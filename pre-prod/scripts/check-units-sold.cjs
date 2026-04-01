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
  const targetDateStr = '2025-12-28';
  const startDate = new Date(targetDateStr);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(targetDateStr);
  endDate.setHours(23, 59, 59, 999);

  console.log(`Checking orders from ${startDate.toISOString()} to ${endDate.toISOString()}`);

  // 1. Fetch Orders
  let allOrders = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: dateOrders, error: dateError } = await supabase
      .from('amazon_orders')
      .select('*, amazon_order_items(*)')
      .gte('purchase_date', startDate.toISOString())
      .lte('purchase_date', endDate.toISOString())
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (dateError) {
      console.error('Error fetching orders:', dateError);
      return;
    }

    if (dateOrders && dateOrders.length > 0) {
      allOrders = [...allOrders, ...dateOrders];
      if (dateOrders.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  console.log(`Found ${allOrders.length} orders.`);

  // 2. Collect SKUs
  const allSkus = new Set();
  allOrders.forEach(order => {
    if (order.amazon_order_items) {
      order.amazon_order_items.forEach(item => {
        if (item.seller_sku) allSkus.add(item.seller_sku);
      });
    }
  });

  // 3. Fetch Bundle Info
  const bundleMap = new Map();
  if (allSkus.size > 0) {
    const { data: compositions, error: compError } = await supabase
      .from('linnworks_composition_summary')
      .select('parent_sku, total_qty')
      .in('parent_sku', Array.from(allSkus));

    if (compError) {
      console.error('Error fetching compositions:', compError);
    }

    if (compositions) {
      compositions.forEach(c => {
        if (c.parent_sku && c.total_qty) {
          bundleMap.set(c.parent_sku, c.total_qty);
        }
      });
    }
  }

  // 4. Calculate Units Sold
  let totalUnits = 0;
  let totalItems = 0;

  let ordersWithNoItems = 0;

  allOrders.forEach(order => {
    if (!order.amazon_order_items || order.amazon_order_items.length === 0) {
      ordersWithNoItems++;
    } else {
      order.amazon_order_items.forEach(item => {
        const qty = Number(item.quantity_ordered) || 0;
        const bundleQty = bundleMap.get(item.seller_sku) || 1;
        const units = qty * bundleQty;

        totalUnits += units;
        totalItems += qty;
      });
    }
  });

  console.log('------------------------------------------------');
  console.log(`Date: ${targetDateStr}`);
  console.log(`Total Orders: ${allOrders.length}`);
  console.log(`Orders with no items: ${ordersWithNoItems}`);
  console.log(`Total Line Items Quantity: ${totalItems}`);
  console.log(`Total Units Sold (with bundles): ${totalUnits}`);
  console.log('------------------------------------------------');
}

main();
