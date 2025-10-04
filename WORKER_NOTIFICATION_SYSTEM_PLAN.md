# Worker-Based Notification Processing System Plan

## Executive Summary

Transform the current client-side notification polling system into a robust server-side processing pipeline using Render.com workers. This will enable 24/7 notification monitoring, intelligent filtering, and proactive competitive analysis.

## Current System Analysis

### Existing Architecture
- **Frontend Polling**: `src/routes/buy-box-alerts/live/+page.svelte` (lines 1117-1165)
  - Client-side SQS polling every 10 seconds
  - Only active when users have dashboard open
  - Notifications lost when no active sessions

- **Bulk Processing**: `render-service/routes/bulk-scan.js`
  - Manual ASIN scanning with rate limiting
  - Real-time pricing updates during scans
  - Batch processing with Amazon SP-API integration

- **Competitive Analysis**: `src/routes/buy-box-alerts/live/+page.svelte` (lines 347-412)
  - Multi-factor severity calculation
  - Historical tracking and trend analysis
  - Position-based alerting logic

### Current Limitations
1. **Dependency on Active Sessions**: Notifications only processed when dashboard is open
2. **No Background Intelligence**: Missing opportunities for trend analysis
3. **Reactive Approach**: Only responds to notifications, doesn't predict issues
4. **Manual Monitoring**: Requires constant human oversight

## Proposed Worker Architecture

### Worker 1: Notification Ingestion Service
**Purpose**: Continuous SQS polling and initial processing with exactly-once guarantees
**Reference Files**: 
- Current polling logic: `src/routes/buy-box-alerts/live/+page.svelte` (pollNotifications function)
- Rate limiting patterns: `render-service/routes/bulk-scan.js` (RateLimiter usage)

**Responsibilities**:
- Poll SQS queue continuously (24/7) with backpressure control
- Validate notification structure with Zod schema
- Ensure exactly-once processing via messageId + body hash
- Store raw notifications in database with trace_id
- Fan out to per-ASIN work queues for serialized processing
- Handle dead letter queue and poison pill detection
- Monitor queue depth and oldest message age

**Key Features**:
```javascript
// Production-ready ingestion with idempotency
- SQS VisibilityTimeout: 120s (2× worst-case processing time)
- Idempotency: messageId + SHA256(body) for AWS re-drive protection
- Schema validation: Zod validator, malformed → DLQ immediately
- Backpressure: Jittered exponential backoff on empty receives
- Per-ASIN serialization: marketplace:ASIN partition key
- Observability: trace_id, metrics (processed/sec, failures/sec, queue lag)
- Dead letter handling: maxReceiveCount=3, forward to worker_failures table
```

**SQS Configuration**:
```javascript
// Required SQS settings
VisibilityTimeout: 120,           // 2× processing time
maxReceiveCount: 3,               // Send to DLQ after 3 failures
MessageRetentionPeriod: 1209600,  // 14 days
KmsEncryption: true               // Encrypt messages at rest
```

### Worker 2: Competitive Analysis Engine
**Purpose**: Apply business logic and calculate notification priority
**Reference Files**:
- Severity calculation: `src/routes/buy-box-alerts/live/+page.svelte` (getCompetitiveSeverity function, lines 347-412)
- Enhanced alerting: `src/routes/buy-box-alerts/live/+page.svelte` (getEnhancedAlertLevel function, lines 650-722)
- Cost calculator integration: `render-service/routes/bulk-scan.js` (CostCalculator usage)

**Responsibilities**:
- Calculate competitive severity using existing logic
- Enrich with cost and margin analysis
- Apply historical trend analysis
- Determine notification priority and routing
- Update competitive intelligence database

**Priority Classification (Deterministic Truth Table)**:
```javascript
// Tightened severity logic with value-weighted overrides
CRITICAL: 
  - offers ≥ 10 AND gap_pct ≥ 50 AND !buyBoxWinner AND position ≥ 80th percentile
  - estimated_daily_sales > threshold (prevent noise from low-value products)

HIGH: 
  - offers ≥ 5 AND gap_pct ≥ 20 AND !buyBoxWinner
  - buyBoxWinner AND margin_at_current_price < 10% (unsustainable)

WARNING: 
  - offers ≥ 3 AND gap_pct ≥ 10 AND position > 3
  - margin_at_market_low < 5% (approaching break-even)

SUCCESS: 
  - offers < 3 OR buyBoxWinner OR (position ≤ 3 AND gap_pct ≤ 5)

// Value-weighted downgrade: if estimated_daily_sales < low_threshold, CRITICAL → HIGH
```

