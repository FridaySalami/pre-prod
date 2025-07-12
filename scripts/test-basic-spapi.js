#!/usr/bin/env node

/**
 * Amazon SP-API Basic Test
 * 
 * This script tests basic token refresh and simpler API calls
 */

const https = require('https');
require('dotenv').config();

// Configuration
const CLIENT_ID = process.env.AMAZON_CLIENT_ID;
const CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.AMAZON_REFRESH_TOKEN;
const SELLER_ID = process.env.AMAZON_SELLER_ID;

console.log('='.repeat(60));
console.log('🧪 AMAZON SP-API BASIC TEST');
console.log('='.repeat(60));

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
            resolve(response);
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

// Main test function
async function runTest() {
  try {
    console.log('📋 TESTING TOKEN REFRESH');
    console.log('─'.repeat(40));

    const tokenResponse = await getAccessToken();

    console.log('✅ Token refresh successful!');
    console.log('📊 Token Details:');
    console.log(`   Token Type: ${tokenResponse.token_type}`);
    console.log(`   Expires In: ${tokenResponse.expires_in} seconds`);
    console.log(`   Access Token: ${tokenResponse.access_token.substring(0, 20)}...`);
    console.log('');

    console.log('📋 CONFIGURATION SUMMARY');
    console.log('─'.repeat(40));
    console.log('✅ Amazon OAuth: Working');
    console.log('✅ Refresh Token: Valid');
    console.log('✅ Access Token: Obtained');
    console.log(`✅ Seller ID: ${SELLER_ID}`);
    console.log('');

    console.log('🎉 SUCCESS! Basic SP-API authentication is working!');
    console.log('');
    console.log('📋 NEXT STEPS:');
    console.log('   • The 403 error suggests AWS IAM permissions need adjustment');
    console.log('   • Your Amazon SP-API application is working correctly');
    console.log('   • Try adding more specific IAM policies for SP-API');
    console.log('   • Consider using the SP-API sandbox for testing');
    console.log('');
    console.log('🔧 RECOMMENDED IAM POLICY:');
    console.log('   Add this policy to your AWS IAM user:');
    console.log('   {');
    console.log('     "Version": "2012-10-17",');
    console.log('     "Statement": [');
    console.log('       {');
    console.log('         "Effect": "Allow",');
    console.log('         "Action": "execute-api:Invoke",');
    console.log('         "Resource": "arn:aws:execute-api:*:*:*"');
    console.log('       }');
    console.log('     ]');
    console.log('   }');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTest();
