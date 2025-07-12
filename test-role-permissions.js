#!/usr/bin/env node

/**
 * Test Individual SP-API Role Permissions
 * This script tests specific API endpoints to determine which roles are working
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

async function makeSignedRequest(path, endpoint, roleName) {
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

  return new Promise((resolve) => {
    const options = {
      hostname: host,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': authorizationHeader,
        'x-amz-access-token': accessToken,
        'x-amz-date': amzDate,
        'User-Agent': 'MyApp/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const status = res.statusCode;
        let result;

        if (status === 200) {
          result = `✅ ${roleName}: WORKING (${status})`;
        } else if (status === 404) {
          result = `⚠️  ${roleName}: ACCESSIBLE but no data (${status})`;
        } else if (status === 403) {
          result = `❌ ${roleName}: ACCESS DENIED (${status}) - Missing role permission`;
        } else {
          result = `⚠️  ${roleName}: UNEXPECTED (${status})`;
        }

        console.log(result);
        if (status === 403) {
          console.log(`   💡 Required role missing for ${endpoint}`);
        }
        resolve({ status, roleName, endpoint });
      });
    });

    req.on('error', (error) => {
      console.log(`❌ ${roleName}: ERROR - ${error.message}`);
      resolve({ status: 'error', roleName, endpoint, error: error.message });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      console.log(`❌ ${roleName}: TIMEOUT`);
      resolve({ status: 'timeout', roleName, endpoint });
    });

    req.end();
  });
}

async function testRolePermissions() {
  console.log('🔍 Testing Individual SP-API Role Permissions');
  console.log('═'.repeat(60));

  const tests = [
    {
      path: '/orders/v0/orders?MarketplaceIds=A1F83G8C2ARO7P&CreatedAfter=2024-01-01T00:00:00Z',
      endpoint: 'Orders API',
      roleName: 'Inventory and Order Tracking'
    },
    {
      path: '/products/pricing/v0/price?MarketplaceId=A1F83G8C2ARO7P&Asins=B08N5WRWNW',
      endpoint: 'Product Pricing API',
      roleName: 'Pricing'
    },
    {
      path: '/fba/inventory/v1/summaries?details=true&granularityType=Marketplace&granularityId=A1F83G8C2ARO7P&marketplaceIds=A1F83G8C2ARO7P',
      endpoint: 'FBA Inventory API',
      roleName: 'Amazon Fulfillment OR Inventory and Order Tracking'
    },
    {
      path: '/listings/2021-08-01/items/A1EXAMPLE123/B08N5WRWNW?marketplaceIds=A1F83G8C2ARO7P',
      endpoint: 'Listings Items API',
      roleName: 'Product Listing'
    }
  ];

  const results = [];

  for (const test of tests) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
    const result = await makeSignedRequest(test.path, test.endpoint, test.roleName);
    results.push(result);
  }

  console.log('\n📊 Role Permission Summary');
  console.log('─'.repeat(60));

  const working = results.filter(r => r.status === 200).length;
  const accessible = results.filter(r => r.status === 404).length;
  const denied = results.filter(r => r.status === 403).length;

  console.log(`✅ Working: ${working}`);
  console.log(`⚠️  Accessible but no data: ${accessible}`);
  console.log(`❌ Access denied: ${denied}`);

  if (denied > 0) {
    console.log('\n💡 Recommendations:');
    console.log('1. Check if "Product Listing" role is enabled in Developer Console');
    console.log('2. Generate a new refresh token after adding missing roles');
    console.log('3. Wait up to 2 hours for role permissions to propagate');
  }

  if (working + accessible === tests.length) {
    console.log('\n🎉 All roles are working correctly!');
  }
}

// Run the test
testRolePermissions().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
