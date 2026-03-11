#!/usr/bin/env node

/**
 * Test Amazon Application Configuration
 * This will help diagnose issues with your Amazon application setup
 */

const https = require('https');
const querystring = require('querystring');
require('dotenv').config();

const CLIENT_ID = process.env.AMAZON_CLIENT_ID;
const CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET;

console.log('🔍 Testing Amazon Application Configuration');
console.log('==========================================');
console.log('Client ID:', CLIENT_ID);
console.log('');

// Test 1: Check if we can reach Amazon's OAuth endpoint
console.log('📡 Test 1: Testing OAuth Token Endpoint Access');
console.log('-----------------------------------------------');

const testData = querystring.stringify({
  grant_type: 'authorization_code',
  code: 'test_code_that_will_fail',
  redirect_uri: 'http://localhost:3001/api/amazon/oauth/callback',
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET
});

const options = {
  hostname: 'api.amazon.com',
  path: '/auth/o2/token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    'Content-Length': Buffer.byteLength(testData)
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response Status:', res.statusCode);
    console.log('Response Headers:', JSON.stringify(res.headers, null, 2));
    console.log('Response Body:', data);

    try {
      const response = JSON.parse(data);

      if (response.error === 'invalid_grant') {
        console.log('✅ Good: Application found, just invalid authorization code (expected)');
      } else if (response.error === 'invalid_client') {
        console.log('❌ Problem: Invalid client credentials - check your Client ID and Secret');
      } else {
        console.log('🤔 Unexpected response:', response.error);
      }
    } catch (e) {
      console.log('❌ Could not parse response as JSON');
    }

    console.log('');
    console.log('🔧 Next Steps:');
    console.log('1. If you see "invalid_grant" - your app credentials are correct');
    console.log('2. If you see "invalid_client" - check your credentials');
    console.log('3. Check your Amazon Developer Console for SP-API permissions');
    console.log('4. Ensure your application is approved for SP-API access');
  });
});

req.on('error', (e) => {
  console.error('❌ Request failed:', e.message);
});

req.write(testData);
req.end();