**Cost & Margin Enrichment**:
```javascript
// Enhanced analysis with profitability awareness
- margin_at_market_low: Profit % if we matched lowest price
- margin_at_prime_low: Profit % if we matched lowest Prime price  
- min_viable_price: Break-even price including all fees
- recommended_prices: Only suggest prices above viability threshold
- risk_flags: ["below-cost", "margin-squeeze", "race-to-bottom"]
```

### Worker 3: Alert Queue Manager
**Purpose**: Manage notification lifecycle and delivery
**Reference Files**:
- Tab filtering logic: `src/routes/buy-box-alerts/live/+page.svelte` (filterNotificationsByTab function)
- Grouping logic: `src/routes/buy-box-alerts/live/+page.svelte` (groupNotificationsBySeverity function)

**Responsibilities**:
- Maintain priority-based notification queues
- Aggregate multiple notifications for same ASIN
- Handle notification lifecycle (new → reviewing → resolved)
- Deliver notifications to dashboard
- Manage alert escalation policies

**Queue Structure with Deduplication**:
```
HIGH_PRIORITY_QUEUE:
- Critical: Immediate SSE push + optional mobile alert
- High: Real-time dashboard update
- Fingerprint: asin|marketplace|critical (prevents spam)
- Snooze support: 30min default, updates existing record

STANDARD_QUEUE:
- Warning: Batched dashboard updates (every 5min)
- Daily digest emails (grouped by ASIN)
- Fingerprint: asin|marketplace|warning

BACKGROUND_QUEUE:
- Stable/Success: Historical tracking only
- Business intelligence updates
- Weekly rollup processing
```

**Alert Lifecycle Management**:
```javascript
// Prevent alert spam with fingerprinting
fingerprint = `${asin}|${marketplace}|${severity_type}`
- New alert within 30min of same fingerprint → UPDATE existing
- Snooze functionality: snooze_until timestamp
- Auto-resolve: Mark delivered alerts as resolved after 24h
- Escalation: Unacknowledged CRITICAL → HIGH after 1h
```

### Worker 4: Business Intelligence Processor
**Purpose**: Long-term analysis and pattern recognition
**Reference Files**:
- Historical tracking: `src/routes/buy-box-alerts/live/+page.svelte` (updateHistoricalData function, lines 415-446)
- Trend analysis: `src/routes/buy-box-alerts/live/+page.svelte` (checkTrendAlerts function, lines 499-539)
- Price leadership analysis: `src/routes/buy-box-alerts/live/+page.svelte` (analyzePriceLeadership function, lines 592-647)

**Responsibilities**:
- Maintain 30-day competitive history per ASIN
- Detect market trends and competitor patterns
- Generate weekly competitive intelligence reports
- Identify pricing opportunities and threats
- Feed insights back to Analysis Engine

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Deliverables**:
- Worker 1: SQS ingestion with exactly-once processing
- Database schema with idempotency and current_state table
- Dead letter queue handling and poison pill detection
- Health monitoring and observability foundation
- Zod schema validation for notifications

**Files to Create**:
- `workers/notification-ingestion/index.js`
- `workers/shared/database-client.js`
- `workers/shared/monitoring.js`
- `workers/shared/schema-validator.js` (Zod schemas)
- `workers/health-server/index.js` (thin HTTP for health checks)

**Critical Features**:
```javascript
// Exactly-once processing
- messageId + SHA256(body) deduplication
- SQS VisibilityTimeout: 120s
- maxReceiveCount: 3 → DLQ
- Per-ASIN work queue serialization

// Observability
- trace_id propagation through all stages  
- Metrics: processed/sec, failures/sec, queue_lag_seconds
- Health endpoint: queue depth, oldest message age, DLQ count
```

**References**:
- Polling logic from: `src/routes/buy-box-alerts/live/+page.svelte` (lines 1117-1165)
- Rate limiting from: `render-service/routes/bulk-scan.js` (rateLimiter usage)

