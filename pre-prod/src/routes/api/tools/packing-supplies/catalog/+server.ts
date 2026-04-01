import { db } from '$lib/supabase/supabaseServer';
import { json } from '@sveltejs/kit';

export async function POST({ request }) {
  try {
    const { id, name, code, type } = await request.json();

    if (!name || !code || !type) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    let result;

    if (id) {
      // Update existing supply
      const { data, error } = await db
        .from('packing_supplies')
        .update({ name, code, type })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert new supply
      const { data, error } = await db
        .from('packing_supplies')
        .insert({ name, code, type, current_stock: 0 })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return json({ success: true, data: result });
  } catch (error: any) {
    console.error('Save supply error:', error);
    return json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE({ url }) {
  try {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Missing supply ID' }, { status: 400 });

    // Option A: Archiving instead of permanent deletion to preserve historical data/FKs
    const { error } = await db
      .from('packing_supplies')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;

    return json({ success: true });
  } catch (error: any) {
    console.error('Archive supply error:', error);
    return json({ error: error.message }, { status: 500 });
  }
}
