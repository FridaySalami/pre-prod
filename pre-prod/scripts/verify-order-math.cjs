
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.PRIVATE_SUPABASE_SERVICE_KEY);

async function verifyOrder() {
  const orderId = '204-7790460-7809932';

  const { data: order } = await supabase
    .from('amazon_orders')
    .select('shipping_cost, amazon_order_items(seller_sku, quantity_ordered)')
    .eq('amazon_order_id', orderId)
    .single();

  if (!order) { console.log('Order not found'); return; }

  const shippingCost = order.shipping_cost;
  const items = order.amazon_order_items;
  const totalQty = items.reduce((sum, item) => sum + item.quantity_ordered, 0);

  console.log('Order:', orderId);
  console.log('Total Actual Shipping Cost:', shippingCost);
  console.log('Items:', JSON.stringify(items, null, 2));
  console.log('Total Quantity:', totalQty);
  console.log('Calculated Shipping Cost Per Unit:', shippingCost / totalQty);
}
verifyOrder();
