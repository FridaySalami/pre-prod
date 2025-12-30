require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const orderId = '204-0562547-0077110';
  console.log(`Checking order: ${orderId}`);

  // 1. Fetch Order Details
  const { data: order, error: orderError } = await supabase
    .from('amazon_orders')
    .select('*')
    .eq('amazon_order_id', orderId)
    .single();

  if (orderError) {
    console.error('Error fetching order:', orderError);
  } else {
    console.log('Order Details:');
    console.log(JSON.stringify(order, null, 2));
  }

  // 2. Fetch Order Items
  const { data: items, error: itemsError } = await supabase
    .from('amazon_order_items')
    .select('*')
    .eq('amazon_order_id', orderId);

  if (itemsError) {
    console.error('Error fetching items:', itemsError);
  } else {
    console.log(`Found ${items.length} items for this order.`);
    if (items.length > 0) {
      console.log(JSON.stringify(items, null, 2));
    }
  }
}

main();
