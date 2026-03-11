const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Try to read .env file manually
let supabaseUrl, supabaseKey;

try {
  const envContent = fs.readFileSync('.env', 'utf8');
  const lines = envContent.split('\n');

  for (const line of lines) {
    if (line.startsWith('PUBLIC_SUPABASE_URL=')) {
      supabaseUrl = line.split('=')[1].trim().replace(/"/g, '');
    }
    if (line.startsWith('PRIVATE_SUPABASE_SERVICE_KEY=')) {
      supabaseKey = line.split('=')[1].trim().replace(/"/g, '');
    }
  }
} catch (error) {
  console.error('Could not read .env file:', error.message);
  process.exit(1);
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function lookupRecord() {
  try {
    console.log('Looking up record: b6dea807-33ec-4161-87d4-123b3ba64a7f');

    const { data, error } = await supabase
      .from('buybox_data')
      .select('*')
      .eq('id', 'b6dea807-33ec-4161-87d4-123b3ba64a7f')
      .single();

    if (error) {
      console.error('Error:', error);
      return;
    }

    if (!data) {
      console.log('No record found with that ID');
      return;
    }

    console.log('\n=== RECORD DETAILS ===');
    console.log('ID:', data.id);
    console.log('ASIN:', data.asin);
    console.log('SKU:', data.sku);
    console.log('Captured At:', data.captured_at);
    console.log('Run ID:', data.run_id);

    console.log('\n=== PRICING STATUS ===');
    console.log('Pricing Status:', data.pricing_status);
    console.log('Is Winner:', data.is_winner);
    console.log('Opportunity Flag:', data.opportunity_flag);

    console.log('\n=== PRICING DATA ===');
    console.log('Your Current Price:', data.your_current_price);
    console.log('Buy Box Price:', data.buybox_price);
    console.log('Competitor Price:', data.competitor_price);
    console.log('Price Gap:', data.price_gap);
    console.log('Price Gap %:', data.price_gap_percentage);

    console.log('\n=== MARGIN ANALYSIS (KEY FOR LOGIC) ===');
    console.log('Your Margin at Current Price (£):', data.your_margin_at_current_price);
    console.log('Your Margin % at Current Price:', data.your_margin_percent_at_current_price);
    console.log('Margin at Buy Box Price (£):', data.margin_at_buybox_price);
    console.log('Margin % at Buy Box Price:', data.margin_percent_at_buybox_price);
    console.log('Margin Difference:', data.margin_difference);
    console.log('Profit Opportunity:', data.profit_opportunity);

    console.log('\n=== RECOMMENDATION LOGIC ===');
    console.log('Recommended Action:', data.recommended_action);
    console.log('Price Adjustment Needed:', data.price_adjustment_needed);

    console.log('\n=== COST BREAKDOWN ===');
    console.log('Material Total Cost:', data.your_material_total_cost);
    console.log('Shipping Cost:', data.your_shipping_cost);
    console.log('Box Cost:', data.your_box_cost);
    console.log('Break Even Price:', data.break_even_price);

    // Logic analysis
    console.log('\n=== LOGIC ANALYSIS ===');
    console.log('Expected logic based on code:');
    console.log('1. No competition check: buyBoxPrice =', data.buybox_price, '(should be > 0)');
    console.log('2. Not profitable check: margin_percent_at_buybox_price < 5% =',
      data.margin_percent_at_buybox_price, '< 5 =',
      data.margin_percent_at_buybox_price !== null ? data.margin_percent_at_buybox_price < 5 : 'null');
    console.log('3. Investigation check: margin_percent_at_buybox_price < 10% =',
      data.margin_percent_at_buybox_price, '< 10 =',
      data.margin_percent_at_buybox_price !== null ? data.margin_percent_at_buybox_price < 10 : 'null');
    console.log('4. Match buybox check: profit_opportunity > 1 =',
      data.profit_opportunity, '> 1 =',
      data.profit_opportunity !== null ? data.profit_opportunity > 1 : 'null');

    console.log('\nThe issue appears to be:');
    if (data.margin_percent_at_buybox_price !== null && data.margin_percent_at_buybox_price < 5) {
      console.log('✅ Logic is working correctly - buy box margin would be < 5%, hence "not_profitable"');
    } else {
      console.log('❌ Logic appears incorrect - buy box margin is', data.margin_percent_at_buybox_price, '% but tagged as', data.recommended_action);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

lookupRecord();
