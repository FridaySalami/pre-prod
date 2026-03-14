import { db } from '$lib/supabase/supabaseServer';
import { CostCalculator } from '$lib/server/cost-calculator';

export async function load() {
  // Fetch all suppliers
  const { data: suppliers, error: suppliersError } = await db
    .from('packing_suppliers')
    .select('*')
    .order('name');

  if (suppliersError) {
    console.error('Error fetching suppliers:', suppliersError);
  }

  // Fetch supplies with their default prices - Only Active Ones
  const { data: supplies, error: suppliesError } = await db
    .from('packing_supplies')
    .select(`
			*,
			packing_supplier_prices (
				supplier_id,
				default_price
			)
		`)
    .eq('is_active', true)
    .order('name');

  if (suppliesError) {
    console.error('Error fetching supplies:', suppliesError);
  }

  // Fetch recent history
  const { data: history, error: historyError } = await db
    .from('packing_invoices')
    .select(`
			*,
			packing_suppliers (name),
			packing_invoice_lines (
				supply_id,
				quantity,
				unit_price,
				packing_supplies (name)
			)
		`)
    .order('invoice_date', { ascending: false })
    .limit(15);

  if (historyError) {
    console.error('Error fetching history:', historyError);
  }

  // --- Phase 3: Fetch multi-window usage from the ledger ---
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sixDaysAgo = new Date();
  sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const { data: usageLedger, error: usageError } = await db
    .from('packing_inventory_ledger')
    .select('supply_id, change_amount, created_at')
    .eq('movement_type', 'amazon_order_usage')
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (usageError) {
    console.error('Error fetching usage ledger:', usageError);
  }

  // Aggregate usage into maps for 2d, 7d, and 30d
  const usageStats30d: Record<string, number> = {};
  const usageStats7d: Record<string, number> = {};
  const usageStats2d: Record<string, number> = {};
  const usageStats3d: Record<string, number> = {};
  const usageStatsPrev3d: Record<string, number> = {};
  
  // Track how many days of data we actually have in the ledger (max 30)
  let earliestDate = new Date();

  if (usageLedger && usageLedger.length > 0) {
    const twoDaysTime = twoDaysAgo.getTime();
    const threeDaysTime = threeDaysAgo.getTime();
    const sixDaysTime = sixDaysAgo.getTime();
    const sevenDaysTime = sevenDaysAgo.getTime();

    usageLedger.forEach((row) => {
      const consumed = Math.abs(row.change_amount || 0);
      const createdAtDate = new Date(row.created_at);
      const createdAt = createdAtDate.getTime();
      
      if (createdAtDate < earliestDate) earliestDate = createdAtDate;

      // Add to 30d stats
      usageStats30d[row.supply_id] = (usageStats30d[row.supply_id] || 0) + consumed;
      
      // Add to 7d stats if within range
      if (createdAt >= sevenDaysTime) {
        usageStats7d[row.supply_id] = (usageStats7d[row.supply_id] || 0) + consumed;
      }
      
      // Add to 2d stats if within range
      if (createdAt >= twoDaysTime) {
        usageStats2d[row.supply_id] = (usageStats2d[row.supply_id] || 0) + consumed;
      }

      // 3d Trend analysis: Current 3 days (0-3) vs Previous 3 days (3-6)
      if (createdAt >= threeDaysTime) {
        usageStats3d[row.supply_id] = (usageStats3d[row.supply_id] || 0) + consumed;
      } else if (createdAt >= sixDaysTime) {
        usageStatsPrev3d[row.supply_id] = (usageStatsPrev3d[row.supply_id] || 0) + consumed;
      }
    });
  }

  const daysOfData = Math.max(1, Math.ceil((new Date().getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)));
  // -----------------------------------------------------

  // --- Phase 4: Fetch unmapped orders for review ---
  const { data: unmapped } = await db
    .from('amazon_order_packaging')
    .select('amazon_order_id, box_code, box_supply_id, calculated_at')
    .is('box_supply_id', null)
    .neq('box_code', '0x0x0')
    .order('calculated_at', { ascending: false })
    .limit(50);

  let unmappedOrders: any[] = [];
  if (unmapped && unmapped.length > 0) {
    const orderIds = unmapped.map(u => u.amazon_order_id);
    const { data: items } = await db
      .from('amazon_order_items')
      .select('amazon_order_id, seller_sku, asin, title, item_price_amount, quantity_ordered, item_tax_amount')
      .in('amazon_order_id', orderIds);

    const { data: orders } = await db
      .from('amazon_orders')
      .select('amazon_order_id, is_prime, shipping_cost')
      .in('amazon_order_id', orderIds);

    // Reuse fetchOrdersData logic in a lightweight way to get reasons
    const allSkus = Array.from(new Set(items?.map(i => i.seller_sku) || []));
    const [inventoryRes, mappingRes, linnworksRes] = await Promise.all([
      db.from('inventory').select('*').in('sku', allSkus),
      db.from('sku_asin_mapping').select('*').in('seller_sku', allSkus),
      db.from('linnworks_composition_summary').select('*').in('parent_sku', allSkus)
    ]);

    const inventoryMap = new Map(inventoryRes.data?.map(i => [i.sku, i]));
    const mappingMap = new Map(mappingRes.data?.map(m => [m.seller_sku, m]));
    const linnworksMap = new Map(linnworksRes.data?.map(l => [l.parent_sku, l]));

    const calculator = new CostCalculator();
    await calculator.initializeDynamicPrices();

    unmappedOrders = unmapped.map(u => {
      const orderData = orders?.find(o => o.amazon_order_id === u.amazon_order_id);
      const orderItems = (items?.filter((i: any) => i.amazon_order_id === u.amazon_order_id) || []).map(item => {
        const itemPrice = item.item_price_amount ? parseFloat(item.item_price_amount) / item.quantity_ordered : 0;
        const itemTax = item.item_tax_amount !== null && item.item_tax_amount !== undefined
          ? parseFloat(item.item_tax_amount) / item.quantity_ordered
          : undefined;

        const product = inventoryMap.get(item.seller_sku);
        const skuMapping = mappingMap.get(item.seller_sku);
        const linnworksData = linnworksMap.get(item.seller_sku);

        let costs = null;
        if (product) {
          costs = calculator.calculate(item.seller_sku!, itemPrice, product, skuMapping, linnworksData, {
            isPrime: orderData?.is_prime,
            actualTax: itemTax,
            quantity: item.quantity_ordered
          });
        }

        return { ...item, costs };
      });

      return { ...u, items: orderItems };
    });
  }
  // -----------------------------------------------------

  return {
    suppliers: suppliers || [],
    supplies: supplies || [],
    history: history || [],
    usageStats30d,
    usageStats7d,
    usageStats2d,
    usageStats3d,
    usageStatsPrev3d,
    daysOfData,
    unmappedOrders
  };
}
