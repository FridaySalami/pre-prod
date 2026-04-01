/**
 * Test STS AssumeRole with External ID
 * 
 * Amazon SP-API might require an External ID when assuming the role.
 * This is a security measure for cross-account access.
 */

import 'dotenv/config';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';

interface TestConfig {
  roleArn: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  externalId?: string;
}

async function testAssumeRoleWithExternalId(config: TestConfig) {
  console.log('🔐 Testing STS AssumeRole with External ID\n');
  console.log('='.repeat(70));

  // Check if External ID might be needed
  console.log('📋 Checking for External ID requirement:\n');

  const sellingPartnerId = process.env.AMAZON_SELLER_ID;
  const applicationId = process.env.AMAZON_CLIENT_ID;

  console.log('Seller Partner ID:', sellingPartnerId || '❌ Not found');
  console.log('Application/Client ID:', applicationId || '❌ Not found');

  // Common patterns for External ID in SP-API:
  const possibleExternalIds = [
    sellingPartnerId,
    applicationId,
    `amzn1.sp.solution.${applicationId}`,
    config.roleArn.split(':')[4], // AWS Account ID from role ARN
  ].filter(Boolean);

  console.log('\n📝 Possible External IDs to try:');
  possibleExternalIds.forEach((id, i) => {
    console.log(`   ${i + 1}. ${id}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('🧪 Test 1: AssumeRole WITHOUT External ID (current approach)\n');

  try {
    const sts = new STSClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });

    const command = new AssumeRoleCommand({
      RoleArn: config.roleArn,
      RoleSessionName: `spapi-test-${Date.now()}`,
      DurationSeconds: 3600
    });

    const response = await sts.send(command);

    if (response.Credentials) {
      console.log('✅ SUCCESS: AssumeRole works WITHOUT External ID');
      console.log('   Access Key ID:', response.Credentials.AccessKeyId?.substring(0, 20) + '...');
      console.log('   Expiration:', response.Credentials.Expiration);
      console.log('   Session Token:', response.Credentials.SessionToken ? 'Present ✓' : 'Missing ✗');
    }
  } catch (error: any) {
    console.log('❌ FAILED:', error.message);

    if (error.message?.includes('ExternalId')) {
      console.log('   ⚠️  External ID IS REQUIRED!');
    }
  }

  // Test with each possible External ID
  for (let i = 0; i < possibleExternalIds.length; i++) {
    const externalId = possibleExternalIds[i];

    console.log('\n' + '='.repeat(70));
    console.log(`🧪 Test ${i + 2}: AssumeRole WITH External ID: ${externalId}\n`);

    try {
      const sts = new STSClient({
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey
        }
      });

      const command = new AssumeRoleCommand({
        RoleArn: config.roleArn,
        RoleSessionName: `spapi-test-${Date.now()}`,
        DurationSeconds: 3600,
        ExternalId: externalId // Add External ID
      });

      const response = await sts.send(command);

      if (response.Credentials) {
        console.log(`✅ SUCCESS: AssumeRole works WITH External ID: ${externalId}`);
        console.log('   Access Key ID:', response.Credentials.AccessKeyId?.substring(0, 20) + '...');
        console.log('   Expiration:', response.Credentials.Expiration);
        console.log('   Session Token:', response.Credentials.SessionToken ? 'Present ✓' : 'Missing ✗');

        console.log('\n🎯 SOLUTION FOUND!');
        console.log(`   Add this External ID to your AssumeRole configuration: ${externalId}`);
        break;
      }
    } catch (error: any) {
      console.log('❌ FAILED:', error.message);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📚 External ID Documentation:\n');
  console.log('Amazon SP-API may require an External ID for security.');
  console.log('The External ID is typically:');
  console.log('   • Your Seller Partner ID');
  console.log('   • Your Application/Client ID');
  console.log('   • A combination of both\n');
  console.log('If External ID is required, you need to:');
  console.log('   1. Find the correct External ID (shown in tests above)');
  console.log('   2. Update sp-api-client.ts assumeRole() to include ExternalId');
  console.log('   3. Ensure IAM role trust policy allows this External ID\n');

  console.log('Trust Policy Example:');
  console.log('```json');
  console.log(JSON.stringify({
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "AWS": `arn:aws:iam::${config.roleArn.split(':')[4]}:user/amazon-spapi-user`
        },
        "Action": "sts:AssumeRole",
        "Condition": {
          "StringEquals": {
            "sts:ExternalId": "YOUR_EXTERNAL_ID_HERE"
          }
        }
      }
    ]
  }, null, 2));
  console.log('```');
}

// Run tests
const config: TestConfig = {
  roleArn: process.env.AMAZON_ROLE_ARN || '',
  accessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY || '',
  region: process.env.AMAZON_AWS_REGION || 'eu-west-1'
};

if (!config.roleArn) {
  console.error('❌ AMAZON_ROLE_ARN not found in .env');
  process.exit(1);
}

testAssumeRoleWithExternalId(config).catch(console.error);
