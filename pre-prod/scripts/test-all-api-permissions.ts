/**
 * Comprehensive SP-API Permission Test
 * Test all major APIs to see which permissions the refresh token has
 */

import { config } from 'dotenv';
config();

import { SPAPIClient, RateLimiters } from './src/lib/amazon/index.js';

async function testAllAPIs() {
  console.log('🔬 Comprehensive SP-API Permission Test\n');
  console.log('Testing which APIs your refresh token can access...\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  const client = SPAPIClient.fromEnv();
  const testAsin = 'B08BPCC8WD';
  const testSku = 'TEST-SKU-001';
  const sellerId = process.env.AMAZON_SELLER_ID || 'A2D8NG39VURSL3';

  const results: any[] = [];

  // Test 1: Catalog Items API v2022-04-01
  console.log('1️⃣  Testing Catalog Items API v2022-04-01...');
  try {
    const response = await client.get(
      `/catalog/2022-04-01/items/${testAsin}`,
      {
        queryParams: {
          marketplaceIds: 'A1F83G8C2ARO7P',
          includedData: 'summaries'
        },
        rateLimiter: RateLimiters.catalog
      }
    );

    if (response.success) {
      console.log('   ✅ SUCCESS - Catalog API v2022-04-01 works!');
      results.push({ api: 'Catalog v2022-04-01', status: 'SUCCESS', role: 'Product Listing' });
    } else if (response.statusCode === 403) {
      console.log('   ❌ 403 DENIED - Missing "Product Listing" role');
      results.push({ api: 'Catalog v2022-04-01', status: 'DENIED (403)', role: 'Product Listing' });
    } else {
      console.log(`   ⚠️  ERROR ${response.statusCode} - ${response.errors?.[0]?.message}`);
      results.push({ api: 'Catalog v2022-04-01', status: `ERROR ${response.statusCode}`, role: 'Product Listing' });
    }
  } catch (error: any) {
    console.log(`   ❌ FAILED - ${error.message}`);
    results.push({ api: 'Catalog v2022-04-01', status: 'FAILED', role: 'Product Listing' });
  }

  await new Promise(r => setTimeout(r, 1000));

  // Test 2: Catalog Items API v0 (old version)
  console.log('\n2️⃣  Testing Catalog Items API v0 (legacy)...');
  try {
    const response = await client.get(
      `/catalog/v0/items/${testAsin}`,
      {
        queryParams: {
          MarketplaceId: 'A1F83G8C2ARO7P'
        },
        rateLimiter: RateLimiters.catalog
      }
    );

    if (response.success) {
      console.log('   ✅ SUCCESS - Catalog API v0 works!');
      results.push({ api: 'Catalog v0', status: 'SUCCESS', role: 'Product Listing' });
    } else if (response.statusCode === 403) {
      console.log('   ❌ 403 DENIED - Missing "Product Listing" role');
      results.push({ api: 'Catalog v0', status: 'DENIED (403)', role: 'Product Listing' });
    } else {
      console.log(`   ⚠️  ERROR ${response.statusCode}`);
      results.push({ api: 'Catalog v0', status: `ERROR ${response.statusCode}`, role: 'Product Listing' });
    }
  } catch (error: any) {
    console.log(`   ❌ FAILED - ${error.message}`);
    results.push({ api: 'Catalog v0', status: 'FAILED', role: 'Product Listing' });
  }

  await new Promise(r => setTimeout(r, 1000));

  // Test 3: Product Pricing API
  console.log('\n3️⃣  Testing Product Pricing API...');
  try {
    const response = await client.get(
      `/products/pricing/v0/items/${testAsin}/offers`,
      {
        queryParams: {
          MarketplaceId: 'A1F83G8C2ARO7P',
          ItemCondition: 'New'
        },
        rateLimiter: RateLimiters.default
      }
    );

    if (response.success) {
      console.log('   ✅ SUCCESS - Pricing API works!');
      results.push({ api: 'Product Pricing', status: 'SUCCESS', role: 'Pricing' });
    } else if (response.statusCode === 403) {
      console.log('   ❌ 403 DENIED - Missing "Pricing" role');
      results.push({ api: 'Product Pricing', status: 'DENIED (403)', role: 'Pricing' });
    } else if (response.statusCode === 404) {
      console.log('   ⚠️  404 - ASIN not found (but API access works!)');
      results.push({ api: 'Product Pricing', status: 'SUCCESS (404 is OK)', role: 'Pricing' });
    } else {
      console.log(`   ⚠️  ERROR ${response.statusCode}`);
      results.push({ api: 'Product Pricing', status: `ERROR ${response.statusCode}`, role: 'Pricing' });
    }
  } catch (error: any) {
    console.log(`   ❌ FAILED - ${error.message}`);
    results.push({ api: 'Product Pricing', status: 'FAILED', role: 'Pricing' });
  }

  await new Promise(r => setTimeout(r, 1000));

  // Test 4: Listings Items API
  console.log('\n4️⃣  Testing Listings Items API...');
  try {
    const response = await client.get(
      `/listings/2021-08-01/items/${sellerId}/${testSku}`,
      {
        queryParams: {
          marketplaceIds: 'A1F83G8C2ARO7P',
          includedData: 'summaries'
        },
        rateLimiter: RateLimiters.listings
      }
    );

    if (response.success) {
      console.log('   ✅ SUCCESS - Listings API works!');
      results.push({ api: 'Listings Items', status: 'SUCCESS', role: 'Product Listing' });
    } else if (response.statusCode === 403) {
      console.log('   ❌ 403 DENIED - Missing "Product Listing" role');
      results.push({ api: 'Listings Items', status: 'DENIED (403)', role: 'Product Listing' });
    } else if (response.statusCode === 404) {
      console.log('   ⚠️  404 - SKU not found (but API access works!)');
      results.push({ api: 'Listings Items', status: 'SUCCESS (404 is OK)', role: 'Product Listing' });
    } else {
      console.log(`   ⚠️  ERROR ${response.statusCode}`);
      results.push({ api: 'Listings Items', status: `ERROR ${response.statusCode}`, role: 'Product Listing' });
    }
  } catch (error: any) {
    console.log(`   ❌ FAILED - ${error.message}`);
    results.push({ api: 'Listings Items', status: 'FAILED', role: 'Product Listing' });
  }

  await new Promise(r => setTimeout(r, 1000));

  // Test 5: Product Fees API
  console.log('\n5️⃣  Testing Product Fees API...');
  try {
    const response = await client.post(
      `/products/fees/v0/items/${testAsin}/feesEstimate`,
      {
        FeesEstimateRequest: {
          MarketplaceId: 'A1F83G8C2ARO7P',
          PriceToEstimateFees: {
            ListingPrice: {
              Amount: 25.99,
              CurrencyCode: 'GBP'
            }
          },
          Identifier: `test-${Date.now()}`,
          IsAmazonFulfilled: true
        }
      },
      {
        rateLimiter: RateLimiters.fees
      }
    );

    if (response.success) {
      console.log('   ✅ SUCCESS - Fees API works!');
      results.push({ api: 'Product Fees', status: 'SUCCESS', role: 'Multiple roles qualify' });
    } else if (response.statusCode === 403) {
      console.log('   ❌ 403 DENIED - Missing required role');
      results.push({ api: 'Product Fees', status: 'DENIED (403)', role: 'Multiple roles qualify' });
    } else {
      console.log(`   ⚠️  ERROR ${response.statusCode}`);
      results.push({ api: 'Product Fees', status: `ERROR ${response.statusCode}`, role: 'Multiple roles qualify' });
    }
  } catch (error: any) {
    console.log(`   ❌ FAILED - ${error.message}`);
    results.push({ api: 'Product Fees', status: 'FAILED', role: 'Multiple roles qualify' });
  }

  await new Promise(r => setTimeout(r, 1000));

  // Test 6: Notifications API
  console.log('\n6️⃣  Testing Notifications API...');
  try {
    const response = await client.get(
      '/notifications/v1/subscriptions/ANY_OFFER_CHANGED',
      {
        rateLimiter: RateLimiters.default
      }
    );

    if (response.success || response.statusCode === 404) {
      console.log('   ✅ SUCCESS - Notifications API works!');
      results.push({ api: 'Notifications', status: 'SUCCESS', role: 'Various' });
    } else if (response.statusCode === 403) {
      console.log('   ❌ 403 DENIED - Missing required role');
      results.push({ api: 'Notifications', status: 'DENIED (403)', role: 'Various' });
    } else {
      console.log(`   ⚠️  ERROR ${response.statusCode}`);
      results.push({ api: 'Notifications', status: `ERROR ${response.statusCode}`, role: 'Various' });
    }
  } catch (error: any) {
    console.log(`   ❌ FAILED - ${error.message}`);
    results.push({ api: 'Notifications', status: 'FAILED', role: 'Various' });
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('📊 PERMISSION TEST SUMMARY:\n');

  const working = results.filter(r => r.status.includes('SUCCESS'));
  const denied = results.filter(r => r.status.includes('DENIED'));
  const other = results.filter(r => !r.status.includes('SUCCESS') && !r.status.includes('DENIED'));

  console.log(`✅ Working APIs (${working.length}):`);
  working.forEach(r => console.log(`   • ${r.api} - ${r.role}`));

  console.log(`\n❌ Denied APIs (${denied.length}):`);
  denied.forEach(r => console.log(`   • ${r.api} - Missing: ${r.role}`));

  if (other.length > 0) {
    console.log(`\n⚠️  Other Errors (${other.length}):`);
    other.forEach(r => console.log(`   • ${r.api} - ${r.status}`));
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');

  // Analysis
  console.log('🔍 ANALYSIS:\n');

  if (denied.some(r => r.api.includes('Catalog'))) {
    console.log('❌ CATALOG API ACCESS DENIED\n');
    console.log('The refresh token does NOT have "Product Listing" role permissions.');
    console.log('\nPossible reasons:');
    console.log('1. "Product Listing" checkbox was not checked during authorization');
    console.log('2. The role is named differently in Seller Central');
    console.log('3. Authorization was done on wrong Seller Central (US vs UK)');
    console.log('\n🔄 SOLUTION: Re-authorize the app and ensure ALL roles are checked:\n');
    console.log('   Go to: https://sellercentral.amazon.co.uk/apps/authorize/consent');
    console.log('   URL: ?application_id=amzn1.application-oa2-client.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    console.log('   Make sure to check EVERY permission box!');
  } else if (working.some(r => r.api.includes('Catalog'))) {
    console.log('✅ CATALOG API WORKS!\n');
    console.log('Your refresh token has the correct permissions.');
    console.log('You can now use the Catalog Items API for Phase 2 implementation.');
  }

  console.log('\n');
}

testAllAPIs();