### Phase 2: Core Processing (Week 3-4)
**Deliverables**:
- Worker 2: Competitive analysis with cost/margin enrichment
- Worker 3: Alert queue management with deduplication
- SSE endpoint for real-time dashboard updates
- current_state table integration with UI

**Files to Create**:
- `workers/competitive-analysis/index.js`
- `workers/queue-manager/index.js`  
- `workers/shared/competitive-logic.ts` (extracted from frontend)
- `workers/shared/cost-calculator.js` (from bulk-scan.js)
- `src/routes/api/notifications/stream/+server.js` (SSE endpoint)

**Critical Features**:
```javascript
// Analysis Engine
- Deterministic severity truth table
- Margin-aware recommendations (never suggest below min_viable_price)
- Value-weighted severity (downgrade CRITICAL for low daily sales)
- Per-ASIN serialization with FOR UPDATE SKIP LOCKED

// Queue Management  
- Fingerprint-based deduplication (asin|marketplace|type)
- Snooze functionality with snooze_until timestamps
- Alert lifecycle: new → delivered → resolved
```

**References**:
- Severity logic from: `src/routes/buy-box-alerts/live/+page.svelte` (lines 347-412, 650-722)
- Cost calculator from: `render-service/routes/bulk-scan.js`

### Phase 3: Intelligence & Optimization (Week 5-6)
**Deliverables**:
- Worker 4: Business intelligence with trend detection
- Advanced alerting patterns and escalation
- Performance optimization and autoscaling
- Comprehensive testing and chaos engineering

**Files to Create**:
- `workers/business-intelligence/index.js`
- `workers/shared/trend-analysis.js`
- `src/routes/api/worker-status/+server.js` (dashboard integration)
- `tests/integration/worker-chaos.test.js`
- `runbooks/queue-on-fire.md` and `runbooks/dlq-rising.md`

**Critical Features**:
```javascript
// Business Intelligence
- 30-day competitive history per ASIN
- "Creeping undercut" detection (≤£0.05 drops every N minutes)
- Leader/follower pattern recognition
- Weekly rollups and profit-aware target recommendations

// Production Hardening
- Circuit breakers on external API calls
- Autoscale triggers on queue depth
- Comprehensive integration testing with LocalStack
- Load testing: 10k messages, verify no dupes, oldest age <60s
```

**References**:
- Historical tracking from: `src/routes/buy-box-alerts/live/+page.svelte` (lines 415-539)
- Grouping logic from: `src/routes/buy-box-alerts/live/+page.svelte` (grouping functions)

## Database Schema Extensions

