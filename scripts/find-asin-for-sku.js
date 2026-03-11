#!/usr/bin/env node

import axios from 'axios';
import crypto from 'crypto';
import qs from 'querystring';
import dotenv from 'dotenv';

dotenv.config();

const MARKETPLACE_ID = 'ATVPDKIKX0DER'; // US marketplace
const REGION = 'us-east-1';
const HOST = 'sellingpartnerapi-na.amazon.com';

// LWA Token function
async function getLWAToken() {
  const tokenUrl = 'https://api.amazon.com/auth/o2/token';
  const params = {
    grant_type: 'refresh_token',
    refresh_token: process.env.AMAZON_REFRESH_TOKEN,
    client_id: process.env.AMAZON_CLIENT_ID,
    client_secret: process.env.AMAZON_CLIENT_SECRET
  };

  try {
    const response = await axios.post(tokenUrl, qs.stringify(params), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data.access_token;
  } catch (error) {
    console.error('❌ LWA Token Error:', error.response?.data || error.message);
    throw error;
  }
}

// AWS4 Signature function
function signRequest(method, path, queryParams, accessToken) {
  const service = 'execute-api';
  const region = REGION;
  const host = HOST;
  const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const date = timestamp.substr(0, 8);

  const canonicalQueryString = queryParams ? qs.stringify(queryParams) : '';
  const canonicalHeaders = `host:${host}\nx-amz-access-token:${accessToken}\nx-amz-date:${timestamp}\n`;
  const signedHeaders = 'host;x-amz-access-token;x-amz-date';

  const canonicalRequest = [
    method,
    path,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    crypto.createHash('sha256').update('').digest('hex')
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timestamp,
    `${date}/${region}/${service}/aws4_request`,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  const kDate = crypto.createHmac('sha256', `AWS4${process.env.AWS_SECRET_ACCESS_KEY}`).update(date).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();

  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  return {
    'Authorization': `AWS4-HMAC-SHA256 Credential=${process.env.AWS_ACCESS_KEY_ID}/${date}/${region}/${service}/aws4_request, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-date': timestamp,
    'x-amz-access-token': accessToken
  };
}

// Search for SKU in catalog
async function findASINForSKU(sku) {
  try {
    const accessToken = await getLWAToken();
    const path = `/catalog/2022-04-01/items`;
    const queryParams = {
      marketplaceIds: MARKETPLACE_ID,
      identifiers: sku,
      identifiersType: 'SKU',
      includedData: 'identifiers,attributes,summaries'
    };

    const headers = signRequest('GET', path, queryParams, accessToken);
    const url = `https://${HOST}${path}?${qs.stringify(queryParams)}`;

    const response = await axios.get(url, { headers });

    return {
      success: true,
      data: response.data,
      status: response.status
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

// Alternative: Search by keyword
async function searchCatalogByKeyword(keyword) {
  try {
    const accessToken = await getLWAToken();
    const path = `/catalog/2022-04-01/items`;
    const queryParams = {
      marketplaceIds: MARKETPLACE_ID,
      keywords: keyword,
      includedData: 'identifiers,attributes,summaries'
    };

    const headers = signRequest('GET', path, queryParams, accessToken);
    const url = `https://${HOST}${path}?${qs.stringify(queryParams)}`;

    const response = await axios.get(url, { headers });

    return {
      success: true,
      data: response.data,
      status: response.status
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

// Format catalog data
function formatCatalogData(catalogData) {
  if (!catalogData.success) {
    return `❌ Error: ${JSON.stringify(catalogData.error)}`;
  }

  const data = catalogData.data;
  let output = '';

  if (data.items && data.items.length > 0) {
    output += `✅ Found ${data.items.length} item(s):\n\n`;

    data.items.forEach((item, index) => {
      output += `📦 Item ${index + 1}:\n`;
      output += `   ASIN: ${item.asin || 'N/A'}\n`;

      if (item.identifiers) {
        output += `   Identifiers:\n`;
        Object.entries(item.identifiers).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            output += `     ${key}: ${value.join(', ')}\n`;
          } else {
            output += `     ${key}: ${value}\n`;
          }
        });
      }

      if (item.attributes) {
        output += `   Title: ${item.attributes.title || 'N/A'}\n`;
        output += `   Brand: ${item.attributes.brand || 'N/A'}\n`;
      }

      if (item.summaries && item.summaries.length > 0) {
        output += `   Marketplace: ${item.summaries[0].marketplaceId || 'N/A'}\n`;
        output += `   Adult Product: ${item.summaries[0].adultProduct || 'false'}\n`;
        output += `   Autographed: ${item.summaries[0].autographed || 'false'}\n`;
      }

      output += '\n';
    });
  } else {
    output += '❌ No items found\n';
  }

  return output;
}

// Main function
async function main() {
  const sku = process.argv[2];

  if (!sku) {
    console.log('🔍 Amazon SKU to ASIN Lookup Tool');
    console.log('📅', new Date().toLocaleString());
    console.log('════════════════════════════════════════════════════════════');
    console.log('❌ Error: Please provide a SKU');
    console.log('');
    console.log('Usage: node find-asin-for-sku.js MUSTAR01');
    console.log('');
    console.log('💡 This tool helps you find the ASIN for your SKU');
    console.log('   so you can then use get-asin-pricing.js to get pricing');
    console.log('');
    process.exit(1);
  }

  console.log('🔍 Amazon SKU to ASIN Lookup Tool');
  console.log('📅', new Date().toLocaleString());
  console.log('════════════════════════════════════════════════════════════');
  console.log(`🔍 Looking up ASIN for SKU: ${sku}`);
  console.log('════════════════════════════════════════════════════════════');

  console.log('📊 Method 1: Direct SKU lookup...');
  const skuResult = await findASINForSKU(sku);

  if (skuResult.success && skuResult.data.items?.length > 0) {
    console.log('✅ Found via SKU lookup:');
    console.log(formatCatalogData(skuResult));

    const asin = skuResult.data.items[0].asin;
    if (asin) {
      console.log(`🎯 Next step: Get pricing for ASIN ${asin}`);
      console.log(`   Command: node get-asin-pricing.js ${asin}`);
    }
  } else {
    console.log(`❌ SKU lookup failed: ${JSON.stringify(skuResult.error)}`);

    console.log('\n📊 Method 2: Keyword search...');
    const keywordResult = await searchCatalogByKeyword(sku);

    if (keywordResult.success && keywordResult.data.items?.length > 0) {
      console.log('✅ Found via keyword search:');
      console.log(formatCatalogData(keywordResult));

      const asin = keywordResult.data.items[0].asin;
      if (asin) {
        console.log(`🎯 Possible match found. Try: node get-asin-pricing.js ${asin}`);
      }
    } else {
      console.log(`❌ Keyword search failed: ${JSON.stringify(keywordResult.error)}`);
    }
  }

  console.log('\n📋 Summary:');
  console.log('────────────────────────────────────────────────────────────');

  const hasResults = skuResult.success && skuResult.data.items?.length > 0;

  if (hasResults) {
    console.log('✅ Successfully found catalog data');
    console.log('');
    console.log('🔧 Next steps:');
    console.log('1. Use the ASIN found above with get-asin-pricing.js');
    console.log('2. Verify the ASIN matches your product');
    console.log('3. Check Amazon Seller Central for confirmation');
  } else {
    console.log('⚠️  Could not find ASIN for this SKU');
    console.log('');
    console.log('🔧 Troubleshooting tips:');
    console.log('1. Verify the SKU is exactly as shown in Seller Central');
    console.log('2. Check that your product is active and approved');
    console.log('3. Try searching with part of the SKU or product title');
    console.log('4. Manually check Seller Central > Inventory > Manage Inventory');
    console.log('');
    console.log('💡 Alternative: Find ASIN manually in Seller Central');
    console.log('   Then use: node get-asin-pricing.js YOUR_ASIN_HERE');
  }
}

main().catch(console.error);
