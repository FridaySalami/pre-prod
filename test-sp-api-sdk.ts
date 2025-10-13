/**
 * Test Official SP-API SDK (No AWS IAM Signing Required!)
 * 
 * This SDK stopped requiring AWS SigV4 signing in October 2023.
 * It uses ONLY LWA OAuth tokens - no IAM credentials needed.
 * 
 * This might bypass the 403 error you're experiencing!
 */

import 'dotenv/config';
import { SellingPartnerApiAuth } from '@sp-api-sdk/auth';
import { CatalogItemsApiClient } from '@sp-api-sdk/catalog-items-api-2022-04-01';

async function testOfficialSDK() {
  console.log('🧪 Testing Official @sp-api-sdk (OAuth-Only, No AWS IAM)\n');
  console.log('='.repeat(70));
  console.log('KEY DIFFERENCE: This SDK does NOT use AWS SigV4 signing!');
  console.log('It uses ONLY LWA OAuth tokens (no IAM credentials needed)');
  console.log('='.repeat(70) + '\n');

  // Check required environment variables
  const requiredEnvVars = [
    'AMAZON_CLIENT_ID',
    'AMAZON_CLIENT_SECRET',
    'AMAZON_REFRESH_TOKEN'
  ];

  const missing = requiredEnvVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '));
    process.exit(1);
  }

  console.log('✅ Environment variables present:');
  console.log(`   - Client ID: ${process.env.AMAZON_CLIENT_ID?.substring(0, 20)}...`);
  console.log(`   - Refresh Token: ${process.env.AMAZON_REFRESH_TOKEN?.substring(0, 20)}...\n`);

  try {
    // Create auth (OAuth only - no AWS credentials!)
    const auth = new SellingPartnerApiAuth({
      clientId: process.env.AMAZON_CLIENT_ID!,
      clientSecret: process.env.AMAZON_CLIENT_SECRET!,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN!,
    });

    console.log('🔐 Created SellingPartnerApiAuth (OAuth-only)');

    // Create Catalog API client
    const client = new CatalogItemsApiClient({
      auth,
      region: 'eu',
    });

    console.log('📦 Created CatalogItemsApiClient (region: eu)\n');

    // Test: Get Catalog Item
    console.log('🧪 TEST: Get Catalog Item (ASIN: B08BPCC8WD)');
    console.log('-'.repeat(70));

    const testAsin = 'B08BPCC8WD';
    const marketplaceId = process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P';

    console.log(`   ASIN: ${testAsin}`);
    console.log(`   Marketplace: ${marketplaceId}`);
    console.log(`   Included Data: summaries, attributes\n`);

    const response = await client.getCatalogItem({
      asin: testAsin,
      marketplaceIds: [marketplaceId],
      includedData: ['summaries', 'attributes']
    });

    console.log('✅ SUCCESS! Catalog API works with OAuth-only approach!\n');
    console.log('📊 Response Data:');
    console.log(JSON.stringify(response.data, null, 2));

    console.log('\n' + '='.repeat(70));
    console.log('🎉 BREAKTHROUGH! OAuth-only approach bypasses the 403 error!');
    console.log('='.repeat(70));
    console.log('\n💡 Key Insights:');
    console.log('   • AWS IAM SigV4 signing is NOT needed (SDK removed it in 2023)');
    console.log('   • Only LWA OAuth refresh token is required');
    console.log('   • No AWS credentials, no IAM role, no AssumeRole needed');
    console.log('   • Catalog API works perfectly with just OAuth!\n');

    console.log('✨ Recommended Next Steps:');
    console.log('   1. Use @sp-api-sdk packages instead of custom implementation');
    console.log('   2. Remove all AWS IAM/SigV4 code from your client');
    console.log('   3. Simplify to OAuth-only authentication');
    console.log('   4. Update documentation to reflect simpler approach\n');

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);

    if (error.response) {
      console.error('\n📋 Response Details:');
      console.error('   Status:', error.response.status);
      console.error('   Status Text:', error.response.statusText);
      console.error('   Headers:', JSON.stringify(error.response.headers, null, 2));

      if (error.response.data) {
        console.error('   Data:', JSON.stringify(error.response.data, null, 2));
      }
    }

    if (error.stack) {
      console.error('\n📚 Stack Trace:');
      console.error(error.stack);
    }

    console.log('\n' + '='.repeat(70));
    console.log('⚠️  If you still get 403, the issue might be:');
    console.log('   • Refresh token needs regeneration in Seller Central');
    console.log('   • "Product Listing" role not properly authorized');
    console.log('   • Seller account verification/qualification needed');
    console.log('='.repeat(70) + '\n');

    process.exit(1);
  }
}

testOfficialSDK();
