const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wpyaeuabvqqwfstegcdh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndweWFldWFidnFxd2ZzdGVnY2RoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODU1MjQ4NSwiZXhwIjoyMDQ0MTI4NDg1fQ.8KFw5HM1AxmZOzCDBDK-4iVJOx-sCAUOzFNT-UyOKQ0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findBuyBoxRecord() {
  try {
    console.log('🔍 Searching for buybox_data record with ID: 3ded817d-bdbd-47e8-9edb-9a492f2833f5');

    const { data, error } = await supabase
      .from('buybox_data')
      .select('*')
      .eq('id', '3ded817d-bdbd-47e8-9edb-9a492f2833f5')
      .single();

    if (error) {
      console.error('❌ Error fetching record:', error);
      return;
    }

    if (!data) {
      console.log('❌ No record found with that ID');
      return;
    }

    console.log('✅ Found record:');
    console.log('=====================================');
    console.log('ID:', data.id);
    console.log('SKU:', data.sku);
    console.log('ASIN:', data.asin);
    console.log('Price (stored as "your price"):', data.price);
    console.log('Competitor Price:', data.competitor_price);
    console.log('Is Winner:', data.is_winner);
    console.log('Job ID:', data.job_id);
    console.log('Captured At:', data.captured_at);
    console.log('Opportunity Flag:', data.opportunity_flag);
    console.log('=====================================');
    console.log('');
    console.log('🔍 PRICING ANALYSIS:');
    if (data.price === data.competitor_price) {
      console.log('⚠️  ISSUE DETECTED: price and competitor_price are identical!');
      console.log('   This suggests the scanner captured the buy box winner price');
      console.log('   and stored it as both your price AND competitor price.');
    } else {
      console.log('✅ Prices are different - this looks correct');
    }

    console.log('');
    console.log('Full record JSON:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findBuyBoxRecord();
