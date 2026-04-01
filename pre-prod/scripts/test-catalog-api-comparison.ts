/**
 * Test Catalog Items API Access - v0 vs v2022-04-01
 * ASIN: B08BPCC8WD
 * 
 * Compare old v0 API (used by working bulk-scan) vs new v2022-04-01 API
 */

// Load environment variables from .env file
import { config } from 'dotenv';
config();

import { SPAPIClient, RateLimiters } from './src/lib/amazon/index.js';

async function testCatalogAPI() {
  console.log('🔍 Testing Amazon Catalog Items API - v0 vs v2022-04-01...\n');

  const client = SPAPIClient.fromEnv();
  const testAsin = 'B08BPCC8WD';

  console.log(`📦 Test ASIN: ${testAsin}`);
  console.log(`🌍 Marketplace: A1F83G8C2ARO7P (UK)\n`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test 1: v0 API (OLD - used by working bulk-scan.js)
  console.log('🧪 TEST 1: Catalog Items API v0 (OLD VERSION)\n');

  try {
    const responseV0 = await client.get(
      `/catalog/v0/items/${testAsin}`,
      {
        queryParams: {
          MarketplaceId: 'A1F83G8C2ARO7P'
        },
        rateLimiter: RateLimiters.catalog
      }
    );

    console.log('✅ SUCCESS! v0 API is accessible!\n');
    console.log('📄 v0 API Response:');
    console.log(JSON.stringify(responseV0, null, 2));
    console.log('\n📊 v0 API Key Data:');

    const data = responseV0.data || responseV0;

    // v0 structure check
    if (data?.AttributeSets?.[0]?.Title) {
      console.log(`   Title: ${data.AttributeSets[0].Title}`);
    }
    if (data?.AttributeSets?.[0]?.Brand) {
      console.log(`   Brand: ${data.AttributeSets[0].Brand}`);
    }
    if (data?.payload?.AttributeSets?.[0]?.Title) {
      console.log(`   Title (payload): ${data.payload.AttributeSets[0].Title}`);
    }

  } catch (error: any) {
    console.error('❌ v0 API FAILED!');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');

  // Test 2: v2022-04-01 API (NEW)
  console.log('🧪 TEST 2: Catalog Items API v2022-04-01 (NEW VERSION)\n');

  try {
    const responseV2 = await client.get(
      `/catalog/2022-04-01/items/${testAsin}`,
      {
        queryParams: {
          marketplaceIds: 'A1F83G8C2ARO7P',
          includedData: 'attributes,images,productTypes,salesRanks,summaries'
        },
        rateLimiter: RateLimiters.catalog
      }
    );

    console.log('✅ SUCCESS! v2022-04-01 API is accessible!\n');
    console.log('📄 v2022-04-01 API Response:');
    console.log(JSON.stringify(responseV2, null, 2));
    console.log('\n📊 v2022-04-01 Key Data:');

    const data = responseV2.data || responseV2;
    const summaries = data.summaries || [];
    const summary = summaries[0] || {};

    if (data.asin) {
      console.log(`   ASIN: ${data.asin}`);
    }
    if (summary.itemName) {
      console.log(`   Title: ${summary.itemName}`);
    }
    if (summary.brand) {
      console.log(`   Brand: ${summary.brand}`);
    }

  } catch (error: any) {
    console.error('❌ v2022-04-01 API FAILED!');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');

  // Conclusion
  console.log('🎯 CONCLUSION:\n');
  console.log('If v0 works but v2022-04-01 fails with 403:');
  console.log('  → Your refresh token predates the "Product Listing" role');
  console.log('  → The old v0 API has different permission requirements');
  console.log('  → You can use v0 API as a workaround OR regenerate token\n');

  console.log('If both work:');
  console.log('  → Your token has all required permissions');
  console.log('  → Use v2022-04-01 for better data structure\n');

  console.log('If both fail:');
  console.log('  → Check AWS credentials and signing');
  console.log('  → Verify LWA authentication is working\n');
}

// Run the test
testCatalogAPI();
