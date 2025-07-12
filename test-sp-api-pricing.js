#!/usr/bin/env node

/**
 * Amazon SP-API Pricing Test
 * Tests pricing data retrieval for specific SKUs
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

console.log('💰 AMAZON SP-API PRICING TEST');
console.log('==============================');
console.log('✅ Testing pricing data retrieval');
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

// Make SP-API call
async function makeSPAPICall(accessToken, path, query = '') {
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
        try {
          const result = {
            statusCode: res.statusCode,
            data: res.statusCode === 200 ? JSON.parse(data) : data,
            headers: res.headers
          };
          resolve(result);
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Test 1: Get your inventory items to find SKUs
async function getInventoryItems(accessToken) {
  console.log('📦 STEP 2A: Getting your inventory items');
  console.log('────────────────────────────────────────');

  const path = '/fba/inventory/v1/summaries';
  const query = `details=true&granularityType=Marketplace&granularityId=${MARKETPLACE_ID}&marketplaceIds=${MARKETPLACE_ID}`;

  const result = await makeSPAPICall(accessToken, path, query);

  if (result.statusCode === 200) {
    const items = result.data.payload?.inventorySummaries || [];
    console.log(`✅ Found ${items.length} inventory items`);

    // Show first few items with their SKUs
    items.slice(0, 5).forEach((item, index) => {
      console.log(`   ${index + 1}. SKU: ${item.sellerSku} | ASIN: ${item.asin} | Quantity: ${item.totalQuantity}`);
    });

    return items;
  } else {
    console.log('⚠️  Could not retrieve inventory:', result.statusCode);
    console.log('Response:', result.data);
    return [];
  }
}

// Test 2: Get catalog item data for a specific SKU/ASIN
async function getCatalogItem(accessToken, asin) {
  console.log(`\n📊 STEP 2B: Getting catalog data for ASIN: ${asin}`);
  console.log('─────────────────────────────────────────────────────');

  const path = `/catalog/2022-04-01/items/${asin}`;
  const query = `marketplaceIds=${MARKETPLACE_ID}&includedData=attributes,dimensions,identifiers,images,productTypes,relationships,salesRanks,summaries`;

  const result = await makeSPAPICall(accessToken, path, query);

  if (result.statusCode === 200) {
    const item = result.data;
    console.log('✅ Catalog item retrieved successfully!');
    console.log('   ASIN:', item.asin);
    console.log('   Title:', item.summaries?.[0]?.itemName || 'N/A');
    console.log('   Brand:', item.attributes?.brand?.[0]?.value || 'N/A');
    console.log('   Category:', item.productTypes?.[0]?.displayName || 'N/A');

    if (item.salesRanks) {
      console.log('   Sales Ranks:');
      item.salesRanks.forEach(rank => {
        console.log(`     - ${rank.title}: #${rank.rank}`);
      });
    }

    return item;
  } else {
    console.log('⚠️  Could not retrieve catalog item:', result.statusCode);
    console.log('Response:', result.data);
    return null;
  }
}

// Test 3: Get pricing data for SKU
async function getPricingData(accessToken, sku) {
  console.log(`\n💰 STEP 2C: Getting pricing data for SKU: ${sku}`);
  console.log('──────────────────────────────────────────────────');

  const path = '/products/pricing/v0/price';
  const query = `MarketplaceId=${MARKETPLACE_ID}&Skus=${encodeURIComponent(sku)}&ItemType=Sku`;

  const result = await makeSPAPICall(accessToken, path, query);

  if (result.statusCode === 200) {
    const pricing = result.data.payload || [];
    console.log('✅ Pricing data retrieved successfully!');

    pricing.forEach(item => {
      console.log(`   SKU: ${item.SellerSKU}`);
      console.log(`   ASIN: ${item.ASIN}`);
      console.log(`   Status: ${item.status}`);

      if (item.Product?.Offers) {
        item.Product.Offers.forEach((offer, index) => {
          console.log(`   Offer ${index + 1}:`);
          console.log(`     - Condition: ${offer.OfferType || offer.SubCondition}`);
          console.log(`     - Price: ${offer.BuyingPrice?.ListingPrice?.Amount} ${offer.BuyingPrice?.ListingPrice?.CurrencyCode}`);
          console.log(`     - Shipping: ${offer.BuyingPrice?.Shipping?.Amount || '0'} ${offer.BuyingPrice?.Shipping?.CurrencyCode || 'GBP'}`);
          if (offer.IsFulfilledByAmazon) {
            console.log(`     - Fulfilled by Amazon: Yes`);
          }
        });
      }
    });

    return pricing;
  } else {
    console.log('⚠️  Could not retrieve pricing data:', result.statusCode);
    console.log('Response:', result.data);
    return null;
  }
}

// Test 4: Get competitive pricing
async function getCompetitivePricing(accessToken, asin) {
  console.log(`\n🏆 STEP 2D: Getting competitive pricing for ASIN: ${asin}`);
  console.log('────────────────────────────────────────────────────────');

  const path = '/products/pricing/v0/competitivePrice';
  const query = `MarketplaceId=${MARKETPLACE_ID}&Asins=${asin}&ItemType=Asin`;

  const result = await makeSPAPICall(accessToken, path, query);

  if (result.statusCode === 200) {
    const competitive = result.data.payload || [];
    console.log('✅ Competitive pricing retrieved successfully!');

    competitive.forEach(item => {
      console.log(`   ASIN: ${item.ASIN}`);
      console.log(`   Status: ${item.status}`);

      if (item.Product?.CompetitivePricing?.CompetitivePrices) {
        item.Product.CompetitivePricing.CompetitivePrices.forEach((price, index) => {
          console.log(`   Competitive Price ${index + 1}:`);
          console.log(`     - Condition: ${price.condition}`);
          console.log(`     - Subcondition: ${price.subcondition}`);
          console.log(`     - Price: ${price.Price?.ListingPrice?.Amount} ${price.Price?.ListingPrice?.CurrencyCode}`);
          console.log(`     - Belongs to requester: ${price.belongsToRequester}`);
        });
      }

      if (item.Product?.CompetitivePricing?.NumberOfOfferListings) {
        console.log('   Offer Listings Count:');
        item.Product.CompetitivePricing.NumberOfOfferListings.forEach(listing => {
          console.log(`     - ${listing.condition}: ${listing.Count} offers`);
        });
      }
    });

    return competitive;
  } else {
    console.log('⚠️  Could not retrieve competitive pricing:', result.statusCode);
    console.log('Response:', result.data);
    return null;
  }
}

// Main test function
async function runPricingTest() {
  try {
    console.log('📋 STEP 1: Getting Access Token');
    console.log('────────────────────────────────');
    const accessToken = await getAccessToken();
    console.log('✅ Access token obtained');
    console.log('');

    // Get inventory to find a SKU to test with
    const inventory = await getInventoryItems(accessToken);

    if (inventory.length > 0) {
      const testItem = inventory[0]; // Use first item
      const testSku = testItem.sellerSku;
      const testAsin = testItem.asin;

      console.log(`\n🎯 Testing with SKU: ${testSku} (ASIN: ${testAsin})`);
      console.log('═══════════════════════════════════════════════════');

      // Test catalog data
      await getCatalogItem(accessToken, testAsin);

      // Test pricing data
      await getPricingData(accessToken, testSku);

      // Test competitive pricing
      await getCompetitivePricing(accessToken, testAsin);

    } else {
      console.log('\n⚠️  No inventory items found. Let\'s test with a manual SKU.');
      console.log('Please provide a SKU to test with, or check your inventory API permissions.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
runPricingTest();
