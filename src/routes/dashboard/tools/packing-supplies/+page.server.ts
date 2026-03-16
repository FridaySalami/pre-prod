import { db } from '$lib/supabase/supabaseServer';
import { CostCalculator } from '$lib/server/cost-calculator';

export async function load({ url }: { url: URL }) {
  // Get date range from query params (default to yesterday/today)
  const dateStr = url.searchParams.get('date');
  const activeTab = url.searchParams.get('tab') || 'log';
  const targetDate = dateStr ? new Date(dateStr) : new Date();
  if (!dateStr) targetDate.setDate(targetDate.getDate() - 1); // Default to yesterday

  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Fetch all suppliers
  const { data: suppliers, error: suppliersError } = await db
    .from('packing_suppliers')
    .select('*')
    .order('name')
    .limit(5000);

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
    .order('name')
    .limit(5000);

  if (suppliesError) {
    console.error('Error fetching supplies:', suppliesError);
  }

  // Start Phase 1 & 2
  let history: any[] = [];
  if (activeTab === 'log' || activeTab === 'history') {
    const { data: historyData, error: historyError } = await db
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
    history = historyData || [];
  }

  // Phase 3 stats are useful for inventory, log, etc.
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

  const usageStats30d: Record<string, number> = {};
  const usageStats7d: Record<string, number> = {};
  const usageStats2d: Record<string, number> = {};
  const usageStats3d: Record<string, number> = {};
  const usageStatsPrev3d: Record<string, number> = {};
  let daysOfData = 0;

  if (activeTab === 'inventory' || activeTab === 'log') {
    const { data: usageLedger, error: usageError } = await db
      .from('packing_inventory_ledger')
      .select('supply_id, change_amount, created_at')
      .eq('movement_type', 'amazon_order_usage')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .limit(10000);

    if (usageError) {
      console.error('Error fetching usage ledger:', usageError);
    }

    let earliestDate = new Date();
    if (usageLedger && usageLedger.length > 0) {
      const twoDaysTime = twoDaysAgo.getTime();
      const threeDaysTime = threeDaysAgo.getTime();
      const sixDaysTime = sixDaysAgo.getTime();
      const sevenDaysTime = sevenDaysAgo.getTime();

      usageLedger.forEach((row: any) => {
        const consumed = Math.abs(row.change_amount || 0);
        const createdAtDate = new Date(row.created_at);
        const createdAt = createdAtDate.getTime();

        if (createdAtDate < earliestDate) earliestDate = createdAtDate;

        usageStats30d[row.supply_id] = (usageStats30d[row.supply_id] || 0) + consumed;
        if (createdAt >= sevenDaysTime) usageStats7d[row.supply_id] = (usageStats7d[row.supply_id] || 0) + consumed;
        if (createdAt >= twoDaysTime) usageStats2d[row.supply_id] = (usageStats2d[row.supply_id] || 0) + consumed;
        if (createdAt >= threeDaysTime) {
          usageStats3d[row.supply_id] = (usageStats3d[row.supply_id] || 0) + consumed;
        } else if (createdAt >= sixDaysTime) {
          usageStatsPrev3d[row.supply_id] = (usageStatsPrev3d[row.supply_id] || 0) + consumed;
        }
      });
      daysOfData = Math.max(1, Math.ceil((new Date().getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)));
    }
  }

  // --- Phase 4: Fetch unmapped orders for review ---
  let unmappedOrders: any[] = [];
  if (activeTab === 'unmapped') {
    const { data: unmapped } = await db
      .from('amazon_order_packaging')
      .select('amazon_order_id, box_code, box_supply_id, calculated_at')
      .is('box_supply_id', null)
      .neq('box_code', '0x0x0')
      .order('calculated_at', { ascending: false })
      .limit(50);

    if (unmapped && unmapped.length > 0) {
      const orderIds = unmapped.map((u: any) => u.amazon_order_id);
      const { data: items } = await db
        .from('amazon_order_items')
        .select('amazon_order_id, seller_sku, asin, title, item_price_amount, quantity_ordered, item_tax_amount')
        .in('amazon_order_id', orderIds);

      const { data: orders } = await db
        .from('amazon_orders')
        .select('amazon_order_id, is_prime, shipping_cost')
        .in('amazon_order_id', orderIds);

      const allSkus = Array.from(new Set(items?.map((i: any) => i.seller_sku) || []));
      const [inventoryRes, mappingRes, linnworksRes] = await Promise.all([
        db.from('inventory').select('*').in('sku', allSkus),
        db.from('sku_asin_mapping').select('*').in('seller_sku', allSkus),
        db.from('linnworks_composition_summary').select('*').in('parent_sku', allSkus)
      ]);

      const inventoryMap = new Map(inventoryRes.data?.map((i: any) => [i.sku, i]));
      const mappingMap = new Map(mappingRes.data?.map((m: any) => [m.seller_sku, m]));
      const linnworksMap = new Map(linnworksRes.data?.map((l: any) => [l.parent_sku, l]));

      const calculator = new CostCalculator();
      await calculator.initializeDynamicPrices();

      unmappedOrders = unmapped.map((u: any) => {
        const orderData = orders?.find((o: any) => o.amazon_order_id === u.amazon_order_id);
        const orderItems = (items?.filter((i: any) => i.amazon_order_id === u.amazon_order_id) || []).map((item: any) => {
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
  }

  // --- Phase 5: Fetch Review Data (Orders for selected date) ---
  let reviewOrders: any[] = [];
  if (activeTab === 'review') {
    const { data: ordersInRange } = await db
      .from('amazon_orders')
      .select('amazon_order_id, purchase_date, is_prime')
      .gte('purchase_date', startOfDay.toISOString())
      .lte('purchase_date', endOfDay.toISOString())
      .order('purchase_date', { ascending: false });

    if (ordersInRange && ordersInRange.length > 0) {
      const orderIds = ordersInRange.map((o: any) => o.amazon_order_id);
      const { data: packingData } = await db
        .from('amazon_order_packaging')
        .select('amazon_order_id, box_code, box_supply_id, calculated_at')
        .in('amazon_order_id', orderIds);

      const { data: items } = await db
        .from('amazon_order_items')
        .select('amazon_order_id, seller_sku, asin, title, quantity_ordered, item_price_amount, item_tax_amount')
        .in('amazon_order_id', orderIds);

      const allSkus = Array.from(new Set(items?.map((i: any) => i.seller_sku) || []));
      const [inventoryRes, mappingRes, linnworksRes] = await Promise.all([
        db.from('inventory').select('*').in('sku', allSkus),
        db.from('sku_asin_mapping').select('*').in('seller_sku', allSkus),
        db.from('linnworks_composition_summary').select('*').in('parent_sku', allSkus)
      ]);

      const inventoryMap = new Map(inventoryRes.data?.map((i: any) => [i.sku, i]));
      const mappingMap = new Map(mappingRes.data?.map((m: any) => [m.seller_sku, m]));
      const linnworksMap = new Map(linnworksRes.data?.map((l: any) => [l.parent_sku, l]));

      const calculator = new CostCalculator();
      await calculator.initializeDynamicPrices();

      reviewOrders = ordersInRange.map((o: any) => {
        const packing = packingData?.find((p: any) => p.amazon_order_id === o.amazon_order_id);
        const orderItems = (items?.filter((i: any) => i.amazon_order_id === o.amazon_order_id) || []).map((item: any) => {
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
              isPrime: o.is_prime,
              actualTax: itemTax,
              quantity: item.quantity_ordered
            });
          }
          return { ...item, costs };
        });

        return {
          ...o,
          box_code: packing?.box_code,
          box_supply_id: packing?.box_supply_id,
          items: orderItems
        };
      });
    }
  }

  return {
    suppliers: suppliers || [],
    supplies: supplies || [],
    history,
    usageStats30d,
    usageStats7d,
    usageStats2d,
    usageStats3d,
    usageStatsPrev3d,
    daysOfData,
    unmappedOrders,
    reviewOrders,
    selectedDate: startOfDay.toISOString().split('T')[0]
  };
}
