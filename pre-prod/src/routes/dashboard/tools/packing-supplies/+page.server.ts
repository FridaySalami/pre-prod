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

  // --- Phase 4: Handled by SKU Management Route now ---
  let unmappedOrders: any[] = [];

  // --- Phase 5: Handled by SKU Management Route now ---
  let reviewOrders: any[] = [];

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
