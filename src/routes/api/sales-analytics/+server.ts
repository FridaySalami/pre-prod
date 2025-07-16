import { json } from '@sveltejs/kit';
import { db } from '../../../lib/supabaseServer.js';
import type { RequestHandler } from './$types';

// Define the sales data type based on your CSV structure
interface SalesData {
  'Primary Key': number;
  'SKU': string;
  '(Parent) ASIN': string;
  '(Child) ASIN': string;
  'Title': string;
  'Units ordered': number;
  'Ordered Product Sales': string;
  'Sessions – Total': string;
  'Unit Session Percentage': string;
  'Featured Offer (Buy Box) percentage': string;
  'Sessions – Mobile app': string;
  'Sessions – Browser': string;
  'Page views – Total': string;
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    const searchTerm = url.searchParams.get('search') || '';
    const searchType = url.searchParams.get('type') || 'all'; // 'sku', 'asin', 'title', or 'all'
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Initialize Supabase
    const supabase = db;

    let query = supabase
      .from('sales_june')
      .select('*')
      .range(offset, offset + limit - 1);

    // Add search filters based on type
    if (searchTerm) {
      switch (searchType) {
        case 'sku':
          query = query.ilike('SKU', `%${searchTerm}%`);
          break;
        case 'asin':
          query = query.or(`"(Parent) ASIN".ilike.%${searchTerm}%,"(Child) ASIN".ilike.%${searchTerm}%`);
          break;
        case 'title':
          query = query.ilike('Title', `%${searchTerm}%`);
          break;
        case 'all':
        default:
          query = query.or(`SKU.ilike.%${searchTerm}%,"(Parent) ASIN".ilike.%${searchTerm}%,"(Child) ASIN".ilike.%${searchTerm}%,Title.ilike.%${searchTerm}%`);
          break;
      }
    }

    // Order by units ordered (descending) to show best performers first
    query = query.order('Units ordered', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return json({ error: 'Failed to fetch sales data' }, { status: 500 });
    }

    // Calculate summary statistics
    const summaryQuery = supabase
      .from('sales_june')
      .select('Units ordered, Ordered Product Sales, Sessions – Total, Featured Offer (Buy Box) percentage');

    // Apply same search filters to summary
    let summaryWithFilter = summaryQuery;
    if (searchTerm) {
      switch (searchType) {
        case 'sku':
          summaryWithFilter = summaryWithFilter.ilike('SKU', `%${searchTerm}%`);
          break;
        case 'asin':
          summaryWithFilter = summaryWithFilter.or(`"(Parent) ASIN".ilike.%${searchTerm}%,"(Child) ASIN".ilike.%${searchTerm}%`);
          break;
        case 'title':
          summaryWithFilter = summaryWithFilter.ilike('Title', `%${searchTerm}%`);
          break;
        case 'all':
        default:
          summaryWithFilter = summaryWithFilter.or(`SKU.ilike.%${searchTerm}%,"(Parent) ASIN".ilike.%${searchTerm}%,"(Child) ASIN".ilike.%${searchTerm}%,Title.ilike.%${searchTerm}%`);
          break;
      }
    }

    const { data: summaryData, error: summaryError } = await summaryWithFilter;

    let summary = {
      totalProducts: 0,
      totalUnits: 0,
      totalRevenue: 0,
      totalSessions: 0,
      avgBuyBoxPercentage: 0
    };

    if (!summaryError && summaryData) {
      summary.totalProducts = summaryData.length;
      summary.totalUnits = summaryData.reduce((sum: number, item: any) => {
        const units = parseInt(item['Units ordered']) || 0;
        return sum + units;
      }, 0);

      summary.totalRevenue = summaryData.reduce((sum: number, item: any) => {
        const revenue = parseFloat(item['Ordered Product Sales']?.replace(/[£,]/g, '') || '0');
        return sum + revenue;
      }, 0);

      summary.totalSessions = summaryData.reduce((sum: number, item: any) => {
        const sessions = parseInt(item['Sessions – Total']?.replace(/,/g, '') || '0');
        return sum + sessions;
      }, 0);

      const avgBuyBox = summaryData.reduce((sum: number, item: any) => {
        const buyBox = parseFloat(item['Featured Offer (Buy Box) percentage']?.replace('%', '') || '0');
        return sum + buyBox;
      }, 0);
      summary.avgBuyBoxPercentage = summaryData.length > 0 ? avgBuyBox / summaryData.length : 0;
    }

    return json({
      data: data || [],
      summary,
      pagination: {
        offset,
        limit,
        hasMore: data && data.length === limit
      },
      searchTerm,
      searchType
    });

  } catch (error) {
    console.error('Sales analytics API error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
