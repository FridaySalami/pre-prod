#!/usr/bin/env node

/**
 * Find Your Seller ID
 * 
 * This script helps you identify your Amazon seller ID by checking
 * your marketplace participations and orders.
 * 
 * Usage:
 *   node find-seller-id.cjs
 */

const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// Configuration
const config = {
  marketplace: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
  region: 'eu-west-1',
  endpoint: 'https://sellingpartnerapi-eu.amazon.com',

  // AWS credentials
  accessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY,

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

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    timeStamp,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

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

// Try to get seller ID from orders
async function getSellerFromOrders(accessToken) {
  try {
    const path = '/orders/v0/orders';
    const createdAfter = new Date();
    createdAfter.setDate(createdAfter.getDate() - 30); // Last 30 days

    const queryParams = {
      MarketplaceIds: config.marketplace,
      CreatedAfter: createdAfter.toISOString(),
      MaxResultsPerPage: 1
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
    console.error('❌ Error getting orders:', error.response?.status, error.response?.data || error.message);
    return null;
  }
}

// Main execution
async function main() {
  console.log('🔍 Amazon Seller ID Finder');
  console.log('═'.repeat(50));

  console.log('This tool helps you find your Amazon seller ID using various methods.\n');

  try {
    const accessToken = await getAccessToken();

    // Method 1: Try to get from orders (if you have recent orders)
    console.log('🔍 Method 1: Checking recent orders...');
    const ordersData = await getSellerFromOrders(accessToken);

    if (ordersData && ordersData.payload && ordersData.payload.Orders && ordersData.payload.Orders.length > 0) {
      const firstOrder = ordersData.payload.Orders[0];
      if (firstOrder.SellerId) {
        console.log(`✅ Found your seller ID from orders: ${firstOrder.SellerId}`);
        console.log(`📦 Order example: ${firstOrder.AmazonOrderId}`);
        console.log(`📅 Order date: ${firstOrder.PurchaseDate}`);
        return;
      }
    }

    console.log('❌ No seller ID found in recent orders');

    // Alternative methods
    console.log('\n🔍 Alternative Methods:');
    console.log('─'.repeat(30));

    console.log('1. 🌐 Amazon Seller Central:');
    console.log('   • Go to Settings → Account Info');
    console.log('   • Look for "Merchant Token" or "Seller ID"');
    console.log('   • It usually starts with "A" and is 13-14 characters');

    console.log('\n2. 📊 Reports:');
    console.log('   • Go to Reports → Business Reports');
    console.log('   • Download any report and check the seller ID field');

    console.log('\n3. 🔗 Product URLs:');
    console.log('   • Go to your product listing');
    console.log('   • Look at the URL for "merchant=" parameter');
    console.log('   • Example: merchant=A1234567890123');

    console.log('\n4. 📱 API Response:');
    console.log('   • Your seller ID appears in the Buy Box analysis above');
    console.log('   • Compare with known competitor seller IDs');

    console.log('\n💡 Once you have your seller ID, you can use it to:');
    console.log('   • Identify your offers in pricing data');
    console.log('   • Check Buy Box ownership');
    console.log('   • Monitor competitor activity');

    console.log('\n🎯 Next Steps:');
    console.log('   1. Find your seller ID using one of the methods above');
    console.log('   2. Run: node enhanced-buy-box-checker.cjs YOUR_ASIN');
    console.log('   3. Compare the Buy Box winner seller ID with yours');

  } catch (error) {
    console.error('❌ Error during execution:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { getSellerFromOrders };
