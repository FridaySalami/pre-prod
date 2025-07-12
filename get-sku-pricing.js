#!/usr/bin/env node

/**
 * Direct SKU Pricing Lookup
 * Get current live pricing for a specific SKU without looking at orders
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

async function getSkuPricing(sku) {
  console.log(`🔍 Looking up current pricing for SKU: ${sku}`);
  console.log('═'.repeat(60));

  const marketplaceId = 'A1F83G8C2ARO7P'; // UK marketplace

  try {
    // Method 1: Try to get pricing by SKU directly
    console.log('📊 Method 1: Direct SKU pricing lookup...');
    const skuPath = `/products/pricing/v0/price?MarketplaceId=${marketplaceId}&Skus=${sku}`;
    const skuResult = await makeSignedRequest(skuPath);

    console.log(`   Status: ${skuResult.status}`);

    if (skuResult.status === 200 && skuResult.data.payload) {
      console.log('   ✅ Found pricing data!');
      const products = skuResult.data.payload;

      products.forEach((product, index) => {
        console.log(`\n   📦 Product ${index + 1}:`);
        console.log(`      SKU: ${product.SellerSKU || 'N/A'}`);
        console.log(`      ASIN: ${product.ASIN || 'N/A'}`);
        console.log(`      Status: ${product.status || 'N/A'}`);

        if (product.Product && product.Product.Offers) {
          product.Product.Offers.forEach((offer, offerIndex) => {
            console.log(`      💰 Offer ${offerIndex + 1}:`);
            console.log(`         Condition: ${offer.SubCondition || offer.ItemCondition || 'N/A'}`);
            console.log(`         Price: ${offer.ListingPrice?.Amount || 'N/A'} ${offer.ListingPrice?.CurrencyCode || ''}`);
            console.log(`         Shipping: ${offer.Shipping?.Amount || 'N/A'} ${offer.Shipping?.CurrencyCode || ''}`);
            if (offer.IsBuyBoxWinner) {
              console.log(`         🏆 BUY BOX WINNER!`);
            }
          });
        }

        if (product.Product && product.Product.CompetitivePricing) {
          const competitive = product.Product.CompetitivePricing;
          if (competitive.CompetitivePrices) {
            console.log(`      🏪 Competitive Pricing:`);
            competitive.CompetitivePrices.forEach((price, priceIndex) => {
              console.log(`         ${priceIndex + 1}. ${price.Price?.LandedPrice?.Amount || 'N/A'} ${price.Price?.LandedPrice?.CurrencyCode || ''}`);
            });
          }
        }
      });

      return { success: true, data: products };
    } else if (skuResult.status === 404) {
      console.log('   ⚠️  No pricing data found for this SKU');
    } else if (skuResult.status === 400) {
      console.log('   ⚠️  Invalid request - SKU might not exist or be active');
    } else {
      console.log(`   ❌ Error: ${skuResult.status}`);
      if (skuResult.raw) {
        console.log(`   Response: ${skuResult.data}`);
      }
    }

    // Method 2: Try to get item offers if we have an ASIN
    console.log('\n📊 Method 2: Attempting to find ASIN for competitive pricing...');

    // Note: Without the ASIN, we can't get competitive pricing
    // The SKU-to-ASIN mapping would typically come from your inventory or orders
    console.log('   ℹ️  To get competitive pricing, we need the ASIN that corresponds to this SKU');
    console.log('   💡 You can find the ASIN in your Amazon Seller Central under inventory');

    return { success: false, message: 'SKU not found in current pricing data' };

  } catch (error) {
    console.log(`❌ Error getting pricing for SKU ${sku}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  const sku = process.argv[2] || 'MUSTAR01';

  console.log('💰 Amazon SKU Pricing Lookup Tool');
  console.log(`📅 ${new Date().toLocaleString()}`);
  console.log('═'.repeat(60));

  const result = await getSkuPricing(sku);

  console.log('\n📋 Summary:');
  console.log('─'.repeat(60));

  if (result.success) {
    console.log('✅ Successfully retrieved pricing data');
    console.log('💡 Use this data to monitor competitor prices and adjust your pricing strategy');
  } else {
    console.log('⚠️  Could not retrieve pricing data');
    console.log('\n🔧 Next steps:');
    console.log('1. Verify the SKU is active and listed on Amazon');
    console.log('2. Check your Amazon Seller Central for the corresponding ASIN');
    console.log('3. Try using the ASIN instead for competitive pricing lookup');
    console.log('4. Ensure your product has live offers on the marketplace');
  }

  console.log('\n💡 Alternative: If you have the ASIN, you can get competitive pricing:');
  console.log('   node get-asin-pricing.js YOUR_ASIN_HERE');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { getSkuPricing };
