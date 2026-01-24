import { db } from '$lib/supabaseServer';

export async function load({ url }) {
  const search = url.searchParams.get('q') || '';
  const missingCost = url.searchParams.get('missing_cost') === 'true';
  const shippingGroups = url.searchParams.get('shipping_groups')?.split(',') || [];
  const page = Number(url.searchParams.get('page')) || 1;
  const limit = 50;
  const offset = (page - 1) * limit;

  // Use linnworks_composition_summary as the primary source since it contains the active cost data
  // Since shipping group is in sku_asin_mapping, we need to filter differently if that filter is applied.
  // However, querying sku_asin_mapping first is tricky if we want to search on title (which is in linnworks_composition_summary).
  //
  // Option 1: Join them. If we can't join easily with Supabase client, we might need to change strategy.
  // But wait, the current logic fetches sku_asin_mapping separately.
  // If we want to filter by shipping group, we should probably query sku_asin_mapping first to get the SKUs
  // that match the shipping group, and then use that list of SKUs to filter linnworks_composition_summary.
  // This works if the result set from sku_asin_mapping isn't huge.
  //
  // Let's assume for now we can filter by SKUs if shipping_groups param is present.

  let items: any[] = [];
  let count = 0;

  if (shippingGroups.length > 0) {
    // Strategy for shipping group filter:
    // 1. Fetch ALL matching SKUs from sku_asin_mapping
    // 2. Chunk them to avoid URL length limits when querying details
    // 3. Fetch details from linnworks_composition_summary
    // 4. Perform search/missing_cost filtering and pagination in-memory

    const { data: shippingData } = await db
      .from('sku_asin_mapping')
      .select('seller_sku')
      .in('merchant_shipping_group', shippingGroups);

    const allMatchingSkus = shippingData?.map((s: any) => s.seller_sku) || [];

    if (allMatchingSkus.length === 0) {
      items = [];
      count = 0;
    } else {
      // Chunk requests to avoid "URI too long"
      const CHUNK_SIZE = 100;
      const chunks = [];
      for (let i = 0; i < allMatchingSkus.length; i += CHUNK_SIZE) {
        chunks.push(allMatchingSkus.slice(i, i + CHUNK_SIZE));
      }

      let allDetails: any[] = [];
      // Run chunk queries in parallel
      await Promise.all(chunks.map(async (chunk) => {
        const { data } = await db
          .from('linnworks_composition_summary')
          .select('parent_sku, parent_title, total_value, child_vats')
          .in('parent_sku', chunk);

        if (data) allDetails.push(...data);
      }));

      // Apply filters in memory
      let filtered = allDetails;

      if (search) {
        const lowerSearch = search.toLowerCase();
        filtered = filtered.filter(item =>
          (item.parent_sku?.toLowerCase().includes(lowerSearch)) ||
          (item.parent_title?.toLowerCase().includes(lowerSearch))
        );
      }

      if (missingCost) {
        filtered = filtered.filter(item => item.total_value === null || item.total_value === 0);
      }

      // Sort by SKU
      filtered.sort((a, b) => (a.parent_sku || '').localeCompare(b.parent_sku || ''));

      // Pagination
      count = filtered.length;
      items = filtered.slice(offset, offset + limit);
    }

  } else {
    // Standard server-side filtering when NO shipping group selected
    let query = db
      .from('linnworks_composition_summary')
      .select('parent_sku, parent_title, total_value, child_vats', { count: 'exact' });

    if (search) {
      query = query.or(`parent_sku.ilike.%${search}%,parent_title.ilike.%${search}%`);
    }

    if (missingCost) {
      query = query.or('total_value.is.null,total_value.eq.0');
    }

    query = query
      .order('parent_sku', { ascending: true })
      .range(offset, offset + limit - 1);

    const result = await query;
    if (result.error) {
      console.error('Error fetching data for cost manager:', result.error);
      return { items: [], total: 0 };
    }
    items = result.data || [];
    count = result.count || 0;
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
    missingCost,
    shippingGroups,
    page,
    limit,
  };
}
