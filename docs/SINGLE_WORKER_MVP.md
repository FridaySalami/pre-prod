# Single Worker MVP - Notification Queue Processor

## Overview
Start with ONE worker that handles SQS polling → database storage → competitive analysis.
This gets you 24/7 monitoring immediately while keeping complexity low.

## Database Setup (Render.com: `Buybox_notifications`)

### Initial Schema (Minimal, Extensible)
```sql
-- Core notification storage with idempotency
CREATE TABLE IF NOT EXISTS worker_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT UNIQUE NOT NULL,      -- SQS messageId for deduplication
  dedupe_hash TEXT NOT NULL,            -- SHA256(body) for AWS re-drive protection
  asin TEXT,                            -- Extracted for indexing
  marketplace TEXT DEFAULT 'A1F83G8C2ARO7P',  -- UK marketplace
  raw_notification JSONB NOT NULL,
  notification_type TEXT,               -- 'ANY_OFFER_CHANGED', 'PRICING_HEALTH'
  event_time TIMESTAMPTZ,              -- Amazon's event timestamp
  severity TEXT,                        -- 'critical', 'high', 'warning', 'info'
  status TEXT DEFAULT 'new',           -- 'new', 'processing', 'completed', 'failed'
  processed_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  trace_id TEXT,                       -- For distributed tracing
  worker_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Current competitive state per ASIN (UI reads from this!)
CREATE TABLE IF NOT EXISTS current_state (
  asin TEXT NOT NULL,
  marketplace TEXT NOT NULL DEFAULT 'A1F83G8C2ARO7P',
  your_price DECIMAL(10,2),
  market_low DECIMAL(10,2),
  prime_low DECIMAL(10,2),
  your_position INTEGER,
  total_offers INTEGER,
  buy_box_winner BOOLEAN DEFAULT FALSE,
  severity TEXT,                       -- Latest severity assessment
  last_notification_id UUID REFERENCES worker_notifications(id),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (asin, marketplace)
);

-- Worker failures / Dead Letter Queue
CREATE TABLE IF NOT EXISTS worker_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  raw_message JSONB,
  error_type TEXT NOT NULL,
  error_message TEXT,
  stack_trace TEXT,
  failure_count INTEGER DEFAULT 1,
  first_failed_at TIMESTAMPTZ DEFAULT NOW(),
  last_failed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_asin ON worker_notifications(asin, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON worker_notifications(status, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_message_id ON worker_notifications(message_id);
CREATE INDEX IF NOT EXISTS idx_current_state_severity ON current_state(severity) WHERE severity IN ('critical', 'high');
CREATE INDEX IF NOT EXISTS idx_failures_message_id ON worker_failures(message_id);

-- Unique constraint for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_dedupe_hash ON worker_notifications(dedupe_hash);
```

## Worker Architecture (Single Process)

### File Structure
```
workers/
├── notification-processor/
│   ├── index.js              # Main worker entry point
│   ├── sqs-poller.js         # SQS polling with idempotency
│   ├── competitive-analyzer.js # Severity calculation
│   ├── database.js           # Supabase client
│   └── config.js             # Environment configuration
├── shared/
│   ├── logger.js             # Structured logging
│   └── monitoring.js         # Health metrics
└── package.json
```

### Worker Flow
```
┌─────────────────┐
│   SQS Queue     │
│  (AWS)          │
└────────┬────────┘
         │ Long poll (20s)
         ▼
┌─────────────────────────────────────┐
│  Worker: Notification Processor    │
│                                     │
│  1. Poll SQS (MaxMessages: 10)     │
│  2. Validate + Dedupe (hash check) │
│  3. Insert worker_notifications    │
│  4. Calculate severity              │
│  5. Upsert current_state           │
│  6. Delete from SQS                 │
│  7. Handle failures → DLQ table    │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Render.com DB  │
│  (PostgreSQL)   │
└─────────────────┘
```

## Environment Variables (Render.com Worker)

```bash
# Database (Render provides these automatically for attached DB)
DATABASE_URL=postgresql://...  # Auto-populated by Render

# AWS SQS
SQS_QUEUE_URL=https://sqs.eu-west-1.amazonaws.com/881471314805/buybox-notifications
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

# Worker Config
WORKER_ID=notification-processor-1
NODE_ENV=production
VISIBILITY_TIMEOUT=120
MAX_RECEIVE_COUNT=3
POLL_INTERVAL=1000  # 1 second between polls
BATCH_SIZE=10       # Messages per poll
```

## Implementation Code

