#!/usr/bin/env node

/**
 * Complete Amazon SP-API Integration Test
 * Tests OAuth, AWS signing, and actual API calls
 */

import https from 'https';
import crypto from 'crypto';
import { config } from 'dotenv';

config();

const CLIENT_ID = process.env.AMAZON_CLIENT_ID;
const CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.AMAZON_REFRESH_TOKEN;
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const REGION = process.env.AMAZON_REGION || 'eu-west-1';
const MARKETPLACE_ID = process.env.AMAZON_MARKETPLACE_ID;

console.log('🔍 COMPLETE SP-API INTEGRATION TEST');
console.log('=====================================');
console.log('✅ Client ID:', CLIENT_ID?.substring(0, 20) + '...');
console.log('✅ AWS Access Key:', AWS_ACCESS_KEY?.substring(0, 10) + '...');
console.log('✅ Region:', REGION);
console.log('✅ Marketplace ID:', MARKETPLACE_ID);
console.log('');

// Step 1: Get access token
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
        const result = JSON.parse(data);
        if (res.statusCode === 200) {
          resolve(result.access_token);
        } else {
          reject(result);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Step 2: Create AWS Signature v4
function createSignature(accessToken, endpoint) {
  const service = 'execute-api';
  const method = 'GET';
  const path = '/orders/v0/orders';
  const query = `MarketplaceIds=${MARKETPLACE_ID}&CreatedAfter=2024-01-01T00:00:00Z`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substr(0, 8);

  // Create canonical request
  const canonicalHeaders = [
    `host:${endpoint}`,
    `user-agent:SP-API-Test/1.0`,
    `x-amz-access-token:${accessToken}`,
    `x-amz-date:${amzDate}`
  ].join('\n') + '\n';

  const signedHeaders = 'host;user-agent;x-amz-access-token;x-amz-date';

  const canonicalRequest = [
    method,
    path,
    query,
    canonicalHeaders,
    signedHeaders,
    crypto.createHash('sha256').update('').digest('hex')
  ].join('\n');

  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${REGION}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  // Calculate signature
  const kDate = crypto.createHmac('sha256', `AWS4${AWS_SECRET_KEY}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(REGION).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorization = `${algorithm} Credential=${AWS_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    headers: {
      'Authorization': authorization,
      'User-Agent': 'SP-API-Test/1.0',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate
    },
    path: `${path}?${query}`
  };
}

// Step 3: Test SP-API call
async function testSPAPICall(accessToken) {
  const endpoint = `sellingpartnerapi-eu.amazon.com`;
  const { headers, path } = createSignature(accessToken, endpoint);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: endpoint,
      path: path,
      method: 'GET',
      headers: headers
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const result = { statusCode: res.statusCode, data: data };
        resolve(result);
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Run complete test
async function runCompleteTest() {
  try {
    console.log('📋 STEP 1: Getting Access Token');
    console.log('────────────────────────────────');
    const accessToken = await getAccessToken();
    console.log('✅ Access token obtained:', accessToken.substring(0, 20) + '...');
    console.log('');

    console.log('📋 STEP 2: Testing SP-API Orders Endpoint');
    console.log('─────────────────────────────────────────');
    const result = await testSPAPICall(accessToken);

    console.log('Status Code:', result.statusCode);

    if (result.statusCode === 200) {
      console.log('🎉 SUCCESS! SP-API is fully working!');
      const orders = JSON.parse(result.data);
      console.log('Orders found:', orders.payload?.Orders?.length || 0);
    } else if (result.statusCode === 403) {
      console.log('⚠️  Permission denied - check your SP-API application permissions');
      console.log('Response:', result.data);
    } else if (result.statusCode === 401) {
      console.log('⚠️  Authentication failed - check your AWS credentials');
      console.log('Response:', result.data);
    } else {
      console.log('⚠️  Unexpected response:');
      console.log('Response:', result.data);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
runCompleteTest();
