import { json } from '@sveltejs/kit';
import { db } from '$lib/supabaseServer';

export async function GET({ url }) {
  const query = url.searchParams.get('q');

  if (!query || query.length < 2) {
    return json([]);
  }

  // 1. Try fetching from inventory first (faster, cleaner list)
  const { data: inventorySkus, error: invError } = await db
    .from('inventory')
    .select('sku')
    .ilike('sku', `%${query}%`)
    .limit(10);

  if (!invError && inventorySkus && inventorySkus.length > 0) {
    return json(inventorySkus.map((i) => i.sku));
  }

  // 2. Fallback to amazon_order_items for historical SKUs if not in inventory
  // Using .limit(50) on a large table with distinct can be slow, but let's try
  // We use a small limit to stop early.
  const { data: orderSkus, error: orderError } = await db
    .from('amazon_order_items')
    .select('seller_sku')
    .ilike('seller_sku', `%${query}%`)
    .limit(20);

  if (orderError) {
    console.error('Error searching SKUs:', orderError);
    return json([]);
  }

  // Dedup and return
  const uniqueSkus = Array.from(new Set(orderSkus.map((o) => o.seller_sku)));
  return json(uniqueSkus.slice(0, 10));
}
