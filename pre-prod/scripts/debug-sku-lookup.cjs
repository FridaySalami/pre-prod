const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://wzkynqgtxmvnkpuwnaqt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6a3lucWd0eG12bmtwdXduYXF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzMyNTk5MiwiZXhwIjoyMDQ4OTAxOTkyfQ.zJIV8i3LcnhKafKRXgLNq1lUKxb4FhbgDnWLV3wGjMY'
);

async function debugSKULookup() {
  console.log('Testing SKU lookup from sku_asin_mapping...');

  // Get some recent buybox_data SKUs
  const { data: recentSKUs } = await supabase
    .from('buybox_data')
    .select('sku')
    .order('captured_at', { ascending: false })
    .limit(10);

  console.log('Recent SKUs from buybox_data:', recentSKUs?.map(r => r.sku));

  // Test lookup for each SKU
  for (const record of recentSKUs || []) {
    const sku = record.sku;

    // Exact query from cost calculator
    const { data: skuMapping, error } = await supabase
      .from('sku_asin_mapping')
      .select('merchant_shipping_group')
      .eq('seller_sku', sku)
      .single();

    console.log(`SKU: "${sku}" -> shipping_group: "${skuMapping?.merchant_shipping_group || 'NULL'}"${error ? ` (Error: ${error.message})` : ''}`);
  }

  // Also test with some SKUs we know exist in sku_asin_mapping
  console.log('\nTesting with known SKUs from sku_asin_mapping...');
  const { data: knownSKUs } = await supabase
    .from('sku_asin_mapping')
    .select('seller_sku, merchant_shipping_group')
    .not('merchant_shipping_group', 'is', null)
    .limit(5);

  for (const record of knownSKUs || []) {
    console.log(`Known SKU: "${record.seller_sku}" -> shipping_group: "${record.merchant_shipping_group}"`);
  }
}

debugSKULookup().catch(console.error);
