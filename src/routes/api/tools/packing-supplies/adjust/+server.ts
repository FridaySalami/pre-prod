import { db } from '$lib/supabase/supabaseServer';
import { json } from '@sveltejs/kit';

export async function POST({ request }) {
  try {
    const { supply_id, new_stock, change_amount, reason } = await request.json();

    if (!supply_id || reason === undefined) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Insert into the ledger
    const { error: ledgerError } = await db.from('packing_inventory_ledger').insert({
      supply_id: supply_id,
      change_amount: change_amount,
      reason: reason
    });

    if (ledgerError) throw ledgerError;

    // Update the specific supply with the new stock count
    const { error: updateError } = await db
      .from('packing_supplies')
      .update({ current_stock: new_stock })
      .eq('id', supply_id);

    if (updateError) throw updateError;

    return json({ success: true });
  } catch (error: any) {
    console.error('Failed to adjust supply:', error);
    return json({ error: error.message }, { status: 500 });
  }
}
