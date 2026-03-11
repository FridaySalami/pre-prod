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

  return {
    suppliers: suppliers || [],
    supplies: supplies || [],
    history: history || []
  };
}
