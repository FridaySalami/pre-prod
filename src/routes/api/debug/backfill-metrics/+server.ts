
import { json } from '@sveltejs/kit';
import { getDailyFinancialData } from '$lib/server/financialService.server';
import { getDailyOrderCounts } from '$lib/server/processedOrdersService.server';
import { supabaseAdmin } from '$lib/supabaseAdmin';

export async function POST({ request }) {
  try {
    const { startDate, endDate } = await request.json();

    if (!startDate || !endDate) {
      return json({ error: 'Missing startDate or endDate' }, { status: 400 });
    }

    console.log(`Backfilling metrics from ${startDate} to ${endDate}`);

    const start = new Date(startDate);
    const end = new Date(endDate);

    // 1. Fetch Financial Data (Linnworks)
    const financialData = await getDailyFinancialData(start, end);

    // 2. Fetch Order Counts (Linnworks)
    const orderData = await getDailyOrderCounts(start, end);

    // 3. Update Database
    const results = [];

    // Iterate through each day in the range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      // Find matching data
      const dayFinancial = financialData.data.find(f => f.date === dateStr);
      const dayOrders = orderData.data.find(o => o.date === dateStr);

      if (dayFinancial) {
        const updateData = {
          date: dateStr,
          total_sales: dayFinancial.salesData.totalSales || 0,
          amazon_sales: dayFinancial.salesData.amazonSales || 0,
          ebay_sales: dayFinancial.salesData.ebaySales || 0,
          shopify_sales: dayFinancial.salesData.shopifySales || 0,
          linnworks_total_orders: dayOrders?.totalOrders || dayFinancial.salesData.orderCount || 0,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabaseAdmin
          .from('daily_metric_review')
          .upsert(updateData, { onConflict: 'date' });

        if (error) {
          console.error(`Error updating ${dateStr}:`, error);
          results.push({ date: dateStr, status: 'error', error });
        } else {
          results.push({ date: dateStr, status: 'success' });
        }
      } else {
        results.push({ date: dateStr, status: 'no_data' });
      }
    }

    return json({ success: true, results });

  } catch (error) {
    console.error('Backfill error:', error);
    return json({ error: error.message }, { status: 500 });
  }
}
