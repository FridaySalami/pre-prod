#!/usr/bin/env node

/**
 * SKU to ASIN Lookup Script
 * 
 * This script helps map your internal SKUs to Amazon ASINs using the SP-API.
 * Once you have the ASIN, you can use the pricing scripts to get live pricing data.
 * 
 * Usage:
 *   node sku-to-asin-lookup.js YOUR_SKU
 *   node sku-to-asin-lookup.js YOUR_SKU1 YOUR_SKU2 YOUR_SKU3
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

    return response.data;
  } catch (error) {
    console.error(`❌ Error searching for SKU ${sku}:`, error.response?.status, error.response?.data || error.message);
    return null;
  }
}

// Get inventory information for SKU
async function getInventoryBySKU(accessToken, sku) {
  try {
    const path = '/fba/inventory/v1/summaries';
    const queryParams = {
      details: 'true',
      granularityType: 'Marketplace',
      granularityId: config.marketplace,
      marketplaceIds: config.marketplace,
      sellerSkus: sku
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
    console.error(`❌ Error getting inventory for SKU ${sku}:`, error.response?.status, error.response?.data || error.message);
    return null;
  }
}

// Main function to lookup ASIN by SKU
async function lookupASIN(sku) {
  console.log(`\n🔍 Looking up ASIN for SKU: ${sku}`);
  console.log('═'.repeat(50));

  try {
    const accessToken = await getAccessToken();

    // Try Catalog Items API first
    console.log('📋 Searching Catalog Items API...');
    const catalogData = await searchASINBySKU(accessToken, sku);

    if (catalogData && catalogData.items && catalogData.items.length > 0) {
      const item = catalogData.items[0];
      console.log(`✅ Found ASIN: ${item.asin}`);
      console.log(`📦 Title: ${item.summaries?.[0]?.itemName || 'N/A'}`);
      console.log(`🏷️  Brand: ${item.attributes?.brand?.[0]?.value || 'N/A'}`);
      console.log(`📊 Status: ${item.summaries?.[0]?.status || 'N/A'}`);

      return {
        sku: sku,
        asin: item.asin,
        title: item.summaries?.[0]?.itemName || 'N/A',
        brand: item.attributes?.brand?.[0]?.value || 'N/A',
        status: item.summaries?.[0]?.status || 'N/A'
      };
    }

    // If not found in catalog, try inventory API
    console.log('📦 Searching Inventory API...');
    const inventoryData = await getInventoryBySKU(accessToken, sku);

    if (inventoryData && inventoryData.inventorySummaries && inventoryData.inventorySummaries.length > 0) {
      const inventory = inventoryData.inventorySummaries[0];
      console.log(`✅ Found ASIN: ${inventory.asin}`);
      console.log(`📦 Product Name: ${inventory.productName || 'N/A'}`);
      console.log(`📊 Condition: ${inventory.condition || 'N/A'}`);

      return {
        sku: sku,
        asin: inventory.asin,
        title: inventory.productName || 'N/A',
        condition: inventory.condition || 'N/A'
      };
    }

    console.log('❌ No ASIN found for this SKU');
    return null;

  } catch (error) {
    console.error('❌ Error during lookup:', error.message);
    return null;
  }
}

// Main execution
async function main() {
  console.log('🔍 SKU to ASIN Lookup Tool');
  console.log('═'.repeat(50));

  const skus = process.argv.slice(2);

  if (skus.length === 0) {
    console.log('❌ Please provide at least one SKU to lookup');
    console.log('Usage: node sku-to-asin-lookup.js YOUR_SKU');
    console.log('       node sku-to-asin-lookup.js SKU1 SKU2 SKU3');
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
  console.log(`📦 SKUs to lookup: ${skus.join(', ')}`);

  const results = [];

  // Process each SKU
  for (const sku of skus) {
    const result = await lookupASIN(sku);
    if (result) {
      results.push(result);
    }

    // Add delay between requests to avoid rate limiting
    if (skus.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Summary
  console.log('\n📊 LOOKUP SUMMARY');
  console.log('═'.repeat(50));

  if (results.length === 0) {
    console.log('❌ No ASINs found for any of the provided SKUs');
    console.log('\n💡 Troubleshooting tips:');
    console.log('   • Make sure the SKU exists in your seller account');
    console.log('   • Check that the SKU is active and listed');
    console.log('   • Verify your marketplace ID is correct');
    console.log('   • Some SKUs may not be indexed in the Catalog API yet');
  } else {
    console.log(`✅ Found ${results.length} ASIN(s):`);
    results.forEach(result => {
      console.log(`   📦 ${result.sku} → ${result.asin} (${result.title})`);
    });

    console.log('\n🎯 Next Steps:');
    console.log('   Use these ASINs with the pricing scripts:');
    results.forEach(result => {
      console.log(`   node test-live-asin-pricing.js ${result.asin}`);
    });
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { lookupASIN };
