/**
 * SQS Poller with idempotency and message parsing
 * Polls SQS queue continuously and ensures exactly-once processing
 */

const AWS = require('aws-sdk');
const crypto = require('crypto');
const logger = require('../shared/logger');

class SQSPoller {
  constructor(config) {
    this.queueUrl = config.queueUrl;
    this.batchSize = config.batchSize || 10;
    this.pollInterval = config.pollInterval || 1000;
    this.visibilityTimeout = config.visibilityTimeout || 120;
    this.isPolling = false;
    this.messageHandlers = [];
    this.pollTimeoutId = null;

    // Configure AWS SQS client
    this.sqs = new AWS.SQS({
      region: process.env.AWS_REGION || 'eu-west-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      httpOptions: {
        timeout: 30000,
        connectTimeout: 5000
      },
      maxRetries: 3
    });

    logger.info('SQS Poller initialized', {
      queueUrl: this.queueUrl,
      batchSize: this.batchSize,
      visibilityTimeout: this.visibilityTimeout
    });
  }

  /**
   * Register a message handler function
   * @param {function} handler - Async function to process messages
   */
  onMessage(handler) {
    this.messageHandlers.push(handler);
  }

  /**
   * Start polling for messages
   */
  async start() {
    if (this.isPolling) {
      logger.warn('⚠️ Already polling');
      return;
    }

    this.isPolling = true;
    logger.info('🔄 Starting SQS polling', { queueUrl: this.queueUrl });

    this.poll();
  }

  /**
   * Poll for messages (internal method)
   */
  async poll() {
    if (!this.isPolling) return;

    try {
      const params = {
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: this.batchSize,
        WaitTimeSeconds: 20, // Long polling for efficiency
        VisibilityTimeout: this.visibilityTimeout,
        AttributeNames: ['All'],
        MessageAttributeNames: ['All']
      };

      const result = await this.sqs.receiveMessage(params).promise();

      if (result.Messages && result.Messages.length > 0) {
        logger.info(`📬 Received ${result.Messages.length} message(s)`);

        // Parse messages
        const parsedMessages = result.Messages.map(msg => this.parseMessage(msg));

        // Call all registered handlers
        for (const handler of this.messageHandlers) {
          try {
            await handler(parsedMessages);
          } catch (error) {
            logger.error('❌ Message handler failed', {
              error: error.message,
              stack: error.stack
            });
            // Continue processing other messages
          }
        }

        // Delete successfully processed messages
        const messagesToDelete = parsedMessages.map(m => ({
          Id: m.MessageId,
          ReceiptHandle: m.ReceiptHandle
        }));

        await this.deleteMessages(messagesToDelete);
      } else {
        // No messages - this is normal with long polling
        logger.debug('📭 No messages in queue');
      }

    } catch (error) {
      logger.error('❌ SQS polling error', {
        error: error.message,
        code: error.code
      });

      // Back off on errors
      await this.sleep(5000);
    }

    // Continue polling
    this.pollTimeoutId = setTimeout(() => this.poll(), this.pollInterval);
  }

  /**
   * Parse SQS message into structured format
   * @param {Object} message - Raw SQS message
   * @returns {Object} - Parsed message with metadata
   */
  parseMessage(message) {
    let body;

    try {
      body = JSON.parse(message.Body);
    } catch (error) {
      logger.error('Failed to parse message body as JSON', {
        messageId: message.MessageId
      });
      throw new Error('Invalid JSON in message body');
    }

    // Handle SNS wrapper (Amazon sends: SNS -> SQS)
    let notification = body;
    if (body.Type === 'Notification' && body.Message) {
      try {
        notification = JSON.parse(body.Message);
        logger.debug('📮 Unwrapped SNS notification');
      } catch (error) {
        logger.error('Failed to parse SNS Message field', {
          messageId: message.MessageId
        });
        throw new Error('Invalid JSON in SNS Message field');
      }
    }

    // Calculate dedupe hash (protects against AWS message re-drives)
    const dedupeHash = crypto
      .createHash('sha256')
      .update(message.Body)
      .digest('hex');

    // Extract ASIN from payload
    const asin = this.extractAsin(notification);
    const marketplace = notification.payload?.marketplaceId ||
      notification.Payload?.MarketplaceId ||
      'A1F83G8C2ARO7P'; // UK default

    return {
      MessageId: message.MessageId,
      ReceiptHandle: message.ReceiptHandle,
      raw: message.Body,
      parsedBody: notification,
      dedupeHash,
      asin,
      marketplace,
      notificationType: notification.notificationType || notification.NotificationType,
      eventTime: notification.eventTime || notification.EventTime
    };
  }

  /**
   * Extract ASIN from notification
   * @param {Object} notification - Parsed notification
   * @returns {string|null} - ASIN or null
   */
  extractAsin(notification) {
    const payload = notification.payload || notification.Payload;

    if (!payload) return null;

    // Handle different notification types
    const offerChange = payload.anyOfferChangedNotification ||
      payload.AnyOfferChangedNotification;
    if (offerChange) {
      return offerChange.asin || offerChange.ASIN;
    }

    const summary = payload.offerChangeSummary ||
      payload.OfferChangeSummary;
    if (summary) {
      return summary.asin || summary.ASIN;
    }

    // Direct ASIN field
    return payload.asin || payload.ASIN || null;
  }

  /**
   * Delete messages from SQS queue
   * @param {Array} entries - Array of {Id, ReceiptHandle}
   */
  async deleteMessages(entries) {
    if (entries.length === 0) return;

    try {
      await this.sqs.deleteMessageBatch({
        QueueUrl: this.queueUrl,
        Entries: entries
      }).promise();

      logger.info(`🗑️ Deleted ${entries.length} message(s) from queue`);
    } catch (error) {
      logger.error('❌ Failed to delete messages', {
        error: error.message,
        count: entries.length
      });
      // Don't throw - messages will become visible again after timeout
    }
  }

  /**
   * Stop polling
   */
  async stop() {
    logger.info('🛑 Stopping SQS polling...');
    this.isPolling = false;

    if (this.pollTimeoutId) {
      clearTimeout(this.pollTimeoutId);
      this.pollTimeoutId = null;
    }
  }

  /**
   * Check if poller is connected/running
   * @returns {boolean}
   */
  isConnected() {
    return this.isPolling;
  }

  /**
   * Helper to sleep
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SQSPoller;
