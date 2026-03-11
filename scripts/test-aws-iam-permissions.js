#!/usr/bin/env node

/**
 * Test AWS IAM permissions for SP-API
 * This will help identify missing AWS permissions
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

console.log('🔍 AWS IAM PERMISSIONS TEST FOR SP-API');
console.log('======================================');
console.log('Testing if AWS IAM user has the right permissions...');
console.log('');

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

// Test different SP-API endpoints with detailed error analysis
async function testEndpointWithErrorAnalysis(accessToken, endpoint, path, query, name) {
  const service = 'execute-api';
  const method = 'GET';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substr(0, 8);

  const canonicalHeaders = [
    `host:${endpoint}`,
    `user-agent:SP-API-IAM-Test/1.0`,
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
        'User-Agent': 'SP-API-IAM-Test/1.0',
        'x-amz-access-token': accessToken,
        'x-amz-date': amzDate
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        let errorDetails = '';

        try {
          const parsedData = JSON.parse(data);
          if (parsedData.errors && parsedData.errors.length > 0) {
            errorDetails = parsedData.errors[0].message;
          }
        } catch (e) {
          errorDetails = data;
        }

        resolve({
          name: name,
          statusCode: res.statusCode,
          data: data,
          errorDetails: errorDetails,
          headers: res.headers
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Test all endpoints with error analysis
async function testAllEndpoints(accessToken) {
  const endpoint = 'sellingpartnerapi-eu.amazon.com';

  const tests = [
    {
      name: 'Orders API',
      path: '/orders/v0/orders',
      query: `MarketplaceIds=${MARKETPLACE_ID}&CreatedAfter=2024-01-01T00:00:00Z`,
      expectedPermission: 'Basic (should work)'
    },
    {
      name: 'Product Pricing',
      path: '/products/pricing/v0/price',
      query: `MarketplaceId=${MARKETPLACE_ID}&Skus=TEST-SKU`,
      expectedPermission: 'Pricing (checked in Developer Console)'
    },
    {
      name: 'FBA Inventory',
      path: '/fba/inventory/v1/summaries',
      query: `details=true&granularityType=Marketplace&granularityId=${MARKETPLACE_ID}`,
      expectedPermission: 'AWS IAM: FBA Inventory access'
    },
    {
      name: 'Listings Items',
      path: '/listings/2021-08-01/items',
      query: `marketplaceIds=${MARKETPLACE_ID}`,
      expectedPermission: 'AWS IAM: Product Listings access'
    },
    {
      name: 'Reports API',
      path: '/reports/2021-06-30/reports',
      query: '',
      expectedPermission: 'AWS IAM: Reports access'
    }
  ];

  console.log('🧪 Testing all endpoints with error analysis...\n');

  for (const test of tests) {
    try {
      console.log(`Testing ${test.name}...`);
      const result = await testEndpointWithErrorAnalysis(
        accessToken,
        endpoint,
        test.path,
        test.query,
        test.name
      );

      if (result.statusCode === 200) {
        console.log(`✅ ${test.name}: SUCCESS`);
      } else if (result.statusCode === 403) {
        console.log(`❌ ${test.name}: ACCESS DENIED`);
        console.log(`   Expected permission: ${test.expectedPermission}`);
        console.log(`   Error: ${result.errorDetails}`);

        // Analyze the error message
        if (result.errorDetails.includes('Unauthorized')) {
          console.log(`   💡 This suggests AWS IAM permission issue`);
        }
      } else if (result.statusCode === 404) {
        console.log(`⚠️  ${test.name}: NOT FOUND (may need parameters)`);
      } else {
        console.log(`⚠️  ${test.name}: Status ${result.statusCode}`);
        console.log(`   Error: ${result.errorDetails}`);
      }

      console.log('');

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR - ${error.message}\n`);
    }
  }
}

// Main test function
async function runIAMTest() {
  try {
    console.log('🔐 Getting access token...');
    const accessToken = await getAccessToken();
    console.log('✅ Access token obtained\n');

    await testAllEndpoints(accessToken);

    console.log('📊 ANALYSIS & RECOMMENDATIONS');
    console.log('═════════════════════════════');
    console.log('Based on your AWS IAM screenshot, you have:');
    console.log('✅ AWSMarketplaceSellerFullAccess');
    console.log('✅ AWSMarketplaceSellerOfferManagement');
    console.log('✅ OperationsAPI');
    console.log('');
    console.log('🎯 If you\'re still getting 403 errors on FBA/Listings:');
    console.log('');
    console.log('1. Add these AWS managed policies to your IAM user:');
    console.log('   - Search for "FBA" or "Inventory" policies');
    console.log('   - Look for "Listings" policies');
    console.log('');
    console.log('2. OR create a custom policy with these permissions:');
    console.log('   - execute-api:Invoke on arn:aws:execute-api:*:*:*/*/fba/inventory/*');
    console.log('   - execute-api:Invoke on arn:aws:execute-api:*:*:*/*/listings/*');
    console.log('');
    console.log('3. The key is matching Developer Console permissions with AWS IAM permissions');

  } catch (error) {
    console.error('❌ IAM test failed:', error);
  }
}

// Run the IAM test
runIAMTest();
