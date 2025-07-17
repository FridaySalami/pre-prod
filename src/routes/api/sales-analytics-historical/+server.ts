import { json } from '@sveltejs/kit';
import { db } from '../../../lib/supabaseServer.js';
import type { RequestHandler } from '@sveltejs/kit';

interface HistoricalSalesData {
  id: number;
  reporting_month: string;
  sku: string;
  parent_asin?: string;
  child_asin?: string;
  title?: string;
  units_ordered: number;
  ordered_product_sales: number;
  sessions_total: number;
  unit_session_percentage: number;
  buy_box_percentage: number;
  sessions_mobile?: number;
  sessions_browser?: number;
  page_views_total?: number;
}

interface TrendData {
  sku: string;
  current_month: any;
  previous_month: any;
  units_trend: number;
  revenue_trend: number;
  sessions_trend: number;
  buy_box_trend: number;
}

interface MonthlyComparison {
  month: string;
  total_products: number;
  total_units: number;
  total_revenue: number;
  total_sessions: number;
  avg_buy_box_percentage: number;
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    const searchTerm = url.searchParams.get('search') || '';
    const searchType = url.searchParams.get('type') || 'all';
    const analysisType = url.searchParams.get('analysis') || 'current'; // 'current', 'trends', 'comparison'
    const timeframe = url.searchParams.get('timeframe') || '6'; // months back
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const supabase = db;

