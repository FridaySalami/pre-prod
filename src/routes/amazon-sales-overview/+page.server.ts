// Amazon Sales Overview - Daily totals across all products
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/supabaseAdmin';

export interface DailySalesData {
  date: string;
  totalRevenue: number;
  totalUnits: number;
  totalSessions: number;
  productCount: number;
}

export const load: PageServerLoad = async () => {
  try {
    console.log('📊 Loading Amazon sales overview...');

    // Get daily aggregated sales data for the last 30 days
    const { data: dailyData, error: dailyError } = await supabaseAdmin
      .from('amazon_sales_data')
      .select('report_date, ordered_product_sales, ordered_units, sessions')
      .gte('report_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('report_date', { ascending: true });

    if (dailyError) {
      console.error('Error fetching daily sales:', dailyError);
      console.error('Error details:', JSON.stringify(dailyError, null, 2));

      // Return empty data instead of throwing error
      return {
        chartData: [],
        summary: {
          totalRevenue: 0,
          totalUnits: 0,
          totalSessions: 0,
          avgDailyRevenue: 0,
          productCount: 0,
          daysWithData: 0
        }
      };
    }

    // If no data yet, return empty
    if (!dailyData || dailyData.length === 0) {
      console.log('ℹ️ No sales data found yet');
      return {
        chartData: [],
        summary: {
          totalRevenue: 0,
          totalUnits: 0,
          totalSessions: 0,
          avgDailyRevenue: 0,
          productCount: 0,
          daysWithData: 0
        }
      };
    }

    // Aggregate by date
    const dailyTotals = new Map<string, DailySalesData>();

    dailyData?.forEach((record: any) => {
      const date = record.report_date;
      const existing = dailyTotals.get(date) || {
        date,
        totalRevenue: 0,
        totalUnits: 0,
        totalSessions: 0,
        productCount: 0
      };

      existing.totalRevenue += parseFloat(record.ordered_product_sales || 0);
      existing.totalUnits += parseInt(record.ordered_units || 0);
      existing.totalSessions += parseInt(record.sessions || 0);
      existing.productCount += 1;

      dailyTotals.set(date, existing);
    });

    const chartData = Array.from(dailyTotals.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Calculate summary stats
    const totalRevenue = chartData.reduce((sum, day) => sum + day.totalRevenue, 0);
    const totalUnits = chartData.reduce((sum, day) => sum + day.totalUnits, 0);
    const totalSessions = chartData.reduce((sum, day) => sum + day.totalSessions, 0);
    const avgDailyRevenue = totalRevenue / (chartData.length || 1);

    // Get total number of unique products with sales data
    const { count: productCount } = await supabaseAdmin
      .from('amazon_sales_data')
      .select('asin', { count: 'exact', head: true })
      .gte('report_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    console.log(`✅ Loaded ${chartData.length} days of sales data`);

    return {
      chartData,
      summary: {
        totalRevenue,
        totalUnits,
        totalSessions,
        avgDailyRevenue,
        productCount: productCount || 0,
        daysWithData: chartData.length
      }
    };

  } catch (err) {
    console.error('Error loading Amazon sales overview:', err);
    throw error(500, 'Failed to load sales overview');
  }
};
