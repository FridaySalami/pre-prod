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

export async function load({ params }) {
  const { sku } = params;
  let orders: any[] = [];
  let error = null;

  if (!sku) {
    return { orders: [], sku };
  }

  // Helper to generate SKU candidates from cleaned URL (e.g. "A-B-C")
  // Generates permutations like "A - B - C", "A B C", "A - B C", etc.
  function generateCandidates(cleanSku: string) {
    // Normalize input first: ensure it's dash-separated
    // This handles "A - B" or "A B" coming in as input -> "A-B"
    const normalized = cleanSku.replace(/\s+/g, '-').replace(/-+/g, '-');
    const parts = normalized.split('-');

    if (parts.length === 1) return [normalized, cleanSku];

    const separators = ['-', ' - ', ' '];
    let results: string[] = [];

    function backtrack(index: number, currentString: string) {
      if (index === parts.length - 1) {
        results.push(currentString + parts[index]);
        return;
      }

      const part = parts[index];
      for (const sep of separators) {
        backtrack(index + 1, currentString + part + sep);
      }
    }

    backtrack(0, '');
    return results;
  }

  // Generate candidate SKUs to allow for "clean" URLs
  const candidates = new Set([
    sku,
    ...generateCandidates(sku)
  ]);
  const candidateList = Array.from(candidates);

  // 1. Find all order items for this SKU (or candidates)
  const { data: orderItems, error: itemsError } = await db
    .from('amazon_order_items')
    .select('amazon_order_id, seller_sku') // Fetch seller_sku to identify the winner
    .in('seller_sku', candidateList);

  if (itemsError) {
    console.error('Error fetching order items for SKU:', itemsError);
    return { orders: [], sku, error: itemsError.message };
  }

  // Determine the canonical SKU from the results (if any)
  // Prefer the one that matches the DB most frequently, or just the first one found.
  // If we searched for 'OIL02H-001' and found 'OIL02H - 001', we use the latter.
  const foundSku = orderItems?.[0]?.seller_sku || sku;

  const orderIds = Array.from(new Set(orderItems?.map(item => item.amazon_order_id) || []));

  if (orderIds.length > 0) {
    // Fetch orders details
    const { data: skuOrders, error: ordersError } = await db
      .from('amazon_orders')
      .select('*, amazon_order_items(*)')
      .in('amazon_order_id', orderIds)
      .order('purchase_date', { ascending: false });

    if (ordersError) {
      console.error('Error fetching orders for SKU:', ordersError);
      error = ordersError;
    } else {
      orders = skuOrders || [];
    }
  }

  // Fetch all necessary data for cost calculations in bulk
  const allSkus = new Set<string>();
  orders.forEach(order => {
    order.amazon_order_items?.forEach((item: any) => {
      if (item.seller_sku) allSkus.add(item.seller_sku);
    });
  });

  const inventoryMap = new Map();
  const mappingMap = new Map();
  const linnworksMap = new Map();
  const bundleMap = new Map<string, number>();

  if (allSkus.size > 0) {
    const skuList = Array.from(allSkus);

    // Parallel fetch for all required data
    const [inventoryRes, mappingRes, linnworksRes] = await Promise.all([
      db.from('inventory')
        .select('id, sku, depth, height, width, weight')
        .in('sku', skuList),
      db.from('sku_asin_mapping')
        .select('seller_sku, merchant_shipping_group, item_name')
        .in('seller_sku', skuList),
      db.from('linnworks_composition_summary')
        .select('parent_sku, total_qty, total_value, child_vats')
        .in('parent_sku', skuList)
    ]);

    if (inventoryRes.data) {
      inventoryRes.data.forEach(i => inventoryMap.set(i.sku, i));
    }
    if (mappingRes.data) {
      mappingRes.data.forEach(m => mappingMap.set(m.seller_sku, m));
    }
    if (linnworksRes.data) {
      linnworksRes.data.forEach(l => {
        linnworksMap.set(l.parent_sku, l);
        if (l.total_qty) bundleMap.set(l.parent_sku, l.total_qty);
      });
    }
  }

  const calculator = new CostCalculator();

  // Enrich orders with cost data
  const enrichedOrders = orders.map((order) => {
    if (!order.amazon_order_items) return order;

    // Calculate total quantity for distributing actual shipping costs
    const totalOrderQuantity = order.amazon_order_items.reduce((sum: number, item: any) => sum + (item.quantity_ordered || 0), 0) || 1;

    const enrichedItems = order.amazon_order_items.map((item: AmazonOrderItem) => {
      if (!item.seller_sku) return item;

      // Calculate price per item for fee calculation
      const itemPrice = item.item_price_amount ? parseFloat(item.item_price_amount) / item.quantity_ordered : 0;
      const itemTax = item.item_tax_amount !== null && item.item_tax_amount !== undefined
        ? parseFloat(item.item_tax_amount) / item.quantity_ordered
        : undefined;

      // Get pre-fetched data
      const product = inventoryMap.get(item.seller_sku);
      const skuMapping = mappingMap.get(item.seller_sku);
      const linnworksData = linnworksMap.get(item.seller_sku);

      let costs = null;
      if (product) {
        costs = calculator.calculate(item.seller_sku!, itemPrice, product, skuMapping, linnworksData, {
          isPrime: order.is_prime,
          actualTax: itemTax,
          quantity: item.quantity_ordered
        });

        // Override with actual shipping cost if available
        if (costs && order.shipping_cost !== null && order.shipping_cost !== undefined) {
          // Distribute actual shipping cost evenly per unit
          costs.shippingCost = Number(order.shipping_cost) / totalOrderQuantity;
          costs.shippingType = 'Actual';
        }
      }

      const bundleQuantity = bundleMap.get(item.seller_sku) || 1;

      return {
        ...item,
        costs,
        bundle_quantity: bundleQuantity
      };
    });

    return {
      ...order,
      amazon_order_items: enrichedItems
    };
  });

  return {
    orders: enrichedOrders ?? [],
    sku: foundSku // Return the canonical SKU found in DB
  };
}