    switch (analysisType) {
      case 'trends':
        return await getTrendAnalysis(supabase, searchTerm, searchType, timeframe, limit, offset);

      case 'comparison':
        return await getMonthlyComparison(supabase, timeframe);

      case 'performance':
        return await getPerformanceAnalysis(supabase, searchTerm, searchType, timeframe);

      default:
        return await getCurrentMonthData(supabase, searchTerm, searchType, limit, offset);
    }

  } catch (error) {
    console.error('Historical sales analytics API error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

async function getCurrentMonthData(supabase: any, searchTerm: string, searchType: string, limit: number, offset: number) {
  // Get latest month data with enhanced insights
  let query = supabase
    .from('historical_sales_data')
    .select('*')
    .eq('reporting_month', supabase.raw('(SELECT MAX(reporting_month) FROM historical_sales_data)'))
    .range(offset, offset + limit - 1);

  // Apply search filters
  if (searchTerm) {
    query = applySearchFilters(query, searchTerm, searchType);
  }

  query = query.order('units_ordered', { ascending: false });

  const { data, error } = await query;

  if (error) {
    return json({ error: 'Failed to fetch current month data' }, { status: 500 });
  }

  // Get summary with trends
  const summary = await calculateEnhancedSummary(supabase, searchTerm, searchType);

  return json({
    data: data || [],
    summary,
    insights: await generateInsights(supabase, data || []),
    pagination: {
      offset,
      limit,
      hasMore: data && data.length === limit
    }
  });
}

async function getTrendAnalysis(supabase: any, searchTerm: string, searchType: string, timeframe: string, limit: number, offset: number) {
  // Get trend data comparing current vs previous months
  const monthsBack = parseInt(timeframe);

  const { data: trendData, error } = await supabase.rpc('get_product_trends', {
    months_back: monthsBack,
    search_term: searchTerm,
    search_type: searchType,
    limit_count: limit,
    offset_count: offset
  });

  if (error) {
    console.error('Trend analysis error:', error);
    return json({ error: 'Failed to fetch trend data' }, { status: 500 });
  }

  return json({
    data: trendData || [],
    type: 'trends',
    timeframe: monthsBack,
    insights: await generateTrendInsights(trendData || [])
  });
}

async function getMonthlyComparison(supabase: any, timeframe: string) {
  const monthsBack = parseInt(timeframe);

  const { data: comparisonData, error } = await supabase
    .from('monthly_sales_summary')
    .select('*')
    .gte('reporting_month', supabase.raw(`NOW() - INTERVAL '${monthsBack} months'`))
    .order('reporting_month', { ascending: true });

  if (error) {
    return json({ error: 'Failed to fetch comparison data' }, { status: 500 });
  }

  // Calculate month-over-month changes
  const enrichedData = calculateMonthOverMonthChanges(comparisonData || []);

  return json({
    data: enrichedData,
    type: 'comparison',
    insights: await generateComparisonInsights(enrichedData)
  });
}

async function getPerformanceAnalysis(supabase: any, searchTerm: string, searchType: string, timeframe: string) {
  // Get top/bottom performers with detailed analytics
  const { data: topPerformers, error: topError } = await supabase.rpc('get_top_performers', {
    months_back: parseInt(timeframe),
    metric: 'revenue'
  });

  const { data: bottomPerformers, error: bottomError } = await supabase.rpc('get_bottom_performers', {
    months_back: parseInt(timeframe),
    metric: 'revenue'
  });

  if (topError || bottomError) {
    return json({ error: 'Failed to fetch performance data' }, { status: 500 });
  }

  return json({
    topPerformers: topPerformers || [],
    bottomPerformers: bottomPerformers || [],
    type: 'performance',
    insights: await generatePerformanceInsights(topPerformers || [], bottomPerformers || [])
  });
}

function applySearchFilters(query: any, searchTerm: string, searchType: string) {
  switch (searchType) {
    case 'sku':
      return query.ilike('sku', `%${searchTerm}%`);
    case 'asin':
      return query.or(`parent_asin.ilike.%${searchTerm}%,child_asin.ilike.%${searchTerm}%`);
    case 'title':
      return query.ilike('title', `%${searchTerm}%`);
    default:
      return query.or(`sku.ilike.%${searchTerm}%,parent_asin.ilike.%${searchTerm}%,child_asin.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%`);
  }
}

async function calculateEnhancedSummary(supabase: any, searchTerm: string, searchType: string) {
  // Get current month summary
  let currentQuery = supabase
    .from('historical_sales_data')
    .select('units_ordered, ordered_product_sales, sessions_total, buy_box_percentage')
    .eq('reporting_month', supabase.raw('(SELECT MAX(reporting_month) FROM historical_sales_data)'));

  if (searchTerm) {
    currentQuery = applySearchFilters(currentQuery, searchTerm, searchType);
  }

  const { data: currentData } = await currentQuery;

  // Get previous month for comparison
  let previousQuery = supabase
    .from('historical_sales_data')
    .select('units_ordered, ordered_product_sales, sessions_total, buy_box_percentage')
    .eq('reporting_month', supabase.raw('(SELECT MAX(reporting_month) FROM historical_sales_data WHERE reporting_month < (SELECT MAX(reporting_month) FROM historical_sales_data))'));

  if (searchTerm) {
    previousQuery = applySearchFilters(previousQuery, searchTerm, searchType);
  }

  const { data: previousData } = await previousQuery;

  return calculateSummaryWithTrends(currentData || [], previousData || []);
}

function calculateSummaryWithTrends(currentData: any[], previousData: any[]) {
  const current = {
    totalProducts: currentData.length,
    totalUnits: currentData.reduce((sum, item) => sum + (item.units_ordered || 0), 0),
    totalRevenue: currentData.reduce((sum, item) => sum + (item.ordered_product_sales || 0), 0),
    totalSessions: currentData.reduce((sum, item) => sum + (item.sessions_total || 0), 0),
    avgBuyBoxPercentage: currentData.length > 0
      ? currentData.reduce((sum, item) => sum + (item.buy_box_percentage || 0), 0) / currentData.length
      : 0
  };

  const previous = {
    totalProducts: previousData.length,
    totalUnits: previousData.reduce((sum, item) => sum + (item.units_ordered || 0), 0),
    totalRevenue: previousData.reduce((sum, item) => sum + (item.ordered_product_sales || 0), 0),
    totalSessions: previousData.reduce((sum, item) => sum + (item.sessions_total || 0), 0),
    avgBuyBoxPercentage: previousData.length > 0
      ? previousData.reduce((sum, item) => sum + (item.buy_box_percentage || 0), 0) / previousData.length
      : 0
  };

  return {
    ...current,
    trends: {
      unitsChange: previous.totalUnits > 0 ? ((current.totalUnits - previous.totalUnits) / previous.totalUnits) * 100 : 0,
      revenueChange: previous.totalRevenue > 0 ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100 : 0,
      sessionsChange: previous.totalSessions > 0 ? ((current.totalSessions - previous.totalSessions) / previous.totalSessions) * 100 : 0,
      buyBoxChange: previous.avgBuyBoxPercentage > 0 ? current.avgBuyBoxPercentage - previous.avgBuyBoxPercentage : 0
    }
  };
}

async function generateInsights(supabase: any, data: any[]) {
  // Generate actionable insights based on current data
  const insights = [];

  if (data.length > 0) {
    const topRevenue = data.slice(0, 5);
    const lowBuyBox = data.filter(item => (item.buy_box_percentage || 0) < 50);
    const highSessions = data.filter(item => (item.sessions_total || 0) > 1000);

    insights.push({
      type: 'success',
      title: 'Top Revenue Generators',
      message: `Your top 5 products generate ${((topRevenue.reduce((sum, item) => sum + (item.ordered_product_sales || 0), 0) / data.reduce((sum, item) => sum + (item.ordered_product_sales || 0), 0)) * 100).toFixed(1)}% of total revenue`
    });

    if (lowBuyBox.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Buy Box Opportunity',
        message: `${lowBuyBox.length} products have less than 50% Buy Box ownership - potential for improvement`
      });
    }

    if (highSessions.length > 0) {
      insights.push({
        type: 'info',
        title: 'High Traffic Products',
        message: `${highSessions.length} products receive over 1,000 sessions - monitor for conversion optimization`
      });
    }
  }

  return insights;
}

function generateTrendInsights(trendData: any[]) {
  // Generate insights for trend analysis
  return [
    {
      type: 'info',
      title: 'Trend Analysis',
      message: `Analyzing ${trendData.length} products for performance trends`
    }
  ];
}

function generateComparisonInsights(comparisonData: any[]) {
  // Generate insights for monthly comparison
  return [
    {
      type: 'info',
      title: 'Monthly Comparison',
      message: `Comparing ${comparisonData.length} months of data`
    }
  ];
}

function generatePerformanceInsights(topPerformers: any[], bottomPerformers: any[]) {
  // Generate insights for performance analysis
  return [
    {
      type: 'success',
      title: 'Performance Analysis',
      message: `Identified ${topPerformers.length} top performers and ${bottomPerformers.length} underperformers`
    }
  ];
}

function calculateMonthOverMonthChanges(data: any[]) {
  return data.map((month, index) => {
    if (index === 0) return { ...month, changes: {} };

    const previous = data[index - 1];
    return {
      ...month,
      changes: {
        unitsChange: ((month.total_units - previous.total_units) / previous.total_units) * 100,
        revenueChange: ((month.total_revenue - previous.total_revenue) / previous.total_revenue) * 100,
        sessionsChange: ((month.total_sessions - previous.total_sessions) / previous.total_sessions) * 100
      }
    };
  });
}
