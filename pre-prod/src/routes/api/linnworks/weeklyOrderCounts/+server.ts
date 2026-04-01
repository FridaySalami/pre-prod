import { json } from '@sveltejs/kit';
import { getDailyOrderCounts, getCurrentWeekRange, getWeeklyProfitStats } from '$lib/server/processedOrdersService.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    // Check authentication
    const session = await locals.getSession();
    if (!session) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get date parameters or use current week as default
    let startDate = url.searchParams.get('startDate');
    let endDate = url.searchParams.get('endDate');

    let start: Date;
    let end: Date;

    if (!startDate || !endDate) {
      // Use current week if no dates provided
      const weekRange = getCurrentWeekRange();
      start = new Date(weekRange.fromDate);
      end = new Date(weekRange.toDate);
    } else {
      // Parse provided dates
      start = new Date(startDate);
      end = new Date(endDate);

      // Validate dates
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return json({
          error: "Invalid date format. Please use ISO format (YYYY-MM-DD)."
        }, { status: 400 });
      }
    }

    // Log the API call details
    console.log('Making Linnworks API call for date range:', {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    });

    // Get the order counts for each day in the range, including channel breakdown
    const orderCountsResult = await getDailyOrderCounts(start, end);
    const dailyOrders = orderCountsResult.data;
    const isCached = orderCountsResult.isCached;

    // Get profit stats
    const profitStats = await getWeeklyProfitStats(start, end);

    // Add summary information
    const summary = {
      totalOrders: dailyOrders.reduce((sum, day) => sum + day.count, 0),
      channelTotals: {
        amazon: dailyOrders.reduce((sum, day) => sum + (day.channels?.amazon || 0), 0),
        ebay: dailyOrders.reduce((sum, day) => sum + (day.channels?.ebay || 0), 0),
        shopify: dailyOrders.reduce((sum, day) => sum + (day.channels?.shopify || 0), 0),
        other: dailyOrders.reduce((sum, day) => sum + (day.channels?.other || 0), 0)
      },
      profitStats
    };

    return json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      dailyOrders,
      summary,
      isCached
    });
  } catch (error) {
    console.error('Error fetching weekly order counts:', error);
    return json({
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}