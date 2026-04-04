import { supabaseAdmin } from '$lib/supabase/supabaseAdmin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  // Fetch monitored SKUs first
  const { data: monitored, error: monitoredError } = await supabaseAdmin
    .from('monitored_top_100_skus')
    .select('*')
    .order('rank', { ascending: true })
    .limit(300); // Increased from 100 to handle the larger SKU list

  console.log('--- BUY BOX MONITOR DEBUG ---');
  console.log('Monitored SKUs count:', monitored?.length || 0);

  // Fetch current status
  const { data: current, error: currentError } = await supabaseAdmin
    .from('top_100_buy_box_current')
    .select('*');

  // Fetch sales for the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 31);

  // Aggregation
  const salesMap: Record<string, number> = {};
  
  console.log('--- STARTING SALES AGGREGATION (DATE BATCHED) ---');
  
  // We'll fetch in 32 batches of 1 day to cover ~30 days with a higher aggregate limit
  // Selling 500/day means ~15k rows for 30 days. Daily batches are safest.
  const daysToFetch = 31;
  let totalRows = 0;

  for (let i = 0; i < daysToFetch; i++) {
    const start = new Date();
    start.setDate(start.getDate() - (i + 1));
    const end = new Date();
    end.setDate(end.getDate() - i);

    const { data: batch, error: batchError } = await supabaseAdmin
      .from('amazon_order_items')
      .select('seller_sku, quantity_ordered')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .limit(1000); // This covers up to 1000 items PER DAY

    if (batchError) {
      console.error(`Batch for day -${i} error:`, batchError);
      continue;
    }

    if (batch) {
      totalRows += batch.length;
      batch.forEach(item => {
        if (item.seller_sku) {
          const sku = item.seller_sku.trim();
          salesMap[sku] = (salesMap[sku] || 0) + (item.quantity_ordered || 0);
        }
      });
    }
  }

  console.log(`Total rows processed across daily batches: ${totalRows}`);
  console.log(`Unique SKUs with sales: ${Object.keys(salesMap).length}`);

  // Step 2: Fetch product titles from our existing catalog cache via ASIN
  const { data: catalog } = await supabaseAdmin
    .from('amazon_catalog_cache')
    .select('asin, title')
    .in('asin', (monitored || []).map(m => m.asin).filter(Boolean));

  const catalogMap = new Map(catalog?.map(c => [c.asin, c.title]) || []);

  // Step 3: Manual join for dashboard
  const currentStatus = (monitored || []).map(m => {
    const skuKey = m.sku?.trim();
    const currentItem = current?.find(c => c.sku?.trim() === skuKey);
    const asin = currentItem?.asin || m.asin;
    
    let sales = 0;
    if (skuKey) {
      sales = salesMap[skuKey] || 0;
      // Also try case-insensitive
      if (sales === 0) {
        const foundKey = Object.keys(salesMap).find(k => k.toLowerCase() === skuKey.toLowerCase());
        if (foundKey) sales = salesMap[foundKey];
      }
    }

    // Determine the best name:
    // 1. Catalog Cache (via ASIN)
    // 2. Monitored Table specifically seeded name (IF NOT JUST THE SKU)
    // 3. Current Table name (IF NOT JUST THE SKU)
    // 4. SKU as fallback
    let displayName = catalogMap.get(asin);
    
    if (!displayName) {
      // If we don't have a catalog name, check if the stored product_name is better than just the SKU
      if (m.product_name && m.product_name !== m.sku) {
        displayName = m.product_name;
      } else if (currentItem?.product_name && currentItem.product_name !== m.sku) {
        displayName = currentItem.product_name;
      } else {
        displayName = skuKey;
      }
    }

    return {
      ...m,
      product_name: displayName,
      asin: asin || 'PENDING_FETCH',
      ...(currentItem || { status: 'PENDING' }),
      sales30d: sales
    };
  })
    .sort((a, b) => (b.sales30d || 0) - (a.sales30d || 0))
    .map((item, index) => ({
      ...item,
      rank: index + 1 // Assign new rank based on sales volume
    }));

  console.log('Final merged items with sales > 0:', currentStatus.filter(i => i.sales30d > 0).length);
  console.log('--- END DEBUG ---');

  // Stats from the merged data
  const stats = {
    total: currentStatus.length,
    winning: currentStatus.filter(m => m.status === 'WINNING').length,
    losing: currentStatus.filter(m => m.status === 'LOSING').length,
    suppressed: currentStatus.filter(m => m.status === 'SUPPRESSED' || m.status === 'NO_FEATURED_OFFER').length,
    atRisk: currentStatus.filter(m => m.status === 'LOSING' || m.status === 'OUT_OF_STOCK').length,
  };

  // Check last run status
  const { data: lastRun } = await supabaseAdmin
    .from('buy_box_monitor_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  return {
    currentStatus: currentStatus || [],
    stats,
    lastRun,
    error: monitoredError?.message || currentError?.message || null
  };
};
