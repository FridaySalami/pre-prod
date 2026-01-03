
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.PRIVATE_SUPABASE_SERVICE_KEY);

async function checkOrder() {
  console.log('Checking for orders with shipping_cost...');
  // Find an order with shipping_cost
  const { data: orders, error } = await supabase
    .from('amazon_orders')
    .select('amazon_order_id, shipping_cost, amazon_order_items(seller_sku, quantity_ordered)')
    .not('shipping_cost', 'is', null)
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!orders || orders.length === 0) {
    console.log('No orders found with shipping_cost set.');

    // If no orders have shipping_cost, let's find one to update for testing
    const { data: testOrder } = await supabase
      .from('amazon_orders')
      .select('amazon_order_id')
      .limit(1);

    if (testOrder && testOrder.length > 0) {
      console.log('You can test with order:', testOrder[0].amazon_order_id);
      console.log(`Run this SQL to set a cost: UPDATE amazon_orders SET shipping_cost = 5.50 WHERE amazon_order_id = '${testOrder[0].amazon_order_id}';`);
    }
    return;
  }

  console.log('Found order with actual shipping cost:', JSON.stringify(orders[0], null, 2));
}

checkOrder();
