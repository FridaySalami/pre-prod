
import { json } from '@sveltejs/kit';
import { getDailyFinancialData } from '$lib/server/financialService.server';
import { getDailyOrderCounts } from '$lib/server/processedOrdersService.server';
import { supabaseAdmin } from '$lib/supabaseAdmin';

export async function GET() {
  try {
    console.log('🔧 Starting November Mondays Fix...');

    // The Mondays to fix
    const mondays = ['2025-11-03', '2025-11-10', '2025-11-17', '2025-11-24'];
    const results = [];

    for (const dateStr of mondays) {
      console.log(`Processing ${dateStr}...`);

      // Create start and end dates for the full day
      const startDate = new Date(dateStr);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(dateStr);
      endDate.setHours(23, 59, 59, 999);

      console.log(`   Querying range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // Fetch data for this specific day with full time range
      const financialData = await getDailyFinancialData(startDate, endDate);
      const orderData = await getDailyOrderCounts(startDate, endDate);

      const dayFinancial = financialData.data.find(f => f.date === dateStr);
      const dayOrders = orderData.data.find(o => o.date === dateStr);

      if (dayFinancial) {
        const updateData = {
          date: dateStr,
          total_sales: dayFinancial.salesData.totalSales || 0,
          amazon_sales: dayFinancial.salesData.amazonSales || 0,
          ebay_sales: dayFinancial.salesData.ebaySales || 0,
          shopify_sales: dayFinancial.salesData.shopifySales || 0,
          linnworks_total_orders: dayOrders?.count || dayFinancial.salesData.orderCount || 0,
          updated_at: new Date().toISOString()
        };

        // Calculate percentages if we have orders
        if (updateData.linnworks_total_orders > 0) {
          const total = updateData.linnworks_total_orders;
          // Try to get channel counts from orderData first
          if (dayOrders?.channels) {
            updateData.amazon_orders_percent = (dayOrders.channels.amazon / total) * 100;
            updateData.ebay_orders_percent = (dayOrders.channels.ebay / total) * 100;
            updateData.shopify_orders_percent = (dayOrders.channels.shopify / total) * 100;
          }
        }

        console.log(`📝 Updating ${dateStr}: Sales=£${updateData.total_sales}, Orders=${updateData.linnworks_total_orders}`);

        const { error } = await supabaseAdmin
          .from('daily_metric_review')
          .upsert(updateData, { onConflict: 'date' });

        if (error) {
          console.error(`❌ Error updating ${dateStr}:`, error);
          results.push({ date: dateStr, status: 'error', error });
        } else {
          console.log(`✅ Successfully updated ${dateStr}`);
          results.push({
            date: dateStr,
            status: 'success',
            sales: updateData.total_sales,
            orders: updateData.linnworks_total_orders
          });
        }
      } else {
        console.warn(`⚠️ No data found in Linnworks for ${dateStr}`);
        results.push({ date: dateStr, status: 'no_data_found_in_linnworks' });
      }
    }

    return json({ success: true, results });
  } catch (error) {
    console.error('Fix failed:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
