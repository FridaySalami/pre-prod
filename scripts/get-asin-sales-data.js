/**
 * Get sales data for a specific ASIN for the last 7 days
 * Usage: node get-asin-sales-data.js
 */

const { AmazonSPAPI } = require('./render-service/services/amazon-spapi');
const { SupabaseService } = require('./render-service/services/supabase-client');

async function getAsinSalesData() {
  const asin = 'B07H1HW13V';

  try {
    console.log(`🔍 Looking up sales data for ASIN: ${asin}`);
    console.log(`📅 Date range: Last 7 days`);
    console.log('─'.repeat(60));

    // Initialize Supabase client
    await SupabaseService.initialize();
    const supabaseClient = SupabaseService.getClient();

    // Initialize Amazon SP-API
    const amazonApi = new AmazonSPAPI(supabaseClient);

    // Calculate date range (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    console.log(`📊 Fetching sales data from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}...`);

    // Get sales data for the ASIN
    const salesData = await amazonApi.getSalesDataBySkuOrAsin(
      asin,
      startDate.toISOString(),
      endDate.toISOString(),
      200 // Max orders to check
    );

    // Display results
    console.log('\n📈 SALES SUMMARY');
    console.log('─'.repeat(60));
    console.log(`ASIN: ${salesData.sku_or_asin}`);
    console.log(`Period: ${salesData.date_range.start.split('T')[0]} to ${salesData.date_range.end}`);
    console.log(`Total Units Sold: ${salesData.total_quantity_sold}`);
    console.log(`Total Revenue: £${salesData.total_revenue}`);
    console.log(`Total Orders: ${salesData.total_orders}`);
    console.log(`Average Order Value: £${salesData.average_order_value}`);
    console.log(`\n${salesData.summary}`);

    if (salesData.orders.length > 0) {
      console.log('\n📋 ORDER DETAILS');
      console.log('─'.repeat(60));

      salesData.orders.forEach((order, index) => {
        console.log(`\n${index + 1}. Order ID: ${order.order_id}`);
        console.log(`   Date: ${order.order_date.split('T')[0]}`);
        console.log(`   SKU: ${order.sku}`);
        console.log(`   Product: ${order.product_name}`);
        console.log(`   Quantity: ${order.quantity}`);
        console.log(`   Unit Price: £${order.unit_price.toFixed(2)}`);
        console.log(`   Total: £${order.total_price.toFixed(2)}`);
      });
    } else {
      console.log('\n❌ No sales found for this ASIN in the last 7 days');
    }

    console.log('\n✅ Sales data lookup completed successfully!');

  } catch (error) {
    console.error('\n❌ Error fetching sales data:', error.message);

    if (error.message === 'RATE_LIMITED') {
      console.log('💡 Try again in a few minutes - Amazon has rate limits on API calls');
    } else if (error.message === 'ACCESS_DENIED') {
      console.log('💡 Check your Amazon SP-API credentials in environment variables');
    } else if (error.message.includes('Missing required Amazon SP-API configuration')) {
      console.log('💡 Make sure all required environment variables are set:');
      console.log('   - AMAZON_CLIENT_ID');
      console.log('   - AMAZON_CLIENT_SECRET');
      console.log('   - AMAZON_REFRESH_TOKEN');
      console.log('   - AMAZON_AWS_ACCESS_KEY_ID');
      console.log('   - AMAZON_AWS_SECRET_ACCESS_KEY');
      console.log('   - YOUR_SELLER_ID (optional, for identifying your offers)');
    }

    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  getAsinSalesData();
}

module.exports = { getAsinSalesData };
