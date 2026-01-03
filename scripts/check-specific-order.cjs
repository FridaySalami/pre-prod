
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.PRIVATE_SUPABASE_SERVICE_KEY);

async function checkSpecificOrder() {
  const orderId = '026-6540232-5125960';
  console.log(`Checking order: ${orderId}`);

  // 1. Get Order Details
  const { data: order, error: orderError } = await supabase
    .from('amazon_orders')
    .select('amazon_order_id, shipping_cost, order_status, purchase_date')
    .eq('amazon_order_id', orderId)
    .single();

  if (orderError) {
    console.error('Error fetching order:', orderError);
    return;
  }

  if (!order) {
    console.log('Order not found in database.');
    return;
  }

  console.log('Order Data:', JSON.stringify(order, null, 2));

  // 2. Get Order Items
  const { data: items, error: itemsError } = await supabase
    .from('amazon_order_items')
    .select('seller_sku, quantity_ordered, item_price_amount')
    .eq('amazon_order_id', orderId);

  if (itemsError) {
    console.error('Error fetching items:', itemsError);
    return;
  }

  console.log('Order Items:', JSON.stringify(items, null, 2));

  // 3. Analysis
  if (order.shipping_cost !== null) {
    const totalQty = items.reduce((sum, item) => sum + (item.quantity_ordered || 0), 0);
    console.log('\n--- ANALYSIS ---');
    console.log(`Actual Shipping Cost (DB): £${order.shipping_cost}`);
    console.log(`Total Items: ${totalQty}`);
    if (totalQty > 0) {
      console.log(`Cost per item: £${(order.shipping_cost / totalQty).toFixed(2)}`);
    }
  } else {
    console.log('\n--- ANALYSIS ---');
    console.log('This order does NOT have an actual shipping cost set yet.');
    console.log('It is currently using estimated costs (see "costs" column in items above).');
  }
}

checkSpecificOrder();
