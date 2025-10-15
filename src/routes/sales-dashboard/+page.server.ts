// Server-side data loader for Sales Dashboard
// Implements server-side pagination, search, and filtering
// Uses materialized view for performance

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

export interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalProducts: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  showing: {
    from: number;
    to: number;
  };
}

export const load: PageServerLoad = async ({ url }) => {
  try {
    const supabase = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY);

    // Parse URL parameters for pagination, sorting, and search
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const pageSize = parseInt(url.searchParams.get('pageSize') || '50');
    const sortBy = url.searchParams.get('sortBy') || 'total_revenue';
    const sortDir = (url.searchParams.get('sortDir') || 'desc') as 'asc' | 'desc';
    const searchQuery = url.searchParams.get('search')?.trim() || '';
    const minRevenue = parseFloat(url.searchParams.get('minRevenue') || '0');

    // Validate pageSize
    const validPageSizes = [25, 50, 100, 250];
    const validatedPageSize = validPageSizes.includes(pageSize) ? pageSize : 50;

    // Validate sortBy
    const validSortColumns = [
      'asin', 'total_revenue', 'total_units', 'total_sessions',
      'total_page_views', 'avg_conversion', 'avg_buy_box', 'avg_price'
    ];
    const validatedSortBy = validSortColumns.includes(sortBy) ? sortBy : 'total_revenue';

    console.log(`📊 Loading sales dashboard: page=${page}, pageSize=${validatedPageSize}, sort=${validatedSortBy} ${sortDir}, search="${searchQuery}"`);

    // Calculate date range
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateFilter = thirtyDaysAgo.toISOString().split('T')[0];

    // Try to use materialized view first, fallback to aggregation
    let products: any[] = [];
    let totalCount = 0;
    let dataSource = 'unknown';

    try {
      // First, try to query the materialized view
      console.log('Attempting to query sales_dashboard_30d materialized view...');

      // If search query exists, find matching ASINs from product names first
      let matchingAsins: string[] = [];
      if (searchQuery) {
        console.log(`🔍 Searching for products matching: "${searchQuery}"`);
        const { data: searchResults, error: searchError } = await supabase
          .from('sku_asin_mapping')
          .select('asin1, item_name')
          .or(`asin1.ilike.%${searchQuery}%,item_name.ilike.%${searchQuery}%`);

        if (searchError) {
          console.error('Search error:', searchError);
        } else if (searchResults && searchResults.length > 0) {
          matchingAsins = searchResults.map((r: { asin1: string }) => r.asin1).filter(Boolean);
          console.log(`✅ Found ${matchingAsins.length} matching products`);
          console.log(`   First 3 matches:`, searchResults.slice(0, 3).map((r: { asin1: string; item_name: string }) => ({ asin: r.asin1, name: r.item_name })));
        }

        // If search provided but no matches found, return empty results
        if (matchingAsins.length === 0) {
          console.log('⚠️ No products found matching search query');
          return {
            products: [],
            pagination: {
              currentPage: page,
              pageSize: validatedPageSize,
              totalProducts: 0,
              totalPages: 0,
              hasNext: false,
              hasPrev: false,
              showing: { from: 0, to: 0 }
            },
            dateRange: {
              start: dateFilter,
              end: new Date().toISOString().split('T')[0]
            },
            filters: {
              search: searchQuery,
              minRevenue: minRevenue,
              sortBy: validatedSortBy,
              sortDir: sortDir
            },
            dataSource: 'no-results'
          };
        }
      }

      // Build the base query
      let countQuery = supabase
        .from('sales_dashboard_30d')
        .select('*', { count: 'exact', head: true });

      let dataQuery = supabase
        .from('sales_dashboard_30d')
        .select('*');

      // Apply search filter if provided (search in matched ASINs)
      if (searchQuery && matchingAsins.length > 0) {
        console.log(`🔍 Filtering by ${matchingAsins.length} matching ASINs:`, matchingAsins.slice(0, 5));
        countQuery = countQuery.in('asin', matchingAsins);
        dataQuery = dataQuery.in('asin', matchingAsins);
      } else if (searchQuery) {
        console.log('⚠️ Search query provided but no matching ASINs found');
      } else {
        console.log('ℹ️ No search query - showing all products');
      }

      // Apply minimum revenue filter
      if (minRevenue > 0) {
        countQuery = countQuery.gte('total_revenue', minRevenue);
        dataQuery = dataQuery.gte('total_revenue', minRevenue);
      }

      // Get total count
      const { count, error: countError } = await countQuery;

      if (countError) {
        throw new Error(`Materialized view not available: ${countError.message}`);
      }

      totalCount = count || 0;

      // Calculate offset
      const offset = (page - 1) * validatedPageSize;

      // Apply sorting and pagination with null handling
      // For descending sorts, we want nulls last (highest values first, nulls at bottom)
      // For ascending sorts, we want nulls last as well (lowest values first, nulls at bottom)
      const { data: viewData, error: viewError } = await dataQuery
        .order(validatedSortBy, { ascending: sortDir === 'asc', nullsFirst: false })
        .range(offset, offset + validatedPageSize - 1);

      if (viewError) {
        throw new Error(`Query failed: ${viewError.message}`);
      }

      products = viewData || [];
      dataSource = 'materialized-view';
      console.log(`✅ Using materialized view: ${products.length} products (${totalCount} total)`);

    } catch (viewError) {
      // Fallback to manual aggregation
      console.log(`⚠️ Materialized view unavailable, falling back to aggregation:`, viewError);
      const aggregated = await fetchAndAggregateData(supabase, dateFilter, searchQuery, minRevenue);

      totalCount = aggregated.length;

      // Sort in memory
      aggregated.sort((a, b) => {
        const aVal = a[validatedSortBy as keyof typeof a];
        const bVal = b[validatedSortBy as keyof typeof b];

        // Handle null/undefined values
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (sortDir === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });

      // Paginate in memory
      const offset = (page - 1) * validatedPageSize;
      products = aggregated.slice(offset, offset + validatedPageSize);
      dataSource = 'client-side-aggregation';
      console.log(`✅ Using aggregation: ${products.length} products on page ${page}`);
    }

    // Fetch product titles from sku_asin_mapping
    console.log('📝 Fetching product titles...');
    const asins = products.map(p => p.asin);

    if (asins.length > 0) {
      const { data: titleData, error: titleError } = await supabase
        .from('sku_asin_mapping')
        .select('asin1, item_name')
        .in('asin1', asins);

      if (titleError) {
        console.error('Failed to fetch product titles:', titleError);
      } else if (titleData) {
        const titleMap = new Map(titleData.map(row => [row.asin1, row.item_name]));
        products = products.map(product => ({
          ...product,
          item_name: titleMap.get(product.asin) || null
        }));
        console.log(`✅ Fetched ${titleData.length} product titles`);
      }
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / validatedPageSize);
    const showingFrom = totalCount > 0 ? (page - 1) * validatedPageSize + 1 : 0;
    const showingTo = Math.min(page * validatedPageSize, totalCount);

    const pagination: PaginationInfo = {
      currentPage: page,
      pageSize: validatedPageSize,
      totalProducts: totalCount,
      totalPages: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      showing: {
        from: showingFrom,
        to: showingTo
      }
    };

    return {
      products: products as SalesRecord[],
      pagination,
      dateRange: {
        start: dateFilter,
        end: new Date().toISOString().split('T')[0]
      },
      filters: {
        search: searchQuery,
        minRevenue: minRevenue,
        sortBy: validatedSortBy,
        sortDir: sortDir
      },
      dataSource
    };

  } catch (err) {
    console.error('Error loading sales dashboard:', err);
    throw error(500, `Failed to load sales data: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
};

/**
 * Fallback: Fetch and aggregate data manually
 */
async function fetchAndAggregateData(
  supabase: any,
  dateFilter: string,
  searchQuery: string,
  minRevenue: number
): Promise<SalesRecord[]> {
  console.log('Fetching all sales data for aggregation...');

  // If search query exists, find matching ASINs first
  let matchingAsins: string[] = [];
  if (searchQuery) {
    console.log(`🔍 Searching for products matching: "${searchQuery}"`);
    const { data: searchResults, error: searchError } = await supabase
      .from('sku_asin_mapping')
      .select('asin1, item_name')
      .or(`asin1.ilike.%${searchQuery}%,item_name.ilike.%${searchQuery}%`);

    if (!searchError && searchResults && searchResults.length > 0) {
      matchingAsins = searchResults.map((r: { asin1: string }) => r.asin1).filter(Boolean);
      console.log(`✅ Found ${matchingAsins.length} matching products`);
      console.log(`   First 3 matches:`, searchResults.slice(0, 3).map((r: { asin1: string; item_name: string }) => ({ asin: r.asin1, name: r.item_name })));
    } else {
      // No matches found
      console.log('⚠️ No products found matching search query');
      return [];
    }
  }

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
      hasMore = batch.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  console.log(`📦 Fetched ${allData.length} total sales records`);

  // Aggregate
  const aggregated = aggregateSalesData(allData);

  // Apply filters
  let filtered = aggregated;

  if (searchQuery && matchingAsins.length > 0) {
    filtered = filtered.filter(p => matchingAsins.includes(p.asin));
  }

  if (minRevenue > 0) {
    filtered = filtered.filter(p => p.total_revenue >= minRevenue);
  }

  return filtered;
}

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
      item_name: null, // Will be populated later from sku_asin_mapping
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
