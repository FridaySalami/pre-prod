/**
 * Test which region/marketplace the refresh token is authorized for
 */

import { config } from 'dotenv';
config();

import { SPAPIClient, RateLimiters } from './src/lib/amazon/index.js';

async function testRegionAccess() {
  console.log('🔍 Testing Refresh Token Region Access\n');

  const testAsin = 'B08BPCC8WD';

  // Test 1: EU Region (current config)
  console.log('🧪 TEST 1: EU Region (sellingpartnerapi-eu.amazon.com)');
  console.log('   Current .env config: AMAZON_AWS_REGION=eu-west-1\n');

  try {
    const euClient = SPAPIClient.fromEnv();
    const euResponse = await euClient.get(
      `/catalog/2022-04-01/items/${testAsin}`,
      {
        queryParams: {
          marketplaceIds: 'A1F83G8C2ARO7P' // UK marketplace
        },
        rateLimiter: RateLimiters.catalog
      }
    );

    if (euResponse.success) {
      console.log('✅ EU Region: SUCCESS - Token works for Europe!\n');
      console.log('Data:', JSON.stringify(euResponse.data, null, 2));
    } else {
      console.log('❌ EU Region: FAILED');
      console.log('Status:', euResponse.statusCode);
      console.log('Errors:', JSON.stringify(euResponse.errors, null, 2));
      console.log('');
    }
  } catch (error: any) {
    console.log('❌ EU Region: ERROR');
    console.log('Message:', error.message);
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════\n');

  // Test 2: NA Region (maybe token was authorized for US?)
  console.log('🧪 TEST 2: NA Region (sellingpartnerapi-na.amazon.com)');
  console.log('   Testing if token was authorized for North America instead\n');

  try {
    const naClient = SPAPIClient.fromEnv({
      awsRegion: 'us-east-1', // Override to NA
      marketplaceId: 'ATVPDKIKX0DER' // US marketplace
    });

    const naResponse = await naClient.get(
      `/catalog/2022-04-01/items/${testAsin}`,
      {
        queryParams: {
          marketplaceIds: 'ATVPDKIKX0DER' // US marketplace
        },
        rateLimiter: RateLimiters.catalog
      }
    );

    if (naResponse.success) {
      console.log('✅ NA Region: SUCCESS - Token works for North America!');
      console.log('⚠️  This means you authorized the app in sellercentral.amazon.com (US)');
      console.log('⚠️  You need to re-authorize in sellercentral.amazon.co.uk (UK)\n');
      console.log('Data:', JSON.stringify(naResponse.data, null, 2));
    } else {
      console.log('❌ NA Region: FAILED');
      console.log('Status:', naResponse.statusCode);
      console.log('Errors:', JSON.stringify(naResponse.errors, null, 2));
      console.log('');
    }
  } catch (error: any) {
    console.log('❌ NA Region: ERROR');
    console.log('Message:', error.message);
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════\n');

  // Test 3: Try UK marketplace on NA endpoint (mixed config)
  console.log('🧪 TEST 3: UK Marketplace on NA Endpoint (mismatched config)');
  console.log('   Testing marketplace A1F83G8C2ARO7P on NA endpoint\n');

  try {
    const mixedClient = SPAPIClient.fromEnv({
      awsRegion: 'us-east-1' // NA endpoint
      // Keep UK marketplace from env
    });

    const mixedResponse = await mixedClient.get(
      `/catalog/2022-04-01/items/${testAsin}`,
      {
        queryParams: {
          marketplaceIds: 'A1F83G8C2ARO7P' // UK marketplace
        },
        rateLimiter: RateLimiters.catalog
      }
    );

    if (mixedResponse.success) {
      console.log('✅ Mixed Config: SUCCESS\n');
      console.log('Data:', JSON.stringify(mixedResponse.data, null, 2));
    } else {
      console.log('❌ Mixed Config: FAILED');
      console.log('Status:', mixedResponse.statusCode);
      console.log('Errors:', JSON.stringify(mixedResponse.errors, null, 2));
      console.log('');
    }
  } catch (error: any) {
    console.log('❌ Mixed Config: ERROR');
    console.log('Message:', error.message);
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('🎯 CONCLUSION:\n');
  console.log('If TEST 1 (EU) succeeded:');
  console.log('  → Token is correctly authorized for Europe');
  console.log('  → Issue is with API permissions, need to check Seller Central roles\n');

  console.log('If TEST 2 (NA) succeeded:');
  console.log('  → Token was authorized on sellercentral.amazon.com (WRONG)');
  console.log('  → You MUST re-authorize on sellercentral.amazon.co.uk (UK)');
  console.log('  → This is the most likely issue!\n');

  console.log('If both failed:');
  console.log('  → Token lacks Catalog API permissions entirely');
  console.log('  → Check which roles were selected during authorization\n');
}

testRegionAccess();
