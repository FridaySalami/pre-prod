require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkDB() {
  const supabase = createClient(
    'https://gvowfbrpmotcfxfzzhxf.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase
    .from('amazon_catalog_cache')
    .select('asin, title, attributes, bullet_points')
    .eq('asin', 'B07N88YRJT')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data) {
    console.log('❌ Product B07N88YRJT not found in cache');
    return;
  }

  console.log('\n=== Cached Product ===');
  console.log('ASIN:', data.asin);
  console.log('Title length:', data.title?.length || 0);
  console.log('\nAttributes keys:', Object.keys(data.attributes || {}));
  console.log('\nLooking for description in attributes...');
  const attrs = data.attributes || {};
  if (attrs.description) {
    console.log('✓ Found description:', attrs.description?.substring(0, 100));
  }
  if (attrs.product_description) {
    console.log('✓ Found product_description:', attrs.product_description?.substring(0, 100));
  }
  
  console.log('\n=== Full Attributes ===');
  console.log(JSON.stringify(data.attributes, null, 2));
}

checkDB().catch(console.error);
