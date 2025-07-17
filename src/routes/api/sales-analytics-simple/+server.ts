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
}

interface MonthlyComparison {
  month: string;
  totalProducts: number;
  totalUnits: number;
  totalRevenue: number;
  totalSessions: number;
  avgBuyBoxPercentage: number;
  growth_vs_previous: {
    units: number;
    revenue: number;
    sessions: number;
  };
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    const analysisType = url.searchParams.get('analysis') || 'current';
    const searchTerm = url.searchParams.get('search') || '';
    const searchType = url.searchParams.get('type') || 'all';
    const timeframe = parseInt(url.searchParams.get('timeframe') || '6');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const supabase = db;

    switch (analysisType) {
      case 'comparison':
        return await getMonthlyComparison(supabase, timeframe);

      case 'trends':
        return await getTrendAnalysis(supabase, searchTerm, searchType, limit, offset);

      default:
        return await getCurrentAnalysis(supabase, searchTerm, searchType, limit, offset);
    }

  } catch (error) {
    console.error('Historical sales analytics API error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

async function getCurrentAnalysis(supabase: any, searchTerm: string, searchType: string, limit: number, offset: number) {
  // Get current month data with comparison to previous month

  let query = supabase
    .from('historical_sales_data')
    .select('*')
    .order('reporting_month', { ascending: false })
    .order('units_ordered', { ascending: false })
    .limit(1); // Get latest month first

  const { data: latestMonthData } = await query;

  if (!latestMonthData || latestMonthData.length === 0) {
    return json({ error: 'No historical data found' }, { status: 404 });
  }

  const latestMonth = latestMonthData[0].reporting_month;

  // Now get the actual data for latest month with search and pagination
  let dataQuery = supabase
    .from('historical_sales_data')
    .select('*')
    .eq('reporting_month', latestMonth)
    .range(offset, offset + limit - 1);

  // Apply search filters
  if (searchTerm) {
    dataQuery = applySearchFilters(dataQuery, searchTerm, searchType);
  }

  dataQuery = dataQuery.order('units_ordered', { ascending: false });

  const { data, error } = await dataQuery;

  if (error) {
    return json({ error: 'Failed to fetch current data' }, { status: 500 });
  }

  // Get summary with trends
  const summary = await calculateSummaryWithTrends(supabase, latestMonth, searchTerm, searchType);
  const insights = generateInsights(data || []);

  return json({
    data: data || [],
    summary,
    insights,
    latestMonth,
    pagination: {
      offset,
      limit,
      hasMore: data && data.length === limit
    }
  });
}

async function getMonthlyComparison(supabase: any, monthsBack: number) {
  // Get monthly aggregated data
  const { data: monthlyData, error } = await supabase
    .from('historical_sales_data')
    .select(`
      reporting_month,
      sku,
      units_ordered,
      ordered_product_sales,
      sessions_total,
      buy_box_percentage
    `)
    .gte('reporting_month', supabase.raw(`NOW() - INTERVAL '${monthsBack} months'`))
    .order('reporting_month', { ascending: true });

  if (error) {
    return json({ error: 'Failed to fetch comparison data' }, { status: 500 });
  }

  // Group by month and calculate totals
  const monthlyComparison = groupByMonth(monthlyData || []);

  return json({
    data: monthlyComparison,
    type: 'comparison',
    insights: generateComparisonInsights(monthlyComparison)
  });
}

async function getTrendAnalysis(supabase: any, searchTerm: string, searchType: string, limit: number, offset: number) {
  // Get data for last 2 months to calculate trends
  const { data: trendData, error } = await supabase
    .from('historical_sales_data')
    .select('*')
    .gte('reporting_month', supabase.raw(`NOW() - INTERVAL '2 months'`))
    .order('reporting_month', { ascending: false })
    .order('units_ordered', { ascending: false });

  if (error) {
    return json({ error: 'Failed to fetch trend data' }, { status: 500 });
  }

  // Calculate trends for each product
  const trendsWithCalculations = calculateProductTrends(trendData || []);

  // Apply search and pagination
  let filteredTrends = trendsWithCalculations;
  if (searchTerm) {
    filteredTrends = filteredTrends.filter(item => {
      switch (searchType) {
        case 'sku':
          return item.sku.toLowerCase().includes(searchTerm.toLowerCase());
        case 'title':
          return item.title?.toLowerCase().includes(searchTerm.toLowerCase());
        default:
          return item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.title?.toLowerCase().includes(searchTerm.toLowerCase());
      }
    });
  }

  const paginatedTrends = filteredTrends.slice(offset, offset + limit);

  return json({
    data: paginatedTrends,
    type: 'trends',
    insights: generateTrendInsights(paginatedTrends),
    pagination: {
      offset,
      limit,
      hasMore: filteredTrends.length > offset + limit
    }
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

async function calculateSummaryWithTrends(supabase: any, latestMonth: string, searchTerm: string, searchType: string) {
  // Get current month summary
  let currentQuery = supabase
    .from('historical_sales_data')
    .select('units_ordered, ordered_product_sales, sessions_total, buy_box_percentage')
    .eq('reporting_month', latestMonth);

  if (searchTerm) {
    currentQuery = applySearchFilters(currentQuery, searchTerm, searchType);
  }

  const { data: currentData } = await currentQuery;

  // Get previous month data
  let previousQuery = supabase
    .from('historical_sales_data')
    .select('units_ordered, ordered_product_sales, sessions_total, buy_box_percentage')
    .lt('reporting_month', latestMonth)
    .order('reporting_month', { ascending: false })
    .limit(1000); // Get previous month data

  if (searchTerm) {
    previousQuery = applySearchFilters(previousQuery, searchTerm, searchType);
  }

  const { data: previousData } = await previousQuery;

  const current = calculateTotals(currentData || []);
  const previous = calculateTotals(previousData || []);

  return {
    ...current,
    trends: {
      unitsChange: previous.totalUnits > 0 ? ((current.totalUnits - previous.totalUnits) / previous.totalUnits) * 100 : 0,
      revenueChange: previous.totalRevenue > 0 ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100 : 0,
      sessionsChange: previous.totalSessions > 0 ? ((current.totalSessions - previous.totalSessions) / previous.totalSessions) * 100 : 0,
      buyBoxChange: current.avgBuyBoxPercentage - previous.avgBuyBoxPercentage
    }
  };
}

function calculateTotals(data: any[]) {
  return {
    totalProducts: data.length,
    totalUnits: data.reduce((sum, item) => sum + (item.units_ordered || 0), 0),
    totalRevenue: data.reduce((sum, item) => sum + (item.ordered_product_sales || 0), 0),
    totalSessions: data.reduce((sum, item) => sum + (item.sessions_total || 0), 0),
    avgBuyBoxPercentage: data.length > 0
      ? data.reduce((sum, item) => sum + (item.buy_box_percentage || 0), 0) / data.length
      : 0
  };
}

function groupByMonth(data: any[]): MonthlyComparison[] {
  const grouped: Record<string, any[]> = data.reduce((acc, item) => {
    const month = item.reporting_month;
    if (!acc[month]) {
      acc[month] = [];
    }
    acc[month].push(item);
    return acc;
  }, {});

  const result = Object.entries(grouped).map(([month, items]) => {
    const totals = calculateTotals(items);
    return {
      month,
      ...totals,
      growth_vs_previous: { units: 0, revenue: 0, sessions: 0 }
    };
  });

  // Calculate growth rates
  for (let i = 1; i < result.length; i++) {
    const current = result[i];
    const previous = result[i - 1];

    current.growth_vs_previous = {
      units: previous.totalUnits > 0 ? ((current.totalUnits - previous.totalUnits) / previous.totalUnits) * 100 : 0,
      revenue: previous.totalRevenue > 0 ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100 : 0,
      sessions: previous.totalSessions > 0 ? ((current.totalSessions - previous.totalSessions) / previous.totalSessions) * 100 : 0
    };
  }

  return result;
}

function calculateProductTrends(data: any[]) {
  const grouped: Record<string, any[]> = data.reduce((acc, item) => {
    if (!acc[item.sku]) {
      acc[item.sku] = [];
    }
    acc[item.sku].push(item);
    return acc;
  }, {});

  return Object.entries(grouped).map(([sku, items]) => {
    const sorted = items.sort((a, b) => new Date(b.reporting_month).getTime() - new Date(a.reporting_month).getTime());
    const current = sorted[0];
    const previous = sorted[1];

    return {
      sku,
      title: current.title,
      current_data: current,
      previous_data: previous,
      trends: {
        units: previous ? ((current.units_ordered - previous.units_ordered) / Math.max(previous.units_ordered, 1)) * 100 : 0,
        revenue: previous ? ((current.ordered_product_sales - previous.ordered_product_sales) / Math.max(previous.ordered_product_sales, 1)) * 100 : 0,
        sessions: previous ? ((current.sessions_total - previous.sessions_total) / Math.max(previous.sessions_total, 1)) * 100 : 0,
        buyBox: current.buy_box_percentage - (previous?.buy_box_percentage || 0)
      }
    };
  }).sort((a, b) => b.current_data.ordered_product_sales - a.current_data.ordered_product_sales);
}

function generateInsights(data: any[]) {
  const insights = [];

  if (data.length > 0) {
    const topRevenue = data.slice(0, 5);
    const topRevenuePercent = (topRevenue.reduce((sum, item) => sum + item.ordered_product_sales, 0) /
      data.reduce((sum, item) => sum + item.ordered_product_sales, 0)) * 100;

    insights.push({
      type: 'success',
      title: 'Revenue Concentration',
      message: `Top 5 products generate ${topRevenuePercent.toFixed(1)}% of total revenue`
    });

    const lowBuyBox = data.filter(item => item.buy_box_percentage < 50);
    if (lowBuyBox.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Buy Box Opportunity',
        message: `${lowBuyBox.length} products have less than 50% Buy Box ownership`
      });
    }

    const highTraffic = data.filter(item => item.sessions_total > 1000 && item.units_ordered < 10);
    if (highTraffic.length > 0) {
      insights.push({
        type: 'info',
        title: 'Conversion Opportunities',
        message: `${highTraffic.length} products have high traffic but low conversions`
      });
    }
  }

  return insights;
}

function generateComparisonInsights(data: MonthlyComparison[]) {
  const insights = [];

  if (data.length >= 2) {
    const latest = data[data.length - 1];
    const avgGrowth = data.slice(-3).reduce((sum, month) => sum + month.growth_vs_previous.revenue, 0) / 3;

    insights.push({
      type: avgGrowth > 0 ? 'success' : 'warning',
      title: 'Growth Trend',
      message: `Average revenue growth over last 3 months: ${avgGrowth.toFixed(1)}%`
    });
  }

  return insights;
}

function generateTrendInsights(data: any[]) {
  const insights = [];

  const growingProducts = data.filter(item => item.trends.revenue > 10).length;
  const decliningProducts = data.filter(item => item.trends.revenue < -10).length;

  if (growingProducts > 0) {
    insights.push({
      type: 'success',
      title: 'Growth Opportunities',
      message: `${growingProducts} products showing strong revenue growth (>10%)`
    });
  }

  if (decliningProducts > 0) {
    insights.push({
      type: 'warning',
      title: 'Attention Needed',
      message: `${decliningProducts} products showing significant revenue decline (>10%)`
    });
  }

  return insights;
}
