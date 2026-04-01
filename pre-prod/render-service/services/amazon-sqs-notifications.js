/**
 * Amazon SQS Notification Service for Buy Box Monitoring
 * 
 * Handles real-time notifications from Amazon SP-API via SQS
 * for instant buy box and pricing change alerts
 */

const AWS = require('aws-sdk');

class AmazonSQSService {
  constructor() {
    // Configure AWS SDK with your credentials
    if (!process.env.AMAZON_AWS_ACCESS_KEY_ID || !process.env.AMAZON_AWS_SECRET_ACCESS_KEY) {
      console.warn('⚠️ AWS credentials not configured - SQS operations will fail');
    }

    this.sqs = new AWS.SQS({
      region: process.env.AMAZON_AWS_REGION || 'eu-west-1',
      accessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY
    });

    this.queueUrl = null;
    this.isPolling = false;

    // Notification types we're interested in
    this.supportedNotifications = {
      'PRICING_HEALTH': 'pricing_health',
      'ANY_OFFER_CHANGED': 'any_offer_changed',
      'PRODUCT_TYPE_NAME_CHANGED': 'product_type_changed'
    };
  }

  /**
   * Create or get existing SQS queue for receiving SP-API notifications
   */
  async createNotificationQueue() {
    try {
      // Use a fixed queue name instead of creating new ones
      const queueName = process.env.SQS_QUEUE_NAME || 'buybox-notifications';

      // First try to get the queue URL if it exists
      try {
        const getQueueParams = {
          QueueName: queueName,
          QueueOwnerAWSAccountId: process.env.AWS_ACCOUNT_ID || '881471314805'
        };

        const result = await this.sqs.getQueueUrl(getQueueParams).promise();
        this.queueUrl = result.QueueUrl;
        console.log('✅ Using existing SQS queue:', this.queueUrl);
        return this.queueUrl;
      } catch (getError) {
        // Queue doesn't exist, try to create it
        console.log('Queue not found, attempting to create...');

        const createParams = {
          QueueName: queueName,
          Attributes: {
            'MessageRetentionPeriod': '1209600', // 14 days
            'VisibilityTimeoutSeconds': '60'
          }
        };

        const result = await this.sqs.createQueue(createParams).promise();
        this.queueUrl = result.QueueUrl;

        console.log('✅ SQS queue created:', this.queueUrl);
        return this.queueUrl;
      }
    } catch (error) {
      console.error('❌ Error with SQS queue:', error);

      // If creation fails, try to construct the URL manually
      const queueName = process.env.SQS_QUEUE_NAME || 'buybox-notifications';
      const accountId = process.env.AWS_ACCOUNT_ID || '881471314805';
      const region = process.env.AMAZON_AWS_REGION || 'eu-west-1';

      this.queueUrl = `https://sqs.${region}.amazonaws.com/${accountId}/${queueName}`;
      console.log('⚠️ Using constructed queue URL:', this.queueUrl);
      console.log('⚠️ Make sure AMAZON_AWS_REGION in .env matches your queue region');
      return this.queueUrl;
    }
  }

  /**
   * Set queue URL if queue already exists
   */
  setQueueUrl(queueUrl) {
    this.queueUrl = queueUrl;
    console.log(`🔗 SQS Queue URL set: ${queueUrl}`);
  }

  /**
   * Get queue attributes and ARN (needed for SP-API subscription)
   */
  async getQueueAttributes() {
    if (!this.queueUrl) {
      throw new Error('Queue URL not set. Create queue first.');
    }

    try {
      const params = {
        QueueUrl: this.queueUrl,
        AttributeNames: ['QueueArn', 'Policy']
      };

      const result = await this.sqs.getQueueAttributes(params).promise();
      return {
        queueArn: result.Attributes.QueueArn,
        queueUrl: this.queueUrl,
        policy: result.Attributes.Policy
      };
    } catch (error) {
      console.error('❌ Failed to get queue attributes:', error);
      throw error;
    }
  }

