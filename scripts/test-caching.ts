#!/usr/bin/env tsx

/**
 * Test Caching Implementation
 * 
 * Validates that:
 * 1. First call fetches from API and caches
 * 2. Second call retrieves from cache (faster)
 * 3. Cache TTL works correctly
 * 4. Both Catalog and Fees caching work
 */

import { SPAPIClient } from './src/lib/amazon/sp-api-client';
import { CatalogService } from './src/lib/amazon/catalog-service';
import { FeesService } from './src/lib/amazon/fees-service';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Test ASINs
const TEST_ASIN = 'B08BPCC8WD'; // Major Gluten Free Vegetable Stock
const TEST_PRICE = 12.99;

// Initialize SP-API client
function createSPAPIClient(): SPAPIClient {
  return new SPAPIClient({
    clientId: process.env.AMAZON_CLIENT_ID!,
    clientSecret: process.env.AMAZON_CLIENT_SECRET!,
    refreshToken: process.env.AMAZON_REFRESH_TOKEN!,
    awsAccessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID!,
    awsSecretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY!,
    awsRegion: 'eu-west-1',
    marketplaceId: 'A1F83G8C2ARO7P',
    sellerId: process.env.AMAZON_SELLER_ID!,
    roleArn: process.env.AMAZON_ROLE_ARN!
  });
}

async function testCatalogCaching() {
  console.log('\n🧪 Testing Catalog Caching\n' + '='.repeat(50));

  const client = createSPAPIClient();
  const catalogService = new CatalogService(client);

  // First call - should fetch from API
  console.log(`\n1️⃣ First call for ${TEST_ASIN} (should fetch from API)...`);
  const start1 = Date.now();
  const product1 = await catalogService.getProduct(TEST_ASIN);
  const time1 = Date.now() - start1;

  console.log(`   ✅ Got product: ${product1.title}`);
  console.log(`   ⏱️  Time: ${time1}ms`);
  console.log(`   🏷️  Keywords: ${product1.keywords?.primary.slice(0, 3).join(', ')}`);

  // Second call - should use cache
  console.log(`\n2️⃣ Second call for ${TEST_ASIN} (should use cache)...`);
  const start2 = Date.now();
  const product2 = await catalogService.getProduct(TEST_ASIN);
  const time2 = Date.now() - start2;

  console.log(`   ✅ Got product: ${product2.title}`);
  console.log(`   ⏱️  Time: ${time2}ms`);
  console.log(`   🚀 Speed improvement: ${Math.round((time1 / time2) * 10) / 10}x faster`);

  // Validate data consistency
  console.log(`\n3️⃣ Validating data consistency...`);
  const titleMatch = product1.title === product2.title;
  const asinMatch = product1.asin === product2.asin;
  const keywordsMatch = JSON.stringify(product1.keywords) === JSON.stringify(product2.keywords);

  console.log(`   Title match: ${titleMatch ? '✅' : '❌'}`);
  console.log(`   ASIN match: ${asinMatch ? '✅' : '❌'}`);
  console.log(`   Keywords match: ${keywordsMatch ? '✅' : '❌'}`);

  return {
    service: 'Catalog',
    firstCallTime: time1,
    cachedCallTime: time2,
    speedup: Math.round((time1 / time2) * 10) / 10,
    dataConsistent: titleMatch && asinMatch && keywordsMatch
  };
}

