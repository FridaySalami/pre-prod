import { json } from '@sveltejs/kit';
import { db } from '$lib/supabaseServer';

export async function GET({ url }) {
  const query = url.searchParams.get('q');
  if (!query || query.length < 2) {
    return json({ items: [] });
  }

  // Search inventory for SKUs matching the query
  const { data: items, error } = await db
    .from('inventory')
    .select('sku, title, width, height, depth, weight')
    .ilike('sku', `%${query}%`)
    .limit(10);

  if (error) {
    console.error('Error searching inventory:', error);
    return json({ items: [] });
  }

  // Also fetch cost data for these items to be helpful
  const enrichedItems = await Promise.all(items.map(async (item) => {
    const { data: costData } = await db
      .from('linnworks_composition_summary')
      .select('total_value, child_vats')
      .eq('parent_sku', item.sku)
      .maybeSingle();

    let vatRate = 20;
    try {
      if (costData?.child_vats) {
        const vats = JSON.parse(costData.child_vats);
        vatRate = vats[0] || 20;
      }
    } catch (e) { }

    return {
      ...item,
      cost: costData?.total_value || 0,
      vatRate
    };
  }));

  return json({ items: enrichedItems });
}
