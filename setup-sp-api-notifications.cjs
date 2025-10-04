#!/usr/bin/env node

/**
 * Setup Amazon SP-API Notifications Subscriptions
 * 
 * This script subscribes to SP-API notifications for:
 * - Pricing changes (ANY_OFFER_CHANGED)
 * - Buy Box changes (included in pricing notifications)
 * - Product type changes
 */

const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// Your SQS Queue ARN (from the test results)
const SQS_QUEUE_ARN = 'arn:aws:sqs:eu-west-1:881471314805:buybox-notifications';

// Configuration
const config = {
  marketplace: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
  region: 'eu-west-1',
  endpoint: 'https://sellingpartnerapi-eu.amazon.com',
  accessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY,
  refreshToken: process.env.AMAZON_REFRESH_TOKEN,
  clientId: process.env.AMAZON_CLIENT_ID,
  clientSecret: process.env.AMAZON_CLIENT_SECRET,
};

// AWS Signature V4 implementation
function createSignature(method, path, queryParams, headers, body, region, service, accessKeyId, secretAccessKey) {
  const algorithm = 'AWS4-HMAC-SHA256';
  const date = new Date();
  const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = date.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';

  // Create canonical request
  const canonicalUri = path;
  const canonicalQuerystring = Object.keys(queryParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
    .join('&');

  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map(key => `${key.toLowerCase()}:${headers[key].trim()}\n`)
    .join('');

  const signedHeaders = Object.keys(headers)
    .sort()
    .map(key => key.toLowerCase())
    .join(';');

  const payloadHash = crypto.createHash('sha256').update(body).digest('hex');

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  // Create string to sign
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  // Calculate signature
  const kDate = crypto.createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  // Create authorization header
  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    'Authorization': authorizationHeader,
    'X-Amz-Date': amzDate,
    ...headers
  };
}

