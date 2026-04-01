const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://wzkynqgtxmvnkpuwnaqt.supabase.co',
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function compareSKUs() {
  console.log('Comparing SKUs between buybox_data and sku_asin_mapping...');

  // Get recent SKUs from buybox_data
  const { data: buyboxSKUs } = await supabase
    .from('buybox_data')
    .select('sku')
    .order('captured_at', { ascending: false })
    .limit(5);

  console.log('Recent SKUs from buybox_data:');
  buyboxSKUs?.forEach(r => console.log(`"${r.sku}"`));

  // Get sample SKUs from sku_asin_mapping 
  const { data: mappingSKUs } = await supabase
    .from('sku_asin_mapping')
    .select('seller_sku, merchant_shipping_group')
    .not('merchant_shipping_group', 'is', null)
    .limit(5);

  console.log('\nSample SKUs from sku_asin_mapping:');
  mappingSKUs?.forEach(r => console.log(`"${r.seller_sku}" -> ${r.merchant_shipping_group}`));

  // Test specific lookup
  if (buyboxSKUs && buyboxSKUs.length > 0) {
    const testSKU = buyboxSKUs[0].sku;
    console.log(`\nTesting lookup for SKU: "${testSKU}"`);

    const { data: lookup, error } = await supabase
      .from('sku_asin_mapping')
      .select('seller_sku, merchant_shipping_group')
      .eq('seller_sku', testSKU)
      .single();

    if (error) {
      console.log(`Error: ${error.message}`);
    } else {
      console.log(`Found: ${lookup?.merchant_shipping_group || 'NULL'}`);
    }
  }
}

compareSKUs().catch(console.error);

