import { db } from '$lib/supabaseServer';
import { CostCalculator } from '$lib/server/cost-calculator';

export async function load({ url }) {
  const dateParam = url.searchParams.get('date');
  let startDate: Date, endDate: Date;

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

  const { data: orders, error } = await db
    .from('amazon_orders')
    .select('*, amazon_order_items(*)')
    .gte('purchase_date', startDate.toISOString())
    .lte('purchase_date', endDate.toISOString())
    .order('purchase_date', { ascending: false });

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

      const costs = await calculator.calculateProductCosts(item.seller_sku, itemPrice, { isPrime: order.is_prime });
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
    date: dateParam || startDate.toISOString().split('T')[0]
  };
}
