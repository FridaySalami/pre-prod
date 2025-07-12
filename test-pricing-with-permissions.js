#!/usr/bin/env node

/**
 * Test Amazon SP-API with Pricing permissions enabled
 * Testing with your actual SKUs that we found
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

// Test with actual SKUs we found
const TEST_SKUS = ['VIN21', 'BAK04C', 'CAL02A - 002'];

console.log('🔍 TESTING PRICING WITH ACTUAL SKUS');
console.log('===================================');
console.log('✅ Testing SKUs:', TEST_SKUS.join(', '));
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

// Create AWS Signature v4
function createSignature(accessToken, endpoint, path, query = '') {
  const service = 'execute-api';
  const method = 'GET';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substr(0, 8);

  const canonicalHeaders = [
    `host:${endpoint}`,
    `user-agent:SP-API-Pricing-Test/1.0`,
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
      'User-Agent': 'SP-API-Pricing-Test/1.0',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate
    },
    fullPath: query ? `${path}?${query}` : path
  };
}

// Test pricing endpoint
async function testPricing(accessToken, sku) {
  const endpoint = 'sellingpartnerapi-eu.amazon.com';
  const path = '/products/pricing/v0/price';
  const query = `MarketplaceId=${MARKETPLACE_ID}&Skus=${encodeURIComponent(sku)}`;

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
          sku: sku,
          statusCode: res.statusCode,
          data: data
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Test competitive pricing
async function testCompetitivePricing(accessToken, sku) {
  const endpoint = 'sellingpartnerapi-eu.amazon.com';
  const path = '/products/pricing/v0/competitivePrice';
  const query = `MarketplaceId=${MARKETPLACE_ID}&Skus=${encodeURIComponent(sku)}`;

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
          sku: sku,
          statusCode: res.statusCode,
          data: data
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Main test function
async function runPricingTest() {
  try {
    console.log('🔐 Getting Access Token...');
    const accessToken = await getAccessToken();
    console.log('✅ Access token obtained\n');

    // Test each SKU for pricing
    for (const sku of TEST_SKUS) {
      console.log(`📋 Testing SKU: ${sku}`);
      console.log('─'.repeat(30 + sku.length));

      // Test regular pricing
      console.log('1. Regular Pricing API...');
      try {
        const pricingResult = await testPricing(accessToken, sku);

        if (pricingResult.statusCode === 200) {
          console.log('✅ SUCCESS! Pricing data found:');
          const data = JSON.parse(pricingResult.data);
          console.log(JSON.stringify(data, null, 2));
        } else if (pricingResult.statusCode === 403) {
          console.log('❌ 403 Forbidden - Pricing permission not active yet');
        } else if (pricingResult.statusCode === 404) {
          console.log('⚠️  404 Not Found - SKU may not have pricing data');
        } else {
          console.log(`⚠️  Status ${pricingResult.statusCode}:`, pricingResult.data);
        }
      } catch (error) {
        console.log('❌ Error:', error.message);
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Test competitive pricing
      console.log('2. Competitive Pricing API...');
      try {
        const compResult = await testCompetitivePricing(accessToken, sku);

        if (compResult.statusCode === 200) {
          console.log('✅ SUCCESS! Competitive pricing found:');
          const data = JSON.parse(compResult.data);
          console.log(JSON.stringify(data, null, 2));
        } else if (compResult.statusCode === 403) {
          console.log('❌ 403 Forbidden - Pricing permission not active yet');
        } else if (compResult.statusCode === 404) {
          console.log('⚠️  404 Not Found - No competitive pricing data');
        } else {
          console.log(`⚠️  Status ${compResult.statusCode}:`, compResult.data);
        }
      } catch (error) {
        console.log('❌ Error:', error.message);
      }

      console.log('');

      // Delay between SKUs
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('📊 PRICING TEST COMPLETE');
    console.log('If you see 403 errors, the pricing permission may need time to activate.');
    console.log('Try checking "Inventory and Order Tracking" in your Amazon Developer Console.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
runPricingTest();
