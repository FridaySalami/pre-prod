import { json } from '@sveltejs/kit';
import { db } from '../../../lib/supabaseServer.js';
import type { RequestHandler } from './$types';

// Define the enhanced sales data type including SKUs with no sales
interface EnhancedSalesData {
  'Primary Key'?: number;
  'SKU': string;
  '(Parent) ASIN'?: string;
  '(Child) ASIN'?: string;
  'Title'?: string;
  'Units ordered': number;
  'Ordered Product Sales': string;
  'Sessions – Total': string;
  'Unit Session Percentage': string;
  'Featured Offer (Buy Box) percentage': string;
  'Sessions – Mobile app'?: string;
  'Sessions – Browser'?: string;
  'Page views – Total'?: string;
  // Additional fields from mapping
  'item-name'?: string;
  'item-description'?: string;
  'price'?: string;
  'status'?: string;
  'has_sales': boolean;
}

// Define the mapping table structure
interface SkuAsinMapping {
  'seller_sku': string;
  'item_name': string;
  'item_description': string;
  'asin1': string;
  'price': string;
  'status': string;
  'quantity': number;
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    const searchTerm = url.searchParams.get('search') || '';
    const searchType = url.searchParams.get('type') || 'all'; // 'sku', 'asin', 'title', or 'all'
    const includeNoSales = url.searchParams.get('includeNoSales') === 'true'; // New parameter
    const showOnlyNoSales = url.searchParams.get('showOnlyNoSales') === 'true'; // Show only SKUs with no sales
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const supabase = db;