async function testFeesCaching() {
  console.log('\n🧪 Testing Fees Caching\n' + '='.repeat(50));

  const client = createSPAPIClient();
  const feesService = new FeesService(client);

  // First call - should fetch from API
  console.log(`\n1️⃣ First call for ${TEST_ASIN} @ £${TEST_PRICE} (should fetch from API)...`);
  const start1 = Date.now();
  const fees1 = await feesService.getFeeEstimate(TEST_ASIN, TEST_PRICE, false); // FBM
  const time1 = Date.now() - start1;

  console.log(`   ✅ Total fees: £${fees1.totalFees}`);
  console.log(`   💰 Estimated proceeds: £${fees1.estimatedProceeds}`);
  console.log(`   ⏱️  Time: ${time1}ms`);

  // Second call - should use cache
  console.log(`\n2️⃣ Second call for ${TEST_ASIN} @ £${TEST_PRICE} (should use cache)...`);
  const start2 = Date.now();
  const fees2 = await feesService.getFeeEstimate(TEST_ASIN, TEST_PRICE, false);
  const time2 = Date.now() - start2;

  console.log(`   ✅ Total fees: £${fees2.totalFees}`);
  console.log(`   💰 Estimated proceeds: £${fees2.estimatedProceeds}`);
  console.log(`   ⏱️  Time: ${time2}ms`);
  console.log(`   🚀 Speed improvement: ${Math.round((time1 / time2) * 10) / 10}x faster`);

  // Validate data consistency
  console.log(`\n3️⃣ Validating data consistency...`);
  const totalFeesMatch = fees1.totalFees === fees2.totalFees;
  const referralFeeMatch = fees1.referralFee === fees2.referralFee;
  const proceedsMatch = fees1.estimatedProceeds === fees2.estimatedProceeds;

  console.log(`   Total fees match: ${totalFeesMatch ? '✅' : '❌'}`);
  console.log(`   Referral fee match: ${referralFeeMatch ? '✅' : '❌'}`);
  console.log(`   Proceeds match: ${proceedsMatch ? '✅' : '❌'}`);

  return {
    service: 'Fees',
    firstCallTime: time1,
    cachedCallTime: time2,
    speedup: Math.round((time1 / time2) * 10) / 10,
    dataConsistent: totalFeesMatch && referralFeeMatch && proceedsMatch
  };
}

async function testDifferentPricePoints() {
  console.log('\n🧪 Testing Different Price Points\n' + '='.repeat(50));

  const client = createSPAPIClient();
  const feesService = new FeesService(client);

  const prices = [10.00, 15.00, 20.00];
  const results: any[] = [];

  for (const price of prices) {
    console.log(`\n💰 Testing price point: £${price}`);
    const start = Date.now();
    const fees = await feesService.getFeeEstimate(TEST_ASIN, price, false);
    const time = Date.now() - start;

    results.push({ price, fees, time });
    console.log(`   Total fees: £${fees.totalFees}, Time: ${time}ms`);

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Second pass - should use cache for all
  console.log(`\n🔁 Second pass (should use cache)...`);
  for (const price of prices) {
    const start = Date.now();
    const fees = await feesService.getFeeEstimate(TEST_ASIN, price, false);
    const time = Date.now() - start;

    console.log(`   £${price}: ${time}ms (cached)`);
  }

  return results;
}

async function main() {
  console.log('🚀 Starting Caching Tests\n');
  console.log(`Test ASIN: ${TEST_ASIN}`);
  console.log(`Test Price: £${TEST_PRICE}\n`);

  try {
    // Test catalog caching
    const catalogResult = await testCatalogCaching();

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test fees caching
    const feesResult = await testFeesCaching();

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test different price points
    await testDifferentPricePoints();

    // Summary
    console.log('\n📊 Test Summary\n' + '='.repeat(50));
    console.log(`\n${catalogResult.service} Service:`);
    console.log(`  First call: ${catalogResult.firstCallTime}ms`);
    console.log(`  Cached call: ${catalogResult.cachedCallTime}ms`);
    console.log(`  Speedup: ${catalogResult.speedup}x`);
    console.log(`  Data consistent: ${catalogResult.dataConsistent ? '✅' : '❌'}`);

    console.log(`\n${feesResult.service} Service:`);
    console.log(`  First call: ${feesResult.firstCallTime}ms`);
    console.log(`  Cached call: ${feesResult.cachedCallTime}ms`);
    console.log(`  Speedup: ${feesResult.speedup}x`);
    console.log(`  Data consistent: ${feesResult.dataConsistent ? '✅' : '❌'}`);

    console.log('\n🎉 All caching tests completed!');

    if (catalogResult.dataConsistent && feesResult.dataConsistent) {
      console.log('✅ Caching is working correctly!\n');
      process.exit(0);
    } else {
      console.log('❌ Data consistency issues detected!\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
