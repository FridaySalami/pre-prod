import { json } from '@sveltejs/kit';
import { db } from '$lib/supabase/supabaseServer';

export async function GET({ url }) {
  const boxCode = url.searchParams.get('boxCode');
  if (!boxCode) return json({ error: 'Missing boxCode' }, { status: 400 });

  try {
    // 1. Find all SKUs from inventory that match these dimensions
    // The inventory stores width, height, depth separately.
    // boxCode is usually "WxHxD"
    const [w, h, d] = boxCode.split('x').map(n => parseFloat(n));

    if (isNaN(w) || isNaN(h) || isNaN(d)) {
      return json({ items: [] });
    }

    const { data: items, error } = await db
      .from('inventory')
      .select('sku, title, width, height, depth')
      .eq('width', w)
      .eq('height', h)
      .eq('depth', d)
      .order('sku');

    if (error) throw error;

    return json({ items: items || [] });
  } catch (error: any) {
    console.error('Fetch SKUs by box error:', error);
    return json({ error: error.message }, { status: 500 });
  }
}

export async function POST({ request }) {
  try {
    const { sku, newBoxCode } = await request.json();
    console.log(`[Reassign DEBUG] Request received for SKU: ${sku}, newBoxCode: ${newBoxCode}`);
    if (!sku || !newBoxCode) return json({ error: 'Missing fields' }, { status: 400 });

    const [w, h, d] = newBoxCode.split('x').map(n => parseFloat(n));
    console.log(`[Reassign DEBUG] Parsed dimensions: W:${w}, H:${h}, D:${d}`);

    // 1. Update the inventory dimensions for this SKU
    const { data: invUpdate, error: invError } = await db
      .from('inventory')
      .update({
        width: w,
        height: h,
        depth: d,
        updated_at: new Date().toISOString()
      })
      .eq('sku', sku)
      .select();

    if (invError) {
      console.error(`[Reassign DEBUG] Inventory update error for SKU ${sku}:`, invError);
      throw invError;
    }
    console.log(`[Reassign DEBUG] Inventory update successful for SKU ${sku}. Rows updated:`, invUpdate?.length || 0);

    // 2. We use 'item_note' to store the persistent box_code override
    // since the schema cache shows 'box_code' is missing from the table.
    const { data: mapUpdate, error: mapError } = await db
      .from('sku_asin_mapping')
      .update({
        item_note: newBoxCode,
        updated_at: new Date().toISOString()
      })
      .eq('seller_sku', sku)
      .select();

    if (mapError) {
      console.warn(`[Reassign DEBUG] Could not update sku_asin_mapping for ${sku}, but inventory updated. Error:`, mapError);
    } else {
      console.log(`[Reassign DEBUG] sku_asin_mapping (item_note) update successful for SKU ${sku}. Rows updated:`, mapUpdate?.length || 0);
    }

    return json({ 
      success: true, 
      details: { 
        inventoryUpdated: !!invUpdate?.length, 
        mappingUpdated: !!mapUpdate?.length 
      } 
    });
  } catch (error: any) {
    console.error('Reassign box error:', error);
    return json({ error: error.message }, { status: 500 });
  }
}