### New Tables
```sql
-- Worker communication and state management
CREATE TABLE worker_notifications (
  id UUID PRIMARY KEY,
  message_id TEXT UNIQUE,           -- SQS messageId for idempotency
  asin TEXT,                        -- Extracted ASIN for indexing
  marketplace TEXT,                 -- Marketplace ID
  dedupe_hash TEXT,                 -- Hash of body for duplicate detection
  raw_notification JSONB,
  processed_at TIMESTAMP,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  event_time TIMESTAMPTZ,           -- Original Amazon event time
  severity TEXT,
  priority INTEGER,
  status TEXT, -- 'new', 'processing', 'completed', 'failed'
  worker_id TEXT,
  trace_id TEXT,                    -- For observability
  created_at TIMESTAMP DEFAULT NOW()
);

-- Current state snapshot per ASIN (UI reads from this, not event log)
CREATE TABLE current_state (
  asin TEXT,
  marketplace TEXT,
  your_price DECIMAL,
  market_low DECIMAL,
  prime_low DECIMAL,
  your_position INTEGER,
  total_offers INTEGER,
  buy_box_winner BOOLEAN,
  severity TEXT,
  margin_at_market_low DECIMAL,
  margin_at_prime_low DECIMAL,
  min_viable_price DECIMAL,
  estimated_daily_sales INTEGER,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (asin, marketplace)
);

-- Competitive intelligence historical data
CREATE TABLE competitive_history (
  id UUID PRIMARY KEY,
  asin TEXT,
  marketplace TEXT,
  timestamp TIMESTAMPTZ,
  your_price DECIMAL,
  market_low DECIMAL,
  your_position INTEGER,
  total_offers INTEGER,
  buy_box_winner BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Alert queues and escalation with deduplication
CREATE TABLE alert_queues (
  id UUID PRIMARY KEY,
  notification_id UUID REFERENCES worker_notifications(id),
  fingerprint TEXT,                 -- asin|marketplace|type for deduplication
  queue_type TEXT, -- 'high_priority', 'standard', 'background'
  scheduled_delivery TIMESTAMP,
  delivered_at TIMESTAMP,
  snooze_until TIMESTAMPTZ,         -- Alert snoozing support
  status TEXT, -- 'queued', 'delivered', 'failed', 'snoozed'
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (fingerprint, queue_type)
);

-- Worker failures and dead letter queue tracking
CREATE TABLE worker_failures (
  id UUID PRIMARY KEY,
  message_id TEXT,
  error_type TEXT,
  error_message TEXT,
  raw_message JSONB,
  worker_id TEXT,
  failure_count INTEGER DEFAULT 1,
  first_failed_at TIMESTAMPTZ DEFAULT NOW(),
  last_failed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-ASIN work serialization queue
CREATE TABLE asin_work_queue (
  id UUID PRIMARY KEY,
  partition_key TEXT,               -- marketplace:asin
  notification_id UUID REFERENCES worker_notifications(id),
  status TEXT DEFAULT 'pending',    -- 'pending', 'processing', 'completed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX ON worker_notifications (message_id);
CREATE INDEX ON worker_notifications (asin, marketplace);
CREATE INDEX ON worker_notifications (status, created_at);
CREATE INDEX ON competitive_history (asin, timestamp DESC);
CREATE INDEX ON alert_queues (queue_type, scheduled_delivery);
CREATE INDEX ON alert_queues (fingerprint, queue_type) WHERE status IN ('queued','delivered');
CREATE INDEX ON current_state (asin, marketplace);
CREATE INDEX ON asin_work_queue (partition_key, status);
```

## Integration with Existing Systems

### Dashboard Updates
**File**: `src/routes/buy-box-alerts/live/+page.svelte`

**Changes Needed**:
1. **Replace client polling** (lines 1117-1165) with Server-Sent Events (SSE) connection
2. **Read from current_state table** instead of processing raw notifications
3. **Add worker status monitoring** dashboard showing queue health
4. **Preserve notification management** (acknowledge, snooze, mark as handled)
5. **Add reconnection logic** with "since last cursor" support for offline periods

**SSE Implementation**:
```javascript
// Replace polling with SSE stream
const eventSource = new EventSource('/api/notifications/stream');
eventSource.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  // Update UI with processed notification from current_state
  updateNotificationState(notification);
};

// Handle reconnection with cursor
eventSource.onerror = () => {
  // Reconnect with last-event-id for gap recovery
  setTimeout(() => connectSSE(lastEventId), 5000);
};
```

### API Enhancements
**New Endpoints Needed**:
- `GET /api/notifications/stream` - SSE endpoint with last-event-id support
- `GET /api/notifications/prioritized?since=cursor` - Get processed notifications with pagination
- `POST /api/notifications/acknowledge` - Mark notifications as handled/snoozed
- `GET /api/worker-status` - Monitor worker health, queue depth, DLQ count
- `GET /api/competitive-intelligence/trends/:asin` - Historical data for sparklines
- `GET /api/health` - Overall system health endpoint

**Health Monitoring Endpoint**:
```javascript
// /api/worker-status response structure
{
  "ingestion": {
    "queue_depth": 45,
    "oldest_message_age_seconds": 12,
    "last_heartbeat": "2025-10-02T14:30:00Z",
    "dlq_count": 2,
    "processed_per_minute": 150
  },
  "analysis": {
    "backlog_count": 8,
    "avg_processing_time_ms": 850,
    "last_heartbeat": "2025-10-02T14:30:05Z"
  },
  "overall_health": "healthy" | "degraded" | "critical"
}
```

### Cost Calculator Integration
**File**: `render-service/routes/bulk-scan.js` (CostCalculator class)

**Worker Integration**:
- Extract cost calculation logic for use in Worker 2
- Add margin-based prioritization to competitive analysis
- Include profitability impact in notification severity

## Render.com Deployment Strategy

