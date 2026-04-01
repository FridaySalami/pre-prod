import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wzkynqgtxmvnkpuwnaqt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6a3lucWd0eG12bmtwdXduYXF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzMyNTk5MiwiZXhwIjoyMDQ4OTAxOTkyfQ.zJIV8i3LcnhKafKRXgLNq1lUKxb4FhbgDnWLV3wGjMY'
);

async function checkShippingData() {
  console.log('Checking sku_asin_mapping table structure and data...');

  // First, let's see what columns exist
  const { data: sample, error } = await supabase
    .from('sku_asin_mapping')
    .select('*')
    .limit(3);

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  console.log('Sample records (showing all columns):');
  console.log(JSON.stringify(sample, null, 2));

  if (sample && sample.length > 0) {
    console.log('\nColumn names in table:');
    console.log(Object.keys(sample[0]));
  }

  // Check if the column exists
  if (sample && sample.length > 0) {
    const hasShippingGroup = 'merchant_shipping_group' in sample[0];
    console.log(`\nHas merchant_shipping_group column: ${hasShippingGroup}`);
  }
}

checkShippingData().catch(console.error);
