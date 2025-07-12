#!/usr/bin/env node

/**
 * Amazon SP-API Pricing Test
 * 
 * This script specifically tests the Pricing API which you have approval for
 */

const https = require('https');
const crypto = require('crypto');
require('dotenv').config();

// Configuration
const CLIENT_ID = process.env.AMAZON_CLIENT_ID;
const CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.AMAZON_REFRESH_TOKEN;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION || 'eu-west-1';
const MARKETPLACE_ID = process.env.AMAZON_MARKETPLACE_ID;
const SELLER_ID = process.env.AMAZON_SELLER_ID;

console.log('='.repeat(60));
console.log('💰 AMAZON PRICING API TEST');
console.log('='.repeat(60));

// Function to get access token
async function getAccessToken() {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: REFRESH_TOKEN,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    }).toString();

    const options = {
      hostname: 'api.amazon.com',
      path: '/auth/o2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve(response.access_token);
          } else {
            reject(new Error(`Token refresh failed: ${response.error_description || response.error}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse token response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// AWS Signature Version 4 signing
function createSignature(method, uri, querystring, headers, payload, region) {
  const algorithm = 'AWS4-HMAC-SHA256';
  const service = 'execute-api';
  const date = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
  const dateStamp = date.slice(0, 8);
  
  // Create canonical request
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map(key => `${key.toLowerCase()}:${headers[key]}`)
    .join('\n') + '\n';
  
  const signedHeaders = Object.keys(headers)
    .sort()
    .map(key => key.toLowerCase())
    .join(';');
  
  const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');
  
  const canonicalRequest = [
    method,
    uri,
    querystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');
  
  // Create string to sign
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    date,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');
  
  // Calculate signature
  const kDate = crypto.createHmac('sha256', `AWS4${AWS_SECRET_ACCESS_KEY}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  
  // Create authorization header
  const authorization = `${algorithm} Credential=${AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  return {
    'Authorization': authorization,
    'X-Amz-Date': date
  };
}

// Test Pricing API endpoints
async function testPricingAPI(accessToken) {
  console.log('📋 Testing Pricing API endpoints...\n');
  
  const endpoints = [
    {
      name: 'Pricing - Get Pricing',
      path: '/products/pricing/v0/price',
      query: `MarketplaceId=${MARKETPLACE_ID}&Asins=B00A2KD8NY`, // Using a common test ASIN
      description: 'Get current pricing for a product'
    },
    {
      name: 'Pricing - Get Competitive Pricing',
      path: '/products/pricing/v0/competitivePrice',
      query: `MarketplaceId=${MARKETPLACE_ID}&Asins=B00A2KD8NY`,
      description: 'Get competitive pricing information'
    },
    {
      name: 'Pricing - Get Item Offers',
      path: '/products/pricing/v0/items/B00A2KD8NY/offers',
      query: `MarketplaceId=${MARKETPLACE_ID}&ItemCondition=New`,
      description: 'Get offers for a specific item'
    }
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 Testing: ${endpoint.name}`);
      console.log(`   Description: ${endpoint.description}`);
      
      const uri = endpoint.path;
      const querystring = endpoint.query;
      const host = `sellingpartnerapi-eu.amazon.com`;
      const method = 'GET';
      const payload = '';
      
      const headers = {
        'host': host,
        'x-amz-access-token': accessToken,
        'user-agent': 'MyApp/1.0'
      };
      
      const awsHeaders = createSignature(method, uri, querystring, headers, payload, AWS_REGION);
      Object.assign(headers, awsHeaders);
      
      const result = await new Promise((resolve, reject) => {
        const options = {
          hostname: host,
          path: `${uri}?${querystring}`,
          method: method,
          headers: headers
        };
        
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              data: data,
              headers: res.headers
            });
          });
        });
        
        req.on('error', reject);
        req.end();
      });
      
      if (result.statusCode === 200) {
        console.log(`   ✅ SUCCESS! Status: ${result.statusCode}`);
        try {
          const parsed = JSON.parse(result.data);
          console.log(`   📊 Response: ${JSON.stringify(parsed, null, 2).substring(0, 200)}...`);
        } catch (e) {
          console.log(`   📊 Response: ${result.data.substring(0, 200)}...`);
        }
      } else {
        console.log(`   ❌ FAILED! Status: ${result.statusCode}`);
        console.log(`   📄 Response: ${result.data}`);
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}\n`);
    }
  }
}

// Test Product Catalog API (alternative if Pricing fails)
async function testCatalogAPI(accessToken) {
  console.log('📋 Testing Catalog API endpoints...\n');
  
  const endpoints = [
    {
      name: 'Catalog - Search Catalog Items',
      path: '/catalog/2022-04-01/items',
      query: `marketplaceIds=${MARKETPLACE_ID}&keywords=coffee&pageSize=5`,
      description: 'Search for products in catalog'
    },
    {
      name: 'Catalog - Get Catalog Item',
      path: '/catalog/2022-04-01/items/B00A2KD8NY',
      query: `marketplaceIds=${MARKETPLACE_ID}&includedData=summaries`,
      description: 'Get specific product details'
    }
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 Testing: ${endpoint.name}`);
      console.log(`   Description: ${endpoint.description}`);
      
      const uri = endpoint.path;
      const querystring = endpoint.query;
      const host = `sellingpartnerapi-eu.amazon.com`;
      const method = 'GET';
      const payload = '';
      
      const headers = {
        'host': host,
        'x-amz-access-token': accessToken,
        'user-agent': 'MyApp/1.0'
      };
      
      const awsHeaders = createSignature(method, uri, querystring, headers, payload, AWS_REGION);
      Object.assign(headers, awsHeaders);
      
      const result = await new Promise((resolve, reject) => {
        const options = {
          hostname: host,
          path: `${uri}?${querystring}`,
          method: method,
          headers: headers
        };
        
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              data: data,
              headers: res.headers
            });
          });
        });
        
        req.on('error', reject);
        req.end();
      });
      
      if (result.statusCode === 200) {
        console.log(`   ✅ SUCCESS! Status: ${result.statusCode}`);
        try {
          const parsed = JSON.parse(result.data);
          console.log(`   📊 Response: ${JSON.stringify(parsed, null, 2).substring(0, 300)}...`);
        } catch (e) {
          console.log(`   📊 Response: ${result.data.substring(0, 200)}...`);
        }
      } else {
        console.log(`   ❌ FAILED! Status: ${result.statusCode}`);
        console.log(`   📄 Response: ${result.data}`);
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}\n`);
    }
  }
}

// Main execution
async function main() {
  try {
    console.log('📋 STEP 1: Getting Access Token');
    console.log('─'.repeat(40));
    const accessToken = await getAccessToken();
    console.log('✅ Access token obtained successfully!\n');
    
    console.log('📋 STEP 2: Testing Live Data Endpoints');
    console.log('─'.repeat(40));
    
    // Test Pricing API first (you have this permission)
    await testPricingAPI(accessToken);
    
    // Test Catalog API as fallback
    await testCatalogAPI(accessToken);
    
    console.log('='.repeat(60));
    console.log('🎯 TEST COMPLETE');
    console.log('='.repeat(60));
    console.log('💡 If any endpoints returned 200 status codes, you have');
    console.log('   successfully accessed live Amazon data!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('   • Use successful endpoints to build your dashboard');
    console.log('   • Request additional SP-API roles if needed');
    console.log('   • Check Amazon Developer Console for role status');
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
  }
}

main();
