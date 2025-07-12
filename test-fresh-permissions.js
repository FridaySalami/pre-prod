#!/usr/bin/env node

/**
 * Test if permissions are active with fresh tokens
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

console.log('🔄 TESTING WITH FRESH ACCESS TOKEN');
console.log('==================================');

// Get fresh access token
async function getFreshAccessToken() {
  console.log('🔐 Requesting fresh access token...');

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
          console.log('✅ Fresh access token obtained');
          console.log('   Token type:', result.token_type);
          console.log('   Expires in:', result.expires_in, 'seconds');
          console.log('   Scope:', result.scope || 'Not specified');
          resolve(result.access_token);
        } else {
          console.log('❌ Token refresh failed:', result);
          reject(result);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Quick permission test
async function quickPermissionTest(accessToken) {
  console.log('\n🧪 Quick permission test...');

  const endpoint = 'sellingpartnerapi-eu.amazon.com';
  const testPaths = [
    { name: 'Inventory', path: '/fba/inventory/v1/summaries', query: `details=true&granularityType=Marketplace&granularityId=${MARKETPLACE_ID}` },
    { name: 'Listings', path: '/listings/2021-08-01/items', query: `marketplaceIds=${MARKETPLACE_ID}` }
  ];

  for (const test of testPaths) {
    try {
      const result = await makeQuickCall(accessToken, endpoint, test.path, test.query);

      if (result.statusCode === 200) {
        console.log(`✅ ${test.name}: WORKING!`);
      } else if (result.statusCode === 403) {
        console.log(`❌ ${test.name}: Still no access (403)`);
      } else {
        console.log(`⚠️  ${test.name}: Status ${result.statusCode}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: Error - ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Make a quick API call
function makeQuickCall(accessToken, endpoint, path, query) {
  const service = 'execute-api';
  const method = 'GET';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substr(0, 8);

  const canonicalHeaders = [
    `host:${endpoint}`,
    `user-agent:SP-API-Fresh-Test/1.0`,
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

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${REGION}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  const kDate = crypto.createHmac('sha256', `AWS4${AWS_SECRET_KEY}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(REGION).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorization = `${algorithm} Credential=${AWS_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: endpoint,
      path: query ? `${path}?${query}` : path,
      method: 'GET',
      headers: {
        'Authorization': authorization,
        'User-Agent': 'SP-API-Fresh-Test/1.0',
        'x-amz-access-token': accessToken,
        'x-amz-date': amzDate
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data: data });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Main test
async function testFreshPermissions() {
  try {
    const accessToken = await getFreshAccessToken();
    await quickPermissionTest(accessToken);

    console.log('\n📋 DIAGNOSIS:');
    console.log('════════════');
    console.log('If still getting 403 errors:');
    console.log('1. ⏰ Permissions may need more time (wait 15-30 minutes)');
    console.log('2. 🔄 May need to complete OAuth flow again');
    console.log('3. 📝 Some permissions require Amazon manual approval');
    console.log('4. 🔍 Check Developer Console for pending approvals');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFreshPermissions();
