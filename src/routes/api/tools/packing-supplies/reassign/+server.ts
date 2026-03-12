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
    if (!sku || !newBoxCode) return json({ error: 'Missing fields' }, { status: 400 });

    const [w, h, d] = newBoxCode.split('x').map(n => parseFloat(n));

    // Update the inventory dimensions for this SKU
    const { error } = await db
      .from('inventory')
      .update({
        width: w,
        height: h,
        depth: d,
        updated_at: new Date().toISOString()
      })
      .eq('sku', sku);

    if (error) throw error;

    return json({ success: true });
  } catch (error: any) {
    console.error('Reassign box error:', error);
    return json({ error: error.message }, { status: 500 });
  }
}
