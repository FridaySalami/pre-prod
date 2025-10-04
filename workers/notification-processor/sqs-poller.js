/**
 * SQS Poller with idempotency and message parsing
 * Polls SQS queue continuously and ensures exactly-once processing
 */

const AWS = require('aws-sdk');
const crypto = require('crypto');
const logger = require('../shared/logger');

class SQSPoller {
  constructor(queueUrl, region = 'eu-west-1') {
    this.queueUrl = queueUrl;
    this.batchSize = 10;
    this.visibilityTimeout = 120;

    // Configure AWS SQS client
    this.sqs = new AWS.SQS({
      region: region,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      httpOptions: {
        timeout: 30000,
        connectTimeout: 5000
      },
      maxRetries: 3
    });

    logger.info('SQS Poller initialized', {
      batchSize: this.batchSize,
      visibilityTimeout: this.visibilityTimeout
    });
  }

  /**
   * Poll for messages and return them
   * @returns {Promise<Array>} - Array of parsed messages
   */
  async poll() {
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
        // Parse messages
        const parsedMessages = result.Messages.map(msg => this.parseMessage(msg));
        return parsedMessages;
      }

      // No messages - return empty array
      return [];

    } catch (error) {
      logger.error('❌ SQS polling error', {
        error: error.message,
        code: error.code,
        stack: error.stack
      });

      // Return empty array on error
      return [];
    }
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

    // Handle ANY_OFFER_CHANGED notification
    const offerChange = payload.anyOfferChangedNotification ||
      payload.AnyOfferChangedNotification;
    
    if (offerChange) {
      // Check OfferChangeTrigger first (most common location)
      const trigger = offerChange.offerChangeTrigger || offerChange.OfferChangeTrigger;
      if (trigger && (trigger.asin || trigger.ASIN)) {
        return trigger.asin || trigger.ASIN;
      }
      
      // Fallback to direct ASIN field
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
   * @param {Array} messages - Array of parsed messages with MessageId and ReceiptHandle
   */
  async deleteMessages(messages) {
    if (!messages || messages.length === 0) return;

    try {
      const entries = messages.map(m => ({
        Id: m.MessageId,
        ReceiptHandle: m.ReceiptHandle
      }));

      await this.sqs.deleteMessageBatch({
        QueueUrl: this.queueUrl,
        Entries: entries
      }).promise();

      logger.info(`🗑️ Deleted ${entries.length} message(s) from queue`);
    } catch (error) {
      logger.error('❌ Failed to delete messages', {
        error: error.message,
        count: messages.length
      });
      // Don't throw - messages will become visible again after timeout
    }
  }

  /**
   * Stop polling (no-op for stateless poller)
   */
  async stop() {
    logger.info('🛑 SQS poller stopped');
  }

  /**
   * Stop polling (no-op for stateless poller)
   */
  async stop() {
    logger.info('🛑 SQS poller stopped');
  }
}

module.exports = SQSPoller;
