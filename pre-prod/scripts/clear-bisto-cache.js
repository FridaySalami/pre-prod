#!/usr/bin/env node

/**
 * Clear cache for Bisto product and trigger re-fetch
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

const BISTO_ASIN = 'B00DYQ6IVW';

async function clearAndRefetch() {
  console.log('\n🧹 Clearing cache for Bisto product...');
  console.log('='.repeat(60));

  try {
    // Clear the cache
    const { error } = await supabase
      .from('amazon_catalog_cache')
      .delete()
      .eq('asin', BISTO_ASIN);

    if (error) {
      console.error('❌ Error clearing cache:', error.message);
      return;
    }

    console.log('✅ Cache cleared successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. The cache is now empty for this product');
    console.log('   2. Visit the product page: http://localhost:3000/buy-box-alerts/product/B00DYQ6IVW');
    console.log('   3. The page will fetch fresh data from Amazon Catalog API');
    console.log('   4. The NEW code will extract the review count');
    console.log('   5. The review count will be cached in the database');
    console.log('   6. The "Customer Reviews" card will show the count!');
    console.log('\n💡 Or run: node test-bisto-reviews.js to check the result');

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
  }
}

clearAndRefetch();
