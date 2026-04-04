import { db } from '$lib/supabase/supabaseServer';
import { json } from '@sveltejs/kit';

export async function POST({ request }) {
  try {
    const payload = await request.json();
    const { supplier_id, invoice_date, invoice_number, total_cost_raw, total_vat, total_cost, notes, items } = payload;

    if (!items || items.length === 0) {
      return json({ error: 'No items provided' }, { status: 400 });
    }

    // 1. Create the Master Invoice Record
    const { data: invoice, error: invoiceError } = await db
      .from('packing_invoices')
      .insert({
        supplier_id,
        invoice_date,
        invoice_number,
        total_cost_raw,
        total_vat,
        total_cost,
        notes
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    const invoiceId = invoice.id;

    // 2. Prepare the Line Items AND Ledger Entries AND Price Updates
    const lineItemsToInsert = items.map((item: any) => ({
      invoice_id: invoiceId,
      supply_id: item.supply_id,
      quantity: item.quantity,
      unit_price: item.unit_price
    }));

    const ledgerEntriesToInsert = items.map((item: any) => ({
      supply_id: item.supply_id,
      change_amount: item.quantity, // Positive incoming
      reason: 'INVOICE_ARRIVED',
      reference_id: invoiceId
    }));

    // We need to upsert default prices based on this invoice
    // If the user changed the price box, it becomes the new default for that supplier
    const pricesToUpsert = items.map((item: any) => ({
      supply_id: item.supply_id,
      supplier_id: supplier_id,
      default_price: item.unit_price,
      updated_at: new Date().toISOString()
    }));

    // 3. Execute all writes
    // Note: Supabase JS client doesn't support full transactions smoothly without RPCs,
    // but since this is internal tooling, sequential execution is generally safe enough.

    const { error: linesError } = await db.from('packing_invoice_lines').insert(lineItemsToInsert);
    if (linesError) throw linesError;

    const { error: ledgerError } = await db.from('packing_inventory_ledger').insert(ledgerEntriesToInsert);
    if (ledgerError) throw ledgerError;

    const { error: pricesError } = await db.from('packing_supplier_prices').upsert(pricesToUpsert, {
      onConflict: 'supply_id, supplier_id'
    });
    if (pricesError) throw pricesError;

    // 4. Batch Update Stock
    // We fetch all relevant IDs at once to minimize roundtrips
    const { data: currentStocks, error: fetchError } = await db
      .from('packing_supplies')
      .select('id, current_stock')
      .in('id', items.map((i: any) => i.supply_id));

    if (fetchError) throw fetchError;

    const stockMap = currentStocks.reduce((acc: any, s: any) => {
      acc[s.id] = s.current_stock || 0;
      return acc;
    }, {});

    const corrections: any[] = [];
    const supplyUpdates = items.map((item: any) => {
      let currentStock = stockMap[item.supply_id] || 0;

      if (currentStock < 0) {
        const negativeDebt = Math.abs(currentStock);
        corrections.push({
          supply_id: item.supply_id,
          change_amount: negativeDebt,
          reason: 'CORRECTION',
          reference_id: `clear_debt_${invoiceId}`
        });
        currentStock = 0;
      }

      return {
        id: item.supply_id,
        current_stock: currentStock + item.quantity,
        updated_at: new Date().toISOString()
      };
    });

    // Clear negative debt in one batch
    if (corrections.length > 0) {
      await db.from('packing_inventory_ledger').insert(corrections);
    }

    // Upsert the new stocks using 'id' as conflict key
    const { error: stockError } = await db.from('packing_supplies').upsert(supplyUpdates, {
      onConflict: 'id'
    });
    if (stockError) throw stockError;

    return json({ success: true, invoice });
  } catch (error: any) {
    console.error('Invoice error:', error);
    return json({ error: error.message }, { status: 500 });
  }
}
