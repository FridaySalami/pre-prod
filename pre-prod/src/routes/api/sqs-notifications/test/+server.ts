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

/**
 * Send test notifications to SQS queue for development/testing
 * POST /api/sqs-notifications/test
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    console.log('🧪 Sending test notification to SQS queue...');

    // Sample notification that mimics Amazon SP-API format
    const testNotification = {
      notificationType: 'ANY_OFFER_CHANGED',
      payloadVersion: '1.0',
      eventTime: new Date().toISOString(),
      payload: {
        anyOfferChangedNotification: {
          sellerId: 'A2D8NG39VURSL3', // Your seller ID
          marketplaceId: 'A1F83G8C2ARO7P',
          asin: `B${Math.random().toString(36).substr(2, 9).toUpperCase()}`, // Random test ASIN
          itemCondition: 'New',
          timeOfOfferChange: new Date().toISOString(),
          offerChangeTrigger: {
            marketplaceId: 'A1F83G8C2ARO7P',
            asin: `B${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            itemCondition: 'New',
            timeOfOfferChange: new Date().toISOString()
          },
          summary: {
            numberOfOffers: [
              {
                condition: 'New',
                fulfillmentChannel: 'Amazon',
                offerCount: Math.floor(Math.random() * 8) + 1 // Random 1-8 offers
              }
            ],
            buyBoxPrices: [
              {
                condition: 'New',
                fulfillmentChannel: 'Amazon',
                listingPrice: {
                  currencyCode: 'GBP',
                  amount: parseFloat((Math.random() * 50 + 10).toFixed(2)) // Random £10-60
                },
                shipping: {
                  currencyCode: 'GBP',
                  amount: Math.random() > 0.7 ? parseFloat((Math.random() * 5).toFixed(2)) : 0.00 // Sometimes shipping cost
                }
              }
            ],
            buyBoxEligibleOffers: [
              {
                condition: 'New',
                fulfillmentChannel: 'Amazon',
                offerCount: Math.floor(Math.random() * 3) + 1 // Random 1-3 eligible offers
              }
            ]
          }
        }
      }
    };

    // Wrap in SNS message format (how Amazon actually sends it)
    const snsMessage = {
      Type: 'Notification',
      MessageId: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      TopicArn: 'arn:aws:sns:eu-west-1:437568002678:test-topic',
      Message: JSON.stringify(testNotification),
      Timestamp: new Date().toISOString(),
      SignatureVersion: '1',
      Signature: 'test-signature',
      SigningCertURL: 'https://sns.eu-west-1.amazonaws.com/test.pem'
    };

    // Send to SQS queue
    const params = {
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(snsMessage),
      MessageAttributes: {
        testMessage: {
          DataType: 'String',
          StringValue: 'true'
        },
        source: {
          DataType: 'String',
          StringValue: 'svelte-test-endpoint'
        }
      }
    };

    const result = await sqs.sendMessage(params).promise();

    console.log(`✅ Test notification sent with MessageId: ${result.MessageId}`);

    return json({
      success: true,
      messageId: result.MessageId,
      testNotification: testNotification,
      message: 'Test notification sent successfully'
    });

  } catch (error: any) {
    console.error('❌ Error sending test notification:', error);

    return json({
      success: false,
      error: error.message || 'Unknown error occurred'
    }, { status: 500 });
  }
};

/**
 * Send multiple test notifications for load testing
 * PUT /api/sqs-notifications/test
 */
export const PUT: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const count = Math.min(body.count || 5, 20); // Limit to max 20 test messages

    console.log(`🧪 Sending ${count} test notifications to SQS queue...`);

    const promises = [];
    const testAsins = ['B0104R0FRG', 'B08N5WRWNW', 'B09ABCDEFG', 'B07HIJKLMN', 'B06OPQRSTU'];

    for (let i = 0; i < count; i++) {
      const testNotification = {
        notificationType: 'ANY_OFFER_CHANGED',
        payloadVersion: '1.0',
        eventTime: new Date(Date.now() - Math.random() * 3600000).toISOString(), // Random time within last hour
        payload: {
          anyOfferChangedNotification: {
            sellerId: 'A2D8NG39VURSL3',
            marketplaceId: 'A1F83G8C2ARO7P',
            asin: testAsins[i % testAsins.length], // Cycle through ASINs
            itemCondition: 'New',
            timeOfOfferChange: new Date().toISOString(),
            offerChangeTrigger: {
              marketplaceId: 'A1F83G8C2ARO7P',
              asin: testAsins[i % testAsins.length],
              itemCondition: 'New',
              timeOfOfferChange: new Date().toISOString()
            },
            summary: {
              numberOfOffers: [
                {
                  condition: 'New',
                  fulfillmentChannel: 'Amazon',
                  offerCount: Math.floor(Math.random() * 10) + 1
                }
              ],
              buyBoxPrices: Math.random() > 0.2 ? [
                {
                  condition: 'New',
                  fulfillmentChannel: 'Amazon',
                  listingPrice: {
                    currencyCode: 'GBP',
                    amount: parseFloat((Math.random() * 100 + 5).toFixed(2))
                  },
                  shipping: {
                    currencyCode: 'GBP',
                    amount: Math.random() > 0.6 ? parseFloat((Math.random() * 8).toFixed(2)) : 0.00
                  }
                }
              ] : undefined, // Sometimes no buy box winner
              buyBoxEligibleOffers: [
                {
                  condition: 'New',
                  fulfillmentChannel: 'Amazon',
                  offerCount: Math.floor(Math.random() * 5) + 1
                }
              ]
            }
          }
        }
      };

      const snsMessage = {
        Type: 'Notification',
        MessageId: `batch-test-${Date.now()}-${i}`,
        TopicArn: 'arn:aws:sns:eu-west-1:437568002678:test-topic',
        Message: JSON.stringify(testNotification),
        Timestamp: new Date().toISOString(),
        SignatureVersion: '1',
        Signature: 'test-signature',
        SigningCertURL: 'https://sns.eu-west-1.amazonaws.com/test.pem'
      };

      promises.push(
        sqs.sendMessage({
          QueueUrl: QUEUE_URL,
          MessageBody: JSON.stringify(snsMessage),
          MessageAttributes: {
            testMessage: {
              DataType: 'String',
              StringValue: 'true'
            },
            batchId: {
              DataType: 'String',
              StringValue: `batch-${Date.now()}`
            }
          }
        }).promise()
      );
    }

    const results = await Promise.all(promises);
    const messageIds = results.map(r => r.MessageId).filter(Boolean);

    console.log(`✅ Sent ${messageIds.length} test notifications`);

    return json({
      success: true,
      messageIds,
      count: messageIds.length,
      message: `${messageIds.length} test notifications sent successfully`
    });

  } catch (error: any) {
    console.error('❌ Error sending batch test notifications:', error);

    return json({
      success: false,
      error: error.message || 'Unknown error occurred'
    }, { status: 500 });
  }
};