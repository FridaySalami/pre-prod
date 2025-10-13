/**
 * Comprehensive SP-API Permission Test
 * Using Official SDK (OAuth-only)
 * 
 * This will test multiple APIs to identify what permissions you actually have
 */

import 'dotenv/config';
import { SellingPartnerApiAuth } from '@sp-api-sdk/auth';
import { CatalogItemsApiClient } from '@sp-api-sdk/catalog-items-api-2022-04-01';

async function testAllPermissions() {
  console.log('🔍 Comprehensive SP-API Permission Analysis\n');
  console.log('Using Official SDK (OAuth-only approach)\n');

  const auth = new SellingPartnerApiAuth({
    clientId: process.env.AMAZON_CLIENT_ID!,
    clientSecret: process.env.AMAZON_CLIENT_SECRET!,
    refreshToken: process.env.AMAZON_REFRESH_TOKEN!,
  });

  const marketplaceId = process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P';
  const testAsin = 'B08BPCC8WD';

  console.log('📋 Test Configuration:');
  console.log(`   Marketplace: ${marketplaceId} (UK)`);
  console.log(`   Test ASIN: ${testAsin}`);
  console.log(`   Region: eu\n`);

  const results: Record<string, { status: string; details?: string }> = {};

  // Test 1: Catalog API v2022-04-01
  console.log('1️⃣  Testing Catalog Items API (v2022-04-01)...');
  try {
    const catalogClient = new CatalogItemsApiClient({ auth, region: 'eu' });
    await catalogClient.getCatalogItem({
      asin: testAsin,
      marketplaceIds: [marketplaceId],
      includedData: ['summaries']
    });
    results['Catalog API (v2022-04-01)'] = { status: '✅ SUCCESS' };
    console.log('   ✅ SUCCESS - You have Catalog API access!\n');
  } catch (error: any) {
    const status = error.response?.status || 'UNKNOWN';
    const errorType = error.response?.headers?.['x-amzn-errortype'] || 'UNKNOWN';
    results['Catalog API (v2022-04-01)'] = {
      status: '❌ DENIED',
      details: `${status} - ${errorType}`
    };
    console.log(`   ❌ DENIED - ${status} ${errorType}\n`);
  }

  // Test 2: Try searchCatalogItems (different endpoint)
  console.log('2️⃣  Testing Catalog Search API...');
  try {
    const catalogClient = new CatalogItemsApiClient({ auth, region: 'eu' });
    await catalogClient.searchCatalogItems({
      marketplaceIds: [marketplaceId],
      keywords: ['test'],
      pageSize: 1
    });
    results['Catalog Search API'] = { status: '✅ SUCCESS' };
    console.log('   ✅ SUCCESS - You have Catalog Search access!\n');
  } catch (error: any) {
    const status = error.response?.status || 'UNKNOWN';
    const errorType = error.response?.headers?.['x-amzn-errortype'] || 'UNKNOWN';
    results['Catalog Search API'] = {
      status: '❌ DENIED',
      details: `${status} - ${errorType}`
    };
    console.log(`   ❌ DENIED - ${status} ${errorType}\n`);
  }

  // Test 3: Pricing API (we know this works from previous tests)
  console.log('3️⃣  Testing Pricing API (for comparison)...');
  try {
    // Using raw fetch since we don't have the SDK installed
    const accessToken = await auth.getAccessToken();
    const response = await fetch(
      `https://sellingpartnerapi-eu.amazon.com/products/pricing/v0/competitivePrice?MarketplaceId=${marketplaceId}&Asins=${testAsin}&ItemType=Asin`,
      {
        headers: {
          'x-amz-access-token': accessToken,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.ok) {
      results['Pricing API'] = { status: '✅ SUCCESS' };
      console.log('   ✅ SUCCESS - Pricing API works\n');
    } else {
      results['Pricing API'] = {
        status: '❌ DENIED',
        details: `${response.status}`
      };
      console.log(`   ❌ DENIED - ${response.status}\n`);
    }
  } catch (error: any) {
    results['Pricing API'] = {
      status: '❌ ERROR',
      details: error.message
    };
    console.log(`   ❌ ERROR - ${error.message}\n`);
  }

  // Summary
  console.log('='.repeat(70));
  console.log('📊 PERMISSION SUMMARY');
  console.log('='.repeat(70));

  Object.entries(results).forEach(([api, result]) => {
    console.log(`${result.status.padEnd(15)} ${api}`);
    if (result.details) {
      console.log(`${''.padEnd(15)} └─ ${result.details}`);
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log('🔍 ANALYSIS & RECOMMENDATIONS');
  console.log('='.repeat(70));

  const deniedApis = Object.entries(results).filter(([_, r]) => r.status.includes('DENIED'));
  const successApis = Object.entries(results).filter(([_, r]) => r.status.includes('SUCCESS'));

  if (deniedApis.length === 0) {
    console.log('✅ All APIs accessible - no issues!');
  } else if (successApis.length > 0) {
    console.log('\n📌 Mixed Results:');
    console.log(`   ✅ ${successApis.length} API(s) working`);
    console.log(`   ❌ ${deniedApis.length} API(s) denied`);
    console.log('\n💡 This confirms:');
    console.log('   • Your OAuth token is valid (some APIs work)');
    console.log('   • Your refresh token is correctly configured');
    console.log('   • Catalog API specifically lacks authorization');
    console.log('\n⚠️  The "Product Listing" role does NOT grant Catalog API access');
    console.log('   despite Amazon\'s documentation stating it should.\n');

    console.log('📧 Recommended Actions:');
    console.log('   1. Contact Amazon SP-API Support');
    console.log('      • Reference these test results');
    console.log('      • Ask what specific permission Catalog API needs');
    console.log('      • Provide seller ID and marketplace info');
    console.log('\n   2. Check Seller Account Requirements');
    console.log('      • Verify Professional (not Individual) account');
    console.log('      • Check if Brand Registry enrollment needed');
    console.log('      • Confirm minimum sales history met');
    console.log('\n   3. Use Alternative APIs (temporary workaround)');
    console.log('      • Listings API for product info (limited)');
    console.log('      • Reports API for bulk product data');
    console.log('      • Product Pricing API for competitive data');
  } else {
    console.log('\n❌ All APIs denied - possible issues:');
    console.log('   • Refresh token needs regeneration');
    console.log('   • Seller Central authorization incomplete');
    console.log('   • Account verification pending');
  }

  console.log('\n' + '='.repeat(70));
}

testAllPermissions();
