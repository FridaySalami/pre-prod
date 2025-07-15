import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables manually
dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PUBLIC_SUPABASE_ANON_KEY
);

async function checkRecentData() {
  console.log('🎉 CHECKING FINAL SUCCESS - Latest buybox data with product titles...');

  const { data, error } = await supabase
    .from('buybox_data')
    .select('asin, sku, product_title, your_cost, recommended_action, margin_percent_at_buybox_price, run_id')
    .eq('run_id', '1d3e09b1-3645-4bec-98e7-b2c5d3f9a9bf')
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`✅ SUCCESS! Found ${data.length} records from the latest test:`);
  data.forEach((row, index) => {
    console.log(`\n${index + 1}. ASIN: ${row.asin}, SKU: ${row.sku}`);
    console.log(`   ✅ Product Title: ${row.product_title || 'Missing'}`);
    console.log(`   ✅ Your Cost: £${row.your_cost || 'Missing'}`);
    console.log(`   ✅ Recommendation: ${row.recommended_action || 'Missing'}`);
    console.log(`   ✅ Margin %: ${row.margin_percent_at_buybox_price || 'Missing'}%`);
  });
}

checkRecentData().catch(console.error);
