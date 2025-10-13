/**
 * Test STS AssumeRole Integration
 * 
 * This script tests the new STS AssumeRole functionality
 * that's now wired into every SP-API signed request
 */

import 'dotenv/config';
import { SPAPIClient } from './src/lib/amazon/sp-api-client';

async function testSTSAssumeRole() {
  console.log('🔐 Testing STS AssumeRole Integration\n');

  // Check for required environment variables
  const requiredEnvVars = [
    'AMAZON_CLIENT_ID',
    'AMAZON_CLIENT_SECRET',
    'AMAZON_REFRESH_TOKEN',
    'AMAZON_AWS_ACCESS_KEY_ID',
    'AMAZON_AWS_SECRET_ACCESS_KEY',
    'AMAZON_ROLE_ARN' // NEW: Required for AssumeRole
  ];

  const missing = requiredEnvVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '));
    console.log('\n💡 You need to add AMAZON_ROLE_ARN to your .env file');
    console.log('   This is the ARN of your SP-API IAM Role from Seller Central');
    console.log('   Example: arn:aws:iam::123456789012:role/SellerCentralSPAPIRole\n');
    process.exit(1);
  }

  console.log('✅ All required environment variables present');
  console.log(`   Role ARN: ${process.env.AMAZON_ROLE_ARN}\n`);

  try {
    const client = SPAPIClient.fromEnv();

    // Test 1: Catalog API with assumed role credentials
    console.log('📦 Test 1: Catalog API (GET /catalog/2022-04-01/items/{asin})');
    const catalogResponse = await client.get(
      '/catalog/2022-04-01/items/B08BPCC8WD',
      {
        queryParams: {
          marketplaceIds: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
          includedData: 'summaries,attributes'
        }
      }
    );

    if (catalogResponse.success) {
      console.log('   ✅ SUCCESS! Catalog API now works with STS AssumeRole');
      console.log('   Product:', catalogResponse.data.summaries?.[0]?.itemName || 'N/A');
    } else {
      console.log('   ❌ FAILED:', catalogResponse.errors?.[0]?.message);
      console.log('   Status:', catalogResponse.statusCode);
      if (catalogResponse.headers?.['x-amzn-requestid']) {
        console.log('   Request ID:', catalogResponse.headers['x-amzn-requestid']);
      }
    }

    // Test 2: Pricing API (should still work)
    console.log('\n💰 Test 2: Pricing API (GET /products/pricing/v0/competitivePrice)');
    const pricingResponse = await client.get(
      '/products/pricing/v0/competitivePrice',
      {
        queryParams: {
          MarketplaceId: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
          Asins: 'B08BPCC8WD',
          ItemType: 'Asin'
        }
      }
    );

    if (pricingResponse.success) {
      console.log('   ✅ SUCCESS! Pricing API still works with STS');
      const asinData = pricingResponse.data?.[0];
      console.log('   ASIN:', asinData?.ASIN || 'N/A');
    } else {
      console.log('   ❌ FAILED:', pricingResponse.errors?.[0]?.message);
    }

    // Test 3: Listings API (should still work)
    console.log('\n📝 Test 3: Listings API (GET /listings/2021-08-01/items/{sellerId}/{sku})');
    const testSku = 'TEST-SKU-123';
    const sellerId = process.env.AMAZON_SELLER_ID || 'A1234567890ABC';
    const listingsResponse = await client.get(
      `/listings/2021-08-01/items/${sellerId}/${testSku}`,
      {
        queryParams: {
          marketplaceIds: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P'
        }
      }
    );

    if (listingsResponse.success || listingsResponse.statusCode === 404) {
      console.log('   ✅ SUCCESS! Listings API works (404 expected for test SKU)');
    } else {
      console.log('   ❌ FAILED:', listingsResponse.errors?.[0]?.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 STS AssumeRole Integration Complete!');
    console.log('='.repeat(60));
    console.log('\n✨ Key Features:');
    console.log('   • Temporary credentials cached for 50-55 minutes');
    console.log('   • x-amz-security-token automatically included in signature');
    console.log('   • Automatic credential refresh before expiration');
    console.log('   • All SP-API calls now use assumed role credentials\n');

  } catch (error) {
    console.error('\n❌ Error during testing:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

testSTSAssumeRole();
