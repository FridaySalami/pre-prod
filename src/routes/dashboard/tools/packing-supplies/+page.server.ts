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

  // --- Phase 3: Fetch 30-day usage from the ledger ---
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: usageLedger, error: usageError } = await db
    .from('packing_inventory_ledger')
    .select('supply_id, change_amount, created_at')
    .eq('movement_type', 'amazon_order_usage')
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (usageError) {
    console.error('Error fetching 30-day usage ledger:', usageError);
  }

  // Determine how many days of data we actually have
  let usageDays = 30;
  if (usageLedger && usageLedger.length > 0) {
    const dates = usageLedger.map((r) => new Date(r.created_at).getTime());
    const minDate = Math.min(...dates);
    const now = new Date().getTime();
    const diffDays = Math.ceil((now - minDate) / (1000 * 60 * 60 * 24));
    // Use at least 1 day to avoid division by zero, max 30 as per query
    usageDays = Math.max(1, Math.min(30, diffDays));
  }

  // Aggregate usage into a map: { supply_id: total_consumed_past_X_days }
  const usageStats: Record<string, number> = {};
  if (usageLedger) {
    usageLedger.forEach((row) => {
      // change_amount will be negative for usage, so we make it positive to represent "consumed count"
      const consumed = Math.abs(row.change_amount || 0);
      usageStats[row.supply_id] = (usageStats[row.supply_id] || 0) + consumed;
    });
  }
  // -----------------------------------------------------

  // --- Phase 4: Fetch unmapped orders for review ---
  const { data: unmapped } = await db
    .from('amazon_order_packaging')
    .select('amazon_order_id, box_code, calculated_at')
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
    usageStats, // Pass the new stats dictionary down to the page
    usageDays, // How many days of data we actually have
    unmappedOrders
  };
}
