import { db } from '$lib/supabaseServer';
import { CostCalculator } from '$lib/server/cost-calculator';

interface AmazonOrderItem {
  seller_sku?: string;
  asin?: string;
  item_price_amount?: string;
  item_tax_amount?: string | null;
  quantity_ordered: number;
  [key: string]: any;
}

export async function load({ url }) {
  const dateParam = url.searchParams.get('date');
  const searchParam = url.searchParams.get('search');
  const viewParam = url.searchParams.get('view') || 'daily';

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
      endDate = new Date(targetDate);
      endDate.setHours(23, 59, 59, 999);

      if (viewParam === 'weekly') {
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6); // 7 days inclusive
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate = new Date(targetDate);
        startDate.setHours(0, 0, 0, 0);
      }
    } else {
      // Default to yesterday
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);

      endDate = new Date(yesterday);
      endDate.setHours(23, 59, 59, 999);

      if (viewParam === 'weekly') {
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate = new Date(yesterday);
        startDate.setHours(0, 0, 0, 0);
      }
    }

    // Fetch all orders with pagination to bypass 1000 row limit
    let allOrders: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: dateOrders, error: dateError } = await db
        .from('amazon_orders')
        .select('*, amazon_order_items(*)')
        .gte('purchase_date', startDate.toISOString())
        .lte('purchase_date', endDate.toISOString())
        .order('purchase_date', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (dateError) {
        error = dateError;
        break;
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

    orders = allOrders;
  }

  if (error) {
    console.error('Error fetching amazon orders:', error);
    return { orders: [] };
  }

  // Fetch composition summary for bundle calculations
  const allSkus = new Set<string>();
  orders.forEach(order => {
    order.amazon_order_items?.forEach((item: any) => {
      if (item.seller_sku) allSkus.add(item.seller_sku);
    });
  });

  const bundleMap = new Map<string, number>();

  if (allSkus.size > 0) {
    const { data: compositions } = await db
      .from('linnworks_composition_summary')
      .select('parent_sku, total_qty')
      .in('parent_sku', Array.from(allSkus));

    if (compositions) {
      compositions.forEach(c => {
        if (c.parent_sku && c.total_qty) {
          bundleMap.set(c.parent_sku, c.total_qty);
        }
      });
    }
  }

  const calculator = new CostCalculator();

  // Enrich orders with cost data
  const enrichedOrders = await Promise.all(orders.map(async (order) => {
    if (!order.amazon_order_items) return order;

    const enrichedItems = await Promise.all(order.amazon_order_items.map(async (item: AmazonOrderItem) => {
      if (!item.seller_sku) return item;

      // Calculate price per item for fee calculation
      const itemPrice = item.item_price_amount ? parseFloat(item.item_price_amount) / item.quantity_ordered : 0;
      const itemTax = item.item_tax_amount !== null && item.item_tax_amount !== undefined
        ? parseFloat(item.item_tax_amount) / item.quantity_ordered
        : undefined;

      const costs = await calculator.calculateProductCosts(item.seller_sku!, itemPrice, {
        isPrime: order.is_prime,
        actualTax: itemTax,
        quantity: item.quantity_ordered
      });

      const bundleQuantity = bundleMap.get(item.seller_sku) || 1;

      return {
        ...item,
        costs,
        bundle_quantity: bundleQuantity
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