### Worker Services Configuration
```yaml
# render.yaml - Production-ready worker configuration
services:
  - type: worker
    name: notification-ingestion
    env: node
    buildCommand: npm ci
    startCommand: node workers/notification-ingestion/index.js
    healthCheckPath: /health
    autoDeploy: true
    envVars:
      - key: SQS_URL
        sync: false
      - key: DLQ_URL  
        sync: false
      - key: VISIBILITY_TIMEOUT
        value: "120"
      - key: MAX_RECEIVE_COUNT
        value: "3"
      - key: WORKER_TYPE
        value: ingestion
    scaling:
      minInstances: 1
      maxInstances: 5

  - type: worker
    name: competitive-analysis
    env: node
    buildCommand: npm ci
    startCommand: node workers/competitive-analysis/index.js
    healthCheckPath: /health
    autoDeploy: true
    envVars:
      - key: WORKER_TYPE
        value: analysis
    scaling:
      minInstances: 1
      maxInstances: 3

  - type: worker
    name: queue-manager
    env: node
    buildCommand: npm ci
    startCommand: node workers/queue-manager/index.js
    healthCheckPath: /health
    autoDeploy: true
    envVars:
      - key: WORKER_TYPE
        value: queue
    scaling:
      minInstances: 1
      maxInstances: 2

  - type: worker
    name: business-intelligence
    env: node
    buildCommand: npm ci
    startCommand: node workers/business-intelligence/index.js
    healthCheckPath: /health
    autoDeploy: true
    envVars:
      - key: WORKER_TYPE
        value: intelligence
    scaling:
      minInstances: 1
      maxInstances: 1

  # Thin HTTP service for health checks on workers
  - type: web
    name: worker-health-api
    env: node
    buildCommand: npm ci
    startCommand: node workers/health-server/index.js
    envVars:
      - key: PORT
        value: "10000"
```

### Security & IAM Configuration
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:ChangeMessageVisibility",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "arn:aws:sqs:region:account:notification-queue"
    },
    {
      "Effect": "Allow", 
      "Action": [
        "sqs:SendMessage"
      ],
      "Resource": "arn:aws:sqs:region:account:notification-dlq"
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt",
        "kms:GenerateDataKey"
      ],
      "Resource": "arn:aws:kms:region:account:key/key-id"
    }
  ]
}
```

### Cost Analysis
**Monthly Render.com Costs (Estimated)**:
- 4 × Small Workers ($7/month each) = $28/month
- Database storage increase = ~$5/month
- **Total additional cost**: ~$33/month

**ROI Benefits**:
- 24/7 monitoring coverage
- Faster competitive response times
- Reduced manual monitoring overhead
- Historical intelligence for better decision making
- Proactive threat detection

## Risk Mitigation

### Technical Risks
1. **Worker Failures**: Implement health checks and auto-restart
2. **Message Loss**: Use dead letter queues and retry mechanisms
3. **Performance**: Monitor processing times and scale workers as needed
4. **Data Consistency**: Implement proper transaction handling

### Business Continuity
1. **Fallback to Client Polling**: Keep existing code as backup
2. **Manual Override**: Allow dashboard to force refresh from SQS
3. **Monitoring**: Alert if workers are down for >5 minutes
4. **Gradual Rollout**: Phase implementation to minimize risk

## Success Metrics

### Technical KPIs (Tight Numbers)
- **P99 Ingest→State Latency**: ≤20s (goal), ≤30s (max SLA)
- **Oldest Message Age**: ≤60s steady state, alert if >120s
- **System Uptime**: >99.5% worker availability per month
- **Duplicate Processing Rate**: <0.1% (idempotency working correctly)
- **False Positive CRITICAL Rate**: <3% (severity algorithm accuracy)
- **UI Freshness**: SSE stream gap ≤5s from current_state write
- **DLQ Growth Rate**: <0.05% of total messages (poison pill detection)

### Business KPIs
- **Competitive Response Time**: Reduce by 50% (currently reactive → proactive)
- **Monitoring Coverage**: 24/7 vs current business hours only
- **Manual Monitoring Reduction**: 70% decrease in required oversight
- **Weekly Intelligence Reports**: Automated competitive trend analysis
- **Alert Noise Reduction**: 60% fewer false positives via value-weighting

### Observability Requirements
```javascript
// Metrics to track (Prometheus format)
worker_notifications_processed_total{worker_id, status}
worker_queue_depth_current{queue_type}
worker_oldest_message_age_seconds{queue_type}
worker_processing_duration_seconds{worker_id, p50, p99}
worker_dlq_messages_total{error_type}
worker_heartbeat_timestamp{worker_id}
sse_stream_gap_seconds{connection_id}
```

## Testing Strategy

### Unit Testing
```javascript
// Schema validation edge cases
- Malformed JSON → DLQ immediately
- Missing required fields → DLQ with error_type
- Valid structure but invalid ASIN format
- Empty arrays, null values, type mismatches

