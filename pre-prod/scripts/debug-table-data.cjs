const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  console.error('PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('PRIVATE_SUPABASE_SERVICE_KEY:', !!supabaseKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugTables() {
  console.log('🔍 Debugging table data...\n');

  // Check sales_june table
  console.log('📊 Checking sales_june table:');
  const { data: salesData, error: salesError } = await supabase
    .from('sales_june')
    .select('*')
    .limit(10);

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
    .limit(10);

  console.log('\n📦 Checking ACTIVE sku_asin_mapping records:');
  const { data: activeMappingData, error: activeMappingError } = await supabase
    .from('sku_asin_mapping')
    .select('*')
    .eq('status', 'Active')
    .limit(10);

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

  if (activeMappingError) {
    console.error('Active mapping error:', activeMappingError);
  } else {
    console.log(`- Found ${activeMappingData?.length || 0} ACTIVE mapping records`);
    if (activeMappingData?.[0]) {
      console.log('- Sample active mapping record:', {
        seller_sku: activeMappingData[0].seller_sku,
        item_name: activeMappingData[0].item_name,
        status: activeMappingData[0].status,
        asin1: activeMappingData[0].asin1
      });
    }
  }  // Check if any sales SKUs match mapping SKUs
  if (salesData && activeMappingData) {
    console.log('\n🔗 Checking SKU overlap with ACTIVE products:');
    const salesSkus = new Set(salesData.map(s => s.SKU));
    const activeMappingSkus = new Set(activeMappingData.map(m => m.seller_sku));

    console.log('- Sales SKUs:', Array.from(salesSkus).slice(0, 10));
    console.log('- Active Mapping SKUs:', Array.from(activeMappingSkus).slice(0, 10));

    const activeOverlap = [...salesSkus].filter(sku => activeMappingSkus.has(sku));
    console.log('- Overlapping SKUs (Active only):', activeOverlap.slice(0, 3));
    console.log(`- Total active overlapping SKUs: ${activeOverlap.length}`);
  }
}

debugTables().catch(console.error);
