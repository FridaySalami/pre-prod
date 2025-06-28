import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';

export async function POST({ request }) {
  try {
    console.log('🔄 Daily metric review update started');

    const requestBody = await request.json();
    console.log('📥 Request body:', JSON.stringify(requestBody, null, 2));

    const { dailySalesData } = requestBody;

    if (!dailySalesData || !Array.isArray(dailySalesData)) {
      console.error('❌ Invalid daily sales data:', { dailySalesData, isArray: Array.isArray(dailySalesData) });
      return json({
        success: false,
        error: 'Invalid daily sales data provided'
      }, { status: 400 });
    }

    console.log(`📊 Updating daily metric review for ${dailySalesData.length} days`);    // Test Supabase connection
    console.log('🔌 Testing Supabase connection...');
    const { data: testData, error: testError } = await supabaseAdmin
      .from('daily_metric_review')
      .select('date')
      .limit(1);

    if (testError) {
      console.error('❌ Supabase connection test failed:', testError);
      return json({
        success: false,
        error: `Database connection failed: ${testError.message}`
      }, { status: 500 });
    }
    console.log('✅ Supabase connection test successful');

    // Process each day's data
    const updatePromises = dailySalesData.map(async (dayData, index) => {
      try {
        console.log(`🗓️ Processing day ${index + 1}/${dailySalesData.length}:`, dayData.date);

        const dayDate = new Date(dayData.date).toISOString().split('T')[0];
        console.log(`📅 Formatted date: ${dayDate}`);

        // Prepare the update data - only include sales-related columns
        const updateData: any = {
          date: dayDate,
          total_sales: dayData.salesData.totalSales || 0,
          amazon_sales: dayData.salesData.amazonSales || 0,
          ebay_sales: dayData.salesData.ebaySales || 0,
          shopify_sales: dayData.salesData.shopifySales || 0,
          linnworks_total_orders: dayData.salesData.orderCount || 0,
          updated_at: new Date().toISOString()
        };

        console.log(`💰 Sales data for ${dayDate}:`, updateData);

        // Calculate order percentages if total orders > 0
        const totalOrders = dayData.salesData.orderCount || 0;
        if (totalOrders > 0) {
          // We'll need to get individual channel order counts
          // For now, we'll estimate based on sales proportions
          const totalSales = dayData.salesData.totalSales || 0;
          if (totalSales > 0) {
            const amazonPercent = ((dayData.salesData.amazonSales || 0) / totalSales) * 100;
            const ebayPercent = ((dayData.salesData.ebaySales || 0) / totalSales) * 100;
            const shopifyPercent = ((dayData.salesData.shopifySales || 0) / totalSales) * 100;

            updateData.amazon_orders_percent = amazonPercent;
            updateData.ebay_orders_percent = ebayPercent;
            updateData.shopify_orders_percent = shopifyPercent;
          }
        }

        // Use upsert to insert or update the record
        // This will only update the specified columns and leave others intact
        const { data, error } = await supabaseAdmin
          .from('daily_metric_review')
          .upsert(updateData, {
            onConflict: 'date',
            ignoreDuplicates: false
          })
          .select();

        if (error) {
          console.error(`❌ Supabase error for ${dayDate}:`, error);
          console.error(`❌ Error details:`, {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          return { success: false, date: dayDate, error: error.message || error };
        }

        console.log(`Successfully updated daily metric review for ${dayDate}`);
        return { success: true, date: dayDate, data };

      } catch (dayError) {
        console.error(`Error processing day data for ${dayData.date}:`, dayError);
        return {
          success: false,
          date: dayData.date,
          error: dayError instanceof Error ? dayError.message : String(dayError)
        };
      }
    });

    // Wait for all updates to complete
    const results = await Promise.all(updatePromises);

    // Count successes and failures
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`Update complete: ${successful.length} successful, ${failed.length} failed`);

    return json({
      success: failed.length === 0,
      message: `Updated ${successful.length} days successfully${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
      results: {
        successful: successful.length,
        failed: failed.length,
        errors: failed.map(f => ({ date: f.date, error: f.error }))
      }
    });

  } catch (error) {
    console.error('Error updating daily metric review:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
