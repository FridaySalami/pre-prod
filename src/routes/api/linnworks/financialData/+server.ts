import { json } from '@sveltejs/kit';
import { getDailyFinancialData } from '$lib/server/financialService.server';
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
      const now = new Date();
      const currentDay = now.getDay();
      const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;

      start = new Date(now);
      start.setDate(now.getDate() - daysToMonday);
      start.setHours(0, 0, 0, 0);

      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
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

    // Get the financial data
    const financialResult = await getDailyFinancialData(start, end);
    const dailyFinancialData = financialResult.data;
    const isCached = financialResult.isCached;

    // Calculate summary information
    const summary = {
      totalSales: dailyFinancialData.reduce((sum, day) => sum + day.salesData.totalSales, 0),
      totalProfit: dailyFinancialData.reduce((sum, day) => sum + day.salesData.totalProfit, 0),
      totalOrders: dailyFinancialData.reduce((sum, day) => sum + day.salesData.orderCount, 0),
      averageOrderValue: dailyFinancialData.reduce((sum, day) => sum + day.salesData.averageOrderValue, 0) /
        (dailyFinancialData.length || 1),
      totalShipping: dailyFinancialData.reduce((sum, day) => sum + day.salesData.totalShipping, 0),
      totalDiscounts: dailyFinancialData.reduce((sum, day) => sum + day.salesData.totalDiscount, 0),
      // Channel specific sales totals
      amazonSales: dailyFinancialData.reduce((sum, day) => sum + day.salesData.amazonSales, 0),
      ebaySales: dailyFinancialData.reduce((sum, day) => sum + day.salesData.ebaySales, 0),
      shopifySales: dailyFinancialData.reduce((sum, day) => sum + day.salesData.shopifySales, 0),
      otherSales: dailyFinancialData.reduce((sum, day) => sum + day.salesData.otherSales, 0)
    };

    return json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      dailyData: dailyFinancialData,
      summary,
      isCached
    });
  } catch (error) {
    console.error('Error fetching financial data:', error);
    return json({
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
