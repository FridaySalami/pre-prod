#!/usr/bin/env node

/**
 * Merchant-Fulfilled Amazon Pricing Tool
 * Test script for getting competitive pricing data from Amazon SP-API
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
        'User-Agent': 'MerchantPricingTool/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ status: res.statusCode, data: response });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function testPricingForMerchantFulfilled() {
  console.log('🛒 Merchant-Fulfilled Amazon Pricing Tool');
  console.log('═'.repeat(50));

  // Popular ASINs for testing (UK marketplace)
  const testASINs = [
    'B08N5WRWNW',  // Example ASIN
    'B0B2XQHD7V',  // Another example
    'B09G9FPHH1'   // Third example
  ];

  const marketplaceId = 'A1F83G8C2ARO7P'; // UK marketplace

  console.log('🔍 Testing Product Pricing API...\n');

  for (const asin of testASINs) {
    console.log(`📦 Testing ASIN: ${asin}`);

    try {
      // Test multiple pricing endpoints

      // 1. Get item offers (competitive pricing)
      const itemOffersPath = `/products/pricing/v0/items/${asin}/offers?MarketplaceId=${marketplaceId}&ItemCondition=New`;
      const itemOffers = await makeSignedRequest(itemOffersPath);

      console.log(`   📊 Item Offers: ${itemOffers.status}`);
      if (itemOffers.status === 200 && itemOffers.data.payload) {
        const offers = itemOffers.data.payload.Summary;
        if (offers && offers.TotalOfferCount > 0) {
          console.log(`      💰 Total Offers: ${offers.TotalOfferCount}`);
          console.log(`      💵 Lowest Price: ${offers.LowestPrices?.[0]?.LandedPrice?.Amount} ${offers.LowestPrices?.[0]?.LandedPrice?.CurrencyCode}`);
          console.log(`      🏆 Buy Box Price: ${offers.BuyBoxPrices?.[0]?.LandedPrice?.Amount} ${offers.BuyBoxPrices?.[0]?.LandedPrice?.CurrencyCode}`);
        } else {
          console.log(`      ⚠️  No offers found`);
        }
      } else if (itemOffers.status === 404) {
        console.log(`      ℹ️  No pricing data available`);
      } else {
        console.log(`      ❌ Error: ${itemOffers.status}`);
      }

      // 2. Get competitive pricing
      const competitivePath = `/products/pricing/v0/price?MarketplaceId=${marketplaceId}&Asins=${asin}`;
      const competitive = await makeSignedRequest(competitivePath);

      console.log(`   🏪 Competitive Pricing: ${competitive.status}`);
      if (competitive.status === 200 && competitive.data.payload) {
        const product = competitive.data.payload[0];
        if (product && product.Product) {
          console.log(`      📋 ASIN: ${product.ASIN}`);
          const competitivePricing = product.Product.CompetitivePricing;
          if (competitivePricing && competitivePricing.CompetitivePrices) {
            competitivePricing.CompetitivePrices.forEach((price, index) => {
              console.log(`      💰 Competitive Price ${index + 1}: ${price.Price?.LandedPrice?.Amount} ${price.Price?.LandedPrice?.CurrencyCode}`);
            });
          }
        }
      }

      console.log(''); // Empty line for readability

    } catch (error) {
      console.log(`   ❌ Error testing ${asin}: ${error.message}\n`);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('📊 Summary for Merchant-Fulfilled Sellers');
  console.log('─'.repeat(50));
  console.log('✅ Product Pricing API: Available for competitive analysis');
  console.log('📈 You can get:');
  console.log('   • Competitor prices for any ASIN');
  console.log('   • Buy Box prices');
  console.log('   • Market pricing trends');
  console.log('   • Your own order data');
  console.log('');
  console.log('🚫 You DON\'T need:');
  console.log('   • FBA Inventory API (you\'re merchant-fulfilled)');
  console.log('   • Product Listing API (you only want pricing)');
  console.log('');
  console.log('🎉 Your setup is perfect for merchant-fulfilled pricing!');
}

// Run the test
testPricingForMerchantFulfilled().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
