import { db } from '$lib/supabaseServer';

export async function load({ url }) {
  const search = url.searchParams.get('q') || '';
  const page = Number(url.searchParams.get('page')) || 1;
  const limit = 50;
  const offset = (page - 1) * limit;

  // Use linnworks_composition_summary as the primary source since it contains the active cost data
  let query = db
    .from('linnworks_composition_summary')
    .select('parent_sku, parent_title, total_value, child_vats')
    .order('parent_sku', { ascending: true })
    .range(offset, offset + limit - 1);

  if (search) {
    // Search by SKU or Title
    query = query.or(`parent_sku.ilike.%${search}%,parent_title.ilike.%${search}%`);
  }

  const { data: items, count, error } = await query;

  if (error) {
    console.error('Error fetching data for cost manager:', error);
    return { items: [], total: 0 };
  }

  // Fetch additional data manually to avoid join issues if FKs aren't set up
  const skus = items?.map((i: any) => i.parent_sku) || [];

  let shippingMap = new Map();
  let dimMap = new Map();

  if (skus.length > 0) {
    // Fetch shipping groups
    const { data: shippingData } = await db
      .from('sku_asin_mapping')
      .select('seller_sku, merchant_shipping_group')
      .in('seller_sku', skus);

    if (shippingData) {
      shippingData.forEach((s: any) => shippingMap.set(s.seller_sku, s.merchant_shipping_group));
    }

    // Fetch dimensions from inventory
    const { data: invData } = await db
      .from('inventory')
      .select('sku, width, height, depth, weight')
      .in('sku', skus);

    if (invData) {
      invData.forEach((i: any) => dimMap.set(i.sku, i));
    }
  }

  // Transform data for the UI
  const transformedItems = items?.map((item: any) => {
    let vatRates = [0];
    try {
      if (item.child_vats) {
        vatRates = JSON.parse(item.child_vats);
      }
    } catch (e) { /* ignore */ }

    const dim = dimMap.get(item.parent_sku) || {};

    return {
      sku: item.parent_sku,
      title: item.parent_title,
      width: dim.width || 0,
      height: dim.height || 0,
      depth: dim.depth || 0,
      weight: dim.weight || 0,
      merchant_shipping_group: shippingMap.get(item.parent_sku) || 'Off Amazon',
      total_value: item.total_value || 0,
      vat_rate: vatRates[0] ?? 0
    };
  }) || [];

  return {
    items: transformedItems,
    search,
    page,
    limit,
  };
}
