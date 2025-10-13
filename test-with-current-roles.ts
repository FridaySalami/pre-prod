/**
 * Test with Current Role Configuration
 * 
 * Based on the app edit screenshot, you have these roles:
 * ✅ Selling Partner Insights
 * ✅ Pricing
 * ✅ Inventory and Order Tracking
 * ✅ Brand Analytics
 * ✅ Buyer Solicitation
 * ✅ Product Listing
 * ✅ Amazon Warehousing and Distribution
 * 
 * Testing if Catalog API works with this configuration
 */

import 'dotenv/config';
import { SellingPartnerApiAuth } from '@sp-api-sdk/auth';
import { CatalogItemsApiClient } from '@sp-api-sdk/catalog-items-api-2022-04-01';

async function testWithCurrentRoles() {
  console.log('🔍 Testing Catalog API with Current Role Configuration\n');
  console.log('='.repeat(70));
  console.log('Current App Roles Checked:');
  console.log('  ✅ Selling Partner Insights');
  console.log('  ✅ Pricing');
  console.log('  ✅ Inventory and Order Tracking');
  console.log('  ✅ Brand Analytics');
  console.log('  ✅ Buyer Solicitation');
  console.log('  ✅ Product Listing');
  console.log('  ✅ Amazon Warehousing and Distribution');
  console.log('='.repeat(70) + '\n');

  const auth = new SellingPartnerApiAuth({
    clientId: process.env.AMAZON_CLIENT_ID!,
    clientSecret: process.env.AMAZON_CLIENT_SECRET!,
    refreshToken: process.env.AMAZON_REFRESH_TOKEN!,
  });

  const catalogClient = new CatalogItemsApiClient({ auth, region: 'eu' });
  const testAsin = 'B08BPCC8WD';
  const marketplaceId = 'A1F83G8C2ARO7P';

  console.log('📦 Testing Catalog API...');
  console.log(`   ASIN: ${testAsin}`);
  console.log(`   Marketplace: ${marketplaceId}\n`);

  try {
    const response = await catalogClient.getCatalogItem({
      asin: testAsin,
      marketplaceIds: [marketplaceId],
      includedData: ['summaries']
    });

    console.log('✅ SUCCESS! Catalog API works!\n');
    console.log('📊 Response:', JSON.stringify(response.data, null, 2));

  } catch (error: any) {
    console.log('❌ Still getting 403\n');
    console.log('📋 Error Details:');
    console.log(`   Status: ${error.response?.status}`);
    console.log(`   Error Type: ${error.response?.headers?.['x-amzn-errortype']}`);
    console.log(`   Request ID: ${error.response?.headers?.['x-amzn-requestid']}\n`);

    console.log('='.repeat(70));
    console.log('💡 RECOMMENDATION: Add Missing Roles');
    console.log('='.repeat(70));
    console.log('\nTry adding these additional roles in the App Edit page:');
    console.log('  ⬜ Finance and Accounting');
    console.log('  ⬜ Buyer Communication');
    console.log('  ⬜ Amazon Fulfillment\n');

    console.log('📝 Steps:');
    console.log('  1. In Seller Central, go to Apps & Services → Develop Apps');
    console.log('  2. Click "Edit App" on Operations Dashboard');
    console.log('  3. Check ALL available roles (including the 3 unchecked ones)');
    console.log('  4. Save the app');
    console.log('  5. Go back to Developer Central main page');
    console.log('  6. Click "Authorize" again to regenerate the refresh token');
    console.log('  7. Test again with the new token\n');

    console.log('⚠️  Note: Even though Amazon\'s docs say "Product Listing" should');
    console.log('   be enough for Catalog API, there might be hidden dependencies');
    console.log('   on other roles. Checking ALL roles is worth trying.\n');

    console.log('='.repeat(70));
  }
}

testWithCurrentRoles();