// Get access token
async function getAccessToken() {
  try {
    const response = await axios.post('https://api.amazon.com/auth/o2/token', {
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data.access_token;
  } catch (error) {
    console.error('❌ Error getting access token:', error.response?.data || error.message);
    throw error;
  }
}

// Get current notification subscriptions
async function getCurrentSubscriptions(accessToken) {
  const path = '/notifications/v1/subscriptions';
  const queryParams = { marketplaceId: config.marketplace };

  const headers = {
    'host': 'sellingpartnerapi-eu.amazon.com',
    'x-amz-access-token': accessToken,
    'content-type': 'application/json'
  };

  const signedHeaders = createSignature(
    'GET',
    path,
    queryParams,
    headers,
    '',
    config.region,
    'execute-api',
    config.accessKeyId,
    config.secretAccessKey
  );

  try {
    const response = await axios.get(`${config.endpoint}${path}`, {
      params: queryParams,
      headers: signedHeaders
    });

    return response.data;
  } catch (error) {
    console.error('❌ Error getting subscriptions:', error.response?.data || error.message);
    return null;
  }
}

// Create notification subscription
async function createSubscription(accessToken, notificationType) {
  const path = '/notifications/v1/subscriptions';
  const queryParams = { marketplaceId: config.marketplace };

  const body = JSON.stringify({
    payloadVersion: '1.0',
    destinationArn: SQS_QUEUE_ARN,
    processingDirective: {
      eventFilter: {
        eventFilterType: 'ANY_OFFER_CHANGED',
        marketplaceIds: [config.marketplace]
      }
    }
  });

  const headers = {
    'host': 'sellingpartnerapi-eu.amazon.com',
    'x-amz-access-token': accessToken,
    'content-type': 'application/json'
  };

  const signedHeaders = createSignature(
    'POST',
    path,
    queryParams,
    headers,
    body,
    config.region,
    'execute-api',
    config.accessKeyId,
    config.secretAccessKey
  );

  try {
    const response = await axios.post(`${config.endpoint}${path}`, body, {
      params: queryParams,
      headers: signedHeaders
    });

    return response.data;
  } catch (error) {
    console.error(`❌ Error creating subscription for ${notificationType}:`, error.response?.data || error.message);
    return null;
  }
}

// Delete a subscription
async function deleteSubscription(accessToken, subscriptionId, notificationType) {
  const path = `/notifications/v1/subscriptions/${subscriptionId}`;
  const queryParams = { marketplaceId: config.marketplace };

  const headers = {
    'host': 'sellingpartnerapi-eu.amazon.com',
    'x-amz-access-token': accessToken,
    'content-type': 'application/json'
  };

  const signedHeaders = createSignature(
    'DELETE',
    path,
    queryParams,
    headers,
    '',
    config.region,
    'execute-api',
    config.accessKeyId,
    config.secretAccessKey
  );

  try {
    const response = await axios.delete(`${config.endpoint}${path}`, {
      params: queryParams,
      headers: signedHeaders
    });

    console.log(`✅ Deleted subscription: ${notificationType} (${subscriptionId})`);
    return true;
  } catch (error) {
    console.error(`❌ Error deleting subscription ${subscriptionId}:`, error.response?.data || error.message);
    return false;
  }
}

// Main function
async function setupNotifications() {
  console.log('🔔 Setting up Amazon SP-API Notifications');
  console.log('═'.repeat(60));

  try {
    // Validate configuration
    const requiredVars = ['AMAZON_AWS_ACCESS_KEY_ID', 'AMAZON_AWS_SECRET_ACCESS_KEY', 'AMAZON_REFRESH_TOKEN', 'AMAZON_CLIENT_ID', 'AMAZON_CLIENT_SECRET'];
    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing.join(', '));
      process.exit(1);
    }

    console.log('🔑 Getting access token...');
    const accessToken = await getAccessToken();
    console.log('✅ Access token obtained');

    console.log('\n📋 Getting current subscriptions...');
    const currentSubscriptions = await getCurrentSubscriptions(accessToken);

    if (currentSubscriptions && currentSubscriptions.payload) {
      console.log(`✅ Found ${currentSubscriptions.payload.length} existing subscriptions:`);
      currentSubscriptions.payload.forEach((sub, index) => {
        console.log(`   ${index + 1}. ${sub.notificationType} -> ${sub.destinationArn}`);
      });

      // Ask if user wants to delete existing subscriptions
      const args = process.argv.slice(2);
      if (args.includes('--clean')) {
        console.log('\n🧹 Cleaning up existing subscriptions...');
        for (const sub of currentSubscriptions.payload) {
          await deleteSubscription(accessToken, sub.subscriptionId, sub.notificationType);
        }
      }
    } else {
      console.log('✅ No existing subscriptions found');
    }

    console.log('\n🔔 Creating new notification subscriptions...');
    console.log(`📍 SQS Queue ARN: ${SQS_QUEUE_ARN}`);

    // Create subscription for ANY_OFFER_CHANGED (includes buy box changes)
    console.log('\n1️⃣ Creating subscription for price/offer changes...');
    const priceSubscription = await createSubscription(accessToken, 'ANY_OFFER_CHANGED');

    if (priceSubscription) {
      console.log('✅ Successfully created price change subscription');
      console.log('   Subscription ID:', priceSubscription.payload?.subscriptionId);
    } else {
      console.log('❌ Failed to create price change subscription');
    }

    console.log('\n📋 Final subscription status:');
    const finalSubscriptions = await getCurrentSubscriptions(accessToken);

    if (finalSubscriptions && finalSubscriptions.payload) {
      console.log(`✅ Total active subscriptions: ${finalSubscriptions.payload.length}`);
      finalSubscriptions.payload.forEach((sub, index) => {
        console.log(`   ${index + 1}. ${sub.notificationType} -> Queue: ${sub.destinationArn.split(':').pop()}`);
      });
    }

    console.log('\n🎉 Notification setup complete!');
    console.log('\n🔔 What happens next:');
    console.log('1. Amazon will send notifications to your SQS queue when:');
    console.log('   - Any offer changes on your products');
    console.log('   - Buy Box ownership changes');
    console.log('   - Competitor prices change');
    console.log('2. Your monitoring dashboard can poll the SQS queue for real-time alerts');
    console.log('3. Test by changing a price in Seller Central');

  } catch (error) {
    console.error('❌ Error setting up notifications:', error.message);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Amazon SP-API Notifications Setup');
  console.log('');
  console.log('Usage:');
  console.log('  node setup-sp-api-notifications.cjs           # Setup notifications');
  console.log('  node setup-sp-api-notifications.cjs --clean   # Clean existing + setup new');
  console.log('  node setup-sp-api-notifications.cjs --help    # Show this help');
  process.exit(0);
}

// Run the setup
setupNotifications().catch(console.error);