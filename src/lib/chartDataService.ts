// chartDataService.ts
import { supabase } from './supabaseClient';

export interface DailyMetricReviewData {
  date: string;
  total_sales: number;
  amazon_sales: number;
  ebay_sales: number;
  shopify_sales: number;
  linnworks_total_orders: number;
  labor_efficiency?: number;
  actual_hours_worked?: number;
  amazon_orders_percent?: number;
  ebay_orders_percent?: number;
  shopify_orders_percent?: number;
  linnworks_amazon_orders?: number;
  linnworks_ebay_orders?: number;
  linnworks_shopify_orders?: number;
}

/**
 * Fetch daily metric review data from Supabase
 * @param daysBack Number of days to fetch (default: 30)
 * @returns Promise<DailyMetricReviewData[]>
 */
export async function fetchDailyMetricData(daysBack: number = 30): Promise<DailyMetricReviewData[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const dateStr = startDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_metric_review')
      .select('*')
      .gte('date', dateStr)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching daily metric data:', error);
      throw error;
    }

    return data || [];
  } catch (err) {
    console.error('Failed to fetch daily metric data:', err);
    throw err;
  }
}

/**
 * Fetch daily metric data for a specific date range
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 * @returns Promise<DailyMetricReviewData[]>
 */
export async function fetchDailyMetricDataRange(
  startDate: string,
  endDate: string
): Promise<DailyMetricReviewData[]> {
  try {
    const { data, error } = await supabase
      .from('daily_metric_review')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching daily metric data range:', error);
      throw error;
    }

    return data || [];
  } catch (err) {
    console.error('Failed to fetch daily metric data range:', err);
    throw err;
  }
}

/**
 * Get sample data for testing/fallback
 * @returns DailyMetricReviewData[]
 */
export function getSampleMetricData(): DailyMetricReviewData[] {
  const sampleData: DailyMetricReviewData[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 14); // Last 2 weeks

  for (let i = 0; i < 14; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    // Generate realistic sample data
    const baseAmazon = 8000 + Math.random() * 4000;
    const baseEbay = 3000 + Math.random() * 3000;
    const baseShopify = 2000 + Math.random() * 2000;

    sampleData.push({
      date: date.toISOString().split('T')[0],
      total_sales: Math.round(baseAmazon + baseEbay + baseShopify),
      amazon_sales: Math.round(baseAmazon),
      ebay_sales: Math.round(baseEbay),
      shopify_sales: Math.round(baseShopify),
      linnworks_total_orders: Math.round(100 + Math.random() * 100),
      labor_efficiency: Math.round((10 + Math.random() * 10) * 10) / 10,
      actual_hours_worked: Math.round((7 + Math.random() * 3) * 10) / 10,
      linnworks_amazon_orders: Math.round(50 + Math.random() * 50),
      linnworks_ebay_orders: Math.round(30 + Math.random() * 40),
      linnworks_shopify_orders: Math.round(20 + Math.random() * 30)
    });
  }

  return sampleData;
}

/**
 * Calculate summary statistics from daily metric data
 * @param data Array of daily metric data
 * @returns Object with summary statistics
 */
export function calculateMetricSummary(data: DailyMetricReviewData[]) {
  if (data.length === 0) {
    return {
      totalSales: 0,
      totalOrders: 0,
      averageDailySales: 0,
      averageDailyOrders: 0,
      averageLaborEfficiency: 0,
      channelBreakdown: {
        amazon: { total: 0, percentage: 0 },
        ebay: { total: 0, percentage: 0 },
        shopify: { total: 0, percentage: 0 }
      }
    };
  }

  const totalSales = data.reduce((sum, item) => sum + item.total_sales, 0);
  const totalOrders = data.reduce((sum, item) => sum + item.linnworks_total_orders, 0);
  const amazonTotal = data.reduce((sum, item) => sum + item.amazon_sales, 0);
  const ebayTotal = data.reduce((sum, item) => sum + item.ebay_sales, 0);
  const shopifyTotal = data.reduce((sum, item) => sum + item.shopify_sales, 0);

  const efficiencyData = data.filter(item => item.labor_efficiency && item.labor_efficiency > 0);
  const averageLaborEfficiency = efficiencyData.length > 0
    ? efficiencyData.reduce((sum, item) => sum + (item.labor_efficiency || 0), 0) / efficiencyData.length
    : 0;

  return {
    totalSales,
    totalOrders,
    averageDailySales: totalSales / data.length,
    averageDailyOrders: totalOrders / data.length,
    averageLaborEfficiency,
    channelBreakdown: {
      amazon: {
        total: amazonTotal,
        percentage: totalSales > 0 ? (amazonTotal / totalSales) * 100 : 0
      },
      ebay: {
        total: ebayTotal,
        percentage: totalSales > 0 ? (ebayTotal / totalSales) * 100 : 0
      },
      shopify: {
        total: shopifyTotal,
        percentage: totalSales > 0 ? (shopifyTotal / totalSales) * 100 : 0
      }
    }
  };
}

/**
 * Format currency for UK market
 * @param value Amount in pence
 * @param compact Whether to use compact notation (K, M)
 * @returns Formatted currency string
 */
export function formatCurrency(value: number, compact: boolean = false): string {
  const formatter = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? 'compact' : 'standard'
  });

  return formatter.format(value);
}

/**
 * Format percentage with specified decimal places
 * @param value Percentage value (0-100)
 * @param decimals Number of decimal places
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}
