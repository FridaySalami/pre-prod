/**
 * Notification Processor Worker - Main Entry Point
 * 
 * Unified worker that:
 * 1. Polls SQS queue for notifications
 * 2. Stores notifications in database
 * 3. Analyzes competitive data
 * 4. Updates current state for UI
 * 5. Provides health endpoint for Render
 */

const logger = require('../shared/logger');
const { startHealthServer } = require('../shared/monitoring');
const Database = require('./database');
const SQSPoller = require('./sqs-poller');
const CompetitiveAnalyzer = require('./competitive-analyzer');

// Configuration
const CONFIG = {
  workerId: process.env.WORKER_ID || 'notification-processor-1',
  healthPort: parseInt(process.env.HEALTH_PORT || '3000'),
  sqsQueueUrl: process.env.SQS_QUEUE_URL,
  awsRegion: process.env.AWS_REGION || 'eu-west-1',
  pollInterval: parseInt(process.env.POLL_INTERVAL || '1000'), // 1 second between polls
  maxConsecutiveErrors: parseInt(process.env.MAX_CONSECUTIVE_ERRORS || '10')
};

class NotificationWorker {
  constructor() {
    this.config = CONFIG;
    this.isRunning = false;
    this.consecutiveErrors = 0;
    this.stats = {
      processed: 0,
      duplicates: 0,
      errors: 0,
      startTime: new Date()
    };

    // Initialize components
    this.database = new Database();
    this.poller = new SQSPoller(CONFIG.sqsQueueUrl, CONFIG.awsRegion);
    this.analyzer = new CompetitiveAnalyzer();

    logger.info('Worker initialized', {
      workerId: this.config.workerId,
      queueUrl: this.config.sqsQueueUrl,
      region: this.config.awsRegion
    });
  }

  /**
   * Start the worker
   */
  async start() {
    logger.info('🚀 Starting notification processor worker', {
      workerId: this.config.workerId
    });

    // Validate configuration
    if (!this.config.sqsQueueUrl) {
      throw new Error('SQS_QUEUE_URL environment variable is required');
    }

    // Connect to database
    await this.database.connect();

    // Start health server
    const healthApp = startHealthServer(
      this.config.healthPort,
      () => this.getHealthStatus()
    );

    logger.info('✅ Health server started', {
      port: this.config.healthPort
    });

    // Start main processing loop
    this.isRunning = true;
    await this.processLoop();
  }

  /**
   * Main processing loop
   */
  async processLoop() {
    while (this.isRunning) {
      try {
        // Poll for messages
        const messages = await this.poller.poll();

        if (messages.length === 0) {
          // No messages, continue polling
          await this.sleep(this.config.pollInterval);
          continue;
        }

        logger.info('📬 Received messages', {
          count: messages.length
        });

        // Process each message
        for (const message of messages) {
          try {
            await this.processMessage(message);
            this.consecutiveErrors = 0; // Reset error counter on success
          } catch (error) {
            logger.error('❌ Error processing message', {
              error: error.message,
              stack: error.stack,
              MessageId: message.MessageId
            });

            // Store in dead letter queue
            await this.handleFailedMessage(message, error);
            this.stats.errors++;
          }
        }

        // Delete successfully processed messages
        await this.poller.deleteMessages(messages);

      } catch (error) {
        this.consecutiveErrors++;
        logger.error('❌ Error in processing loop', {
          error: error.message,
          stack: error.stack,
          consecutiveErrors: this.consecutiveErrors
        });

        // Stop if too many consecutive errors
        if (this.consecutiveErrors >= this.config.maxConsecutiveErrors) {
          logger.error('🛑 Too many consecutive errors, stopping worker', {
            maxErrors: this.config.maxConsecutiveErrors
          });
          this.isRunning = false;
          process.exit(1);
        }

        // Wait before retrying
        await this.sleep(5000);
      }
    }
  }

