#!/usr/bin/env node

/**
 * Check SP-API Application Permissions
 * 
 * This script checks what permissions your SP-API application currently has
 * and identifies missing permissions needed for notifications.
 */

const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

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

// AWS Signature V4 implementation (simplified)
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

// Test different SP-API endpoints to see which permissions you have
async function testPermissions(accessToken) {
  const tests = [
    {
      name: 'Product Pricing API',
      path: '/products/pricing/v0/price',
      params: { MarketplaceId: config.marketplace, Asins: 'B08N5WRWNW' }, // Test ASIN
      required: 'Product Pricing'
    },
    {
      name: 'Competitive Pricing API',
      path: '/products/pricing/v0/competitivePrice',
      params: { MarketplaceId: config.marketplace, Asins: 'B08N5WRWNW' },
      required: 'Product Pricing'
    },
    {
      name: 'Notifications API',
      path: '/notifications/v1/subscriptions',
      params: { marketplaceId: config.marketplace },
      required: 'Notifications'
    },
    {
      name: 'Listings API',
      path: '/listings/2021-08-01/items',
      params: { marketplacesIds: config.marketplace },
      required: 'Product Listing'
    }
  ];

  console.log('🔍 Testing SP-API Permissions...');
  console.log('═'.repeat(50));

  const results = [];

  for (const test of tests) {
    try {
      const headers = {
        'host': 'sellingpartnerapi-eu.amazon.com',
        'x-amz-access-token': accessToken,
        'content-type': 'application/json'
      };

      const signedHeaders = createSignature(
        'GET',
        test.path,
        test.params,
        headers,
        '',
        config.region,
        'execute-api',
        config.accessKeyId,
        config.secretAccessKey
      );

      console.log(`Testing ${test.name}...`);

      const response = await axios.get(`${config.endpoint}${test.path}`, {
        params: test.params,
        headers: signedHeaders,
        timeout: 10000
      });

      console.log(`✅ ${test.name} - GRANTED`);
      results.push({ ...test, status: 'GRANTED', error: null });

    } catch (error) {
      const errorCode = error.response?.data?.errors?.[0]?.code || error.code;
      const errorMessage = error.response?.data?.errors?.[0]?.message || error.message;

      if (errorCode === 'Unauthorized' || errorMessage.includes('Access to requested resource is denied')) {
        console.log(`❌ ${test.name} - DENIED (Missing Permission)`);
        results.push({ ...test, status: 'DENIED', error: 'Missing Permission' });
      } else if (errorCode === 'InvalidInput' || error.response?.status === 400) {
        console.log(`✅ ${test.name} - GRANTED (Invalid request, but permission exists)`);
        results.push({ ...test, status: 'GRANTED', error: 'Invalid Input (Permission OK)' });
      } else {
        console.log(`⚠️  ${test.name} - ERROR: ${errorMessage}`);
        results.push({ ...test, status: 'ERROR', error: errorMessage });
      }
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

async function checkPermissions() {
  console.log('🔐 SP-API Permission Checker');
  console.log('═'.repeat(40));

  try {
    console.log('🔑 Getting access token...');
    const accessToken = await getAccessToken();
    console.log('✅ Access token obtained\n');

    const results = await testPermissions(accessToken);

    console.log('\n📊 PERMISSION SUMMARY:');
    console.log('═'.repeat(50));

    const granted = results.filter(r => r.status === 'GRANTED');
    const denied = results.filter(r => r.status === 'DENIED');
    const errors = results.filter(r => r.status === 'ERROR');

    console.log(`✅ GRANTED Permissions (${granted.length}):`);
    granted.forEach(r => console.log(`   • ${r.required}`));

    console.log(`\n❌ MISSING Permissions (${denied.length}):`);
    denied.forEach(r => console.log(`   • ${r.required} (${r.name})`));

    if (errors.length > 0) {
      console.log(`\n⚠️  ERRORS (${errors.length}):`);
      errors.forEach(r => console.log(`   • ${r.name}: ${r.error}`));
    }

    console.log('\n🔗 NEXT STEPS:');

    if (denied.some(r => r.required === 'Notifications')) {
      console.log('1. 🚨 CRITICAL: Request Notifications API permission');
      console.log('   - Go to Amazon Developer Console');
      console.log('   - Edit your SP-API application');
      console.log('   - Add "Notifications" permission');
      console.log('   - Submit for approval (usually instant)');
    }

    if (denied.length === 0) {
      console.log('🎉 All required permissions are available!');
      console.log('   You can proceed with setting up notifications.');
    }

    console.log('\n📚 Resources:');
    console.log('   - Developer Console: https://developer.amazon.com/settings/console/sp-api');
    console.log('   - SP-API Guide: https://developer-docs.amazon.com/sp-api/');

  } catch (error) {
    console.error('❌ Error checking permissions:', error.message);
    process.exit(1);
  }
}

// Run the check
checkPermissions().catch(console.error);