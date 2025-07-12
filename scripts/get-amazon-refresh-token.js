#!/usr/bin/env node

/**
 * Amazon SP-API Refresh Token Generator
 * 
 * This script helps you generate a refresh token for Amazon SP-API integration.
 * For private apps (your own seller account), you can use this simplified process.
 */

const https = require('https');
const url = require('url');
const querystring = require('querystring');
require('dotenv').config();

// Configuration from .env file
const CLIENT_ID = process.env.AMAZON_CLIENT_ID;
const CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3001/api/amazon/oauth/callback';

// Amazon URLs for different regions
const AMAZON_URLS = {
  'eu-west-1': {
    sellerCentral: 'https://sellercentral.amazon.co.uk',
    tokenEndpoint: 'https://api.amazon.com/auth/o2/token'
  },
  'us-east-1': {
    sellerCentral: 'https://sellercentral.amazon.com',
    tokenEndpoint: 'https://api.amazon.com/auth/o2/token'
  }
};

const REGION = process.env.AMAZON_REGION || 'eu-west-1';
const amazonConfig = AMAZON_URLS[REGION];

console.log('='.repeat(60));
console.log('🚀 AMAZON SP-API REFRESH TOKEN GENERATOR');
console.log('='.repeat(60));

// Validate configuration
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing Amazon credentials in .env file');
  console.error('   Please ensure AMAZON_CLIENT_ID and AMAZON_CLIENT_SECRET are set');
  process.exit(1);
}

console.log('✅ Configuration loaded:');
console.log(`   Client ID: ${CLIENT_ID}`);
console.log(`   Region: ${REGION}`);
console.log(`   Redirect URI: ${REDIRECT_URI}`);
console.log('');

// Generate state parameter for security
const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// Build authorization URL
const authParams = {
  application_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  state: state,
  version: 'beta'
};

const authUrl = `${amazonConfig.sellerCentral}/apps/authorize/consent?${querystring.stringify(authParams)}`;

console.log('📋 STEP 1: AUTHORIZE YOUR APPLICATION');
console.log('─'.repeat(40));
console.log('1. Copy the URL below and open it in your browser');
console.log('2. Sign in to your Amazon Seller Central account');
console.log('3. Authorize the application');
console.log('4. Copy the authorization code from the callback URL');
console.log('');
console.log('🔗 Authorization URL:');
console.log(authUrl);
console.log('');

console.log('📋 STEP 2: EXTRACT AUTHORIZATION CODE');
console.log('─'.repeat(40));
console.log('After authorizing, you\'ll be redirected to a URL like:');
console.log(`${REDIRECT_URI}?code=ANQwertyuiop...&state=${state}`);
console.log('');
console.log('Copy the "code" parameter value (everything after "code=")');
console.log('');

// Function to exchange authorization code for refresh token
function exchangeCodeForToken(authCode) {
  return new Promise((resolve, reject) => {
    const tokenData = querystring.stringify({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: REDIRECT_URI,
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
            reject(new Error(`Token exchange failed: ${response.error_description || response.error}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
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

// Interactive mode - wait for user input
if (process.argv.length > 2) {
  // Command line argument provided
  const authCode = process.argv[2];
  console.log('📋 STEP 3: EXCHANGING CODE FOR REFRESH TOKEN');
  console.log('─'.repeat(40));
  console.log(`Processing authorization code: ${authCode.substring(0, 20)}...`);

  exchangeCodeForToken(authCode)
    .then(tokenResponse => {
      console.log('');
      console.log('🎉 SUCCESS! Refresh token generated:');
      console.log('='.repeat(60));
      console.log('');
      console.log('📝 ADD TO YOUR .env FILE:');
      console.log(`AMAZON_REFRESH_TOKEN=${tokenResponse.refresh_token}`);
      console.log('');
      console.log('📊 Token Details:');
      console.log(`   Refresh Token: ${tokenResponse.refresh_token}`);
      console.log(`   Access Token: ${tokenResponse.access_token}`);
      console.log(`   Token Type: ${tokenResponse.token_type}`);
      console.log(`   Expires In: ${tokenResponse.expires_in} seconds`);
      console.log('');
      console.log('✅ You can now use Amazon SP-API with your refresh token!');
    })
    .catch(error => {
      console.error('❌ Error exchanging code for token:', error.message);
      process.exit(1);
    });
} else {
  // Interactive mode
  console.log('📋 STEP 3: RUN WITH AUTHORIZATION CODE');
  console.log('─'.repeat(40));
  console.log('Once you have the authorization code, run:');
  console.log(`node ${__filename} YOUR_AUTHORIZATION_CODE`);
  console.log('');
  console.log('Example:');
  console.log(`node ${__filename} ANQwertyuiop123456789`);
}

console.log('');
console.log('🔧 TROUBLESHOOTING:');
console.log('─'.repeat(20));
console.log('• Make sure your redirect URI is added to Amazon Developer Console');
console.log('• Ensure your app has SP-API permissions in AWS IAM');
console.log('• Check that CLIENT_ID and CLIENT_SECRET are correct');
console.log('• Authorization codes expire quickly - use them immediately');
console.log('');
