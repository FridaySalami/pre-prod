#!/usr/bin/env node

/**
 * Create SP-API Notification Subscriptions (Grantless)
 * 
 * This script creates subscriptions to receive buy box and pricing notifications
 * using the destination we just created.
 */

const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// The destination ID from the previous step
const DESTINATION_ID = '6fa6a0f4-70fa-4458-ac0f-f0adc462d65f';

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

// Get access token (normal refresh token flow for subscriptions)
async function getAccessToken() {
  try {
    console.log('🔑 Getting access token for subscriptions...');

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

    console.log('✅ Access token obtained');
    return response.data.access_token;
  } catch (error) {
    console.error('❌ Error getting access token:', error.response?.data || error.message);
    throw error;
  }
}

// Get current subscriptions
async function getSubscriptions(accessToken) {
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
    destinationId: DESTINATION_ID,
    processingDirective: {
      eventFilter: {
        eventFilterType: notificationType,
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

// Main function
async function setupSubscriptions() {
  console.log('🔔 Creating SP-API Notification Subscriptions');
  console.log('═'.repeat(50));

  try {
    // Validate configuration
    const requiredVars = ['AMAZON_AWS_ACCESS_KEY_ID', 'AMAZON_AWS_SECRET_ACCESS_KEY', 'AMAZON_REFRESH_TOKEN', 'AMAZON_CLIENT_ID', 'AMAZON_CLIENT_SECRET'];
    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing.join(', '));
      console.log('💡 Note: Subscriptions need refresh token (unlike destinations)');
      process.exit(1);
    }

    // Get access token (subscriptions need normal auth, not grantless)
    const accessToken = await getAccessToken();

    console.log('\n📋 Checking existing subscriptions...');
    const currentSubscriptions = await getSubscriptions(accessToken);

    if (currentSubscriptions && currentSubscriptions.payload) {
      console.log(`✅ Found ${currentSubscriptions.payload.length} existing subscriptions:`);
      currentSubscriptions.payload.forEach((sub, index) => {
        console.log(`   ${index + 1}. ${sub.notificationType} -> ${sub.destinationId}`);
      });
    } else {
      console.log('✅ No existing subscriptions found');
    }

    console.log('\n🔔 Creating new notification subscriptions...');
    console.log(`📍 Using Destination ID: ${DESTINATION_ID}`);

    // Create subscription for ANY_OFFER_CHANGED (includes buy box changes)
    console.log('\n1️⃣ Creating subscription for ANY_OFFER_CHANGED...');
    const offerSubscription = await createSubscription(accessToken, 'ANY_OFFER_CHANGED');

    if (offerSubscription && offerSubscription.payload) {
      console.log('✅ Successfully created ANY_OFFER_CHANGED subscription');
      console.log('   Subscription ID:', offerSubscription.payload.subscriptionId);
    } else {
      console.log('❌ Failed to create ANY_OFFER_CHANGED subscription');
    }

    // Try other notification types
    console.log('\n2️⃣ Creating subscription for LISTINGS_ITEM_STATUS_CHANGE...');
    const listingsSubscription = await createSubscription(accessToken, 'LISTINGS_ITEM_STATUS_CHANGE');

    if (listingsSubscription && listingsSubscription.payload) {
      console.log('✅ Successfully created LISTINGS_ITEM_STATUS_CHANGE subscription');
      console.log('   Subscription ID:', listingsSubscription.payload.subscriptionId);
    } else {
      console.log('❌ Failed to create LISTINGS_ITEM_STATUS_CHANGE subscription');
    }

    console.log('\n📋 Final subscription status:');
    const finalSubscriptions = await getSubscriptions(accessToken);

    if (finalSubscriptions && finalSubscriptions.payload) {
      console.log(`✅ Total active subscriptions: ${finalSubscriptions.payload.length}`);
      finalSubscriptions.payload.forEach((sub, index) => {
        console.log(`   ${index + 1}. ${sub.notificationType} (${sub.subscriptionId})`);
      });
    }

    console.log('\n🎉 Subscription setup complete!');
    console.log('\n🔔 What happens next:');
    console.log('1. Amazon will send notifications to your SQS queue when:');
    console.log('   - Any offer changes on your products (ANY_OFFER_CHANGED)');
    console.log('   - Buy Box ownership changes (included in offer changes)');
    console.log('   - Listing status changes (LISTINGS_ITEM_STATUS_CHANGE)');
    console.log('2. Your monitoring dashboard can poll the SQS queue for real-time alerts');
    console.log('3. Test by changing a price in Seller Central');
    console.log('\n🧪 Test your setup:');
    console.log('   - Change a price on one of your products');
    console.log('   - Check your SQS queue for notifications');
    console.log('   - Run: node test-sqs-permissions.cjs');

  } catch (error) {
    console.error('❌ Error setting up subscriptions:', error.message);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Create SP-API Notification Subscriptions');
  console.log('');
  console.log('Usage:');
  console.log('  node create-subscriptions.cjs        # Create subscriptions');
  console.log('  node create-subscriptions.cjs --help # Show this help');
  console.log('');
  console.log('Prerequisites:');
  console.log('  1. SQS queue must be set up with correct permissions');
  console.log('  2. Destination must be created (run create-grantless-destination.cjs first)');
  process.exit(0);
}

// Run the setup
setupSubscriptions().catch(console.error);