
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrder() {
  const orderId = '026-3279278-2001969';
  console.log(`Checking order: ${orderId}`);

  const { data: order, error } = await supabase
    .from('amazon_orders')
    .select(`
            amazon_order_id,
            amazon_order_items (
                seller_sku,
                quantity_ordered
            )
        `)
    .eq('amazon_order_id', orderId)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!order) {
    console.log('Order not found');
    return;
  }

  console.log(JSON.stringify(order, null, 2));
}

checkOrder();
