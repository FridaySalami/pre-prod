/**
 * Sales Summary API
 * 
 * Returns 30-day sales summary for a specific ASIN
 * Data comes from amazon_sales_data table (populated by daily cron job)
 * 
 * GET /api/sales/[asin]/summary
 * 
 * Response:
 * {
 *   asin: "B0087OSN0A",
 *   days: 30,
 *   totalRevenue: 1234.56,
 *   totalUnits: 45,
 *   totalSessions: 890,
 *   avgConversionRate: 5.06,
 *   avgBuyBoxPercentage: 85.3,
 *   avgSalesPrice: 27.43,
 *   latestData: { ... },
 *   oldestData: { ... }
 * }
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SalesProcessor } from '$lib/amazon/sales-processor';

export const GET: RequestHandler = async ({ params }) => {
  const { asin } = params;

  if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) {
    throw error(400, 'Invalid ASIN format');
  }

  try {
    const processor = new SalesProcessor();
    const summary = await processor.get30DaySummary(asin);

    if (!summary) {
      return json({
        asin,
        hasData: false,
        message: 'No sales data available for this ASIN in the last 30 days'
      });
    }

    return json({
      ...summary,
      hasData: true
    });

  } catch (err) {
    console.error('Failed to fetch sales summary:', err);
    throw error(500, 'Failed to fetch sales data');
  }
};
