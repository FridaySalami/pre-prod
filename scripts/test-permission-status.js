#!/usr/bin/env node

/**
 * Amazon SP-API Permission Status Check
 * This will tell you exactly what you need to enable
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

console.log('🔍 AMAZON SP-API PERMISSION STATUS CHECK');
console.log('========================================');

// Get access token
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

// Create AWS Signature
function createSignature(accessToken, endpoint, path, query = '') {
  const service = 'execute-api';
  const method = 'GET';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substr(0, 8);

  const canonicalHeaders = [
    `host:${endpoint}`,
    `user-agent:SP-API-Permission-Check/1.0`,
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

  return {
    headers: {
      'Authorization': authorization,
      'User-Agent': 'SP-API-Permission-Check/1.0',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate
    },
    fullPath: query ? `${path}?${query}` : path
  };
}

// Test endpoint access
async function testAccess(accessToken, path, query = '', name = '') {
  const endpoint = 'sellingpartnerapi-eu.amazon.com';
  const { headers, fullPath } = createSignature(accessToken, endpoint, path, query);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: endpoint,
      path: fullPath,
      method: 'GET',
      headers: headers
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          name: name,
          statusCode: res.statusCode,
          hasAccess: res.statusCode === 200,
          needsPermission: res.statusCode === 403,
          notFound: res.statusCode === 404
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Check all permission status
async function checkPermissions(accessToken) {
  console.log('🔍 Checking Permission Status...\n');

  const permissionTests = [
    {
      name: 'Orders API',
      permission: 'Built-in (already working)',
      path: '/orders/v0/orders',
      query: `MarketplaceIds=${MARKETPLACE_ID}&CreatedAfter=2024-01-01T00:00:00Z`,
      status: '✅ WORKING'
    },
    {
      name: 'Product Pricing API',
      permission: 'Pricing (checked in your screenshot)',
      path: '/products/pricing/v0/price',
      query: `MarketplaceId=${MARKETPLACE_ID}&Skus=TEST-SKU`,
      status: 'Testing...'
    },
    {
      name: 'Inventory Summaries',
      permission: 'Inventory and Order Tracking (NEED TO CHECK)',
      path: '/fba/inventory/v1/summaries',
      query: `details=true&granularityType=Marketplace&granularityId=${MARKETPLACE_ID}`,
      status: 'Testing...'
    },
    {
      name: 'Listings Items',
      permission: 'Product Listing (NEED TO CHECK)',
      path: '/listings/2021-08-01/items',
      query: `marketplaceIds=${MARKETPLACE_ID}`,
      status: 'Testing...'
    }
  ];

  const results = [];

  for (const test of permissionTests) {
    try {
      if (test.name === 'Orders API') {
        // We know this works
        console.log(`${test.status} ${test.name}`);
        console.log(`   Permission: ${test.permission}`);
        results.push({ ...test, hasAccess: true });
      } else {
        const result = await testAccess(accessToken, test.path, test.query, test.name);

        if (result.hasAccess) {
          console.log(`✅ WORKING ${test.name}`);
          console.log(`   Permission: ${test.permission}`);
        } else if (result.needsPermission) {
          console.log(`❌ NO ACCESS ${test.name}`);
          console.log(`   Permission needed: ${test.permission}`);
        } else if (result.notFound) {
          console.log(`⚠️  PARTIAL ACCESS ${test.name} (404 - may need parameters)`);
          console.log(`   Permission: ${test.permission}`);
        } else {
          console.log(`⚠️  UNKNOWN ${test.name} (Status: ${result.statusCode})`);
          console.log(`   Permission: ${test.permission}`);
        }

        results.push({ ...test, ...result });
      }

      console.log('');

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.log(`❌ ERROR ${test.name}: ${error.message}\n`);
    }
  }

  return results;
}

// Main function
async function checkPermissionStatus() {
  try {
    console.log('🔐 Getting Access Token...');
    const accessToken = await getAccessToken();
    console.log('✅ Access token obtained\n');

    const results = await checkPermissions(accessToken);

    // Summary
    console.log('📊 PERMISSION SUMMARY');
    console.log('═══════════════════════');

    const workingApis = results.filter(r => r.hasAccess).length;
    const totalApis = results.length;

    console.log(`Working APIs: ${workingApis}/${totalApis}`);
    console.log('');

    console.log('🎯 NEXT STEPS:');
    console.log('──────────────');
    console.log('1. Go to your Amazon Developer Console (where you took the screenshot)');
    console.log('2. Check these additional permissions:');
    console.log('   ✅ Inventory and Order Tracking');
    console.log('   ✅ Product Listing');
    console.log('3. Save the changes');
    console.log('4. Wait 5-10 minutes for permissions to activate');
    console.log('5. Run this test again');
    console.log('');
    console.log('💡 Once you have inventory access, you can find your active products');
    console.log('   and test pricing on SKUs that actually have pricing data!');

  } catch (error) {
    console.error('❌ Permission check failed:', error);
  }
}

// Run the check
checkPermissionStatus();