  /**
   * Process a single message
   * @param {Object} message - Parsed message from SQS
   */
  async processMessage(message) {
    const { asin, parsedBody, dedupeHash } = message;

    logger.info('Processing notification', {
      asin,
      dedupeHash: dedupeHash.substring(0, 12),
      MessageId: message.MessageId
    });

    // Analyze competitive data
    const analysis = this.analyzer.analyze(parsedBody);

    logger.info('Analysis complete', {
      asin,
      severity: analysis.severity,
      yourPrice: analysis.yourPrice,
      marketLow: analysis.marketLow,
      position: analysis.yourPosition
    });

    // Store notification in database
    const isDuplicate = await this.database.storeNotification({
      asin,
      notification_data: parsedBody,
      dedupe_hash: dedupeHash,
      severity: analysis.severity,
      metadata: {
        yourPrice: analysis.yourPrice,
        marketLow: analysis.marketLow,
        primeLow: analysis.primeLow,
        totalOffers: analysis.totalOffers,
        yourPosition: analysis.yourPosition,
        buyBoxWinner: analysis.buyBoxWinner
      }
    });

    if (isDuplicate) {
      logger.debug('Duplicate notification ignored', { asin, dedupeHash });
      this.stats.duplicates++;
      return;
    }

    // Update current state for UI
    await this.database.updateCurrentState({
      asin,
      severity: analysis.severity,
      your_price: analysis.yourPrice,
      market_low: analysis.marketLow,
      prime_low: analysis.primeLow,
      total_offers: analysis.totalOffers,
      your_position: analysis.yourPosition,
      buy_box_winner: analysis.buyBoxWinner,
      last_notification_data: parsedBody
    });

    this.stats.processed++;
    logger.info('✅ Notification processed successfully', {
      asin,
      severity: analysis.severity,
      totalProcessed: this.stats.processed
    });
  }

  /**
   * Handle failed message by storing in DLQ
   * @param {Object} message - Failed message
   * @param {Error} error - Error that occurred
   */
  async handleFailedMessage(message, error) {
    try {
      await this.database.storeFailed({
        asin: message.asin || 'unknown',
        notification_data: message.parsedBody,
        error_message: error.message,
        error_stack: error.stack
      });

      logger.info('💀 Failed message stored in DLQ', {
        asin: message.asin,
        error: error.message
      });
    } catch (dlqError) {
      logger.error('❌ Failed to store in DLQ', {
        error: dlqError.message,
        originalError: error.message
      });
    }
  }

  /**
   * Get health status for health endpoint
   * @returns {Object} - Health status
   */
  getHealthStatus() {
    const uptimeSeconds = Math.floor((Date.now() - this.stats.startTime) / 1000);

    return {
      healthy: this.isRunning && this.consecutiveErrors < this.config.maxConsecutiveErrors,
      workerId: this.config.workerId,
      uptime: uptimeSeconds,
      stats: {
        processed: this.stats.processed,
        duplicates: this.stats.duplicates,
        errors: this.stats.errors,
        consecutiveErrors: this.consecutiveErrors
      }
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('🛑 Shutting down worker gracefully...', {
      workerId: this.config.workerId
    });

    this.isRunning = false;

    // Wait for current processing to complete
    await this.sleep(2000);

    // Close database connections
    await this.database.close();

    logger.info('✅ Worker shutdown complete', {
      finalStats: this.stats
    });

    process.exit(0);
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
(async () => {
  const worker = new NotificationWorker();

  // Handle graceful shutdown
  process.on('SIGTERM', () => worker.shutdown());
  process.on('SIGINT', () => worker.shutdown());

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('💥 Uncaught exception', {
      error: error.message,
      stack: error.stack
    });
    worker.shutdown();
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 Unhandled rejection', {
      reason: reason?.toString(),
      promise: promise?.toString()
    });
  });

  // Start the worker
  try {
    await worker.start();
  } catch (error) {
    logger.error('💥 Fatal error starting worker', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
})();
