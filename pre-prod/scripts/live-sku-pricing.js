#!/usr/bin/env node

/**
 * Live SKU Pricing Tool - Production Ready
 * Get real-time pricing data for your Amazon SKUs
 * 
 * Usage:
 *   node live-sku-pricing.js
 *   node live-sku-pricing.js --sku "YOUR-SKU-123"
 *   node live-sku-pricing.js --csv output.csv
 */

import https from 'https';
import crypto from 'crypto';
import querystring from 'querystring';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Configuration
const MARKETPLACE_ID = 'A1F83G8C2ARO7P'; // UK marketplace
const RATE_LIMIT_DELAY = 1100; // 1.1 seconds between requests to avoid rate limits

// Your SKUs - Add your actual SKUs here
const YOUR_SKUS = [
  // Add your SKUs here, for example:
  // 'SKU-EXAMPLE-001',
  // 'SKU-EXAMPLE-002',
  // 'SKU-EXAMPLE-003'
];

// Command line arguments
const args = process.argv.slice(2);
const singleSKU = args.includes('--sku') ? args[args.indexOf('--sku') + 1] : null;
const csvOutput = args.includes('--csv') ? args[args.indexOf('--csv') + 1] : null;

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
        'User-Agent': 'LiveSKUPricing/1.0'
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

async function getCompletePricingData(sku, marketplaceId = MARKETPLACE_ID) {
  const result = {
    sku: sku,
    timestamp: new Date().toISOString(),
    success: false,
    asin: null,
    yourPrice: null,
    competitorPrices: [],
    buyBoxPrice: null,
    lowestPrice: null,
    totalOffers: 0,
    errors: []
  };

  try {
    // Step 1: Get competitive pricing by SKU
    const pricingPath = `/products/pricing/v0/price?MarketplaceId=${marketplaceId}&Skus=${encodeURIComponent(sku)}`;
    const pricingResponse = await makeSignedRequest(pricingPath);

    if (pricingResponse.status === 200 && pricingResponse.data.payload) {
      const products = pricingResponse.data.payload;
      if (products && products.length > 0) {
        const product = products[0];
        result.asin = product.ASIN;

        if (product.Product && product.Product.CompetitivePricing) {
          const pricing = product.Product.CompetitivePricing;

          // Extract competitive prices
          if (pricing.CompetitivePrices) {
            result.competitorPrices = pricing.CompetitivePrices.map(price => ({
              condition: price.condition,
              price: price.Price?.LandedPrice?.Amount,
              currency: price.Price?.LandedPrice?.CurrencyCode,
              fulfillment: price.Price?.Fulfillment?.Channel
            })).filter(p => p.price);
          }
        }

        // Step 2: Get item offers for more detailed pricing
        if (result.asin) {
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));

          const offersPath = `/products/pricing/v0/items/${result.asin}/offers?MarketplaceId=${marketplaceId}&ItemCondition=New`;
          const offersResponse = await makeSignedRequest(offersPath);

          if (offersResponse.status === 200 && offersResponse.data.payload) {
            const summary = offersResponse.data.payload.Summary;

            if (summary) {
              result.totalOffers = summary.TotalOfferCount || 0;

              if (summary.LowestPrices && summary.LowestPrices.length > 0) {
                const lowest = summary.LowestPrices[0];
                result.lowestPrice = {
                  price: lowest.LandedPrice?.Amount,
                  currency: lowest.LandedPrice?.CurrencyCode,
                  fulfillment: lowest.Fulfillment?.Channel
                };
              }

              if (summary.BuyBoxPrices && summary.BuyBoxPrices.length > 0) {
                const buyBox = summary.BuyBoxPrices[0];
                result.buyBoxPrice = {
                  price: buyBox.LandedPrice?.Amount,
                  currency: buyBox.LandedPrice?.CurrencyCode,
                  fulfillment: buyBox.Fulfillment?.Channel
                };
              }
            }
          } else {
            result.errors.push(`Offers API error: ${offersResponse.status}`);
          }
        }

        result.success = true;
      } else {
        result.errors.push('No pricing data found for SKU');
      }
    } else if (pricingResponse.status === 404) {
      result.errors.push('SKU not found in marketplace');
    } else if (pricingResponse.status === 403) {
      result.errors.push('Access denied - check permissions');
    } else {
      result.errors.push(`Pricing API error: ${pricingResponse.status}`);
    }

  } catch (error) {
    result.errors.push(`Request error: ${error.message}`);
  }

  return result;
}