### `workers/notification-processor/index.js`
```javascript
#!/usr/bin/env node
const SQSPoller = require('./sqs-poller');
const CompetitiveAnalyzer = require('./competitive-analyzer');
const Database = require('./database');
const logger = require('../shared/logger');
const { startHealthServer } = require('../shared/monitoring');

const WORKER_ID = process.env.WORKER_ID || 'notification-processor-1';

async function main() {
  logger.info('🚀 Starting Notification Processor Worker', { workerId: WORKER_ID });

  // Initialize database connection
  const db = new Database();
  await db.connect();

  // Initialize competitive analyzer
  const analyzer = new CompetitiveAnalyzer();

  // Initialize SQS poller
  const poller = new SQSPoller({
    queueUrl: process.env.SQS_QUEUE_URL,
    visibilityTimeout: parseInt(process.env.VISIBILITY_TIMEOUT) || 120,
    batchSize: parseInt(process.env.BATCH_SIZE) || 10,
    pollInterval: parseInt(process.env.POLL_INTERVAL) || 1000
  });

  // Start health check server (required by Render)
  startHealthServer(3000, () => ({
    status: 'healthy',
    workerId: WORKER_ID,
    queueConnected: poller.isConnected(),
    dbConnected: db.isConnected(),
    uptime: process.uptime()
  }));

  // Message handler
  poller.onMessage(async (messages) => {
    for (const message of messages) {
      const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        logger.info('📨 Processing message', { traceId, messageId: message.MessageId });

        // 1. Store raw notification with idempotency
        const notification = await db.storeNotification({
          messageId: message.MessageId,
          dedupeHash: message.dedupeHash,
          rawNotification: message.parsedBody,
          traceId,
          workerId: WORKER_ID
        });

        // 2. Calculate competitive severity
        const analysis = await analyzer.analyze(message.parsedBody);

        // 3. Update current state
        await db.updateCurrentState({
          asin: message.asin,
          marketplace: message.marketplace,
          notificationId: notification.id,
          ...analysis,
          traceId
        });

        // 4. Mark as processed
        await db.markProcessed(notification.id);

        logger.info('✅ Message processed successfully', { 
          traceId, 
          asin: message.asin,
          severity: analysis.severity 
        });

      } catch (error) {
        logger.error('❌ Message processing failed', { 
          traceId, 
          messageId: message.MessageId,
          error: error.message,
          stack: error.stack
        });

        // Store in DLQ table
        await db.storeFailed({
          messageId: message.MessageId,
          rawMessage: message.raw,
          errorType: error.name,
          errorMessage: error.message,
          stackTrace: error.stack
        });

        // Don't delete from SQS - let it retry or go to AWS DLQ
        throw error;
      }
    }
  });

  // Start polling
  await poller.start();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('🛑 SIGTERM received, shutting down gracefully...');
    await poller.stop();
    await db.disconnect();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error('💥 Worker crashed', { error: error.message, stack: error.stack });
  process.exit(1);
});
```

### `workers/notification-processor/sqs-poller.js`
```javascript
const AWS = require('aws-sdk');
const crypto = require('crypto');
const logger = require('../shared/logger');

class SQSPoller {
  constructor(config) {
    this.queueUrl = config.queueUrl;
    this.batchSize = config.batchSize;
    this.pollInterval = config.pollInterval;
    this.visibilityTimeout = config.visibilityTimeout;
    this.isPolling = false;
    this.messageHandlers = [];

    this.sqs = new AWS.SQS({
      region: process.env.AWS_REGION || 'eu-west-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      httpOptions: { timeout: 30000, connectTimeout: 5000 },
      maxRetries: 3
    });
  }

  onMessage(handler) {
    this.messageHandlers.push(handler);
  }

  async start() {
    if (this.isPolling) {
      logger.warn('⚠️ Already polling');
      return;
    }

    this.isPolling = true;
    logger.info('🔄 Starting SQS polling', { queueUrl: this.queueUrl });
    
    this.poll();
  }

  async poll() {
    if (!this.isPolling) return;

    try {
      const params = {
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: this.batchSize,
        WaitTimeSeconds: 20, // Long polling
        VisibilityTimeout: this.visibilityTimeout,
        AttributeNames: ['All']
      };

      const result = await this.sqs.receiveMessage(params).promise();

      if (result.Messages && result.Messages.length > 0) {
        logger.info(`📬 Received ${result.Messages.length} message(s)`);

        const parsedMessages = result.Messages.map(msg => this.parseMessage(msg));

        // Call all registered handlers
        for (const handler of this.messageHandlers) {
          await handler(parsedMessages);
        }

        // Delete successfully processed messages
        await this.deleteMessages(parsedMessages.map(m => ({
          Id: m.MessageId,
          ReceiptHandle: m.ReceiptHandle
        })));
      }

    } catch (error) {
      logger.error('❌ SQS polling error', { error: error.message });
    }

    // Continue polling
    setTimeout(() => this.poll(), this.pollInterval);
  }

  parseMessage(message) {
    const body = JSON.parse(message.Body);
    
    // Handle SNS wrapper (Amazon sends: SNS -> SQS)
    let notification = body;
    if (body.Type === 'Notification' && body.Message) {
      notification = JSON.parse(body.Message);
    }

    // Calculate dedupe hash (protects against AWS re-drives)
    const dedupeHash = crypto
      .createHash('sha256')
      .update(message.Body)
      .digest('hex');

    // Extract ASIN from payload
    const asin = notification.payload?.anyOfferChangedNotification?.asin ||
                 notification.payload?.offerChangeSummary?.asin ||
                 notification.Payload?.ASIN;

    return {
      MessageId: message.MessageId,
      ReceiptHandle: message.ReceiptHandle,
      raw: message.Body,
      parsedBody: notification,
      dedupeHash,
      asin,
      marketplace: notification.payload?.marketplaceId || 'A1F83G8C2ARO7P',
      notificationType: notification.notificationType || notification.NotificationType,
      eventTime: notification.eventTime || notification.EventTime
    };
  }

  async deleteMessages(entries) {
    if (entries.length === 0) return;

    try {
      await this.sqs.deleteMessageBatch({
        QueueUrl: this.queueUrl,
        Entries: entries
      }).promise();

      logger.info(`🗑️ Deleted ${entries.length} messages from queue`);
    } catch (error) {
      logger.error('❌ Failed to delete messages', { error: error.message });
    }
  }

  async stop() {
    logger.info('🛑 Stopping SQS polling...');
    this.isPolling = false;
  }

  isConnected() {
    return this.isPolling;
  }
}

module.exports = SQSPoller;
```