// Severity calculation determinism  
- Boundary conditions: exactly 50% gap, 20% gap, 10% gap
- Edge cases: no Buy Box winner, single offer, your offer missing
- Value weighting: low daily sales should downgrade CRITICAL → HIGH
```

### Integration Testing
```javascript
// LocalStack SQS with canned SP-API payloads
- Send 100 test notifications, verify 100 in current_state
- Kill worker mid-process, restart, verify no duplicates
- Send malformed message, verify DLQ routing
- Test visibility timeout: delay processing >120s, verify re-delivery

// Database consistency
- Concurrent ASIN processing with FOR UPDATE SKIP LOCKED
- current_state updates are atomic
- Alert fingerprinting prevents duplicates within 30min window
```

### Load Testing  
```javascript
// Production simulation
- Fire 10,000 notifications over 30 minutes
- Verify oldest message age stays <60s throughout
- No duplicate processing (idempotency check)
- All workers maintain heartbeat
- SSE streams deliver updates within 5s of current_state write
```

### Chaos Engineering
```javascript
// Failure scenarios to test
- Kill ingestion worker during SQS receive → message returns to queue
- Database connection drops → exponential backoff and reconnect  
- SQS DLQ fills up → alert escalation
- Analysis worker OOMs → restart and resume from queue
- Network partition → workers handle isolation gracefully
```

## Runbooks

### "Queue's on Fire" Runbook
```markdown
## Symptoms
- Oldest message age >300s
- Queue depth growing exponentially  
- Multiple workers showing unhealthy

## Immediate Actions
1. Check worker health: GET /api/worker-status
2. Scale ingestion workers: render deploy --replicas 5
3. Check DLQ count: if >100, investigate poison pills
4. Monitor database connections: ensure pool not exhausted

## Root Cause Investigation
- CloudWatch SQS metrics: ApproximateNumberOfMessages trend
- Worker logs: error patterns, processing times
- Database slow query log: identify bottlenecks
```

### "DLQ Rising" Runbook  
```markdown
## Symptoms
- DLQ message count increasing
- worker_failures table growing
- Specific error patterns in logs

## Immediate Actions
1. Query worker_failures grouped by error_type
2. If schema validation errors: check for SP-API format changes
3. If timeout errors: consider increasing VisibilityTimeout
4. If poison pills: isolate and manually inspect malformed messages

## Prevention
- Add new test cases for identified failure patterns
- Update schema validation if Amazon changes notification format
- Consider pre-filtering known problematic message types
```

## File References Summary

### Existing Files to Study
1. **`src/routes/buy-box-alerts/live/+page.svelte`**
   - Polling logic (lines 1117-1165)
   - Severity calculation (lines 347-412, 650-722, 1008-1024)
   - Historical tracking (lines 415-539)
   - UI grouping and filtering logic

2. **`render-service/routes/bulk-scan.js`**
   - Rate limiting patterns
   - Amazon SP-API integration
   - Cost calculator usage
   - Batch processing architecture

### New Files to Create
1. **Worker Services**: 4 main worker applications
2. **Shared Libraries**: Database client, monitoring, competitive logic
3. **API Extensions**: Worker status and intelligence endpoints
4. **Database Migrations**: New tables for worker communication

## Next Steps

1. **Review and Approve Plan**: Stakeholder sign-off on architecture
2. **Environment Setup**: Configure Render.com worker environments
3. **Phase 1 Development**: Start with basic ingestion worker
4. **Testing Strategy**: Develop worker testing and monitoring
5. **Gradual Deployment**: Implement phases with rollback capability

---

**Plan Version**: 1.0  
**Created**: October 2, 2025  
**Review Date**: October 9, 2025  
**Stakeholders**: Development Team, Business Operations