#!/usr/bin/env node

/**
 * Alternative approach: Find active products using Reports API
 * and test pricing without needing inventory permissions
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

console.log('🔄 ALTERNATIVE APPROACH: FINDING ACTIVE PRODUCTS');
console.log('===============================================');

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

// Create AWS signature
function createSignature(accessToken, endpoint, path, query = '') {
  const service = 'execute-api';
  const method = 'GET';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substr(0, 8);

  const canonicalHeaders = [
    `host:${endpoint}`,
    `user-agent:SP-API-Alternative/1.0`,
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
      'User-Agent': 'SP-API-Alternative/1.0',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate
    },
    fullPath: query ? `${path}?${query}` : path
  };
}

// Test API call
async function testApiCall(accessToken, path, query = '', description = '') {
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

// Try to find active products through different approaches
async function findActiveProducts(accessToken) {
  console.log('🔍 Trying different approaches to find active products...\n');

  // Approach 1: Recent orders (we know this works)
  console.log('1. 📦 Getting recent orders...');
  try {
    const result = await testApiCall(
      accessToken,
      '/orders/v0/orders',
      `MarketplaceIds=${MARKETPLACE_ID}&CreatedAfter=2025-06-01T00:00:00Z&OrderStatuses=Unshipped,PartiallyShipped,Shipped`,
      'Recent Orders'
    );

    if (result.statusCode === 200) {
      const data = JSON.parse(result.data);
      console.log(`✅ Found ${data.payload?.Orders?.length || 0} recent orders`);

      // Get SKUs from first 3 orders
      const orders = data.payload?.Orders || [];
      const recentSkus = [];

      for (let i = 0; i < Math.min(3, orders.length); i++) {
        const order = orders[i];
        try {
          const itemsResult = await testApiCall(
            accessToken,
            `/orders/v0/orders/${order.AmazonOrderId}/orderItems`,
            '',
            'Order Items'
          );

          if (itemsResult.statusCode === 200) {
            const itemsData = JSON.parse(itemsResult.data);
            itemsData.payload?.OrderItems?.forEach(item => {
              if (item.SellerSKU) {
                recentSkus.push(item.SellerSKU);
              }
            });
          }

          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.log(`   Error getting order items: ${error.message}`);
        }
      }

      console.log(`   Found ${recentSkus.length} recent SKUs`);
      return recentSkus;
    } else {
      console.log(`❌ Orders API failed: ${result.statusCode}`);
    }
  } catch (error) {
    console.log(`❌ Orders approach failed: ${error.message}`);
  }

  return [];
}

// Test pricing for specific SKUs
async function testPricingForSkus(accessToken, skus) {
  console.log('\n🔍 Testing pricing for found SKUs...');

  const results = [];

  for (const sku of skus.slice(0, 3)) { // Test first 3 SKUs
    console.log(`\n📊 Testing pricing for: ${sku}`);
    console.log('─'.repeat(35 + sku.length));

    try {
      const result = await testApiCall(
        accessToken,
        '/products/pricing/v0/price',
        `MarketplaceId=${MARKETPLACE_ID}&Skus=${encodeURIComponent(sku)}`,
        'Pricing'
      );

      if (result.statusCode === 200) {
        const data = JSON.parse(result.data);
        console.log('✅ SUCCESS! Pricing data found:');

        if (data.payload && data.payload.length > 0) {
          const priceData = data.payload[0];
          console.log(`   SKU: ${priceData.SellerSKU || 'N/A'}`);
          console.log(`   ASIN: ${priceData.ASIN || 'N/A'}`);
          console.log(`   Status: ${priceData.status || 'N/A'}`);

          if (priceData.Product?.Offers) {
            priceData.Product.Offers.forEach((offer, index) => {
              console.log(`   Offer ${index + 1}:`);
              console.log(`     Condition: ${offer.OfferType?.condition || 'N/A'}`);
              if (offer.Price?.LandedPrice) {
                console.log(`     Price: ${offer.Price.LandedPrice.Amount} ${offer.Price.LandedPrice.CurrencyCode}`);
              }
              if (offer.Price?.ListingPrice) {
                console.log(`     Listing Price: ${offer.Price.ListingPrice.Amount} ${offer.Price.ListingPrice.CurrencyCode}`);
              }
            });
          }

          results.push({ sku, success: true, data: priceData });
        } else {
          console.log('   No pricing data in response');
          results.push({ sku, success: false, reason: 'No data' });
        }
      } else if (result.statusCode === 404) {
        console.log('⚠️  No pricing data found (404)');
        results.push({ sku, success: false, reason: '404 - Not found' });
      } else if (result.statusCode === 403) {
        console.log('❌ Access denied (403)');
        results.push({ sku, success: false, reason: '403 - Access denied' });
      } else {
        console.log(`⚠️  Unexpected status: ${result.statusCode}`);
        console.log(`   Response: ${result.data}`);
        results.push({ sku, success: false, reason: `Status ${result.statusCode}` });
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      results.push({ sku, success: false, reason: error.message });
    }

    // Delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

// Main function
async function runAlternativeTest() {
  try {
    console.log('🔐 Getting access token...');
    const accessToken = await getAccessToken();
    console.log('✅ Access token obtained\n');

    // Find active products
    const activeSkus = await findActiveProducts(accessToken);

    if (activeSkus.length === 0) {
      console.log('\n❌ No active SKUs found. Cannot test pricing.');
      return;
    }

    console.log(`\n📋 Found ${activeSkus.length} SKUs to test:`);
    activeSkus.forEach(sku => console.log(`   - ${sku}`));

    // Test pricing
    const pricingResults = await testPricingForSkus(accessToken, activeSkus);

    // Summary
    console.log('\n📊 PRICING TEST SUMMARY');
    console.log('══════════════════════');
    const successful = pricingResults.filter(r => r.success).length;
    console.log(`SKUs tested: ${pricingResults.length}`);
    console.log(`Successful pricing calls: ${successful}`);
    console.log(`Success rate: ${((successful / pricingResults.length) * 100).toFixed(1)}%`);

    if (successful > 0) {
      console.log('\n🎉 SUCCESS! Your pricing API is working!');
      console.log('You can now implement pricing functionality in your application.');
    } else {
      console.log('\n💡 All SKUs returned 404 - this might mean:');
      console.log('   - These are old/discontinued products');
      console.log('   - Private label items without public pricing');
      console.log('   - Need to test with more recent/active products');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
runAlternativeTest();
