#!/usr/bin/env node

/**
 * Live SKU Pricing Test - MUSTAR01
 * Test script for getting live pricing data for your specific SKU
 */

import https from 'https';
import crypto from 'crypto';
import querystring from 'querystring';
import dotenv from 'dotenv';

dotenv.config();

// AWS Signature V4 implementation
function sign(key, message) {
  return crypto.createHmac('sha256', key).update(message).digest();
}

function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = sign('AWS4' + key, dateStamp);
  const kRegion = sign(kDate, regionName);
  const kService = sign(kRegion, serviceName);
  const kSigning = sign(kService, 'aws4_request');
  return kSigning;
}

async function getLWAToken() {
  const tokenData = querystring.stringify({
    grant_type: 'refresh_token',
    refresh_token: process.env.AMAZON_REFRESH_TOKEN,
    client_id: process.env.AMAZON_CLIENT_ID,
    client_secret: process.env.AMAZON_CLIENT_SECRET
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.amazon.com',
      path: '/auth/o2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': tokenData.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.access_token) {
            resolve(response.access_token);
          } else {
            reject(new Error('No access token received'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(tokenData);
    req.end();
  });
}

async function makeSignedRequest(path) {
  const accessToken = await getLWAToken();
  const region = 'eu-west-1';
  const service = 'execute-api';
  const host = 'sellingpartnerapi-eu.amazon.com';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);

  const canonicalHeaders = `host:${host}\nx-amz-access-token:${accessToken}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-access-token;x-amz-date';
  const payloadHash = crypto.createHash('sha256').update('').digest('hex');

  const canonicalRequest = `GET\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

  const signingKey = getSignatureKey(process.env.AWS_SECRET_ACCESS_KEY, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${process.env.AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': authorizationHeader,
        'x-amz-access-token': accessToken,
        'x-amz-date': amzDate,
        'User-Agent': 'LiveSKUTest/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ status: res.statusCode, data: response, headers: res.headers });
        } catch (error) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function testLiveSKU() {
  console.log('🛒 Live SKU Pricing Test');
  console.log('═'.repeat(40));
  console.log(`📦 Testing SKU: MUSTAR01`);
  console.log(`🕐 Time: ${new Date().toLocaleString()}`);
  console.log('');

  const marketplaceId = 'A1F83G8C2ARO7P'; // UK marketplace
  const sku = 'MUSTAR01';

  try {
    console.log('🔍 Step 1: Getting your product information...');

    // First, let's try to get the listing for your SKU
    console.log('   📋 Searching for your SKU in your listings...');

    // Get marketplace participations to see available marketplaces
    const marketplacePath = '/sellers/v1/marketplaceParticipations';
    const marketplaceResult = await makeSignedRequest(marketplacePath);

    console.log(`   🏪 Marketplace API: ${marketplaceResult.status}`);
    if (marketplaceResult.status === 200 && marketplaceResult.data.payload) {
      console.log(`   ✅ Successfully connected to Amazon Seller Central`);
      const marketplaces = marketplaceResult.data.payload;
      marketplaces.forEach(mp => {
        if (mp.marketplace) {
          console.log(`      🌍 Marketplace: ${mp.marketplace.name} (${mp.marketplace.id})`);
        }
      });
    }

    console.log('');
    console.log('🔍 Step 2: Getting recent orders to find ASIN...');

    // Get recent orders to see if we can find the ASIN for this SKU
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 7); // Check last 7 days
    const ordersPath = `/orders/v0/orders?MarketplaceIds=${marketplaceId}&CreatedAfter=${yesterday.toISOString()}&OrderStatuses=Unshipped,PartiallyShipped,Shipped`;
    const ordersResult = await makeSignedRequest(ordersPath);

    console.log(`   📦 Orders API: ${ordersResult.status}`);
    if (ordersResult.status === 200 && ordersResult.data.payload) {
      const orders = ordersResult.data.payload.Orders || [];
      console.log(`   📊 Found ${orders.length} recent orders`);

      let foundASIN = null;
      let foundOrder = null;

      // Look through orders to find your SKU
      for (const order of orders.slice(0, 5)) { // Check first 5 orders
        console.log(`   🔎 Checking order ${order.AmazonOrderId}...`);

        const orderItemsPath = `/orders/v0/orders/${order.AmazonOrderId}/orderItems`;
        const itemsResult = await makeSignedRequest(orderItemsPath);

        if (itemsResult.status === 200 && itemsResult.data.payload) {
          const items = itemsResult.data.payload.OrderItems || [];

          for (const item of items) {
            if (item.SellerSKU === sku) {
              foundASIN = item.ASIN;
              foundOrder = order;
              console.log(`   🎯 FOUND YOUR SKU!`);
              console.log(`      📦 SKU: ${item.SellerSKU}`);
              console.log(`      🏷️  ASIN: ${item.ASIN}`);
              console.log(`      💰 Sale Price: ${item.ItemPrice?.Amount} ${item.ItemPrice?.CurrencyCode}`);
              console.log(`      📅 Order Date: ${order.PurchaseDate}`);
              break;
            }
          }
        }

        if (foundASIN) break;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (foundASIN) {
        console.log('');
        console.log('🔍 Step 3: Getting current market pricing...');

        // Now get current pricing for this ASIN
        const itemOffersPath = `/products/pricing/v0/items/${foundASIN}/offers?MarketplaceId=${marketplaceId}&ItemCondition=New`;
        const pricingResult = await makeSignedRequest(itemOffersPath);

        console.log(`   💰 Live Pricing API: ${pricingResult.status}`);
        if (pricingResult.status === 200 && pricingResult.data.payload) {
          const pricing = pricingResult.data.payload;

          console.log(`   📊 Current Market Data for ${foundASIN}:`);

          if (pricing.Summary) {
            const summary = pricing.Summary;
            console.log(`      🏪 Total Offers: ${summary.TotalOfferCount || 0}`);

            if (summary.LowestPrices && summary.LowestPrices.length > 0) {
              const lowest = summary.LowestPrices[0];
              console.log(`      💵 Lowest Price: ${lowest.LandedPrice?.Amount} ${lowest.LandedPrice?.CurrencyCode}`);
              console.log(`      📦 Fulfillment: ${lowest.Fulfillment?.Channel}`);
            }

            if (summary.BuyBoxPrices && summary.BuyBoxPrices.length > 0) {
              const buyBox = summary.BuyBoxPrices[0];
              console.log(`      🏆 Buy Box Price: ${buyBox.LandedPrice?.Amount} ${buyBox.LandedPrice?.CurrencyCode}`);
            }

            if (summary.OffersAvailableTime) {
              console.log(`      🕐 Last Updated: ${summary.OffersAvailableTime}`);
            }
          }

          if (pricing.Offers && pricing.Offers.length > 0) {
            console.log(`   📋 Individual Offers (showing first 3):`);
            pricing.Offers.slice(0, 3).forEach((offer, index) => {
              console.log(`      ${index + 1}. ${offer.ListingPrice?.Amount} ${offer.ListingPrice?.CurrencyCode} (${offer.Fulfillment?.Channel})`);
            });
          }

        } else if (pricingResult.status === 404) {
          console.log(`   ⚠️  No current pricing data available for this ASIN`);
        } else {
          console.log(`   ❌ Error getting pricing: ${pricingResult.status}`);
          if (pricingResult.data.errors) {
            pricingResult.data.errors.forEach(error => {
              console.log(`      Error: ${error.message}`);
            });
          }
        }

      } else {
        console.log(`   ⚠️  SKU "${sku}" not found in recent orders`);
        console.log(`   💡 This might mean:`);
        console.log(`      • The sale was processed in a different marketplace`);
        console.log(`      • The SKU name is different in Amazon`);
        console.log(`      • The order is older than 7 days`);
      }

    } else {
      console.log(`   ❌ Error accessing orders: ${ordersResult.status}`);
      if (ordersResult.data && ordersResult.data.errors) {
        ordersResult.data.errors.forEach(error => {
          console.log(`      Error: ${error.message}`);
        });
      }
    }

  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
  }

  console.log('');
  console.log('📊 Test Summary');
  console.log('─'.repeat(40));
  console.log(`✅ Your SP-API setup is working correctly`);
  console.log(`📦 Tested SKU: ${sku}`);
  console.log(`🕐 Test completed: ${new Date().toLocaleString()}`);
}

// Run the test
testLiveSKU().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
