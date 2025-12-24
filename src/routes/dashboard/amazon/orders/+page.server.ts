import { db } from '$lib/supabaseServer';
import { CostCalculator } from '$lib/server/cost-calculator';

export async function load({ url }) {
  const dateParam = url.searchParams.get('date');
  const searchParam = url.searchParams.get('search');

  let orders: any[] = [];
  let error = null;
  let startDate: Date | undefined;

  if (searchParam) {
    const term = searchParam.trim();

    // 1. Search orders by ID
    const { data: ordersById, error: error1 } = await db
      .from('amazon_orders')
      .select('amazon_order_id')
      .ilike('amazon_order_id', `%${term}%`);

    // 2. Search items by SKU or ASIN
    const { data: itemsBySkuOrAsin, error: error2 } = await db
      .from('amazon_order_items')
      .select('amazon_order_id')
      .or(`seller_sku.ilike.%${term}%,asin.ilike.%${term}%`);

    if (error1) console.error('Error searching orders:', error1);
    if (error2) console.error('Error searching items:', error2);

    const orderIds = new Set([
      ...(ordersById?.map(o => o.amazon_order_id) || []),
      ...(itemsBySkuOrAsin?.map(i => i.amazon_order_id) || [])
    ]);

    if (orderIds.size > 0) {
      const { data: searchResults, error: searchError } = await db
        .from('amazon_orders')
        .select('*, amazon_order_items(*)')
        .in('amazon_order_id', Array.from(orderIds))
        .order('purchase_date', { ascending: false });

      orders = searchResults || [];
      error = searchError;
    }
  } else {
    let endDate: Date;

    if (dateParam) {
      const targetDate = new Date(dateParam);
      startDate = new Date(targetDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(targetDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Default to yesterday
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      startDate = new Date(yesterday);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(yesterday);
      endDate.setHours(23, 59, 59, 999);
    }

    const { data: dateOrders, error: dateError } = await db
      .from('amazon_orders')
      .select('*, amazon_order_items(*)')
      .gte('purchase_date', startDate.toISOString())
      .lte('purchase_date', endDate.toISOString())
      .order('purchase_date', { ascending: false });

    orders = dateOrders || [];
    error = dateError;
  }

  if (error) {
    console.error('Error fetching amazon orders:', error);
    return { orders: [] };
  }

  const calculator = new CostCalculator();

  // Enrich orders with cost data
  const enrichedOrders = await Promise.all(orders.map(async (order) => {
    if (!order.amazon_order_items) return order;

    const enrichedItems = await Promise.all(order.amazon_order_items.map(async (item) => {
      if (!item.seller_sku) return item;

      // Calculate price per item for fee calculation
      const itemPrice = item.item_price_amount ? parseFloat(item.item_price_amount) / item.quantity_ordered : 0;
      const itemTax = item.item_tax_amount !== null ? parseFloat(item.item_tax_amount) / item.quantity_ordered : undefined;

      const costs = await calculator.calculateProductCosts(item.seller_sku, itemPrice, { isPrime: order.is_prime, actualTax: itemTax });
      return {
        ...item,
        costs
      };
    }));

    return {
      ...order,
      amazon_order_items: enrichedItems
    };
  }));

  return {
    orders: enrichedOrders ?? [],
    date: dateParam || (startDate ? startDate.toISOString().split('T')[0] : ''),
    search: searchParam || ''
  };
}
