#!/usr/bin/env node

/**
 * Create SP-API Subscription (Corrected Version)
 * 
 * Based on the official Amazon SP-API documentation you found.
 * This creates a subscription for ANY_OFFER_CHANGED notifications.
 */

const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// The destination ID from our previous successful creation
const DESTINATION_ID = '6fa6a0f4-70fa-4458-ac0f-f0adc462d65f';
const NOTIFICATION_TYPE = 'ANY_OFFER_CHANGED';

// Configuration
const config = {
  marketplace: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
  region: 'eu-west-1',
  endpoint: 'https://sellingpartnerapi-eu.amazon.com', // EU endpoint, not NA
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
    console.log('🔑 Getting access token...');

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

// Create subscription with proper format from documentation
async function createSubscriptionCorrect(accessToken) {
  // Correct path format from documentation
  const path = `/notifications/v1/subscriptions/${NOTIFICATION_TYPE}`;
  const queryParams = { marketplaceId: config.marketplace };

  // Request body matching the documentation exactly
  const requestBody = {
    payloadVersion: '1.0',           // Required
    destinationId: DESTINATION_ID,   // Required - our destination from earlier
    processingDirective: {           // Optional but useful for filtering
      eventFilter: {
        aggregationSettings: {
          aggregationTimePeriod: 'FiveMinutes'
        },
        eventFilterType: 'ANY_OFFER_CHANGED'
      }
    }
  };

  const body = JSON.stringify(requestBody);

  console.log('📋 Request Details:');
  console.log('   Method: POST');
  console.log('   Path:', path);
  console.log('   Query Params:', queryParams);
  console.log('   Body:', JSON.stringify(requestBody, null, 2));

  const headers = {
    'host': 'sellingpartnerapi-eu.amazon.com',
    'x-amz-access-token': accessToken,
    'content-type': 'application/json',
    'accept': 'application/json'
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
    console.log('\n🔔 Creating subscription...');
    const response = await axios.post(`${config.endpoint}${path}`, body, {
      params: queryParams,
      headers: signedHeaders
    });

    return response.data;
  } catch (error) {
    console.error('❌ Error creating subscription:', error.response?.data || error.message);

    // Enhanced error analysis
    if (error.response?.status === 401) {
      console.log('\n💡 401 Unauthorized - This means:');
      console.log('   1. Missing SP-API application permissions');
      console.log('   2. Invalid access token');
      console.log('   3. Missing seller authorization');
    } else if (error.response?.status === 400) {
      console.log('\n💡 400 Bad Request - Check:');
      console.log('   1. Request body format');
      console.log('   2. Required fields (payloadVersion, destinationId)');
      console.log('   3. Valid notification type');
    }

    return null;
  }
}

// Main function
async function main() {
  console.log('🔔 Creating SP-API Subscription (Corrected)');
  console.log('═'.repeat(50));

  try {
    // Validate configuration
    const requiredVars = ['AMAZON_AWS_ACCESS_KEY_ID', 'AMAZON_AWS_SECRET_ACCESS_KEY', 'AMAZON_REFRESH_TOKEN', 'AMAZON_CLIENT_ID', 'AMAZON_CLIENT_SECRET'];
    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing.join(', '));
      process.exit(1);
    }

    console.log('📍 Configuration:');
    console.log('   Endpoint:', config.endpoint);
    console.log('   Region:', config.region);
    console.log('   Marketplace:', config.marketplace);
    console.log('   Notification Type:', NOTIFICATION_TYPE);
    console.log('   Destination ID:', DESTINATION_ID);

    // Get access token
    const accessToken = await getAccessToken();

    // Create subscription with corrected format
    const result = await createSubscriptionCorrect(accessToken);

    if (result && result.payload) {
      console.log('\n🎉 SUCCESS! Subscription created!');
      console.log('   Subscription ID:', result.payload.subscriptionId);
      console.log('   Payload Version:', result.payload.payloadVersion);
      console.log('   Destination ID:', result.payload.destinationId);

      if (result.payload.processingDirective) {
        console.log('   Event Filter Type:', result.payload.processingDirective.eventFilterType);
        if (result.payload.processingDirective.aggregationSettings) {
          console.log('   Aggregation Period:', result.payload.processingDirective.aggregationSettings.aggregationTimePeriod);
        }
      }

      console.log('\n🔔 What happens next:');
      console.log('1. Amazon will send notifications to your SQS queue when offers change');
      console.log('2. Notifications will be aggregated over 5-minute periods');
      console.log('3. Test by changing a price in Seller Central');
      console.log('4. Check your SQS queue for incoming notifications');

    } else {
      console.log('\n❌ Failed to create subscription');
      console.log('   This confirms you need the Notifications API permission');
      console.log('   Contact Amazon Support or find the missing permission in Developer Console');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run
main().catch(console.error);