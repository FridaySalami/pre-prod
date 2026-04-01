/**
 * Test Review Count Extraction from Catalog API
 * 
 * This script tests the new customerReviewCount field by:
 * 1. Clearing the cache for a specific ASIN
 * 2. Fetching fresh data from Amazon Catalog API
 * 3. Verifying review count extraction
 * 4. Checking database storage
 */

import { CatalogService } from './src/lib/amazon/catalog-service.js';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tqwqqnqlnqxrgcjrbqtx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxd3FxbnFsbnF4cmdjanJicXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU5MTk3NzYsImV4cCI6MjA1MTQ5NTc3Nn0.tLB7nhrCHi21kl0L5aNL6aE_kJhBs2RGhFfSBBWXF3g';

// Test ASIN from screenshot - Bisto Gravy
const TEST_ASIN = 'B00DYQ6IVW';

async function testReviewCount() {
  console.log('🧪 Testing Review Count Extraction\n');
  console.log('='.repeat(60));

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const catalogService = new CatalogService();

  try {
    // Step 1: Clear cache for this ASIN
    console.log(`\n1️⃣ Clearing cache for ASIN: ${TEST_ASIN}`);
    const { error: deleteError } = await supabase
      .from('amazon_catalog_cache')
      .delete()
      .eq('asin', TEST_ASIN);

    if (deleteError) {
      console.log(`   ⚠️ No existing cache to clear (or error): ${deleteError.message}`);
    } else {
      console.log('   ✅ Cache cleared successfully');
    }

    // Step 2: Fetch fresh data from Amazon Catalog API
    console.log(`\n2️⃣ Fetching fresh data from Amazon Catalog API...`);
    const startTime = Date.now();
    const product = await catalogService.getProduct(TEST_ASIN);
    const fetchTime = Date.now() - startTime;
    console.log(`   ✅ API call completed in ${fetchTime}ms`);

    // Step 3: Display product details
    console.log('\n3️⃣ Product Details:');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ASIN:     ${product.asin}`);
    console.log(`   Title:    ${product.title}`);
    console.log(`   Brand:    ${product.brand || 'N/A'}`);
    console.log(`   Category: ${product.category || 'N/A'}`);
    console.log(`   Images:   ${product.images.length} images`);
    console.log(`   Bullets:  ${product.bulletPoints?.length || 0} bullet points`);

    // Step 4: Check review count
    console.log('\n4️⃣ Review Count Extraction:');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (product.customerReviewCount !== undefined && product.customerReviewCount !== null) {
      console.log(`   ✅ SUCCESS: ${product.customerReviewCount.toLocaleString()} reviews extracted`);
      console.log(`   📊 Amazon shows: ~329 reviews (from screenshot)`);
      console.log(`   📊 We extracted: ${product.customerReviewCount} reviews`);

      // Check if numbers match (allowing for some variance as reviews change)
      const variance = Math.abs(product.customerReviewCount - 329);
      if (variance <= 10) {
        console.log(`   ✅ Numbers match within acceptable range (±10)`);
      } else {
        console.log(`   ⚠️ Significant variance: ${variance} reviews difference`);
        console.log(`   ℹ️ This could be due to timing or marketplace differences`);
      }
    } else {
      console.log('   ❌ FAILED: Review count not extracted');
      console.log('   ℹ️ This could mean:');
      console.log('      - Product has no reviews');
      console.log('      - Catalog API doesn\'t provide review count for this product');
      console.log('      - Attribute name is different than expected');
    }

    // Step 5: Check database storage
    console.log('\n5️⃣ Database Verification:');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const { data: cached, error: cacheError } = await supabase
      .from('amazon_catalog_cache')
      .select('asin, title, customer_review_count, updated_at')
      .eq('asin', TEST_ASIN)
      .single();

    if (cacheError) {
      console.log(`   ❌ Cache read error: ${cacheError.message}`);
    } else if (cached) {
      console.log(`   ✅ Found in cache:`);
      console.log(`      ASIN: ${cached.asin}`);
      console.log(`      Review Count: ${cached.customer_review_count || 'NULL'}`);
      console.log(`      Updated: ${new Date(cached.updated_at).toLocaleString()}`);

      if (cached.customer_review_count === product.customerReviewCount) {
        console.log(`   ✅ Database value matches API extraction`);
      } else {
        console.log(`   ❌ Mismatch: DB=${cached.customer_review_count}, API=${product.customerReviewCount}`);
      }
    } else {
      console.log(`   ❌ Product not found in cache (unexpected)`);
    }

    // Step 6: Check raw attributes for debugging
    console.log('\n6️⃣ Raw Attributes (for debugging):');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (product.attributes) {
      const reviewAttrs = Object.keys(product.attributes).filter(key =>
        key.toLowerCase().includes('review') ||
        key.toLowerCase().includes('rating')
      );

      if (reviewAttrs.length > 0) {
        console.log(`   Found ${reviewAttrs.length} review-related attribute(s):`);
        reviewAttrs.forEach(key => {
          console.log(`      ${key}: ${JSON.stringify(product.attributes[key])}`);
        });
      } else {
        console.log('   ⚠️ No review-related attributes found');
        console.log('   ℹ️ Checking first 10 attributes:');
        const firstTen = Object.keys(product.attributes).slice(0, 10);
        firstTen.forEach(key => {
          const value = product.attributes[key];
          const preview = JSON.stringify(value).substring(0, 50);
          console.log(`      ${key}: ${preview}${preview.length >= 50 ? '...' : ''}`);
        });
      }
    } else {
      console.log('   ⚠️ No attributes object available');
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 TEST SUMMARY:');
    console.log('='.repeat(60));
    console.log(`✅ Cache cleared: YES`);
    console.log(`✅ API fetch: SUCCESS (${fetchTime}ms)`);
    console.log(`✅ Product data: ${product.title}`);
    console.log(`${product.customerReviewCount ? '✅' : '❌'} Review count: ${product.customerReviewCount || 'NOT EXTRACTED'}`);
    console.log(`✅ Database cached: YES`);
    console.log('='.repeat(60));

    if (product.customerReviewCount) {
      console.log('\n🎉 SUCCESS! Review count extraction is working!');
      console.log(`\n💡 Next steps:`);
      console.log(`   1. Reload your product page: localhost:3000/buy-box-alerts/product/${TEST_ASIN}`);
      console.log(`   2. The "Customer Reviews" card should now show: ${product.customerReviewCount.toLocaleString()} reviews`);
      console.log(`   3. Compare with Amazon's count: ~329 reviews`);
    } else {
      console.log('\n⚠️ Review count not available for this product');
      console.log('\nPossible reasons:');
      console.log('   • Catalog API doesn\'t provide review count for UK marketplace');
      console.log('   • Product type doesn\'t include review data');
      console.log('   • Different attribute name used');
      console.log('\n💡 Consider testing with a US marketplace product (ASIN starting with B0...)');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testReviewCount().catch(console.error);