### `workers/notification-processor/competitive-analyzer.js`
```javascript
const logger = require('../shared/logger');

class CompetitiveAnalyzer {
  analyze(notification) {
    // Extract offer data from notification
    const offerData = this.extractOfferData(notification);
    
    if (!offerData) {
      return {
        severity: 'info',
        yourPrice: null,
        marketLow: null,
        primeLow: null,
        totalOffers: 0,
        yourPosition: null,
        buyBoxWinner: false
      };
    }

    // Calculate severity using your existing logic
    const severity = this.calculateSeverity(offerData);

    return {
      severity,
      yourPrice: offerData.yourPrice,
      marketLow: offerData.marketLow,
      primeLow: offerData.primeLow,
      totalOffers: offerData.totalOffers,
      yourPosition: offerData.yourPosition,
      buyBoxWinner: offerData.buyBoxWinner
    };
  }

  extractOfferData(notification) {
    // Handle different notification formats
    const payload = notification.payload || notification.Payload;
    
    if (!payload) return null;

    const offerChange = payload.anyOfferChangedNotification;
    const summary = offerChange?.offerChangeSummary;
    
    if (!summary) return null;

    // Parse offers
    const offers = summary.offers || [];
    const yourSellerId = process.env.AMAZON_SELLER_ID || 'A2D8NG39VURSL3';

    const yourOffer = offers.find(o => o.sellerId === yourSellerId);
    const primeOffers = offers.filter(o => o.isFulfilledByAmazon);

    return {
      asin: offerChange.asin,
      yourPrice: yourOffer?.listingPrice?.amount || null,
      yourPosition: yourOffer ? offers.indexOf(yourOffer) + 1 : null,
      buyBoxWinner: yourOffer?.isBuyBoxWinner || false,
      marketLow: offers[0]?.listingPrice?.amount || null,
      primeLow: primeOffers[0]?.listingPrice?.amount || null,
      totalOffers: offers.length
    };
  }

  calculateSeverity(data) {
    // Based on your existing severity logic from the dashboard
    const { yourPrice, marketLow, yourPosition, totalOffers, buyBoxWinner } = data;

    // Success case
    if (buyBoxWinner || yourPosition <= 3) {
      return 'success';
    }

    // No price data
    if (!yourPrice || !marketLow) {
      return 'info';
    }

    // Calculate price gap
    const gapPct = ((yourPrice - marketLow) / marketLow) * 100;

    // Critical: way off market + many competitors
    if (gapPct >= 50 && totalOffers >= 10 && yourPosition > 10) {
      return 'critical';
    }

    // High: significant gap
    if (gapPct >= 20 && totalOffers >= 5) {
      return 'high';
    }

    // Warning: minor issues
    if (gapPct >= 10 || totalOffers >= 3) {
      return 'warning';
    }

    return 'info';
  }
}

module.exports = CompetitiveAnalyzer;
```

