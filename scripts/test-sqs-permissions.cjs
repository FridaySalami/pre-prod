#!/usr/bin/env node

/**
 * Test SQS Permissions for Amazon SP-API Notifications
 * 
 * This script tests if your SQS queue permissions are correctly configured
 * for receiving Amazon SP-API notifications.
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

async function testSQSPermissions() {
  console.log('🧪 Testing SQS Permissions for SP-API Notifications');
  console.log('═'.repeat(60));

  try {
    // Test 1: Check if queue exists and is accessible
    console.log('1️⃣ Testing queue accessibility...');

    const queueAttributes = await sqs.getQueueAttributes({
      QueueUrl: QUEUE_URL,
      AttributeNames: ['QueueArn', 'Policy', 'CreatedTimestamp']
    }).promise();

    console.log('✅ Queue accessible');
    console.log('   ARN:', queueAttributes.Attributes.QueueArn);
    console.log('   Created:', new Date(queueAttributes.Attributes.CreatedTimestamp * 1000).toISOString());

    // Test 2: Check current policy
    console.log('\n2️⃣ Checking current queue policy...');

    if (queueAttributes.Attributes.Policy) {
      const policy = JSON.parse(queueAttributes.Attributes.Policy);
      console.log('✅ Policy exists');
      console.log('   Policy:', JSON.stringify(policy, null, 2));

      // Check if Amazon SP-API account is in the policy
      const hasSpApiAccess = policy.Statement.some(statement =>
        statement.Principal &&
        (statement.Principal.AWS === '437568002678' ||
          statement.Principal.AWS === 'arn:aws:iam::437568002678:root')
      );

      if (hasSpApiAccess) {
        console.log('✅ Amazon SP-API account (437568002678) has access');
      } else {
        console.log('❌ Amazon SP-API account (437568002678) NOT found in policy');
        console.log('   You need to add permissions for Amazon SP-API service account');
      }
    } else {
      console.log('❌ No policy configured');
      console.log('   You need to set a policy allowing Amazon SP-API access');
    }

    // Test 3: Check queue statistics
    console.log('\n3️⃣ Checking queue statistics...');

    const stats = await sqs.getQueueAttributes({
      QueueUrl: QUEUE_URL,
      AttributeNames: [
        'ApproximateNumberOfMessages',
        'ApproximateNumberOfMessagesNotVisible'
      ]
    }).promise();

    console.log('✅ Queue statistics:');
    console.log('   Messages available:', stats.Attributes.ApproximateNumberOfMessages);
    console.log('   Messages in flight:', stats.Attributes.ApproximateNumberOfMessagesNotVisible);

    // Test 4: Test sending a message (to verify permissions)
    console.log('\n4️⃣ Testing message sending permissions...');

    try {
      const testMessage = {
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify({
          test: true,
          timestamp: new Date().toISOString(),
          message: 'SQS permission test from your application'
        })
      };

      await sqs.sendMessage(testMessage).promise();
      console.log('✅ Successfully sent test message');
      console.log('   Your application can send messages to the queue');
    } catch (sendError) {
      console.log('❌ Failed to send test message:', sendError.message);
      console.log('   Check your AWS credentials and permissions');
    }

    // Test 5: Test receiving messages
    console.log('\n5️⃣ Testing message receiving...');

    try {
      const receiveParams = {
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 1
      };

      const messages = await sqs.receiveMessage(receiveParams).promise();

      if (messages.Messages && messages.Messages.length > 0) {
        console.log('✅ Successfully received messages');
        console.log('   Messages found:', messages.Messages.length);

        // Clean up test message if it was received
        for (const message of messages.Messages) {
          try {
            const body = JSON.parse(message.Body);
            if (body.test === true) {
              await sqs.deleteMessage({
                QueueUrl: QUEUE_URL,
                ReceiptHandle: message.ReceiptHandle
              }).promise();
              console.log('   ✅ Cleaned up test message');
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      } else {
        console.log('✅ No messages in queue (normal for new setup)');
      }
    } catch (receiveError) {
      console.log('❌ Failed to receive messages:', receiveError.message);
    }

    console.log('\n📋 SUMMARY:');
    console.log('════════════════════════════════════════════════════════');
    console.log('✅ Queue URL: ' + QUEUE_URL);
    console.log('✅ Queue ARN: ' + queueAttributes.Attributes.QueueArn);
    console.log('');
    console.log('🔗 Next Steps:');
    console.log('1. If policy is missing Amazon SP-API access, update it in AWS Console');
    console.log('2. Subscribe to SP-API notifications using the Notifications API');
    console.log('3. Test with real SP-API notifications');
    console.log('');
    console.log('📚 Resources:');
    console.log('- SP-API Notifications Guide: https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-reference');
    console.log('- Your Queue ARN for API calls: ' + queueAttributes.Attributes.QueueArn);

  } catch (error) {
    console.error('❌ Error testing SQS permissions:', error);

    if (error.code === 'AWS_SQS_NonExistentQueue') {
      console.log('');
      console.log('💡 The queue doesn\'t exist. Create it first:');
      console.log('   1. Go to AWS Console > SQS');
      console.log('   2. Create queue: buybox-notifications');
      console.log('   3. Set the queue policy for Amazon SP-API access');
    } else if (error.code === 'InvalidUserID.NotFound') {
      console.log('');
      console.log('💡 AWS credentials issue:');
      console.log('   1. Check your .env file has correct AWS credentials');
      console.log('   2. Verify AMAZON_AWS_ACCESS_KEY_ID and AMAZON_AWS_SECRET_ACCESS_KEY');
    }
  }
}

// Run the test
testSQSPermissions().catch(console.error);