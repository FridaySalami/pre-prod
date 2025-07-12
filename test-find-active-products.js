#!/usr/bin/env node

/**
 * Find Current Active Products and Test Pricing
 * This will help find SKUs that actually have pricing data
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

console.log('🔍 FINDING ACTIVE PRODUCTS FOR PRICING');
console.log('======================================');

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
    `user-agent:SP-API-Active-Products/1.0`,
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
      'User-Agent': 'SP-API-Active-Products/1.0',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate
    },
    fullPath: query ? `${path}?${query}` : path
  };
}

// Test different endpoints to find active products
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
          data: data
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Get recent orders to find RECENT/ACTIVE SKUs
async function getRecentActiveSkus(accessToken) {
  console.log('📋 Looking for RECENT orders (last 30 days)...');

  // Look for very recent orders
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentDate = thirtyDaysAgo.toISOString();

  try {
    const result = await testEndpoint(
      accessToken,
      '/orders/v0/orders',
      `MarketplaceIds=${MARKETPLACE_ID}&CreatedAfter=${recentDate}&OrderStatuses=Unshipped,PartiallyShipped,Shipped,Delivered`,
      'Recent Orders'
    );

    if (result.statusCode === 200) {
      const data = JSON.parse(result.data);
      const orders = data.payload?.Orders || [];

      console.log(`✅ Found ${orders.length} recent orders`);

      // Get SKUs from recent orders
      const recentSkus = new Set();

      for (let i = 0; i < Math.min(10, orders.length); i++) {
        const order = orders[i];
        console.log(`   Checking order ${order.AmazonOrderId} (${order.OrderStatus})...`);

        try {
          const itemsResult = await testEndpoint(
            accessToken,
            `/orders/v0/orders/${order.AmazonOrderId}/orderItems`,
            '',
            'Order Items'
          );

          if (itemsResult.statusCode === 200) {
            const itemsData = JSON.parse(itemsResult.data);
            const orderItems = itemsData.payload?.OrderItems || [];

            orderItems.forEach(item => {
              if (item.SellerSKU) {
                recentSkus.add(item.SellerSKU);
                console.log(`      Found recent SKU: ${item.SellerSKU}`);
              }
            });
          }

          // Small delay
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.log(`      Error getting items: ${error.message}`);
        }
      }

      return Array.from(recentSkus);
    } else {
      console.log('❌ Could not get recent orders:', result.data);
      return [];
    }
  } catch (error) {
    console.log('❌ Error getting recent orders:', error.message);
    return [];
  }
}

// Test pricing for a SKU
async function testPricingForSku(accessToken, sku) {
  console.log(`\n🔍 Testing pricing for SKU: ${sku}`);
  console.log('─'.repeat(35 + sku.length));

  // Test regular pricing
  try {
    const result = await testEndpoint(
      accessToken,
      '/products/pricing/v0/price',
      `MarketplaceId=${MARKETPLACE_ID}&Skus=${encodeURIComponent(sku)}`,
      'Pricing'
    );

    if (result.statusCode === 200) {
      console.log('✅ SUCCESS! Found pricing data:');
      const data = JSON.parse(result.data);

      if (data.payload && data.payload.length > 0) {
        const priceData = data.payload[0];
        console.log(`   SKU: ${priceData.SellerSKU}`);
        console.log(`   ASIN: ${priceData.ASIN}`);
        console.log(`   Status: ${priceData.status}`);

        if (priceData.Product?.Offers) {
          priceData.Product.Offers.forEach((offer, index) => {
            console.log(`   Offer ${index + 1}:`);
            console.log(`     Condition: ${offer.OfferType?.condition}`);
            console.log(`     Price: ${offer.Price?.LandedPrice?.Amount} ${offer.Price?.LandedPrice?.CurrencyCode}`);
          });
        }
      }

      return true;
    } else if (result.statusCode === 404) {
      console.log('⚠️  No pricing data found for this SKU');
      return false;
    } else if (result.statusCode === 403) {
      console.log('❌ Access denied - check permissions');
      return false;
    } else {
      console.log(`⚠️  Status ${result.statusCode}:`, result.data);
      return false;
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    return false;
  }
}

// Main function
async function findAndTestPricing() {
  try {
    console.log('🔐 Getting Access Token...');
    const accessToken = await getAccessToken();
    console.log('✅ Access token obtained\n');

    // Get recent active SKUs
    const recentSkus = await getRecentActiveSkus(accessToken);

    if (recentSkus.length === 0) {
      console.log('\n❌ No recent SKUs found. This might mean:');
      console.log('   - No recent orders in the last 30 days');
      console.log('   - Need to check older orders');
      console.log('   - Need inventory permissions to see active listings');
      return;
    }

    console.log(`\n📋 Testing pricing for ${recentSkus.length} recent SKUs...`);

    let successCount = 0;

    // Test pricing for each recent SKU
    for (const sku of recentSkus.slice(0, 5)) { // Test first 5
      const success = await testPricingForSku(accessToken, sku);
      if (success) successCount++;

      // Delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n📊 PRICING TEST SUMMARY');
    console.log('═══════════════════════');
    console.log(`SKUs tested: ${Math.min(5, recentSkus.length)}`);
    console.log(`Successful pricing calls: ${successCount}`);

    if (successCount === 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      console.log('   1. Check "Inventory and Order Tracking" permission in Amazon Developer Console');
      console.log('   2. The tested SKUs might be discontinued or private label items');
      console.log('   3. Try testing with a SKU you know is currently active/listed');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
findAndTestPricing();
