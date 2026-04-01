/**
 * Clear catalog cache for specific ASIN(s) to force fresh API fetch
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

const asins = process.argv.slice(2);

if (asins.length === 0) {
  console.log('Usage: node clear-catalog-cache.js <ASIN1> [ASIN2] [ASIN3] ...');
  console.log('Example: node clear-catalog-cache.js B09T3GDNGT B008K4HNOY');
  process.exit(1);
}

async function clearCache() {
  console.log('🗑️  Clearing Catalog Cache');
  console.log('═'.repeat(70));

  for (const asin of asins) {
    console.log(`\n📦 ASIN: ${asin}`);

    try {
      // Delete from cache
      const { data, error } = await supabase
        .from('amazon_catalog_cache')
        .delete()
        .eq('asin', asin);

      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
      } else {
        console.log(`   ✅ Cache cleared - next page load will fetch fresh data`);
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✅ Done! Refresh the product page to see deduplicated images.');
  console.log('   The Catalog API will be called again and images will be filtered.');
}

clearCache();
