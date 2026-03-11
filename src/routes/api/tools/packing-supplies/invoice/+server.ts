import { db } from '$lib/supabase/supabaseServer';
import { json } from '@sveltejs/kit';

export async function DELETE({ request }) {
  try {
    const url = new URL(request.url);
    const invoiceId = url.searchParams.get('id');

    if (!invoiceId) {
      return json({ error: 'No invoice ID provided' }, { status: 400 });
    }

    // 1. Fetch line items to reverse the stock updates
    const { data: lines, error: linesError } = await db
      .from('packing_invoice_lines')
      .select('supply_id, quantity')
      .eq('invoice_id', invoiceId);

    if (linesError) throw linesError;

    // 2. Reverse current_stock on packing_supplies
    if (lines && lines.length > 0) {
      for (const line of lines) {
        // Fetch current stock
        const { data: supplyData } = await db
          .from('packing_supplies')
          .select('current_stock')
          .eq('id', line.supply_id)
          .single();

        const currentStock = supplyData?.current_stock || 0;

        // Subtract what was added
        await db.from('packing_supplies')
          .update({ current_stock: Math.max(0, currentStock - line.quantity) })
          .eq('id', line.supply_id);
      }
    }

    // 3. Delete related inventory ledger entries
    // Since reasoning might be generic, we can delete entries with this reference_id
    const { error: ledgerError } = await db
      .from('packing_inventory_ledger')
      .delete()
      .eq('reference_id', invoiceId);

    // 4. Delete invoice lines (might fail if foreign keys don't cascade, better to do it manually)
    const { error: deleteLinesError } = await db
      .from('packing_invoice_lines')
      .delete()
      .eq('invoice_id', invoiceId);

    if (deleteLinesError) throw deleteLinesError;

    // 5. Delete the invoice itself
    const { error: invoiceError } = await db
      .from('packing_invoices')
      .delete()
      .eq('id', invoiceId);

    if (invoiceError) throw invoiceError;

    return json({ success: true });

  } catch (error: any) {
    console.error('Failed to delete invoice:', error);
    return json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH({ request }) {
  try {
    const payload = await request.json();
    const { id, invoice_date, invoice_number, notes } = payload;

    if (!id) return json({ error: 'Missing invoice ID' }, { status: 400 });

    const { data, error } = await db
      .from('packing_invoices')
      .update({ invoice_date, invoice_number, notes })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return json({ success: true, data });
  } catch (e: any) {
    return json({ error: e.message }, { status: 500 });
  }
}