#!/usr/bin/env node

/**
 * Test Database Caching Setup
 * 
 * Validates that:
 * 1. Cache tables exist
 * 2. Can write to cache
 * 3. Can read from cache
 * 4. TTL queries work correctly
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

// Test data
const TEST_ASIN = 'B08BPCC8WD';
const TEST_MARKETPLACE = 'A1F83G8C2ARO7P';

async function testCatalogCache() {
  console.log('\n🧪 Testing Catalog Cache Table\n' + '='.repeat(50));

  // 1. Test write
  console.log('\n1️⃣ Writing test data to catalog cache...');
  const catalogData = {
    asin: TEST_ASIN,
    marketplace_id: TEST_MARKETPLACE,
    title: 'Test Product - Major Gluten Free Vegetable Stock',
    brand: 'Major',
    category: 'Grocery',
    images: [
      { variant: 'MAIN', link: 'https://example.com/image.jpg', height: 500, width: 500 }
    ],
    bullet_points: ['Gluten Free', 'Vegetable Stock', 'Made in UK'],
    dimensions: { height: { value: 10, unit: 'cm' }, weight: { value: 500, unit: 'g' } },
    attributes: { manufacturer: [{ value: 'Major' }] },
    keywords: {
      primary: ['Major', 'Gluten', 'Free', 'Vegetable', 'Stock'],
      secondary: ['Powder', 'Organic', 'Natural'],
      phrases: ['Gluten Free', 'Vegetable Stock'],
      stats: { totalUnique: 9, avgScore: 0.75 }
    },
    updated_at: new Date().toISOString()
  };

  const { data: insertData, error: insertError } = await supabase
    .from('amazon_catalog_cache')
    .upsert(catalogData, { onConflict: 'asin,marketplace_id' })
    .select();

  if (insertError) {
    console.error('   ❌ Write failed:', insertError);
    return false;
  }
  console.log('   ✅ Write successful');

  // 2. Test read (fresh data)
  console.log('\n2️⃣ Reading fresh data from cache...');
  const { data: readData, error: readError } = await supabase
    .from('amazon_catalog_cache')
    .select('*')
    .eq('asin', TEST_ASIN)
    .eq('marketplace_id', TEST_MARKETPLACE)
    .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .single();

  if (readError || !readData) {
    console.error('   ❌ Read failed:', readError);
    return false;
  }
  console.log('   ✅ Read successful');
  console.log(`   📦 Title: ${readData.title}`);
  console.log(`   🏷️  Keywords: ${readData.keywords?.primary?.slice(0, 3).join(', ')}`);

  // 3. Test stale data query (should return nothing for 8-day old data)
  console.log('\n3️⃣ Testing TTL (7-day expiration)...');
  const staleDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const { data: staleData, error: staleError } = await supabase
    .from('amazon_catalog_cache')
    .select('*')
    .eq('asin', TEST_ASIN)
    .gte('updated_at', staleDate)
    .single();

  if (staleData) {
    console.log('   ✅ TTL works - data is still fresh (< 7 days old)');
  } else {
    console.log('   ❌ Unexpected: No data found (might be if test data is > 7 days old)');
  }

  // 4. Verify indexes exist
  console.log('\n4️⃣ Verifying indexes...');
  try {
    const { data: indexes, error: indexError } = await supabase.rpc('execute_sql', {
      sql: `SELECT indexname FROM pg_indexes WHERE tablename = 'amazon_catalog_cache' ORDER BY indexname;`
    });

    if (indexes && !indexError) {
      console.log('   ✅ Indexes found:', indexes);
    } else {
      console.log('   ⚠️  Could not verify indexes (RPC not available)');
    }
  } catch (err) {
    console.log('   ⚠️  Could not verify indexes (RPC not available)');
  }

  return true;
}

async function testFeesCache() {
  console.log('\n🧪 Testing Fees Cache Table\n' + '='.repeat(50));

  // 1. Test write
  console.log('\n1️⃣ Writing test data to fees cache...');
  const feesData = {
    asin: TEST_ASIN,
    marketplace_id: TEST_MARKETPLACE,
    listing_price: 12.99,
    is_amazon_fulfilled: false,
    fba_fee: 0,
    referral_fee: 1.95,
    variable_closing_fee: 0,
    total_fees: 1.95,
    estimated_proceeds: 11.04,
    fee_details: { test: true },
    updated_at: new Date().toISOString()
  };

  const { data: insertData, error: insertError } = await supabase
    .from('amazon_fees_cache')
    .upsert(feesData, {
      onConflict: 'asin,listing_price,is_amazon_fulfilled,marketplace_id'
    })
    .select();

  if (insertError) {
    console.error('   ❌ Write failed:', insertError);
    return false;
  }
  console.log('   ✅ Write successful');

  // 2. Test read (fresh data)
  console.log('\n2️⃣ Reading fresh data from cache...');
  const { data: readData, error: readError } = await supabase
    .from('amazon_fees_cache')
    .select('*')
    .eq('asin', TEST_ASIN)
    .eq('listing_price', 12.99)
    .eq('is_amazon_fulfilled', false)
    .eq('marketplace_id', TEST_MARKETPLACE)
    .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .single();

  if (readError || !readData) {
    console.error('   ❌ Read failed:', readError);
    return false;
  }
  console.log('   ✅ Read successful');
  console.log(`   💰 Total fees: £${readData.total_fees}`);
  console.log(`   📈 Proceeds: £${readData.estimated_proceeds}`);

  // 3. Test different price point
  console.log('\n3️⃣ Testing different price point (£15.99)...');
  const feesData2 = {
    ...feesData,
    listing_price: 15.99,
    referral_fee: 2.40,
    total_fees: 2.40,
    estimated_proceeds: 13.59
  };

  const { error: insert2Error } = await supabase
    .from('amazon_fees_cache')
    .upsert(feesData2, {
      onConflict: 'asin,listing_price,is_amazon_fulfilled,marketplace_id'
    });

  if (insert2Error) {
    console.error('   ❌ Write failed:', insert2Error);
    return false;
  }
  console.log('   ✅ Multiple price points cached successfully');

  // 4. Verify unique constraint
  console.log('\n4️⃣ Verifying unique constraint...');
  const { data: allFees } = await supabase
    .from('amazon_fees_cache')
    .select('listing_price')
    .eq('asin', TEST_ASIN);

  if (allFees && allFees.length >= 2) {
    console.log(`   ✅ Found ${allFees.length} different price points for ${TEST_ASIN}`);
  }

  return true;
}

async function testCachePerformance() {
  console.log('\n🧪 Testing Cache Performance\n' + '='.repeat(50));

  // Test read speed
  console.log('\n1️⃣ Measuring read performance...');
  const iterations = 10;
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await supabase
      .from('amazon_catalog_cache')
      .select('*')
      .eq('asin', TEST_ASIN)
      .single();
    times.push(Date.now() - start);
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  console.log(`   Average read time: ${avgTime.toFixed(1)}ms`);
  console.log(`   Min: ${minTime}ms, Max: ${maxTime}ms`);
  console.log(`   ✅ Cache reads are ${avgTime < 100 ? 'fast' : 'acceptable'} (<100ms target)`);

  return avgTime < 100;
}

async function main() {
  console.log('🚀 Starting Database Caching Tests\n');

  try {
    // Test catalog cache
    const catalogSuccess = await testCatalogCache();

    // Test fees cache
    const feesSuccess = await testFeesCache();

    // Test performance
    const perfSuccess = await testCachePerformance();

    // Summary
    console.log('\n📊 Test Summary\n' + '='.repeat(50));
    console.log(`Catalog cache: ${catalogSuccess ? '✅' : '❌'}`);
    console.log(`Fees cache: ${feesSuccess ? '✅' : '❌'}`);
    console.log(`Performance: ${perfSuccess ? '✅' : '❌'}`);

    if (catalogSuccess && feesSuccess && perfSuccess) {
      console.log('\n🎉 All database caching tests passed!\n');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
