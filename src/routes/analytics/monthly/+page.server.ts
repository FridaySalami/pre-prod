import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_SERVICE_KEY } from '$env/static/private';

// TypeScript interface for the daily metric review data
interface DailyMetricData {
  date: string;
  total_sales: number;
  amazon_sales: number;
  ebay_sales: number;
  shopify_sales: number;
  linnworks_total_orders: number;
  linnworks_amazon_orders: number;
  linnworks_ebay_orders: number;
  linnworks_shopify_orders: number;
  amazon_orders_percent: number;
  ebay_orders_percent: number;
  shopify_orders_percent: number;
  actual_hours_worked: number;
  labor_efficiency: number;
}

export async function load({ url }) {
  console.log('Environment check:', {
    url: PUBLIC_SUPABASE_URL,
    keyExists: !!PRIVATE_SUPABASE_SERVICE_KEY
  });

  if (!PUBLIC_SUPABASE_URL || !PRIVATE_SUPABASE_SERVICE_KEY) {
    console.error('Missing Supabase configuration');
    return {
      monthlyData: null,
      dailyData: [],
      error: 'Missing Supabase configuration',
      selectedYear: new Date().getFullYear(),
      selectedMonth: new Date().getMonth() + 1,
      usingFallback: false,
      dataSource: null
    };
  }

  const supabase = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY);

  // Get year and month from URL params, default to current month
  const year = url.searchParams.get('year') ? parseInt(url.searchParams.get('year')!) : new Date().getFullYear();
  const month = url.searchParams.get('month') ? parseInt(url.searchParams.get('month')!) : new Date().getMonth() + 1;

  console.log(`Loading data for ${year}-${month.toString().padStart(2, '0')}`);

  // Calculate date range for the month
  const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

  console.log(`Date range: ${startDate} to ${endDate}`);

  try {
    // First, let's check what data exists in the table
    const { data: allData, error: allError } = await supabase
      .from('daily_metric_review')
      .select('date')
      .order('date');

    if (allError) {
      console.error('Error checking available data:', allError);
    } else {
      console.log(`Found ${allData?.length || 0} total records in daily_metric_review table`);
      if (allData && allData.length > 0) {
        const dates = allData.map(d => d.date).sort();
        console.log(`Date range in table: ${dates[0]} to ${dates[dates.length - 1]}`);
      }
    }

    // Fetch daily data for the month from daily_metric_review first
    let { data: dailyData, error } = await supabase
      .from('daily_metric_review')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date');

    console.log(`daily_metric_review result: ${dailyData?.length || 0} records found for requested month`);

    if (error) {
      console.error('Error fetching from daily_metric_review:', error);
      return {
        monthlyData: null,
        dailyData: [],
        error: `Database error: ${error.message}`,
        selectedYear: year,
        selectedMonth: month,
        usingFallback: false,
        dataSource: null
      };
    }

    // If no data in daily_metric_review, return empty result
    if (!dailyData || dailyData.length === 0) {
      console.log('No data found in daily_metric_review for the requested period');
      return {
        monthlyData: null,
        dailyData: [],
        error: null,
        selectedYear: year,
        selectedMonth: month,
        usingFallback: false,
        dataSource: 'daily_metric_review'
      };
    }

    // Log sample data for debugging
    if (dailyData && dailyData.length > 0) {
      console.log('Sample daily data:', dailyData[0]);
    }

    // Aggregate daily data into monthly summary
    const monthlyData = dailyData && dailyData.length > 0 ? {
      month: `${year}-${month.toString().padStart(2, '0')}`,
      totalSales: dailyData.reduce((sum, day) => sum + (day.total_sales || 0), 0),
      totalOrders: dailyData.reduce((sum, day) => sum + (day.linnworks_total_orders || 0), 0),
      amazonSales: dailyData.reduce((sum, day) => sum + (day.amazon_sales || 0), 0),
      ebaySales: dailyData.reduce((sum, day) => sum + (day.ebay_sales || 0), 0),
      shopifySales: dailyData.reduce((sum, day) => sum + (day.shopify_sales || 0), 0),
      // Fix labor efficiency calculation by excluding zero values (Sundays and non-working days)
      laborEfficiency: (() => {
        const workingDays = dailyData.filter(day => (day.labor_efficiency || 0) > 0);
        return workingDays.length > 0
          ? workingDays.reduce((sum, day) => sum + (day.labor_efficiency || 0), 0) / workingDays.length
          : 0;
      })(),
      daysWithData: dailyData.length
    } : null;

    console.log('Aggregated monthly data:', monthlyData);

    return {
      monthlyData,
      dailyData: dailyData || [],
      error: null,
      selectedYear: year,
      selectedMonth: month,
      usingFallback: false,
      dataSource: 'daily_metric_review'
    };

  } catch (err) {
    console.error('Server error fetching monthly data:', err);
    return {
      monthlyData: null,
      dailyData: [],
      error: 'Server error fetching data',
      selectedYear: year,
      selectedMonth: month,
      usingFallback: false,
      dataSource: null
    };
  }
}
