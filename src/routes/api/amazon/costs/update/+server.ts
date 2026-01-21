import { json } from '@sveltejs/kit';
import { db } from '$lib/supabaseServer';

export async function POST({ request }) {
  try {
    const body = await request.json();
    const {
      sku,
      asin,
      title,
      width,
      height,
      depth,
      weight,
      merchant_shipping_group,
      total_value,
      vat_rate,
      is_fragile
    } = body;

    if (!sku) {
      return json({ success: false, error: 'SKU is required' }, { status: 400 });
    }

    // 1. Update Inventory
    const { error: invError } = await db
      .from('inventory')
      .upsert({
        sku,
        title,
        width: parseFloat(width) || 0,
        height: parseFloat(height) || 0,
        depth: parseFloat(depth) || 0,
        weight: parseFloat(weight) || 0,
        is_fragile: !!is_fragile,
        updated_at: new Date().toISOString()
      }, { onConflict: 'sku' });

    if (invError) {
      console.error('Error updating inventory:', invError);
      return json({ success: false, error: 'Failed to update inventory: ' + invError.message }, { status: 500 });
    }

    // 2. Update SKU-ASIN Mapping
    // Note: sku_asin_mapping might not have an ID, so we rely on seller_sku being unique or primary key
    const { error: mapError } = await db
      .from('sku_asin_mapping')
      .upsert({
        seller_sku: sku,
        asin1: asin || null,
        item_name: title,
        merchant_shipping_group: merchant_shipping_group || 'Off Amazon',
        updated_at: new Date().toISOString()
      }, { onConflict: 'seller_sku' });

    if (mapError) {
      console.error('Error updating mapping:', mapError);
      return json({ success: false, error: 'Failed to update mapping: ' + mapError.message }, { status: 500 });
    }

    // 3. Update Linnworks Composition Summary
    // We'll create a simple composition with one child (itself) if it doesn't exist

    // Check if exists first since parent_sku might not have a unique constraint
    const { data: existingComp } = await db
      .from('linnworks_composition_summary')
      .select('id')
      .eq('parent_sku', sku)
      .maybeSingle();

    const compData = {
      parent_sku: sku,
      parent_title: title,
      total_value: parseFloat(total_value) || 0,
      total_qty: 1,
      child_skus: JSON.stringify([sku]), // Self-reference as simple product
      child_titles: JSON.stringify([title]),
      child_quantities: JSON.stringify([1]),
      child_prices: JSON.stringify([parseFloat(total_value) || 0]),
      child_vats: JSON.stringify([parseFloat(vat_rate) || 0]),
      updated_at: new Date().toISOString()
    };

    let compError;

    if (existingComp) {
      const { error } = await db
        .from('linnworks_composition_summary')
        .update(compData)
        .eq('id', existingComp.id);
      compError = error;
    } else {
      const { error } = await db
        .from('linnworks_composition_summary')
        .insert(compData);
      compError = error;
    }

    if (compError) {
      console.error('Error updating composition:', compError);
      return json({ success: false, error: 'Failed to update composition: ' + compError.message }, { status: 500 });
    }

    return json({ success: true, message: 'Cost data updated successfully' });
  } catch (e) {
    console.error('Error in update cost API:', e);
    return json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
