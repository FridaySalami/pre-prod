#!/usr/bin/env node

/**
 * Amazon SP-API Permissions Discovery
 * Tests what endpoints you have access to and finds available SKUs
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

console.log('🔍 AMAZON SP-API PERMISSIONS DISCOVERY');
console.log('======================================');
console.log('✅ Marketplace ID:', MARKETPLACE_ID);
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
    `user-agent:SP-API-Discovery/1.0`,
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
      'User-Agent': 'SP-API-Discovery/1.0',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate
    },
    fullPath: query ? `${path}?${query}` : path
  };
}

// Test SP-API endpoint
async function testEndpoint(accessToken, path, query = '', name = '') {
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
          data: data,
          success: res.statusCode === 200
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Test multiple endpoints to see what you have access to
async function discoverPermissions(accessToken) {
  console.log('🔍 Testing Available Endpoints...\n');

  const endpoints = [
    {
      name: 'Orders API',
      path: '/orders/v0/orders',
      query: `MarketplaceIds=${MARKETPLACE_ID}&CreatedAfter=2024-01-01T00:00:00Z`
    },
    {
      name: 'Seller Account',
      path: '/sellers/v1/marketplaceParticipations',
      query: ''
    },
    {
      name: 'Reports API',
      path: '/reports/2021-06-30/reports',
      query: ''
    },
    {
      name: 'Listings Items',
      path: '/listings/2021-08-01/items',
      query: `marketplaceIds=${MARKETPLACE_ID}`
    },
    {
      name: 'Notifications API',
      path: '/notifications/v1/subscriptions',
      query: ''
    },
    {
      name: 'Feeds API',
      path: '/feeds/2021-06-30/feeds',
      query: ''
    },
    {
      name: 'Product Fees',
      path: '/products/fees/v0/listings',
      query: `MarketplaceId=${MARKETPLACE_ID}`
    },
    {
      name: 'Product Types',
      path: '/definitions/2020-09-01/productTypes',
      query: `marketplaceIds=${MARKETPLACE_ID}`
    }
  ];

  const results = [];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint.name}...`);
      const result = await testEndpoint(accessToken, endpoint.path, endpoint.query, endpoint.name);

      if (result.success) {
        console.log(`✅ ${endpoint.name}: ACCESSIBLE`);
        const data = JSON.parse(result.data);

        // Show some data preview
        if (endpoint.name === 'Orders API' && data.payload?.Orders) {
          console.log(`   - Found ${data.payload.Orders.length} orders`);
        } else if (endpoint.name === 'Seller Account' && data.payload) {
          console.log(`   - Marketplaces: ${data.payload.length}`);
        } else if (endpoint.name === 'Reports API' && data.reports) {
          console.log(`   - Available reports: ${data.reports.length}`);
        }

        results.push({ ...result, data: data });
      } else if (result.statusCode === 403) {
        console.log(`❌ ${endpoint.name}: NO PERMISSION`);
      } else if (result.statusCode === 404) {
        console.log(`⚠️  ${endpoint.name}: NOT FOUND (may need parameters)`);
      } else {
        console.log(`⚠️  ${endpoint.name}: Error ${result.statusCode}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint.name}: ERROR - ${error.message}`);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return results.filter(r => r.success);
}

// Get SKUs from orders (if accessible)
async function getSKUsFromOrders(accessToken) {
  console.log('\n🔍 Looking for SKUs in recent orders...');

  try {
    const result = await testEndpoint(
      accessToken,
      '/orders/v0/orders',
      `MarketplaceIds=${MARKETPLACE_ID}&CreatedAfter=2024-01-01T00:00:00Z`,
      'Orders for SKUs'
    );

    if (result.success) {
      const data = JSON.parse(result.data);
      const orders = data.payload?.Orders || [];

      console.log(`Found ${orders.length} orders`);

      // Get order items from first few orders
      const skus = new Set();

      for (let i = 0; i < Math.min(5, orders.length); i++) {
        const order = orders[i];
        console.log(`\nChecking order ${order.AmazonOrderId}...`);

        try {
          const itemsResult = await testEndpoint(
            accessToken,
            `/orders/v0/orders/${order.AmazonOrderId}/orderItems`,
            '',
            'Order Items'
          );

          if (itemsResult.success) {
            const itemsData = JSON.parse(itemsResult.data);
            const orderItems = itemsData.payload?.OrderItems || [];

            orderItems.forEach(item => {
              if (item.SellerSKU) {
                skus.add(item.SellerSKU);
                console.log(`   Found SKU: ${item.SellerSKU}`);
              }
            });
          }

          // Small delay
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.log(`   Error getting items: ${error.message}`);
        }
      }

      return Array.from(skus);
    }
  } catch (error) {
    console.log('Error getting SKUs from orders:', error.message);
  }

  return [];
}

// Main discovery function
async function runDiscovery() {
  try {
    console.log('🔐 Getting Access Token...');
    const accessToken = await getAccessToken();
    console.log('✅ Access token obtained\n');

    // Test endpoints
    const accessibleEndpoints = await discoverPermissions(accessToken);

    // Try to get SKUs
    const availableSKUs = await getSKUsFromOrders(accessToken);

    // Summary
    console.log('\n📊 DISCOVERY SUMMARY');
    console.log('════════════════════');
    console.log(`Accessible endpoints: ${accessibleEndpoints.length}`);
    console.log(`Available SKUs found: ${availableSKUs.length}`);

    if (availableSKUs.length > 0) {
      console.log('\n📝 Found SKUs:');
      availableSKUs.forEach(sku => console.log(`   - ${sku}`));

      console.log('\n💡 Try testing pricing with one of these SKUs instead of "ACC01 - 001"');
    }

  } catch (error) {
    console.error('❌ Discovery failed:', error);
  }
}

// Run the discovery
runDiscovery();
