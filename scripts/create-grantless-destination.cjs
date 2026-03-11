#!/usr/bin/env node

/**
 * Create SP-API Notification Destination (Grantless Operation)
 * 
 * This script uses grantless authentication to create a destination 
 * for SP-API notifications without requiring seller authorization.
 */

const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// Your SQS Queue ARN (from previous tests)
const SQS_QUEUE_ARN = 'arn:aws:sqs:eu-west-1:881471314805:buybox-notifications';
const DESTINATION_NAME = 'buybox-notifications-destination';

// Configuration
const config = {
  marketplace: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
  region: 'eu-west-1',
  endpoint: 'https://sellingpartnerapi-eu.amazon.com',
  accessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY,
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

// Get grantless access token (different from normal refresh token flow)
async function getGrantlessAccessToken() {
  try {
    console.log('🔑 Getting grantless access token...');

    const response = await axios.post('https://api.amazon.com/auth/o2/token', {
      grant_type: 'client_credentials',
      scope: 'sellingpartnerapi::notifications',
      client_id: config.clientId,
      client_secret: config.clientSecret
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('✅ Grantless access token obtained');
    return response.data.access_token;
  } catch (error) {
    console.error('❌ Error getting grantless access token:', error.response?.data || error.message);
    throw error;
  }
}

// Get existing destinations
async function getDestinations(accessToken) {
  const path = '/notifications/v1/destinations';
  const queryParams = {};

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
      headers: signedHeaders
    });

    return response.data;
  } catch (error) {
    console.error('❌ Error getting destinations:', error.response?.data || error.message);
    return null;
  }
}

// Create notification destination
async function createDestination(accessToken) {
  const path = '/notifications/v1/destinations';
  const queryParams = {};

  const body = JSON.stringify({
    resourceSpecification: {
      sqs: {
        arn: SQS_QUEUE_ARN
      }
    },
    name: DESTINATION_NAME
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
      headers: signedHeaders
    });

    return response.data;
  } catch (error) {
    console.error('❌ Error creating destination:', error.response?.data || error.message);
    return null;
  }
}

// Delete a destination (cleanup)
async function deleteDestination(accessToken, destinationId) {
  const path = `/notifications/v1/destinations/${destinationId}`;
  const queryParams = {};

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
      headers: signedHeaders
    });

    console.log(`✅ Deleted destination: ${destinationId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error deleting destination ${destinationId}:`, error.response?.data || error.message);
    return false;
  }
}

// Main function
async function setupDestination() {
  console.log('📍 Creating SP-API Notification Destination (Grantless)');
  console.log('═'.repeat(55));

  try {
    // Validate configuration
    const requiredVars = ['AMAZON_AWS_ACCESS_KEY_ID', 'AMAZON_AWS_SECRET_ACCESS_KEY', 'AMAZON_CLIENT_ID', 'AMAZON_CLIENT_SECRET'];
    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing.join(', '));
      console.log('💡 Note: Grantless operations don\'t need AMAZON_REFRESH_TOKEN');
      process.exit(1);
    }

    // Use grantless authentication (no refresh token needed)
    const accessToken = await getGrantlessAccessToken();

    console.log('\n📋 Checking existing destinations...');
    const existingDestinations = await getDestinations(accessToken);

    if (existingDestinations && existingDestinations.payload) {
      console.log(`✅ Found ${existingDestinations.payload.length} existing destinations:`);
      existingDestinations.payload.forEach((dest, index) => {
        console.log(`   ${index + 1}. ${dest.name} (${dest.destinationId})`);
        if (dest.resource && dest.resource.sqs) {
          console.log(`      → SQS: ${dest.resource.sqs.arn}`);
        }
      });

      // Check if our destination already exists
      const existingDest = existingDestinations.payload.find(dest =>
        dest.name === DESTINATION_NAME ||
        (dest.resource && dest.resource.sqs && dest.resource.sqs.arn === SQS_QUEUE_ARN)
      );

      if (existingDest) {
        console.log(`\n⚠️  Destination already exists: ${existingDest.name} (${existingDest.destinationId})`);

        const args = process.argv.slice(2);
        if (args.includes('--recreate')) {
          console.log('🔄 Recreating destination...');
          await deleteDestination(accessToken, existingDest.destinationId);
        } else {
          console.log('✅ Using existing destination');
          console.log('\n🎉 Destination setup complete!');
          console.log(`📍 Destination ID: ${existingDest.destinationId}`);
          console.log(`📍 Destination Name: ${existingDest.name}`);
          console.log(`📍 SQS ARN: ${existingDest.resource.sqs.arn}`);
          return existingDest.destinationId;
        }
      }
    } else {
      console.log('✅ No existing destinations found');
    }

    console.log('\n📍 Creating new notification destination...');
    console.log(`📍 Destination Name: ${DESTINATION_NAME}`);
    console.log(`📍 SQS ARN: ${SQS_QUEUE_ARN}`);

    const result = await createDestination(accessToken);

    if (result && result.payload) {
      console.log('✅ Successfully created destination!');
      console.log('   Destination ID:', result.payload.destinationId);
      console.log('   Destination Name:', result.payload.name);
      console.log('   Resource ARN:', result.payload.resource.sqs.arn);

      console.log('\n🎉 Destination setup complete!');
      console.log('\n🔔 Next Steps:');
      console.log('1. ✅ SQS Queue configured');
      console.log('2. ✅ Destination created');
      console.log('3. 🔄 Now create subscriptions using this destination');
      console.log('');
      console.log('📋 Save this Destination ID for subscriptions:');
      console.log(`   ${result.payload.destinationId}`);

      return result.payload.destinationId;
    } else {
      console.log('❌ Failed to create destination');
      return null;
    }

  } catch (error) {
    console.error('❌ Error setting up destination:', error.message);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Create SP-API Notification Destination (Grantless)');
  console.log('');
  console.log('Usage:');
  console.log('  node create-grantless-destination.cjs              # Create destination');
  console.log('  node create-grantless-destination.cjs --recreate   # Delete existing + recreate');
  console.log('  node create-grantless-destination.cjs --help       # Show this help');
  console.log('');
  console.log('Required Environment Variables:');
  console.log('  AMAZON_AWS_ACCESS_KEY_ID     # Your AWS access key');
  console.log('  AMAZON_AWS_SECRET_ACCESS_KEY # Your AWS secret key');
  console.log('  AMAZON_CLIENT_ID             # Your SP-API client ID');
  console.log('  AMAZON_CLIENT_SECRET         # Your SP-API client secret');
  console.log('');
  console.log('Note: AMAZON_REFRESH_TOKEN is NOT needed for grantless operations');
  process.exit(0);
}

// Run the setup
setupDestination().then(destinationId => {
  if (destinationId) {
    console.log('\n🚀 Ready for the next step: Create subscriptions!');
  }
}).catch(console.error);