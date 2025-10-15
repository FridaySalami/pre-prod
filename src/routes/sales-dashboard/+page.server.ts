// Server-side data loader for Sales Dashboard
// Fetches top 100 products by revenue from last 30 days

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_SERVICE_KEY } from '$env/static/private';

export interface SalesRecord {
  asin: string;
  parent_asin: string | null;
  item_name: string | null;
  total_revenue: number;
  total_units: number;
  total_sessions: number;
  total_page_views: number;
  avg_buy_box: number;
  avg_conversion: number;
  days_with_data: number;
  avg_price: number;
}

export const load: PageServerLoad = async () => {
  try {
    const supabase = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY);

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateFilter = thirtyDaysAgo.toISOString().split('T')[0];

    console.log(`📊 Fetching top sellers since ${dateFilter}`);

    // Fallback: Manual aggregation query (database function not implemented yet)
    console.log('Fetching all sales data for client-side aggregation...');

    // Fetch ALL data (no limit) by making multiple requests if needed
    let allData: any[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error: batchError } = await supabase
        .from('amazon_sales_data')
        .select('*')
        .gte('report_date', dateFilter)
        .range(from, from + batchSize - 1);

      if (batchError) {
        throw new Error(`Failed to fetch sales data: ${batchError.message}`);
      }

      if (batch && batch.length > 0) {
        allData = allData.concat(batch);
        from += batchSize;
        hasMore = batch.length === batchSize; // Continue if we got a full batch
      } else {
        hasMore = false;
      }
    }

    console.log(`📦 Fetched ${allData.length} total sales records, aggregating...`);

    // Aggregate in JavaScript
    const aggregated = aggregateSalesData(allData);

    console.log(`✅ Aggregated into ${aggregated.length} unique products`);

    // Fetch product titles from sku_asin_mapping table
    console.log('📝 Fetching product titles...');
    const asins = aggregated.map(p => p.asin);

    // Fetch titles in batches
    let productTitles = new Map<string, string>();
    const titleBatchSize = 1000;

    for (let i = 0; i < asins.length; i += titleBatchSize) {
      const batchAsins = asins.slice(i, i + titleBatchSize);
      const { data: titleData, error: titleError } = await supabase
        .from('sku_asin_mapping')
        .select('asin1, item_name')
        .in('asin1', batchAsins);

      if (titleError) {
        console.error('Failed to fetch product titles:', titleError);
      } else if (titleData) {
        titleData.forEach(row => {
          if (row.asin1 && row.item_name) {
            productTitles.set(row.asin1, row.item_name);
          }
        });
      }
    }

    console.log(`✅ Fetched ${productTitles.size} product titles`);

    // Merge titles into aggregated data
    const productsWithTitles = aggregated.map(product => ({
      ...product,
      item_name: productTitles.get(product.asin) || null
    }));

    return {
      products: productsWithTitles, // Return ALL products with titles
      dateRange: {
        start: dateFilter,
        end: new Date().toISOString().split('T')[0]
      },
      totalProducts: productsWithTitles.length,
      dataSource: 'client-side-aggregation'
    };

  } catch (err) {
    console.error('Error loading sales dashboard:', err);
    throw error(500, `Failed to load sales data: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
};

/**
 * Client-side aggregation fallback if database function doesn't exist
 */
function aggregateSalesData(rawData: any[]): SalesRecord[] {
  const grouped = new Map<string, {
    asin: string;
    parent_asin: string | null;
    revenue: number[];
    units: number[];
    sessions: number[];
    pageViews: number[];
    buyBox: number[];
    conversion: number[];
    days: number;
  }>();

  // Group by ASIN
  rawData.forEach(record => {
    const key = record.asin;
    if (!grouped.has(key)) {
      grouped.set(key, {
        asin: record.asin,
        parent_asin: record.parent_asin,
        revenue: [],
        units: [],
        sessions: [],
        pageViews: [],
        buyBox: [],
        conversion: [],
        days: 0
      });
    }

    const group = grouped.get(key)!;
    group.revenue.push(record.ordered_product_sales || 0);
    group.units.push(record.ordered_units || 0);
    group.sessions.push(record.sessions || 0);
    group.pageViews.push(record.page_views || 0);

    if (record.buy_box_percentage !== null && record.buy_box_percentage !== undefined) {
      group.buyBox.push(record.buy_box_percentage);
    }
    if (record.unit_session_percentage !== null && record.unit_session_percentage !== undefined) {
      group.conversion.push(record.unit_session_percentage);
    }

    group.days++;
  });

  // Calculate totals and averages
  const aggregated: SalesRecord[] = Array.from(grouped.values()).map(group => {
    const totalRevenue = group.revenue.reduce((sum, val) => sum + val, 0);
    const totalUnits = group.units.reduce((sum, val) => sum + val, 0);

    return {
      asin: group.asin,
      parent_asin: group.parent_asin,
      total_revenue: totalRevenue,
      total_units: totalUnits,
      total_sessions: group.sessions.reduce((sum, val) => sum + val, 0),
      total_page_views: group.pageViews.reduce((sum, val) => sum + val, 0),
      avg_buy_box: group.buyBox.length > 0
        ? group.buyBox.reduce((sum, val) => sum + val, 0) / group.buyBox.length
        : 0,
      avg_conversion: group.conversion.length > 0
        ? group.conversion.reduce((sum, val) => sum + val, 0) / group.conversion.length
        : 0,
      days_with_data: group.days,
      avg_price: totalUnits > 0 ? totalRevenue / totalUnits : 0
    };
  });

  // Sort by revenue descending
  return aggregated.sort((a, b) => b.total_revenue - a.total_revenue);
}
