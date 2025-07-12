#!/usr/bin/env node

/**
 * Complete Amazon SP-API Test
 * 
 * This script tests the full SP-API integration including AWS credentials
 */

const https = require('https');
const crypto = require('crypto');
require('dotenv').config();

// Configuration
const CLIENT_ID = process.env.AMAZON_CLIENT_ID;
const CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.AMAZON_REFRESH_TOKEN;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION || 'eu-west-1';
const MARKETPLACE_ID = process.env.AMAZON_MARKETPLACE_ID;
const SELLER_ID = process.env.AMAZON_SELLER_ID;

console.log('='.repeat(60));
console.log('🔬 COMPLETE AMAZON SP-API INTEGRATION TEST');
console.log('='.repeat(60));

// Validate configuration
console.log('📋 CONFIGURATION CHECK:');
console.log('─'.repeat(30));
console.log('✅ Client ID:', CLIENT_ID ? '✓ Set' : '❌ Missing');
console.log('✅ Client Secret:', CLIENT_SECRET ? '✓ Set' : '❌ Missing');
console.log('✅ Refresh Token:', REFRESH_TOKEN ? '✓ Set' : '❌ Missing');
console.log('✅ AWS Access Key:', AWS_ACCESS_KEY_ID ? '✓ Set' : '❌ Missing');
console.log('✅ AWS Secret Key:', AWS_SECRET_ACCESS_KEY ? '✓ Set' : '❌ Missing');
console.log('✅ AWS Region:', AWS_REGION);
console.log('✅ Marketplace ID:', MARKETPLACE_ID ? '✓ Set' : '❌ Missing');
console.log('✅ Seller ID:', SELLER_ID ? '✓ Set' : '❌ Missing');
console.log('');

const missingConfig = [];
if (!CLIENT_ID) missingConfig.push('AMAZON_CLIENT_ID');
if (!CLIENT_SECRET) missingConfig.push('AMAZON_CLIENT_SECRET');
if (!REFRESH_TOKEN) missingConfig.push('AMAZON_REFRESH_TOKEN');
if (!AWS_ACCESS_KEY_ID) missingConfig.push('AWS_ACCESS_KEY_ID');
if (!AWS_SECRET_ACCESS_KEY) missingConfig.push('AWS_SECRET_ACCESS_KEY');
if (!MARKETPLACE_ID) missingConfig.push('AMAZON_MARKETPLACE_ID');
if (!SELLER_ID) missingConfig.push('AMAZON_SELLER_ID');

if (missingConfig.length > 0) {
  console.log('❌ MISSING CONFIGURATION:');
  missingConfig.forEach(config => console.log(`   • ${config}`));
  console.log('');
  console.log('Please add these to your .env file before continuing.');
  process.exit(1);
}

// Function to get access token
async function getAccessToken() {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: REFRESH_TOKEN,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    }).toString();

    const options = {
      hostname: 'api.amazon.com',
      path: '/auth/o2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve(response.access_token);
          } else {
            reject(new Error(`Token refresh failed: ${response.error_description || response.error}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse token response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// AWS Signature Version 4 signing
function createSignature(stringToSign, secretKey, date, region, service) {
  const kDate = crypto.createHmac('sha256', 'AWS4' + secretKey).update(date).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();

  return crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
}

// Test SP-API call (Get Marketplace Participations)
async function testSPAPICall(accessToken) {
  return new Promise((resolve, reject) => {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substr(0, 8);

    const host = 'sellingpartnerapi-eu.amazon.com';
    const endpoint = '/sellers/v1/marketplaceParticipations';
    const method = 'GET';

    // Create canonical request
    const canonicalHeaders = `host:${host}\nx-amz-access-token:${accessToken}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-access-token;x-amz-date';
    const payloadHash = crypto.createHash('sha256').update('').digest('hex');

    const canonicalRequest = `${method}\n${endpoint}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${AWS_REGION}/execute-api/aws4_request`;
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

    // Create signature
    const signature = createSignature(stringToSign, AWS_SECRET_ACCESS_KEY, dateStamp, AWS_REGION, 'execute-api');

    // Create authorization header
    const authorization = `${algorithm} Credential=${AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const options = {
      hostname: host,
      path: endpoint,
      method: method,
      headers: {
        'Authorization': authorization,
        'x-amz-access-token': accessToken,
        'x-amz-date': amzDate,
        'User-Agent': 'MyApp/1.0 (Language=Node.js)'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve(response);
          } else {
            reject(new Error(`SP-API call failed (${res.statusCode}): ${JSON.stringify(response)}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse SP-API response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Main test function
async function runTest() {
  try {
    console.log('📋 STEP 1: REFRESHING ACCESS TOKEN');
    console.log('─'.repeat(40));
    const accessToken = await getAccessToken();
    console.log('✅ Access token obtained successfully!');
    console.log('');

    console.log('📋 STEP 2: TESTING SP-API CALL');
    console.log('─'.repeat(40));
    const apiResponse = await testSPAPICall(accessToken);
    console.log('🎉 SP-API call successful!');
    console.log('📊 Marketplace Participations:', JSON.stringify(apiResponse, null, 2));
    console.log('');

    console.log('🎉 SUCCESS! Your complete Amazon SP-API integration is working!');
    console.log('');
    console.log('✅ What you can do now:');
    console.log('   • Make SP-API calls to get orders, inventory, products');
    console.log('   • Implement pricing automation (you have Pricing permission)');
    console.log('   • Build your dashboard with real Amazon data');
    console.log('   • Set up webhooks for real-time notifications');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('   • Verify all environment variables are set correctly');
    console.log('   • Check AWS IAM user has SP-API permissions');
    console.log('   • Ensure your Amazon application is approved for SP-API');
    console.log('   • Verify your Seller ID is correct');
  }
}

runTest();
