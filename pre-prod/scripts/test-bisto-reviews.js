#!/usr/bin/env node

/**
 * Test Review Count for Bisto Product
 * Simple script to check if review count can be extracted
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

const BISTO_ASIN = 'B00DYQ6IVW'; // From screenshot

async function testReviewCount() {
  console.log('\n🧪 Testing Review Count for Bisto Product');
  console.log('='.repeat(60));
  console.log(`ASIN: ${BISTO_ASIN}`);
  console.log(`Expected: ~329 reviews (from Amazon screenshot)\n`);

  try {
    // Check if product exists in cache
    console.log('1️⃣ Checking cache...');
    const { data: cached, error } = await supabase
      .from('amazon_catalog_cache')
      .select('*')
      .eq('asin', BISTO_ASIN)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('   ❌ Error:', error.message);
      return;
    }

    if (!cached) {
      console.log('   ⚠️ Product not in cache yet');
      console.log('   💡 Visit the product page to fetch it: http://localhost:3000/buy-box-alerts/product/B00DYQ6IVW');
      console.log('   💡 Or clear cache and fetch via app');
      return;
    }

    console.log('   ✅ Found in cache');
    console.log(`   Title: ${cached.title}`);
    console.log(`   Brand: ${cached.brand}`);
    console.log(`   Updated: ${new Date(cached.updated_at).toLocaleString()}`);

    // Check review count column
    console.log('\n2️⃣ Checking review count...');
    if (cached.customer_review_count !== null && cached.customer_review_count !== undefined) {
      console.log(`   ✅ Review count: ${cached.customer_review_count.toLocaleString()}`);
      console.log(`   📊 Amazon shows: ~329 reviews`);
      console.log(`   📊 We have: ${cached.customer_review_count} reviews`);

      const variance = Math.abs(cached.customer_review_count - 329);
      if (variance <= 20) {
        console.log(`   ✅ Match! (variance: ${variance})`);
      } else {
        console.log(`   ⚠️ Different count (variance: ${variance})`);
      }
    } else {
      console.log(`   ❌ No review count in database (value: ${cached.customer_review_count})`);
      console.log('\n   🔍 Possible reasons:');
      console.log('      • Data cached before review count column was added');
      console.log('      • Catalog API doesn\'t provide review count for this product');
      console.log('      • Need to clear cache and re-fetch');

      console.log('\n   💡 To fix:');
      console.log('      1. Clear this product from cache:');
      console.log(`         DELETE FROM amazon_catalog_cache WHERE asin = '${BISTO_ASIN}';`);
      console.log('      2. Visit product page to trigger fresh fetch');
      console.log('      3. Run this test again');
    }

    // Check attributes for review data
    console.log('\n3️⃣ Checking raw attributes...');
    if (cached.attributes) {
      const attrs = typeof cached.attributes === 'string'
        ? JSON.parse(cached.attributes)
        : cached.attributes;

      const reviewKeys = Object.keys(attrs).filter(k =>
        k.toLowerCase().includes('review') ||
        k.toLowerCase().includes('rating')
      );

      if (reviewKeys.length > 0) {
        console.log(`   ✅ Found ${reviewKeys.length} review-related attribute(s):`);
        reviewKeys.forEach(key => {
          console.log(`      ${key}:`, attrs[key]);
        });
      } else {
        console.log('   ⚠️ No review attributes found');
        console.log(`   ℹ️ Total attributes: ${Object.keys(attrs).length}`);
        console.log('   ℹ️ Sample attributes:', Object.keys(attrs).slice(0, 5).join(', '));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY:');
    console.log('='.repeat(60));
    if (cached.customer_review_count) {
      console.log('✅ Review count extraction is WORKING!');
      console.log(`✅ Count: ${cached.customer_review_count.toLocaleString()} reviews`);
      console.log('\n💡 Reload your product page to see the review count!');
    } else {
      console.log('⚠️ Review count not yet extracted');
      console.log('\n💡 Action required:');
      console.log('   1. Clear the cache for this product');
      console.log('   2. Visit the product page to trigger a fresh API call');
      console.log('   3. The new code will extract the review count');
    }

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    console.error(err);
  }
}

testReviewCount();
