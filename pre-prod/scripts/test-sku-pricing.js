#!/usr/bin/env node

/**
 * SKU-Based Amazon Pricing Tool
 * Get live pricing data using your product SKUs
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
        'User-Agent': 'SKUPricingTool/1.0'
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
          resolve({ status: res.statusCode, data: data, raw: true });
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

async function getPricingBySKU(sku, marketplaceId = 'A1F83G8C2ARO7P') {
  console.log(`\n🔍 Getting pricing for SKU: ${sku}`);

  try {
    // Method 1: Get pricing by SKU directly
    const skuPricingPath = `/products/pricing/v0/price?MarketplaceId=${marketplaceId}&Skus=${encodeURIComponent(sku)}`;
    const skuPricing = await makeSignedRequest(skuPricingPath);

    console.log(`   📊 SKU Pricing API: ${skuPricing.status}`);

    if (skuPricing.status === 200 && skuPricing.data.payload) {
      const products = skuPricing.data.payload;
      if (products && products.length > 0) {
        const product = products[0];
        console.log(`   ✅ Found pricing data:`);
        console.log(`      📦 SKU: ${product.SellerSKU}`);
        console.log(`      🏷️  ASIN: ${product.ASIN}`);

        if (product.Product && product.Product.CompetitivePricing) {
          const pricing = product.Product.CompetitivePricing;
          console.log(`      💰 Competitive Prices:`);

          if (pricing.CompetitivePrices) {
            pricing.CompetitivePrices.forEach((price, index) => {
              if (price.Price && price.Price.LandedPrice) {
                console.log(`         ${index + 1}. ${price.Price.LandedPrice.Amount} ${price.Price.LandedPrice.CurrencyCode} (${price.condition})`);
              }
            });
          }

          if (pricing.NumberOfOfferListings) {
            pricing.NumberOfOfferListings.forEach((listing) => {
              console.log(`      📈 ${listing.condition}: ${listing.Count} offers`);
            });
          }
        }

        return {
          success: true,
          sku: product.SellerSKU,
          asin: product.ASIN,
          pricing: product.Product?.CompetitivePricing
        };
      } else {
        console.log(`   ⚠️  No pricing data found for this SKU`);
        return { success: false, reason: 'No data found' };
      }
    } else if (skuPricing.status === 404) {
      console.log(`   ⚠️  SKU not found in marketplace`);
      return { success: false, reason: 'SKU not found' };
    } else if (skuPricing.status === 403) {
      console.log(`   ❌ Access denied - check permissions`);
      return { success: false, reason: 'Access denied' };
    } else {
      console.log(`   ❌ Error ${skuPricing.status}: ${skuPricing.raw ? skuPricing.data : JSON.stringify(skuPricing.data)}`);
      return { success: false, reason: `HTTP ${skuPricing.status}` };
    }

  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

async function getItemOffersBySKU(sku, marketplaceId = 'A1F83G8C2ARO7P') {
  console.log(`\n🛒 Getting offers for SKU: ${sku}`);

  try {
    // First, we need to get the ASIN for this SKU
    const skuPricingPath = `/products/pricing/v0/price?MarketplaceId=${marketplaceId}&Skus=${encodeURIComponent(sku)}`;
    const skuPricing = await makeSignedRequest(skuPricingPath);

    if (skuPricing.status === 200 && skuPricing.data.payload && skuPricing.data.payload[0]) {
      const asin = skuPricing.data.payload[0].ASIN;
      console.log(`   🔗 Found ASIN: ${asin}`);

      // Now get item offers using the ASIN
      const offersPath = `/products/pricing/v0/items/${asin}/offers?MarketplaceId=${marketplaceId}&ItemCondition=New`;
      const offers = await makeSignedRequest(offersPath);

      console.log(`   📊 Item Offers API: ${offers.status}`);

      if (offers.status === 200 && offers.data.payload) {
        const summary = offers.data.payload.Summary;
        if (summary && summary.TotalOfferCount > 0) {
          console.log(`   ✅ Found ${summary.TotalOfferCount} offers:`);

          if (summary.LowestPrices && summary.LowestPrices.length > 0) {
            const lowest = summary.LowestPrices[0];
            console.log(`      💵 Lowest Price: ${lowest.LandedPrice?.Amount} ${lowest.LandedPrice?.CurrencyCode}`);
            console.log(`      🚚 Fulfillment: ${lowest.Fulfillment?.Channel}`);
          }

          if (summary.BuyBoxPrices && summary.BuyBoxPrices.length > 0) {
            const buyBox = summary.BuyBoxPrices[0];
            console.log(`      🏆 Buy Box: ${buyBox.LandedPrice?.Amount} ${buyBox.LandedPrice?.CurrencyCode}`);
          }

          return {
            success: true,
            sku: sku,
            asin: asin,
            totalOffers: summary.TotalOfferCount,
            lowestPrice: summary.LowestPrices?.[0],
            buyBoxPrice: summary.BuyBoxPrices?.[0]
          };
        } else {
          console.log(`   ⚠️  No offers found`);
          return { success: false, reason: 'No offers' };
        }
      } else {
        console.log(`   ❌ Error getting offers: ${offers.status}`);
        return { success: false, reason: `Offers API error ${offers.status}` };
      }
    } else {
      console.log(`   ❌ Could not find ASIN for SKU`);
      return { success: false, reason: 'ASIN not found' };
    }

  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

async function testSKUPricing() {
  console.log('💰 SKU-Based Live Pricing Tool');
  console.log('═'.repeat(50));
  console.log('📝 Instructions:');
  console.log('   1. Replace the test SKUs below with your actual SKUs');
  console.log('   2. Make sure your SKUs are active in the UK marketplace');
  console.log('   3. Rate limit: 1 request per second to avoid 429 errors');
  console.log('');

  // 🔧 REPLACE THESE WITH YOUR ACTUAL SKUs
  const yourSKUs = [
    'YOUR-SKU-1',      // Replace with your actual SKU
    'YOUR-SKU-2',      // Replace with your actual SKU
    'YOUR-SKU-3'       // Replace with your actual SKU
  ];

  const marketplaceId = 'A1F83G8C2ARO7P'; // UK marketplace
  const results = [];

  console.log(`🔍 Testing ${yourSKUs.length} SKUs in UK marketplace...`);
  console.log('═'.repeat(50));

  for (const sku of yourSKUs) {
    // Method 1: Get competitive pricing by SKU
    const pricingResult = await getPricingBySKU(sku, marketplaceId);

    // Wait 1 second to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Method 2: Get item offers (more detailed pricing)
    const offersResult = await getItemOffersBySKU(sku, marketplaceId);

    results.push({
      sku,
      pricing: pricingResult,
      offers: offersResult
    });

    // Wait 1 second between SKUs
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n📊 Summary Results');
  console.log('═'.repeat(50));

  const successful = results.filter(r => r.pricing.success || r.offers.success).length;
  console.log(`✅ Successful: ${successful}/${results.length}`);

  if (successful === 0) {
    console.log('\n💡 Troubleshooting Tips:');
    console.log('   1. Make sure your SKUs are exactly as they appear in Seller Central');
    console.log('   2. Ensure your products are active and published');
    console.log('   3. Check that you\'re using the correct marketplace ID');
    console.log('   4. Verify your products are in the UK marketplace (A1F83G8C2ARO7P)');
  }

  console.log('\n🚀 Ready for Production:');
  console.log('   1. Replace test SKUs with your real SKUs');
  console.log('   2. Implement proper error handling');
  console.log('   3. Add rate limiting (1 req/sec)');
  console.log('   4. Store results in your database');
  console.log('   5. Set up automated pricing updates');
}

// Run the test
testSKUPricing().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
