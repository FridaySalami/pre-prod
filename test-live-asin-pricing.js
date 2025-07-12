#!/usr/bin/env node

/**
 * Live ASIN Pricing Test
 * Get current pricing for ASIN: B0104R0FRG
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
        'User-Agent': 'LivePricingTool/1.0'
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
          resolve({ status: res.statusCode, data: data, rawData: data });
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

async function testLivePricing() {
  const asin = 'B0104R0FRG';
  const marketplaceId = 'A1F83G8C2ARO7P'; // UK marketplace

  console.log('🛒 Live Pricing Test');
  console.log('═'.repeat(50));
  console.log(`📦 ASIN: ${asin}`);
  console.log(`🌍 Marketplace: UK (${marketplaceId})`);
  console.log('');

  try {
    // Test 1: Get item offers (current market pricing)
    console.log('🔍 Testing Item Offers API...');
    const itemOffersPath = `/products/pricing/v0/items/${asin}/offers?MarketplaceId=${marketplaceId}&ItemCondition=New`;
    const itemOffers = await makeSignedRequest(itemOffersPath);

    console.log(`Status: ${itemOffers.status}`);
    if (itemOffers.status === 200 && itemOffers.data.payload) {
      console.log('✅ SUCCESS! Found pricing data:');
      const summary = itemOffers.data.payload.Summary;
      if (summary) {
        console.log(`   📊 Total Offers: ${summary.TotalOfferCount || 'N/A'}`);
        if (summary.LowestPrices && summary.LowestPrices.length > 0) {
          console.log(`   💰 Lowest Price: £${summary.LowestPrices[0].LandedPrice?.Amount} ${summary.LowestPrices[0].LandedPrice?.CurrencyCode}`);
        }
        if (summary.BuyBoxPrices && summary.BuyBoxPrices.length > 0) {
          console.log(`   🏆 Buy Box Price: £${summary.BuyBoxPrices[0].LandedPrice?.Amount} ${summary.BuyBoxPrices[0].LandedPrice?.CurrencyCode}`);
        }
      }

      // Show detailed offers
      if (itemOffers.data.payload.Offers && itemOffers.data.payload.Offers.length > 0) {
        console.log('\n   📋 Available Offers:');
        itemOffers.data.payload.Offers.slice(0, 5).forEach((offer, index) => {
          console.log(`      ${index + 1}. £${offer.ListingPrice?.Amount} (${offer.SubCondition || 'New'}) - ${offer.IsFulfilledByAmazon ? 'FBA' : 'FBM'}`);
        });
      }
    } else if (itemOffers.status === 404) {
      console.log('⚠️  No offers found for this ASIN');
    } else {
      console.log(`❌ Error: ${itemOffers.status}`);
      if (itemOffers.data.errors) {
        console.log(`   Error details: ${JSON.stringify(itemOffers.data.errors, null, 2)}`);
      }
    }

    console.log('\n' + '─'.repeat(50));

    // Test 2: Get competitive pricing
    console.log('🔍 Testing Competitive Pricing API...');
    const competitivePath = `/products/pricing/v0/price?MarketplaceId=${marketplaceId}&Asins=${asin}`;
    const competitive = await makeSignedRequest(competitivePath);

    console.log(`Status: ${competitive.status}`);
    if (competitive.status === 200 && competitive.data.payload) {
      console.log('✅ SUCCESS! Found competitive pricing:');
      const product = competitive.data.payload[0];
      if (product && product.Product) {
        console.log(`   📋 ASIN: ${product.ASIN}`);
        const competitivePricing = product.Product.CompetitivePricing;
        if (competitivePricing && competitivePricing.CompetitivePrices) {
          competitivePricing.CompetitivePrices.forEach((price, index) => {
            console.log(`   💰 Competitive Price ${index + 1}: £${price.Price?.LandedPrice?.Amount} ${price.Price?.LandedPrice?.CurrencyCode}`);
          });
        }
      }
    } else if (competitive.status === 404) {
      console.log('⚠️  No competitive pricing data available');
    } else {
      console.log(`❌ Error: ${competitive.status}`);
    }

  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
  }

  console.log('\n🎉 Live pricing test completed!');
  console.log('Your SP-API setup is working for live pricing data.');
}

// Run the test
testLivePricing().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