### `workers/notification-processor/database.js`
```javascript
const { createClient } = require('@supabase/supabase-js');
const logger = require('../shared/logger');

class Database {
  constructor() {
    this.client = null;
  }

  async connect() {
    // Render.com provides DATABASE_URL automatically
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY required');
    }

    this.client = createClient(supabaseUrl, supabaseKey);
    logger.info('✅ Database connected');
  }

  async storeNotification({ messageId, dedupeHash, rawNotification, traceId, workerId }) {
    const { data, error } = await this.client
      .from('worker_notifications')
      .insert({
        message_id: messageId,
        dedupe_hash: dedupeHash,
        raw_notification: rawNotification,
        notification_type: rawNotification.notificationType,
        event_time: rawNotification.eventTime,
        asin: rawNotification.payload?.anyOfferChangedNotification?.asin,
        trace_id: traceId,
        worker_id: workerId,
        status: 'processing'
      })
      .select()
      .single();

    if (error) {
      // Check if it's a duplicate (unique constraint violation)
      if (error.code === '23505') {
        logger.warn('⚠️ Duplicate message detected', { messageId, dedupeHash });
        // Fetch existing record
        const { data: existing } = await this.client
          .from('worker_notifications')
          .select()
          .eq('message_id', messageId)
          .single();
        return existing;
      }
      throw error;
    }

    return data;
  }

  async updateCurrentState({ asin, marketplace, notificationId, ...analysis }) {
    const { error } = await this.client
      .from('current_state')
      .upsert({
        asin,
        marketplace,
        your_price: analysis.yourPrice,
        market_low: analysis.marketLow,
        prime_low: analysis.primeLow,
        your_position: analysis.yourPosition,
        total_offers: analysis.totalOffers,
        buy_box_winner: analysis.buyBoxWinner,
        severity: analysis.severity,
        last_notification_id: notificationId,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'asin,marketplace'
      });

    if (error) throw error;
  }

  async markProcessed(notificationId) {
    const { error } = await this.client
      .from('worker_notifications')
      .update({ 
        status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', notificationId);

    if (error) throw error;
  }

  async storeFailed({ messageId, rawMessage, errorType, errorMessage, stackTrace }) {
    const { error } = await this.client
      .from('worker_failures')
      .insert({
        message_id: messageId,
        raw_message: rawMessage,
        error_type: errorType,
        error_message: errorMessage,
        stack_trace: stackTrace
      });

    if (error) {
      logger.error('❌ Failed to store DLQ record', { error: error.message });
    }
  }

  async disconnect() {
    // Supabase client doesn't need explicit disconnect
    logger.info('👋 Database disconnected');
  }

  isConnected() {
    return this.client !== null;
  }
}

module.exports = Database;
```

### `workers/shared/monitoring.js`
```javascript
const express = require('express');
const logger = require('./logger');

function startHealthServer(port, getStatus) {
  const app = express();

  app.get('/health', (req, res) => {
    const status = getStatus();
    const httpCode = status.status === 'healthy' ? 200 : 503;
    res.status(httpCode).json(status);
  });

  app.listen(port, '0.0.0.0', () => {
    logger.info(`🏥 Health server started on port ${port}`);
  });
}

module.exports = { startHealthServer };
```

### `workers/shared/logger.js`
```javascript
function log(level, message, meta = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  }));
}

module.exports = {
  info: (msg, meta) => log('INFO', msg, meta),
  warn: (msg, meta) => log('WARN', msg, meta),
  error: (msg, meta) => log('ERROR', msg, meta)
};
```

## Deployment Steps

### 1. Create Database on Render.com
✅ You've already started this with `Buybox_notifications`

Run the SQL schema from above in the Render.com database console.

### 2. Create Worker Service on Render.com
- Service Type: **Worker**
- Name: `notification-processor`
- Environment: **Node**
- Build Command: `npm ci`
- Start Command: `node workers/notification-processor/index.js`
- Health Check Path: `/health`

### 3. Add Environment Variables
All the variables listed in the "Environment Variables" section above.

### 4. Connect Database
Link the `Buybox_notifications` PostgreSQL database to your worker.

## Testing

### Local Testing
```bash
cd workers/notification-processor
npm test

# Test against LocalStack SQS
npm run test:integration
```

### Send Test Notification
Use your existing `test-notifications.cjs` script to send messages to SQS and verify they appear in the database.

## Success Metrics (Week 1)
- [ ] Worker stays running 24/7
- [ ] All SQS messages processed within 60 seconds
- [ ] Zero duplicate notifications in DB
- [ ] Health endpoint responds
- [ ] `current_state` table updates correctly

## Future Expansion
Once this works, you can add:
- Worker 2: Advanced competitive analysis
- Worker 3: Alert queue manager
- Worker 4: Business intelligence

But start simple and iterate!