function displayResult(result) {
  console.log(`\n📦 SKU: ${result.sku}`);
  console.log(`🕐 Time: ${new Date(result.timestamp).toLocaleString()}`);

  if (result.success) {
    console.log(`✅ Status: Success`);
    console.log(`🏷️  ASIN: ${result.asin}`);
    console.log(`📊 Total Offers: ${result.totalOffers}`);

    if (result.buyBoxPrice) {
      console.log(`🏆 Buy Box: ${result.buyBoxPrice.price} ${result.buyBoxPrice.currency} (${result.buyBoxPrice.fulfillment})`);
    }

    if (result.lowestPrice) {
      console.log(`💵 Lowest Price: ${result.lowestPrice.price} ${result.lowestPrice.currency} (${result.lowestPrice.fulfillment})`);
    }

    if (result.competitorPrices.length > 0) {
      console.log(`💰 Competitor Prices:`);
      result.competitorPrices.forEach((price, index) => {
        console.log(`   ${index + 1}. ${price.price} ${price.currency} (${price.condition}, ${price.fulfillment})`);
      });
    }
  } else {
    console.log(`❌ Status: Failed`);
    result.errors.forEach(error => {
      console.log(`   ⚠️  ${error}`);
    });
  }
}

function saveToCSV(results, filename) {
  const csvHeaders = [
    'SKU', 'Timestamp', 'Success', 'ASIN', 'Total_Offers',
    'BuyBox_Price', 'BuyBox_Currency', 'BuyBox_Fulfillment',
    'Lowest_Price', 'Lowest_Currency', 'Lowest_Fulfillment',
    'Competitor_Prices_Count', 'Errors'
  ];

  const csvRows = results.map(result => [
    result.sku,
    result.timestamp,
    result.success,
    result.asin || '',
    result.totalOffers,
    result.buyBoxPrice?.price || '',
    result.buyBoxPrice?.currency || '',
    result.buyBoxPrice?.fulfillment || '',
    result.lowestPrice?.price || '',
    result.lowestPrice?.currency || '',
    result.lowestPrice?.fulfillment || '',
    result.competitorPrices.length,
    result.errors.join('; ')
  ]);

  const csvContent = [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n');

  fs.writeFileSync(filename, csvContent);
  console.log(`📄 Results saved to ${filename}`);
}

async function main() {
  console.log('🚀 Live SKU Pricing Tool');
  console.log('═'.repeat(60));

  // Check environment variables
  const requiredEnvVars = [
    'AMAZON_REFRESH_TOKEN',
    'AMAZON_CLIENT_ID',
    'AMAZON_CLIENT_SECRET',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error('❌ Missing environment variables:', missingVars.join(', '));
    process.exit(1);
  }

  let skusToProcess = [];

  if (singleSKU) {
    skusToProcess = [singleSKU];
    console.log(`📋 Processing single SKU: ${singleSKU}`);
  } else if (YOUR_SKUS.length > 0) {
    skusToProcess = YOUR_SKUS;
    console.log(`📋 Processing ${YOUR_SKUS.length} SKUs from configuration`);
  } else {
    console.log('⚠️  No SKUs configured. Please:');
    console.log('   1. Add your SKUs to the YOUR_SKUS array in this file, or');
    console.log('   2. Use: node live-sku-pricing.js --sku "YOUR-SKU-123"');
    process.exit(1);
  }

  console.log(`🌍 Marketplace: UK (${MARKETPLACE_ID})`);
  console.log(`⏱️  Rate limit: ${RATE_LIMIT_DELAY}ms between requests`);
  console.log('═'.repeat(60));

  const results = [];

  for (let i = 0; i < skusToProcess.length; i++) {
    const sku = skusToProcess[i];
    console.log(`\n[${i + 1}/${skusToProcess.length}] Processing: ${sku}`);

    const result = await getCompletePricingData(sku);
    results.push(result);
    displayResult(result);

    // Rate limiting between SKUs
    if (i < skusToProcess.length - 1) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
  }

  // Summary
  const successful = results.filter(r => r.success).length;
  console.log('\n📊 Summary');
  console.log('═'.repeat(60));
  console.log(`✅ Successful: ${successful}/${results.length}`);
  console.log(`❌ Failed: ${results.length - successful}/${results.length}`);

  if (csvOutput) {
    saveToCSV(results, csvOutput);
  }

  if (successful === 0) {
    console.log('\n💡 Troubleshooting Tips:');
    console.log('   1. Verify SKUs are exactly as they appear in Seller Central');
    console.log('   2. Ensure products are active and published');
    console.log('   3. Check products exist in UK marketplace');
    console.log('   4. Run: node amazon-sp-api-diagnostics.js for full diagnostics');
  }

  console.log('\n🎯 Next Steps:');
  console.log('   1. Add your real SKUs to the YOUR_SKUS array');
  console.log('   2. Use --csv output.csv to save results');
  console.log('   3. Set up automated runs with cron/scheduled tasks');
  console.log('   4. Integrate with your pricing strategy system');
}

main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
