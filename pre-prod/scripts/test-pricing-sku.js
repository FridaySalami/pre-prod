#!/usr/bin/env node

/**
 * Amazon SP-API Pricing Test for SKU: ACC01 - 001
 * Tests multiple endpoints to find and get pricing data
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

const TEST_SKU = 'ACC01 - 001';

console.log('🔍 AMAZON SP-API PRICING TEST');
console.log('==============================');
console.log('✅ Testing SKU:', TEST_SKU);
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

// Step 2: Create AWS Signature v4 (flexible for different endpoints)
function createSignature(accessToken, endpoint, path, query = '') {
  const service = 'execute-api';
  const method = 'GET';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substr(0, 8);

  // Create canonical request
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
      'User-Agent': 'SP-API-Pricing-Test/1.0',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate
    },
    fullPath: query ? `${path}?${query}` : path
  };
}

// Generic SP-API call function
async function makeSPAPICall(accessToken, path, query = '', description = '') {
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
          statusCode: res.statusCode,
          data: data,
          description: description
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Test 1: Product Pricing API
async function testProductPricing(accessToken, sku) {
  console.log('📋 Test 1: Product Pricing API');
  console.log('───────────────────────────────');

  const path = '/products/pricing/v0/price';
  const query = `MarketplaceId=${MARKETPLACE_ID}&Skus=${encodeURIComponent(sku)}`;

  try {
    const result = await makeSPAPICall(accessToken, path, query, 'Product Pricing');
    console.log('Status Code:', result.statusCode);

    if (result.statusCode === 200) {
      const data = JSON.parse(result.data);
      console.log('✅ Pricing data found!');
      console.log('Response:', JSON.stringify(data, null, 2));
      return data;
    } else {
      console.log('Response:', result.data);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('');
  return null;
}

// Test 2: Catalog Items API (search by keywords)
async function testCatalogSearch(accessToken, sku) {
  console.log('📋 Test 2: Catalog Items Search');
  console.log('─────────────────────────────────');

  const path = '/catalog/2022-04-01/items';
  const query = `marketplaceIds=${MARKETPLACE_ID}&keywords=${encodeURIComponent(sku)}&includedData=summaries,attributes,salesRanks`;

  try {
    const result = await makeSPAPICall(accessToken, path, query, 'Catalog Search');
    console.log('Status Code:', result.statusCode);

    if (result.statusCode === 200) {
      const data = JSON.parse(result.data);
      console.log('✅ Catalog items found:', data.items?.length || 0);
      if (data.items?.length > 0) {
        data.items.forEach((item, index) => {
          console.log(`\nItem ${index + 1}:`);
          console.log('ASIN:', item.asin);
          console.log('Title:', item.summaries?.[0]?.itemName);
          console.log('Brand:', item.summaries?.[0]?.brand);
        });
      }
      return data;
    } else {
      console.log('Response:', result.data);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('');
  return null;
}

// Test 3: Inventory Summary (your own inventory)
async function testInventorySummary(accessToken) {
  console.log('📋 Test 3: Inventory Summary (Your Products)');
  console.log('─────────────────────────────────────────────');

  const path = '/fba/inventory/v1/summaries';
  const query = `details=true&granularityType=Marketplace&granularityId=${MARKETPLACE_ID}&marketplaceIds=${MARKETPLACE_ID}`;

  try {
    const result = await makeSPAPICall(accessToken, path, query, 'Inventory Summary');
    console.log('Status Code:', result.statusCode);

    if (result.statusCode === 200) {
      const data = JSON.parse(result.data);
      console.log('✅ Inventory items found:', data.inventorySummaries?.length || 0);

      // Look for our SKU
      const matchingSku = data.inventorySummaries?.find(item =>
        item.sellerSku === TEST_SKU ||
        item.sellerSku?.toLowerCase() === TEST_SKU.toLowerCase() ||
        item.sellerSku?.includes('ACC01')
      );

      if (matchingSku) {
        console.log('\n🎯 Found matching SKU in inventory:');
        console.log('SKU:', matchingSku.sellerSku);
        console.log('ASIN:', matchingSku.asin);
        console.log('Condition:', matchingSku.condition);
        console.log('Total Quantity:', matchingSku.totalQuantity);
      } else {
        console.log('\n📝 Available SKUs (first 10):');
        data.inventorySummaries?.slice(0, 10).forEach(item => {
          console.log(`- ${item.sellerSku} (ASIN: ${item.asin})`);
        });
      }
      return data;
    } else {
      console.log('Response:', result.data);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('');
  return null;
}

// Test 4: Competitive Pricing
async function testCompetitivePricing(accessToken, sku) {
  console.log('📋 Test 4: Competitive Pricing');
  console.log('────────────────────────────────');

  const path = '/products/pricing/v0/competitivePrice';
  const query = `MarketplaceId=${MARKETPLACE_ID}&Skus=${encodeURIComponent(sku)}`;

  try {
    const result = await makeSPAPICall(accessToken, path, query, 'Competitive Pricing');
    console.log('Status Code:', result.statusCode);

    if (result.statusCode === 200) {
      const data = JSON.parse(result.data);
      console.log('✅ Competitive pricing data found!');
      console.log('Response:', JSON.stringify(data, null, 2));
      return data;
    } else {
      console.log('Response:', result.data);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('');
  return null;
}

// Main test function
async function runPricingTests() {
  try {
    console.log('🔐 Getting Access Token...');
    const accessToken = await getAccessToken();
    console.log('✅ Access token obtained\n');

    // Run all tests
    const results = {
      pricing: await testProductPricing(accessToken, TEST_SKU),
      catalog: await testCatalogSearch(accessToken, TEST_SKU),
      inventory: await testInventorySummary(accessToken),
      competitive: await testCompetitivePricing(accessToken, TEST_SKU)
    };

    // Summary
    console.log('📊 SUMMARY');
    console.log('══════════');
    console.log('Product Pricing API:', results.pricing ? '✅ Success' : '❌ No data');
    console.log('Catalog Search:', results.catalog ? '✅ Success' : '❌ No data');
    console.log('Inventory Summary:', results.inventory ? '✅ Success' : '❌ No data');
    console.log('Competitive Pricing:', results.competitive ? '✅ Success' : '❌ No data');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the pricing tests
runPricingTests();
