import { db } from '$lib/supabase/supabaseServer';

export async function load() {
  // Fetch all suppliers
  const { data: suppliers, error: suppliersError } = await db
    .from('packing_suppliers')
    .select('*')
    .order('name');

  if (suppliersError) {
    console.error('Error fetching suppliers:', suppliersError);
  }

  // Fetch supplies with their default prices
  const { data: supplies, error: suppliesError } = await db
    .from('packing_supplies')
    .select(`
			*,
			packing_supplier_prices (
				supplier_id,
				default_price
			)
		`)
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
    .select('supply_id, change_amount')
    .eq('movement_type', 'amazon_order_usage')
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (usageError) {
    console.error('Error fetching 30-day usage ledger:', usageError);
  }

  // Aggregate usage into a map: { supply_id: total_consumed_past_30_days }
  const usageStats: Record<string, number> = {};
  if (usageLedger) {
    usageLedger.forEach(row => {
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
    .order('calculated_at', { ascending: false })
    .limit(50);

  let unmappedOrders: any[] = [];
  if (unmapped && unmapped.length > 0) {
    const orderIds = unmapped.map(u => u.amazon_order_id);
    const { data: items } = await db
      .from('amazon_order_items')
      .select('amazon_order_id, seller_sku, asin, title')
      .in('amazon_order_id', orderIds);

    unmappedOrders = unmapped.map(u => ({
      ...u,
      items: items?.filter((i: any) => i.amazon_order_id === u.amazon_order_id) || []
    }));
  }
  // -----------------------------------------------------

  return {
    suppliers: suppliers || [],
    supplies: supplies || [],
    history: history || [],
    usageStats, // Pass the new stats dictionary down to the page
    unmappedOrders
  };
}
