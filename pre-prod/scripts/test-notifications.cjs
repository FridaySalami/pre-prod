#!/usr/bin/env node

/**
 * Manual SQS Notification Test
 * 
 * This script sends simulated Amazon SP-API notifications to your SQS queue
 * to test if your monitoring system can receive and process them correctly.
 */

const AWS = require('aws-sdk');
require('dotenv').config();

// Configure AWS SDK
const sqs = new AWS.SQS({
  region: 'eu-west-1',
  accessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY
});

const QUEUE_URL = 'https://sqs.eu-west-1.amazonaws.com/881471314805/buybox-notifications';

// Sample notification that mimics what Amazon SP-API would send
const sampleNotifications = [
  {
    notificationType: 'ANY_OFFER_CHANGED',
    payloadVersion: '1.0',
    eventTime: new Date().toISOString(),
    payload: {
      anyOfferChangedNotification: {
        sellerId: 'A2D8NG39VURSL3', // Your seller ID
        marketplaceId: 'A1F83G8C2ARO7P',
        asin: 'B0104R0FRG',
        itemCondition: 'New',
        timeOfOfferChange: new Date().toISOString(),
        offerChangeTrigger: {
          marketplaceId: 'A1F83G8C2ARO7P',
          asin: 'B0104R0FRG',
          itemCondition: 'New',
          timeOfOfferChange: new Date().toISOString()
        },
        summary: {
          numberOfOffers: [
            {
              condition: 'New',
              fulfillmentChannel: 'Amazon',
              offerCount: 3
            }
          ],
          buyBoxPrices: [
            {
              condition: 'New',
              fulfillmentChannel: 'Amazon',
              listingPrice: {
                currencyCode: 'GBP',
                amount: 19.99
              },
              shipping: {
                currencyCode: 'GBP',
                amount: 0.00
              }
            }
          ],
          buyBoxEligibleOffers: [
            {
              condition: 'New',
              fulfillmentChannel: 'Amazon',
              offerCount: 2
            }
          ]
        }
      }
    }
  },
  {
    notificationType: 'ANY_OFFER_CHANGED',
    payloadVersion: '1.0',
    eventTime: new Date().toISOString(),
    payload: {
      anyOfferChangedNotification: {
        sellerId: 'A2D8NG39VURSL3',
        marketplaceId: 'A1F83G8C2ARO7P',
        asin: 'B08N5WRWNW',
        itemCondition: 'New',
        timeOfOfferChange: new Date().toISOString(),
        offerChangeTrigger: {
          marketplaceId: 'A1F83G8C2ARO7P',
          asin: 'B08N5WRWNW',
          itemCondition: 'New',
          timeOfOfferChange: new Date().toISOString()
        },
        summary: {
          numberOfOffers: [
            {
              condition: 'New',
              fulfillmentChannel: 'Amazon',
              offerCount: 1
            }
          ],
          buyBoxPrices: [
            {
              condition: 'New',
              fulfillmentChannel: 'Amazon',
              listingPrice: {
                currencyCode: 'GBP',
                amount: 24.99
              },
              shipping: {
                currencyCode: 'GBP',
                amount: 0.00
              }
            }
          ]
        }
      }
    }
  }
];

async function sendTestNotifications() {
  console.log('🧪 Sending Test Notifications to SQS');
  console.log('═'.repeat(40));

  try {
    for (let i = 0; i < sampleNotifications.length; i++) {
      const notification = sampleNotifications[i];

      console.log(`\n📨 Sending test notification ${i + 1}/${sampleNotifications.length}...`);
      console.log(`   Type: ${notification.notificationType}`);
      console.log(`   ASIN: ${notification.payload.anyOfferChangedNotification.asin}`);

      // Wrap in SNS message format (how Amazon actually sends it)
      const snsMessage = {
        Type: 'Notification',
        MessageId: `test-${Date.now()}-${i}`,
        TopicArn: 'arn:aws:sns:us-east-1:437568002678:test-topic',
        Message: JSON.stringify(notification),
        Timestamp: new Date().toISOString(),
        SignatureVersion: '1',
        Signature: 'test-signature',
        SigningCertURL: 'https://sns.us-east-1.amazonaws.com/test.pem'
      };

      const params = {
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(snsMessage)
      };

      const result = await sqs.sendMessage(params).promise();
      console.log(`   ✅ Sent with MessageId: ${result.MessageId}`);

      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n🎉 All test notifications sent successfully!');
    console.log('\n📋 What to do next:');
    console.log('1. Check your SQS queue for the messages');
    console.log('2. Test your monitoring dashboard to see if it receives them');
    console.log('3. Verify your notification processing logic works');
    console.log('\n🔍 Check messages with:');
    console.log('   node test-sqs-permissions.cjs');
    console.log('\n💡 These simulate real Amazon SP-API notifications');
    console.log('   Use this to develop your notification handling before');
    console.log('   getting the actual Notifications API permission.');

  } catch (error) {
    console.error('❌ Error sending test notifications:', error);
  }
}

async function receiveAndShowNotifications() {
  console.log('\n🔍 Checking for messages in SQS queue...');

  try {
    const params = {
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 5
    };

    const result = await sqs.receiveMessage(params).promise();

    if (result.Messages && result.Messages.length > 0) {
      console.log(`📨 Found ${result.Messages.length} messages:`);

      result.Messages.forEach((message, index) => {
        console.log(`\n📧 Message ${index + 1}:`);
        try {
          const body = JSON.parse(message.Body);
          if (body.Type === 'Notification' && body.Message) {
            const notification = JSON.parse(body.Message);
            console.log(`   Type: ${notification.notificationType}`);
            console.log(`   Time: ${notification.eventTime}`);
            if (notification.payload.anyOfferChangedNotification) {
              console.log(`   ASIN: ${notification.payload.anyOfferChangedNotification.asin}`);
              console.log(`   Offers: ${notification.payload.anyOfferChangedNotification.summary.numberOfOffers[0]?.offerCount || 'Unknown'}`);
            }
          } else {
            console.log('   Raw message body:', JSON.stringify(body, null, 2));
          }
        } catch (e) {
          console.log('   Raw message:', message.Body);
        }
      });

      console.log('\n⚠️  Messages left in queue for your app to process');
      console.log('   (Not deleting them so your monitoring system can read them)');
    } else {
      console.log('📭 No messages found in queue');
    }

  } catch (error) {
    console.error('❌ Error receiving messages:', error);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help')) {
  console.log('Manual SQS Notification Test');
  console.log('');
  console.log('Usage:');
  console.log('  node test-notifications.cjs           # Send test notifications');
  console.log('  node test-notifications.cjs --receive # Check for messages');
  console.log('  node test-notifications.cjs --help    # Show this help');
  process.exit(0);
}

if (args.includes('--receive')) {
  receiveAndShowNotifications();
} else {
  sendTestNotifications();
}