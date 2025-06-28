// Debug endpoint to test data fetching
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { HistoricalDataService } from '$lib/services/historicalDataService';

export async function GET() {
  try {
    console.log('🔍 Debug: Testing raw database query...');

    // Test raw database query
    const { data: rawData, error: rawError } = await supabase
      .from('daily_metric_review')
      .select('date, total_sales, amazon_sales, ebay_sales, shopify_sales')
      .order('date', { ascending: false })
      .limit(10);

    if (rawError) {
      console.error('Raw query error:', rawError);
      return json({ error: 'Database query failed', details: rawError });
    }

    console.log('🔍 Debug: Raw data sample:', rawData?.slice(0, 3));

    // Test HistoricalDataService
    console.log('🔍 Debug: Testing HistoricalDataService...');
    const weeklyData = await HistoricalDataService.fetchWeeklyData({
      metric: 'total_sales',
      count: 5
    });

    console.log('🔍 Debug: Weekly data result:', {
      hasData: !!weeklyData,
      dataPoints: weeklyData?.data?.length || 0,
      statistics: weeklyData?.statistics
    });

    return json({
      success: true,
      rawDataCount: rawData?.length || 0,
      rawDataSample: rawData?.slice(0, 5) || [],
      weeklyDataPoints: weeklyData?.data?.length || 0,
      weeklyData: weeklyData?.data || [],
      weeklyStatistics: weeklyData?.statistics
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return json({ error: 'Debug test failed', details: String(error) });
  }
}
