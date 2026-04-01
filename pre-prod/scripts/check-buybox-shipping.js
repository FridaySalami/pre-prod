import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wzkynqgtxmvnkpuwnaqt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6a3lucWd0eG12bmtwdXduYXF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzMyNTk5MiwiZXhwIjoyMDQ4OTAxOTkyfQ.zJIV8i3LcnhKafKRXgLNq1lUKxb4FhbgDnWLV3wGjMY'
);

async function checkBuyBoxShippingData() {
  console.log('Checking buybox_data table for shipping information...');

  // Get recent records with shipping data
  const { data: recent, error } = await supabase
    .from('buybox_data')
    .select('id, asin, sku, merchant_shipping_group, captured_at, source')
    .order('captured_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching buybox data:', error);
    return;
  }

  console.log('\nRecent buybox records with shipping data:');
  recent.forEach(record => {
    console.log(`ASIN: ${record.asin}, SKU: ${record.sku}, Shipping: ${record.merchant_shipping_group}, Source: ${record.source}`);
  });

  // Count shipping types
  const { data: shippingCounts, error: countError } = await supabase
    .from('buybox_data')
    .select('merchant_shipping_group')
    .not('merchant_shipping_group', 'is', null);

  if (!countError && shippingCounts) {
    const counts = shippingCounts.reduce((acc, record) => {
      acc[record.merchant_shipping_group] = (acc[record.merchant_shipping_group] || 0) + 1;
      return acc;
    }, {});

    console.log('\nShipping type distribution:');
    Object.entries(counts).forEach(([type, count]) => {
      console.log(`${type}: ${count} records`);
    });
  }
}

checkBuyBoxShippingData().catch(console.error);