    if (includeNoSales || showOnlyNoSales) {
      // Enhanced query that includes SKUs with no sales

      if (showOnlyNoSales) {
        // Show only SKUs from mapping that have no sales
        let mappingQuery = supabase
          .from('sku_asin_mapping')
          .select(`
            seller_sku,
            item_name,
            item_description,
            asin1,
            price,
            status,
            quantity
          `)
          .eq('status', 'Active')
          .range(offset, offset + limit - 1);

        // Apply search filters to mapping table
        if (searchTerm) {
          switch (searchType) {
            case 'sku':
              mappingQuery = mappingQuery.ilike('seller_sku', `%${searchTerm}%`);
              break;
            case 'asin':
              mappingQuery = mappingQuery.ilike('asin1', `%${searchTerm}%`);
              break;
            case 'title':
              mappingQuery = mappingQuery.ilike('item_name', `%${searchTerm}%`);
              break;
            case 'all':
            default:
              mappingQuery = mappingQuery.or(`seller_sku.ilike.%${searchTerm}%,asin1.ilike.%${searchTerm}%,item_name.ilike.%${searchTerm}%`);
              break;
          }
        }

        const { data: mappingData, error: mappingError } = await mappingQuery;

        if (mappingError) {
          console.error('Mapping error:', mappingError);
          return json({ error: 'Failed to fetch SKU mapping data' }, { status: 500 });
        }

        // Filter out SKUs that have sales by checking against sales table
        const skuList = mappingData?.map((item: any) => item['seller_sku']) || [];

        const { data: salesSkus, error: salesSkusError } = await supabase
          .from('sales_june')
          .select('SKU')
          .in('SKU', skuList);

        if (salesSkusError) {
          console.error('Sales SKU check error:', salesSkusError);
          return json({ error: 'Failed to check sales data' }, { status: 500 });
        }

        const skusWithSales = new Set(salesSkus?.map(item => item.SKU) || []);

        // Convert mapping data to enhanced format (SKUs with no sales only)
        const noSalesData: EnhancedSalesData[] = mappingData
          ?.filter((item: any) => !skusWithSales.has(item['seller_sku']))
          .map((item: any) => ({
            'SKU': item['seller_sku'] || '',
            '(Child) ASIN': item['asin1'] || '',
            'Title': item['item_name'] || '',
            'Units ordered': 0,
            'Ordered Product Sales': '£0.00',
            'Sessions – Total': '0',
            'Unit Session Percentage': '0%',
            'Featured Offer (Buy Box) percentage': '0%',
            'item-name': item['item_name'],
            'item-description': item['item_description'],
            'price': item['price'],
            'status': item['status'],
            'has_sales': false
          })) || [];

        const summary = {
          totalProducts: noSalesData.length,
          totalUnits: 0,
          totalRevenue: 0,
          totalSessions: 0,
          avgBuyBoxPercentage: 0,
          productsWithNoSales: noSalesData.length,
          productsWithSales: 0
        };

        return json({
          data: noSalesData,
          summary,
          pagination: {
            offset,
            limit,
            hasMore: noSalesData.length === limit
          },
          searchTerm,
          searchType,
          mode: 'no-sales-only'
        });

      } else {
        // Combined view: sales data + SKUs with no sales

        // First get sales data
        let salesQuery = supabase
          .from('sales_june')
          .select('*');

        // Apply search filters
        if (searchTerm) {
          switch (searchType) {
            case 'sku':
              salesQuery = salesQuery.ilike('SKU', `%${searchTerm}%`);
              break;
            case 'asin':
              salesQuery = salesQuery.or(`"(Parent) ASIN".ilike.%${searchTerm}%,"(Child) ASIN".ilike.%${searchTerm}%`);
              break;
            case 'title':
              salesQuery = salesQuery.ilike('Title', `%${searchTerm}%`);
              break;
            case 'all':
            default:
              salesQuery = salesQuery.or(`SKU.ilike.%${searchTerm}%,"(Parent) ASIN".ilike.%${searchTerm}%,"(Child) ASIN".ilike.%${searchTerm}%,Title.ilike.%${searchTerm}%`);
              break;
          }
        }

        const { data: salesData, error: salesError } = await salesQuery;

        if (salesError) {
          console.error('Sales error:', salesError);
          return json({ error: 'Failed to fetch sales data' }, { status: 500 });
        }

        // Get all SKUs from mapping table (active only)
        const { data: allMappingData, error: mappingError } = await supabase
          .from('sku_asin_mapping')
          .select(`
            seller_sku,
            item_name,
            item_description,
            asin1,
            price,
            status
          `)
          .eq('status', 'Active');

        if (mappingError) {
          console.error('Mapping error:', mappingError);
        }

        // Create sets for quick lookup
        const skusWithSales = new Set(salesData?.map(item => item.SKU) || []);
        const mappingBySku = new Map(
          allMappingData?.map((item: any) => [item['seller_sku'], item]) || []
        );

        // Convert sales data to enhanced format
        const enhancedSalesData: EnhancedSalesData[] = salesData?.map(item => ({
          ...item,
          'item-name': mappingBySku.get(item.SKU)?.['item_name'] || '',
          'item-description': mappingBySku.get(item.SKU)?.['item_description'] || '',
          'price': mappingBySku.get(item.SKU)?.['price'] || '',
          'status': mappingBySku.get(item.SKU)?.['status'] || '',
          'has_sales': true
        })) || [];

        // Add SKUs with no sales
        const noSalesData: EnhancedSalesData[] = allMappingData
          ?.filter((item: any) => !skusWithSales.has(item['seller_sku']))
          .map((item: any) => ({
            'SKU': item['seller_sku'] || '',
            '(Child) ASIN': item['asin1'] || '',
            'Title': item['item_name'] || '',
            'Units ordered': 0,
            'Ordered Product Sales': '£0.00',
            'Sessions – Total': '0',
            'Unit Session Percentage': '0%',
            'Featured Offer (Buy Box) percentage': '0%',
            'item-name': item['item_name'],
            'item-description': item['item_description'],
            'price': item['price'],
            'status': item['status'],
            'has_sales': false
          })) || [];

        // Combine and sort data
        const combinedData = [...enhancedSalesData, ...noSalesData];

        // Sort by sales performance (items with sales first, then by units ordered)
        combinedData.sort((a, b) => {
          if (a.has_sales && !b.has_sales) return -1;
          if (!a.has_sales && b.has_sales) return 1;
          return (b['Units ordered'] || 0) - (a['Units ordered'] || 0);
        });

        // Apply pagination
        const paginatedData = combinedData.slice(offset, offset + limit);

        // Calculate summary statistics
        const summary = {
          totalProducts: combinedData.length,
          totalUnits: enhancedSalesData.reduce((sum, item) => sum + (item['Units ordered'] || 0), 0),
          totalRevenue: enhancedSalesData.reduce((sum, item) => {
            const revenue = parseFloat(item['Ordered Product Sales']?.replace(/[£,]/g, '') || '0');
            return sum + revenue;
          }, 0),
          totalSessions: enhancedSalesData.reduce((sum, item) => {
            const sessions = parseInt(item['Sessions – Total']?.replace(/,/g, '') || '0');
            return sum + sessions;
          }, 0),
          avgBuyBoxPercentage: enhancedSalesData.length > 0 ?
            enhancedSalesData.reduce((sum, item) => {
              const buyBox = parseFloat(item['Featured Offer (Buy Box) percentage']?.replace('%', '') || '0');
              return sum + buyBox;
            }, 0) / enhancedSalesData.length : 0,
          productsWithSales: enhancedSalesData.length,
          productsWithNoSales: noSalesData.length
        };

        return json({
          data: paginatedData,
          summary,
          pagination: {
            offset,
            limit,
            hasMore: offset + limit < combinedData.length
          },
          searchTerm,
          searchType,
          mode: 'combined'
        });
      }

    } else {
      // Original sales-only query
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

      const { data, error } = await query;

      if (error) {
        console.error('Supabase error:', error);
        return json({ error: 'Failed to fetch sales data' }, { status: 500 });
      }

      // Calculate summary statistics for sales data only
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

      // Add has_sales flag to existing data
      const enhancedData = data?.map(item => ({
        ...item,
        has_sales: true
      })) || [];

      return json({
        data: enhancedData,
        summary,
        pagination: {
          offset,
          limit,
          hasMore: data && data.length === limit
        },
        searchTerm,
        searchType,
        mode: 'sales-only'
      });
    }

  } catch (error) {
    console.error('Sales analytics API error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
