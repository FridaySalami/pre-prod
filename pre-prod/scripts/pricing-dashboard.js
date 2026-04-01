#!/usr/bin/env node

/**
 * Amazon SP-API Pricing Dashboard
 * 
 * This script provides a complete solution for getting pricing data from Amazon SP-API.
 * It can work with either SKUs (which it will map to ASINs) or ASINs directly.
 * 
 * Usage:
 *   node pricing-dashboard.js --sku YOUR_SKU
 *   node pricing-dashboard.js --asin B0104R0FRG
 *   node pricing-dashboard.js --sku SKU1 SKU2 SKU3
 *   node pricing-dashboard.js --asin ASIN1 ASIN2 ASIN3
 *   node pricing-dashboard.js --mixed --sku YOUR_SKU --asin B0104R0FRG
 */

const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// Configuration
const config = {
  marketplace: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P', // UK marketplace
  region: 'eu-west-1',
  endpoint: 'https://sellingpartnerapi-eu.amazon.com',

  // AWS credentials
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,

  // SP-API credentials
  refreshToken: process.env.AMAZON_REFRESH_TOKEN,
  clientId: process.env.AMAZON_CLIENT_ID,
  clientSecret: process.env.AMAZON_CLIENT_SECRET,
};

// AWS Signature V4 implementation
function createSignature(method, path, queryParams, headers, body, region, service, accessKeyId, secretAccessKey) {
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStamp = now.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';

  // Canonical request
  const canonicalUri = path;
  const canonicalQuerystring = queryParams ? Object.keys(queryParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
    .join('&') : '';

  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map(key => `${key.toLowerCase()}:${headers[key]}\n`)
    .join('');

  const signedHeaders = Object.keys(headers)
    .sort()
    .map(key => key.toLowerCase())
    .join(';');

  const payloadHash = crypto.createHash('sha256').update(body || '').digest('hex');

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  // String to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    timeStamp,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  // Calculate signature
  const kDate = crypto.createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  return {
    authorization: `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-date': timeStamp
  };
}

// Get access token
async function getAccessToken() {
  try {
    const response = await axios.post('https://api.amazon.com/auth/o2/token', {
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data.access_token;
  } catch (error) {
    console.error('❌ Error getting access token:', error.response?.data || error.message);
    throw error;
  }
}

// Search for ASIN by SKU using Catalog Items API
async function searchASINBySKU(accessToken, sku) {
  try {
    const path = '/catalog/2022-04-01/items';
    const queryParams = {
      marketplaceIds: config.marketplace,
      identifiers: sku,
      identifiersType: 'SKU',
      includedData: 'identifiers,attributes,summaries'
    };

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'x-amz-access-token': accessToken,
      'Content-Type': 'application/json',
      'Host': 'sellingpartnerapi-eu.amazon.com'
    };

    const signatureData = createSignature(
      'GET',
      path,
      queryParams,
      headers,
      '',
      config.region,
      'execute-api',
      config.accessKeyId,
      config.secretAccessKey
    );

    headers['Authorization'] = signatureData.authorization;
    headers['x-amz-date'] = signatureData['x-amz-date'];

    const queryString = Object.keys(queryParams)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');

    const response = await axios.get(`${config.endpoint}${path}?${queryString}`, {
      headers,
      timeout: 10000
    });

    if (response.data.items && response.data.items.length > 0) {
      const item = response.data.items[0];
      return {
        sku: sku,
        asin: item.asin,
        title: item.summaries?.[0]?.itemName || 'N/A',
        brand: item.attributes?.brand?.[0]?.value || 'N/A',
        status: item.summaries?.[0]?.status || 'N/A'
      };
    }

    return null;
  } catch (error) {
    console.error(`❌ Error searching for SKU ${sku}:`, error.response?.status, error.response?.data || error.message);
    return null;
  }
}

// Get pricing data for ASIN
async function getPricingData(accessToken, asin) {
  try {
    const path = `/products/pricing/v0/items/${asin}/offers`;
    const queryParams = {
      MarketplaceId: config.marketplace,
      ItemCondition: 'New'
    };

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'x-amz-access-token': accessToken,
      'Content-Type': 'application/json',
      'Host': 'sellingpartnerapi-eu.amazon.com'
    };

    const signatureData = createSignature(
      'GET',
      path,
      queryParams,
      headers,
      '',
      config.region,
      'execute-api',
      config.accessKeyId,
      config.secretAccessKey
    );

    headers['Authorization'] = signatureData.authorization;
    headers['x-amz-date'] = signatureData['x-amz-date'];

    const queryString = Object.keys(queryParams)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');

    const response = await axios.get(`${config.endpoint}${path}?${queryString}`, {
      headers,
      timeout: 10000
    });

    return response.data;
  } catch (error) {
    console.error(`❌ Error getting pricing for ASIN ${asin}:`, error.response?.status, error.response?.data || error.message);
    return null;
  }
}

// Format pricing data for display
function formatPricingData(pricingData) {
  if (!pricingData || !pricingData.payload) {
    return {
      success: false,
      message: 'No pricing data available'
    };
  }

  const payload = pricingData.payload;
  const offers = payload.Offers || [];

  if (offers.length === 0) {
    return {
      success: false,
      message: 'No offers available'
    };
  }

  // Find lowest price and buy box
  let lowestPrice = null;
  let buyBoxPrice = null;
  const formattedOffers = [];

  offers.forEach(offer => {
    const listingPrice = offer.ListingPrice;
    const shipping = offer.Shipping;
    const totalPrice = listingPrice.Amount + (shipping ? shipping.Amount : 0);

    formattedOffers.push({
      price: listingPrice.Amount,
      currency: listingPrice.CurrencyCode,
      condition: offer.SubCondition,
      fulfillment: offer.IsFulfilledByAmazon ? 'FBA' : 'FBM',
      totalPrice: totalPrice,
      buyBox: offer.IsBuyBoxWinner || false
    });

    if (lowestPrice === null || totalPrice < lowestPrice.totalPrice) {
      lowestPrice = {
        price: listingPrice.Amount,
        currency: listingPrice.CurrencyCode,
        totalPrice: totalPrice
      };
    }

    if (offer.IsBuyBoxWinner) {
      buyBoxPrice = {
        price: listingPrice.Amount,
        currency: listingPrice.CurrencyCode,
        totalPrice: totalPrice
      };
    }
  });

  return {
    success: true,
    totalOffers: offers.length,
    lowestPrice: lowestPrice,
    buyBoxPrice: buyBoxPrice,
    offers: formattedOffers
  };
}

// Process a single item (SKU or ASIN)
async function processItem(accessToken, item, type) {
  console.log(`\n📦 Processing ${type.toUpperCase()}: ${item}`);
  console.log('─'.repeat(40));

  let asin = item;
  let productInfo = null;

  // If it's a SKU, first convert to ASIN
  if (type === 'sku') {
    console.log('🔍 Looking up ASIN for SKU...');
    productInfo = await searchASINBySKU(accessToken, item);

    if (!productInfo) {
      console.log('❌ Could not find ASIN for this SKU');
      return null;
    }

    asin = productInfo.asin;
    console.log(`✅ Found ASIN: ${asin}`);
    console.log(`📋 Title: ${productInfo.title}`);
  }

  // Get pricing data
  console.log('💰 Fetching pricing data...');
  const pricingData = await getPricingData(accessToken, asin);
  const formattedPricing = formatPricingData(pricingData);

  if (!formattedPricing.success) {
    console.log(`❌ ${formattedPricing.message}`);
    return null;
  }

  // Display pricing information
  console.log(`✅ Found ${formattedPricing.totalOffers} offer(s)`);

  if (formattedPricing.lowestPrice) {
    console.log(`💰 Lowest Price: ${formattedPricing.lowestPrice.price} ${formattedPricing.lowestPrice.currency}`);
  }

  if (formattedPricing.buyBoxPrice) {
    console.log(`🏆 Buy Box Price: ${formattedPricing.buyBoxPrice.price} ${formattedPricing.buyBoxPrice.currency}`);
  }

  console.log('\n📊 All Offers:');
  formattedPricing.offers.forEach((offer, index) => {
    const buyBoxIndicator = offer.buyBox ? ' 🏆' : '';
    console.log(`   ${index + 1}. ${offer.price} ${offer.currency} (${offer.condition}) - ${offer.fulfillment}${buyBoxIndicator}`);
  });

  return {
    originalItem: item,
    type: type,
    asin: asin,
    productInfo: productInfo,
    pricing: formattedPricing
  };
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    skus: [],
    asins: [],
    mixed: false
  };

  let currentMode = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--sku') {
      currentMode = 'sku';
    } else if (arg === '--asin') {
      currentMode = 'asin';
    } else if (arg === '--mixed') {
      result.mixed = true;
    } else if (currentMode) {
      if (currentMode === 'sku') {
        result.skus.push(arg);
      } else if (currentMode === 'asin') {
        result.asins.push(arg);
      }
    }
  }

  return result;
}

// Main execution
async function main() {
  console.log('🛒 Amazon SP-API Pricing Dashboard');
  console.log('═'.repeat(50));

  const args = parseArgs();

  if (args.skus.length === 0 && args.asins.length === 0) {
    console.log('❌ Please provide at least one SKU or ASIN');
    console.log('\nUsage:');
    console.log('  node pricing-dashboard.js --sku YOUR_SKU');
    console.log('  node pricing-dashboard.js --asin B0104R0FRG');
    console.log('  node pricing-dashboard.js --sku SKU1 SKU2 --asin ASIN1 ASIN2');
    console.log('  node pricing-dashboard.js --mixed --sku YOUR_SKU --asin B0104R0FRG');
    process.exit(1);
  }

  // Validate configuration
  const requiredEnvVars = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AMAZON_REFRESH_TOKEN',
    'AMAZON_CLIENT_ID',
    'AMAZON_CLIENT_SECRET'
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }

  console.log(`🌍 Marketplace: ${config.marketplace}`);
  console.log(`📦 Processing ${args.skus.length} SKU(s) and ${args.asins.length} ASIN(s)`);

  try {
    const accessToken = await getAccessToken();
    const results = [];

    // Process SKUs
    for (const sku of args.skus) {
      const result = await processItem(accessToken, sku, 'sku');
      if (result) results.push(result);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Process ASINs
    for (const asin of args.asins) {
      const result = await processItem(accessToken, asin, 'asin');
      if (result) results.push(result);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary
    console.log('\n📊 PRICING SUMMARY');
    console.log('═'.repeat(50));

    if (results.length === 0) {
      console.log('❌ No pricing data found for any items');
    } else {
      console.log(`✅ Successfully processed ${results.length} item(s):`);

      results.forEach(result => {
        const lowest = result.pricing.lowestPrice;
        const buyBox = result.pricing.buyBoxPrice;

        console.log(`\n📦 ${result.originalItem} (${result.type.toUpperCase()}) → ${result.asin}`);
        if (result.productInfo) {
          console.log(`   📋 ${result.productInfo.title}`);
        }
        console.log(`   💰 Lowest: ${lowest.price} ${lowest.currency}`);
        if (buyBox) {
          console.log(`   🏆 Buy Box: ${buyBox.price} ${buyBox.currency}`);
        }
        console.log(`   📊 Offers: ${result.pricing.totalOffers}`);
      });
    }

    console.log('\n🎉 Pricing dashboard completed!');

  } catch (error) {
    console.error('❌ Error during execution:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { processItem, getPricingData, searchASINBySKU };