  /**
   * Set queue policy to allow Amazon SP-API to send messages
   */
  async setQueuePolicy() {
    if (!this.queueUrl) {
      throw new Error('Queue URL not set. Create queue first.');
    }

    try {
      const attributes = await this.getQueueAttributes();

      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'AllowSPAPIAccess',
            Effect: 'Allow',
            Principal: {
              AWS: 'arn:aws:iam::437568002678:root' // Amazon SP-API service account
            },
            Action: 'sqs:SendMessage',
            Resource: attributes.queueArn
          }
        ]
      };

      const params = {
        QueueUrl: this.queueUrl,
        Attributes: {
          Policy: JSON.stringify(policy)
        }
      };

      await this.sqs.setQueueAttributes(params).promise();
      console.log('✅ SQS Queue policy updated for SP-API access');

      return attributes.queueArn;
    } catch (error) {
      console.error('❌ Failed to set queue policy:', error);
      throw error;
    }
  }

  /**
   * Start polling for messages from SQS queue
   */
  async startPolling(messageHandler) {
    if (!this.queueUrl) {
      throw new Error('Queue URL not set. Create queue first.');
    }

    if (this.isPolling) {
      console.log('⚠️ Already polling for messages');
      return;
    }

    this.isPolling = true;
    console.log('🚀 Starting SQS message polling...');

    const pollMessages = async () => {
      if (!this.isPolling) return;

      try {
        const params = {
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20, // Long polling
          VisibilityTimeoutSeconds: 60
        };

        const result = await this.sqs.receiveMessage(params).promise();

        if (result.Messages && result.Messages.length > 0) {
          console.log(`📨 Received ${result.Messages.length} notification(s)`);

          for (const message of result.Messages) {
            try {
              await this.processNotification(message, messageHandler);

              // Delete processed message
              await this.sqs.deleteMessage({
                QueueUrl: this.queueUrl,
                ReceiptHandle: message.ReceiptHandle
              }).promise();

            } catch (processError) {
              console.error('❌ Error processing notification:', processError);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error polling SQS:', error);
      }

      // Continue polling
      setTimeout(pollMessages, 1000);
    };

    pollMessages();
  }

  /**
   * Stop polling for messages
   */
  stopPolling() {
    this.isPolling = false;
    console.log('⏹️ Stopped SQS message polling');
  }

  /**
   * Process incoming notification message
   */
  async processNotification(message, messageHandler) {
    try {
      const notification = JSON.parse(message.Body);

      // Check if it's an SNS message (SP-API uses SNS -> SQS)
      let actualNotification = notification;
      if (notification.Type === 'Notification' && notification.Message) {
        actualNotification = JSON.parse(notification.Message);
      }

      console.log('📧 Processing notification:', {
        type: actualNotification.notificationType,
        timestamp: actualNotification.eventTime,
        messageId: message.MessageId
      });

      // Call the message handler with parsed notification
      if (messageHandler) {
        await messageHandler(actualNotification, message);
      }

    } catch (error) {
      console.error('❌ Error parsing notification:', error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    if (!this.queueUrl) {
      return { error: 'Queue not configured' };
    }

    try {
      const params = {
        QueueUrl: this.queueUrl,
        AttributeNames: [
          'ApproximateNumberOfMessages',
          'ApproximateNumberOfMessagesNotVisible',
          'CreatedTimestamp'
        ]
      };

      const result = await this.sqs.getQueueAttributes(params).promise();

      return {
        queueUrl: this.queueUrl,
        messagesAvailable: parseInt(result.Attributes.ApproximateNumberOfMessages),
        messagesInFlight: parseInt(result.Attributes.ApproximateNumberOfMessagesNotVisible),
        createdTimestamp: result.Attributes.CreatedTimestamp,
        isPolling: this.isPolling
      };
    } catch (error) {
      console.error('❌ Error getting queue stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Convenience method - alias for createNotificationQueue
   */
  async createQueue() {
    return await this.createNotificationQueue();
  }

  /**
   * Get the ARN of the current queue
   */
  async getQueueArn() {
    if (!this.queueUrl) {
      await this.createNotificationQueue();
    }

    try {
      const params = {
        QueueUrl: this.queueUrl,
        AttributeNames: ['QueueArn']
      };

      const result = await this.sqs.getQueueAttributes(params).promise();
      console.log('✅ Retrieved queue ARN from AWS:', result.Attributes.QueueArn);
      return result.Attributes.QueueArn;
    } catch (error) {
      console.error('❌ Error getting queue ARN:', error);
      throw error;
    }
  }

  /**
   * Setup queue policy - alias for setQueuePolicy
   */
  async setupQueuePolicy() {
    return await this.setQueuePolicy();
  }

  /**
   * Get stats - alias for getQueueStats
   */
  getStats() {
    // Return synchronous stats
    return {
      messagesReceived: this.stats.messagesReceived,
      messagesProcessed: this.stats.messagesProcessed,
      processingErrors: this.stats.processingErrors,
      lastMessageReceived: this.stats.lastMessageReceived,
      isPolling: this.isPolling,
      queueUrl: this.queueUrl
    };
  }
}

module.exports = { AmazonSQSService };