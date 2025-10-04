#!/usr/bin/env node

/**
 * Check SQS Queue Encryption Settings
 * 
 * This script checks if your SQS queue uses server-side encryption
 * and if you need to add KMS permissions for Amazon SP-API.
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

async function checkQueueEncryption() {
  console.log('🔒 Checking SQS Queue Encryption Settings');
  console.log('═'.repeat(50));

  try {
    // Get queue attributes including encryption settings
    const params = {
      QueueUrl: QUEUE_URL,
      AttributeNames: [
        'KmsMasterKeyId',
        'KmsDataKeyReusePeriodSeconds',
        'SqsManagedSseEnabled',
        'QueueArn'
      ]
    };

    const result = await sqs.getQueueAttributes(params).promise();
    const attributes = result.Attributes;

    console.log('📋 Queue Encryption Analysis:');
    console.log('─'.repeat(30));

    // Check for KMS encryption
    if (attributes.KmsMasterKeyId) {
      console.log('🛡️  KMS Encryption: ENABLED');
      console.log('   KMS Key ID:', attributes.KmsMasterKeyId);
      console.log('   Data Key Reuse Period:', attributes.KmsDataKeyReusePeriodSeconds || 'Default (300 seconds)');

      console.log('\n⚠️  ACTION REQUIRED:');
      console.log('   You MUST add KMS permissions for Amazon SP-API');
      console.log('   Follow Step 2 from Amazon\'s documentation');

      return {
        encrypted: true,
        encryptionType: 'KMS',
        keyId: attributes.KmsMasterKeyId,
        actionRequired: true
      };
    }

    // Check for SQS-managed encryption
    else if (attributes.SqsManagedSseEnabled === 'true') {
      console.log('🛡️  SQS-Managed Encryption: ENABLED');
      console.log('   Encryption Type: AWS SQS-managed (no KMS key needed)');

      console.log('\n✅ NO ACTION REQUIRED:');
      console.log('   SQS-managed encryption doesn\'t require KMS permissions');

      return {
        encrypted: true,
        encryptionType: 'SQS-Managed',
        keyId: null,
        actionRequired: false
      };
    }

    // No encryption
    else {
      console.log('🔓 Encryption: DISABLED');
      console.log('   Your queue uses no server-side encryption');

      console.log('\n✅ NO ACTION REQUIRED:');
      console.log('   No encryption = no KMS permissions needed');

      return {
        encrypted: false,
        encryptionType: 'None',
        keyId: null,
        actionRequired: false
      };
    }

  } catch (error) {
    console.error('❌ Error checking queue encryption:', error);
    throw error;
  }
}

async function main() {
  try {
    const encryptionInfo = await checkQueueEncryption();

    console.log('\n📋 SUMMARY:');
    console.log('═'.repeat(30));
    console.log('Queue:', QUEUE_URL.split('/').pop());
    console.log('Encrypted:', encryptionInfo.encrypted ? 'Yes' : 'No');
    console.log('Type:', encryptionInfo.encryptionType);

    if (encryptionInfo.actionRequired) {
      console.log('\n🚨 KMS POLICY REQUIRED:');
      console.log('Add this policy to your KMS key:');
      console.log('');
      console.log(JSON.stringify({
        "Version": "2012-10-17",
        "Statement": [
          {
            "Effect": "Allow",
            "Principal": {
              "AWS": "arn:aws:iam::437568002678:root"
            },
            "Action": [
              "kms:GenerateDataKey",
              "kms:Decrypt"
            ],
            "Resource": "*"
          }
        ]
      }, null, 2));

      console.log('\n📍 Where to Add This:');
      console.log('1. Go to AWS Console → KMS');
      console.log('2. Find your key:', encryptionInfo.keyId);
      console.log('3. Edit key policy');
      console.log('4. Add the above policy statement');
    } else {
      console.log('\n🎉 You\'re all set!');
      console.log('No additional KMS permissions needed.');
    }

    console.log('\n🔗 Next Steps:');
    if (encryptionInfo.actionRequired) {
      console.log('1. Add KMS policy (see above)');
      console.log('2. Test SP-API notifications setup');
    } else {
      console.log('1. Proceed with SP-API notifications setup');
      console.log('2. Your SQS permissions are complete!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the check
main().catch(console.error);