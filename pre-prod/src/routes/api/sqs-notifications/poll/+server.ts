import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import AWS from 'aws-sdk';
import { env } from '$env/dynamic/private';

// Configure AWS SQS with explicit credentials
const sqs = new AWS.SQS({
  region: env.AMAZON_AWS_REGION || 'eu-west-1',
  accessKeyId: env.AMAZON_AWS_ACCESS_KEY_ID,
  secretAccessKey: env.AMAZON_AWS_SECRET_ACCESS_KEY,
  httpOptions: {
    timeout: 30000, // 30 seconds timeout
    connectTimeout: 5000 // 5 seconds to establish connection
  },
  maxRetries: 3
});

const QUEUE_URL = env.SQS_QUEUE_URL || 'https://sqs.eu-west-1.amazonaws.com/881471314805/buybox-notifications';

// Interface for SQS message
interface SQSMessage {
  MessageId?: string;
  ReceiptHandle?: string;
  Body?: string;
  Attributes?: Record<string, string>;
  MessageAttributes?: Record<string, any>;
}

// Interface for parsed notification
interface ParsedNotification {
  notificationType: string;
  payloadVersion: string;
  eventTime: string;
  payload: any;
  messageId: string;
  receiptHandle: string;
}

/**
 * Poll SQS queue for new notifications
 * POST /api/sqs-notifications/poll
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    console.log('🔍 Polling SQS queue for notifications...');
    console.log('🔐 AWS Config check:', {
      hasAccessKey: !!env.AMAZON_AWS_ACCESS_KEY_ID,
      hasSecretKey: !!env.AMAZON_AWS_SECRET_ACCESS_KEY,
      region: env.AMAZON_AWS_REGION,
      queueUrl: env.SQS_QUEUE_URL ? 'configured' : 'using default'
    });

    // Receive messages from SQS
    const params = {
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 10, // Get up to 10 messages at once
      WaitTimeSeconds: 1, // Short polling for faster response
      VisibilityTimeout: 30, // Hide message for 30 seconds while processing
      AttributeNames: ['All'] as const
    };

    const result = await sqs.receiveMessage(params).promise();

    if (!result.Messages || result.Messages.length === 0) {
      console.log('📭 No messages found in SQS queue');
      return json({
        success: true,
        notifications: [],
        messageCount: 0
      });
    }

    console.log(`📨 Found ${result.Messages.length} message(s) in SQS queue`);

    const notifications: ParsedNotification[] = [];
    const messagesToDelete: { Id: string; ReceiptHandle: string }[] = [];

    // Process each message
    for (const message of result.Messages) {
      try {
        console.log(`🔍 Processing message ID: ${message.MessageId}`);
        console.log(`📄 Raw message body:`, message.Body?.substring(0, 200) + '...');

        const parsedNotification = await parseMessage(message);
        if (parsedNotification) {
          console.log(`✅ Successfully parsed notification:`, {
            type: parsedNotification.notificationType,
            eventTime: parsedNotification.eventTime,
            payloadKeys: Object.keys(parsedNotification.payload || {}),
            messageId: parsedNotification.messageId
          });

          notifications.push(parsedNotification);

          // Mark message for deletion after successful processing
          messagesToDelete.push({
            Id: parsedNotification.messageId,
            ReceiptHandle: parsedNotification.receiptHandle
          });
        }
      } catch (error) {
        console.error('❌ Error parsing message:', error);
        console.error('📄 Full message body:', message.Body);
        // Continue processing other messages
      }
    }

    // Delete processed messages from queue
    if (messagesToDelete.length > 0) {
      try {
        await sqs.deleteMessageBatch({
          QueueUrl: QUEUE_URL,
          Entries: messagesToDelete
        }).promise();

        console.log(`🗑️ Deleted ${messagesToDelete.length} processed messages from queue`);
      } catch (deleteError) {
        console.error('❌ Error deleting messages from queue:', deleteError);
        // Don't fail the entire request if deletion fails
      }
    }

    console.log(`✅ Successfully processed ${notifications.length} notifications`);

    return json({
      success: true,
      notifications,
      messageCount: notifications.length,
      rawMessageCount: result.Messages.length
    });

  } catch (error: any) {
    console.error('❌ Error polling SQS notifications:', error);

    return json({
      success: false,
      error: error.message || 'Unknown error occurred',
      notifications: [],
      messageCount: 0
    }, { status: 500 });
  }
};

/**
 * Parse an SQS message into a structured notification
 */
async function parseMessage(message: SQSMessage): Promise<ParsedNotification | null> {
  if (!message.Body || !message.MessageId || !message.ReceiptHandle) {
    throw new Error('Invalid message format: missing required fields');
  }

  let messageBody: any;

  try {
    messageBody = JSON.parse(message.Body);
    console.log(`📦 Parsed message body type:`, messageBody.Type || 'direct');
  } catch (error) {
    throw new Error('Invalid JSON in message body');
  }

  // Handle SNS wrapper (Amazon sends notifications via SNS -> SQS)
  let actualNotification = messageBody;

  if (messageBody.Type === 'Notification' && messageBody.Message) {
    console.log(`📬 Unwrapping SNS notification from topic:`, messageBody.TopicArn);
    try {
      actualNotification = JSON.parse(messageBody.Message);
      console.log(`🎯 Actual notification type:`, actualNotification.notificationType);
    } catch (error) {
      throw new Error('Invalid JSON in SNS Message field');
    }
  } else {
    console.log(`📮 Direct notification (not SNS wrapped)`);
  }

  // Validate notification structure (handle both formats)
  const notificationType = actualNotification.NotificationType || actualNotification.notificationType;
  const eventTime = actualNotification.EventTime || actualNotification.eventTime;
  const payloadVersion = actualNotification.PayloadVersion || actualNotification.payloadVersion || '1.0';
  const payload = actualNotification.Payload || actualNotification.payload || {};

  if (!notificationType || !eventTime) {
    console.error(`❌ Invalid notification structure:`, {
      hasType: !!notificationType,
      hasEventTime: !!eventTime,
      keys: Object.keys(actualNotification)
    });
    throw new Error('Invalid notification structure: missing required fields');
  }

  console.log(`🎉 Successfully validated notification:`, {
    type: notificationType,
    version: payloadVersion,
    eventTime: eventTime
  });

  return {
    notificationType,
    payloadVersion,
    eventTime,
    payload,
    messageId: message.MessageId,
    receiptHandle: message.ReceiptHandle
  };
}

/**
 * Get current queue statistics
 * GET /api/sqs-notifications/poll
 */
export const GET: RequestHandler = async () => {
  try {
    const params = {
      QueueUrl: QUEUE_URL,
      AttributeNames: [
        'ApproximateNumberOfMessages',
        'ApproximateNumberOfMessagesNotVisible',
        'ApproximateNumberOfMessagesDelayed',
        'CreatedTimestamp'
      ] as const
    };

    const result = await sqs.getQueueAttributes(params).promise();

    return json({
      success: true,
      queueStats: {
        messagesAvailable: parseInt(result.Attributes?.ApproximateNumberOfMessages || '0'),
        messagesInFlight: parseInt(result.Attributes?.ApproximateNumberOfMessagesNotVisible || '0'),
        messagesDelayed: parseInt(result.Attributes?.ApproximateNumberOfMessagesDelayed || '0'),
        queueCreated: result.Attributes?.CreatedTimestamp,
        queueUrl: QUEUE_URL
      }
    });

  } catch (error: any) {
    console.error('❌ Error getting queue stats:', error);

    return json({
      success: false,
      error: error.message || 'Unknown error occurred'
    }, { status: 500 });
  }
};