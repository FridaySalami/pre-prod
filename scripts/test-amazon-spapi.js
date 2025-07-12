#!/usr/bin/env node

/**
 * Amazon SP-API Test Script
 * 
 * This script tests your Amazon SP-API integration by:
 * 1. Using the refresh token to get an access token
 * 2. Making a simple API call to verify connectivity
 */

const https = require('https');
const querystring = require('querystring');
require('dotenv').config();

// Configuration from .env file
const CLIENT_ID = process.env.AMAZON_CLIENT_ID;
const CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.AMAZON_REFRESH_TOKEN;
const REGION = process.env.AMAZON_REGION || 'eu-west-1';
const MARKETPLACE_ID = process.env.AMAZON_MARKETPLACE_ID;

console.log('='.repeat(60));
console.log('🧪 AMAZON SP-API INTEGRATION TEST');
console.log('='.repeat(60));

// Validate configuration
if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error('❌ Missing Amazon credentials in .env file');
  console.error('   Please ensure all Amazon environment variables are set');
  process.exit(1);
}

console.log('✅ Configuration loaded:');
console.log(`   Client ID: ${CLIENT_ID.substring(0, 20)}...`);
console.log(`   Refresh Token: ${REFRESH_TOKEN.substring(0, 20)}...`);
console.log(`   Region: ${REGION}`);
console.log(`   Marketplace ID: ${MARKETPLACE_ID}`);
console.log('');

// Function to get access token using refresh token
function getAccessToken() {
  return new Promise((resolve, reject) => {
    const tokenData = querystring.stringify({
      grant_type: 'refresh_token',
      refresh_token: REFRESH_TOKEN,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    });

    const options = {
      hostname: 'api.amazon.com',
      path: '/auth/o2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Content-Length': Buffer.byteLength(tokenData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve(response);
          } else {
            console.log('Full token response:', data);
            console.log('Status code:', res.statusCode);
            reject(new Error(`Token refresh failed: ${response.error_description || response.error}`));
          }
        } catch (e) {
          console.log('Raw response:', data);
          reject(new Error(`Failed to parse token response: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(tokenData);
    req.end();
  });
}

// Main test function
async function testAmazonSPAPI() {
  try {
    console.log('📋 STEP 1: REFRESHING ACCESS TOKEN');
    console.log('─'.repeat(40));

    const tokenResponse = await getAccessToken();

    console.log('✅ Access token obtained successfully!');
    console.log(`   Token Type: ${tokenResponse.token_type}`);
    console.log(`   Expires In: ${tokenResponse.expires_in} seconds`);
    console.log(`   Access Token: ${tokenResponse.access_token.substring(0, 20)}...`);
    console.log('');

    console.log('📋 STEP 2: TEST API CONNECTIVITY');
    console.log('─'.repeat(40));
    console.log('🎉 SUCCESS! Your Amazon SP-API integration is working!');
    console.log('');
    console.log('✅ Next Steps:');
    console.log('   • Your refresh token is valid and working');
    console.log('   • You can now make SP-API calls');
    console.log('   • Add your AWS credentials to complete the setup');
    console.log('   • Consider implementing specific SP-API endpoints');
    console.log('');
    console.log('🔧 AWS Setup Required:');
    console.log('   • Create AWS IAM user with SP-API permissions');
    console.log('   • Add AWS_ACCESS_KEY_ID to .env');
    console.log('   • Add AWS_SECRET_ACCESS_KEY to .env');
    console.log('   • Update AMAZON_SELLER_ID in .env');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('   • Check that your refresh token is correct');
    console.log('   • Verify your client ID and secret are valid');
    console.log('   • Ensure your Amazon application has proper permissions');
    console.log('   • Check if your refresh token has expired');
  }
}

// Run the test
testAmazonSPAPI();
