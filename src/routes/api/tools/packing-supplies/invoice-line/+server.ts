import { db } from '$lib/supabase/supabaseServer';
import { json } from '@sveltejs/kit';

export async function PATCH({ request }) {
  try {
    const payload = await request.json();
    const { invoice_id, supply_id, quantity, unit_price } = payload;

    if (!invoice_id || !supply_id || quantity === undefined || unit_price === undefined) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Get old line details to calculate stock difference
    const { data: oldLine, error: oldLineError } = await db
      .from('packing_invoice_lines')
      .select('quantity, unit_price')
      .eq('invoice_id', invoice_id)
      .eq('supply_id', supply_id)
      .single();

    if (oldLineError) throw oldLineError;

    const qtyDifference = quantity - oldLine.quantity;

    // 2. Update line item
    const { error: lineError } = await db
      .from('packing_invoice_lines')
      .update({ quantity, unit_price })
      .eq('invoice_id', invoice_id)
      .eq('supply_id', supply_id);

    if (lineError) throw lineError;

    // Fetch the parent invoice to grab the supplier_id for price updates
    const { data: invoiceData } = await db
      .from('packing_invoices')
      .select('supplier_id')
      .eq('id', invoice_id)
      .single();

    if (invoiceData?.supplier_id && (unit_price !== oldLine.unit_price || oldLine.unit_price === 0)) {
      // Update the default price to reflect this invoice edit
      await db.from('packing_supplier_prices').upsert({
        supply_id: supply_id,
        supplier_id: invoiceData.supplier_id,
        default_price: unit_price,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'supply_id, supplier_id'
      });
    }

    // 3. Update stock (if changed)
    if (qtyDifference !== 0) {
      const { data: supplyData } = await db
        .from('packing_supplies')
        .select('current_stock')
        .eq('id', supply_id)
        .single();

      const currentStock = supplyData?.current_stock || 0;

      await db.from('packing_supplies')
        .update({ current_stock: Math.max(0, currentStock + qtyDifference) })
        .eq('id', supply_id);

      // 4. Update ledger entry
      // Find the ledger entry for this invoice and supply. It stores the absolute positive incoming amount in `change_amount`.
      await db.from('packing_inventory_ledger')
        .update({ change_amount: quantity })
        .eq('reference_id', invoice_id)
        .eq('supply_id', supply_id);
    }

    // 5. Recalculate totals for the master invoice.
    const { data: allLines, error: allLinesError } = await db
      .from('packing_invoice_lines')
      .select('quantity, unit_price')
      .eq('invoice_id', invoice_id);

    if (!allLinesError && allLines) {
      const newTotalRaw = allLines.reduce((acc, line) => acc + (line.quantity * line.unit_price), 0);
      const newVat = newTotalRaw * 0.2;
      const newTotal = newTotalRaw + newVat;

      await db.from('packing_invoices')
        .update({
          total_cost_raw: newTotalRaw,
          total_vat: newVat,
          total_cost: newTotal
        })
        .eq('id', invoice_id);
    }

    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message }, { status: 500 });
  }
}