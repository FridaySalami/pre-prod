const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugTables() {
  console.log('🔍 Debugging table data...\n');

  // Check sales_june table
  console.log('📊 Checking sales_june table:');
  const { data: salesData, error: salesError } = await supabase
    .from('sales_june')
    .select('*')
    .limit(3);

  if (salesError) {
    console.error('Sales error:', salesError);
  } else {
    console.log(`- Found ${salesData?.length || 0} sales records`);
    if (salesData?.[0]) {
      console.log('- Sample sales record:');
      console.log('  SKU:', salesData[0].SKU);
      console.log('  Units:', salesData[0]['Units ordered']);
      console.log('  Revenue:', salesData[0]['Ordered Product Sales']);
    }
  }

  console.log('\n📦 Checking sku_asin_mapping table:');
  const { data: mappingData, error: mappingError } = await supabase
    .from('sku_asin_mapping')
    .select('*')
    .limit(3);

  if (mappingError) {
    console.error('Mapping error:', mappingError);
  } else {
    console.log(`- Found ${mappingData?.length || 0} mapping records`);
    if (mappingData?.[0]) {
      console.log('- Sample mapping record:');
      console.log('  Available columns:', Object.keys(mappingData[0]));
      console.log('  Sample data:', mappingData[0]);
    }
  }

  // Check if any sales SKUs match mapping SKUs
  if (salesData && mappingData) {
    console.log('\n🔗 Checking SKU overlap:');
    const salesSkus = new Set(salesData.map(s => s.SKU));
    const mappingSkus = new Set(mappingData.map(m => m.seller_sku || m['seller-sku']));

    console.log('- Sales SKUs:', Array.from(salesSkus).slice(0, 3));
    console.log('- Mapping SKUs:', Array.from(mappingSkus).slice(0, 3));

    const overlap = [...salesSkus].filter(sku => mappingSkus.has(sku));
    console.log('- Overlapping SKUs:', overlap.slice(0, 3));
  }
}

debugTables().catch(console.error);
