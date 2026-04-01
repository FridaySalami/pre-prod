#!/usr/bin/env node

/**
 * Rate-Limited Sales Data Retrieval
 * 
 * This script safely gets sales data for a specific SKU or ASIN with optimized
 * rate limiting to avoid hitting Amazon SP-API limits.
 * 
 * Usage:
 *   node test-sales-data.cjs YOUR_SKU
 *   node test-sales-data.cjs B0104R0FRG
 *   node test-sales-data.cjs YOUR_SKU --days 7
 *   node test-sales-data.cjs YOUR_SKU --start 2024-01-01 --end 2024-01-31
 *   node test-sales-data.cjs YOUR_SKU --safe    (ultra-conservative rate limiting)
 */

require('dotenv').config();
const { AmazonSPAPI } = require('./render-service/services/amazon-spapi');

// Mock Supabase client for this test
const mockSupabaseClient = {
  from: () => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: null, error: null })
      })
    })
  })
};

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('❌ Please provide a SKU or ASIN');
  console.log('Usage: node test-sales-data.cjs YOUR_SKU');
  console.log('       node test-sales-data.cjs B0104R0FRG');
  console.log('       node test-sales-data.cjs YOUR_SKU --days 30');
  console.log('       node test-sales-data.cjs YOUR_SKU --start 2024-01-01 --end 2024-01-31');
  console.log('       node test-sales-data.cjs YOUR_SKU --safe  (ultra-conservative rate limiting)');
  process.exit(1);
}

const skuOrAsin = args[0];
const isSafeMode = args.includes('--safe');

// Parse optional date parameters
let startDate, endDate;
const daysIndex = args.indexOf('--days');
const startIndex = args.indexOf('--start');
const endIndex = args.indexOf('--end');

if (daysIndex !== -1 && args[daysIndex + 1]) {
  const days = parseInt(args[daysIndex + 1]);
  startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  endDate = new Date();
  endDate.setMinutes(endDate.getMinutes() - 5); // Amazon requires at least 2 minutes before current time
} else if (startIndex !== -1 && args[startIndex + 1]) {
  startDate = new Date(args[startIndex + 1]);
  if (endIndex !== -1 && args[endIndex + 1]) {
    endDate = new Date(args[endIndex + 1]);
  } else {
    endDate = new Date();
    endDate.setMinutes(endDate.getMinutes() - 5);
  }
} else {
  // Default to yesterday only (using local date to avoid timezone issues)
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  startDate = yesterday;
  endDate = yesterday;
}

// Rate limiting settings based on mode
const rateLimitSettings = {
  maxOrders: isSafeMode ? 5 : 15,        // Conservative order checking
  orderDelay: isSafeMode ? 3000 : 1500,  // Delay between order item requests (ms)
  initialDelay: isSafeMode ? 2000 : 1000  // Initial delay before starting
};

// Rate-limited sales data function
async function getSalesDataWithRateLimit(amazonAPI, skuOrAsin, startDate, endDate) {
  console.log(`⏱️  Using ${isSafeMode ? 'SAFE' : 'NORMAL'} mode rate limiting:`);
  console.log(`   • Max orders to check: ${rateLimitSettings.maxOrders}`);
  console.log(`   • Delay between requests: ${rateLimitSettings.orderDelay}ms`);
  console.log('');

  // Add initial delay
  console.log(`😴 Initial delay of ${rateLimitSettings.initialDelay}ms to avoid burst limits...`);
  await new Promise(resolve => setTimeout(resolve, rateLimitSettings.initialDelay));

  try {
    // Step 1: Get orders first (this is fast)
    console.log('📋 Step 1: Getting orders list...');
    const ordersResponse = await amazonAPI.getOrders(startDate, endDate, rateLimitSettings.maxOrders);
    const orders = ordersResponse?.payload?.Orders || [];

    if (orders.length === 0) {
      return {
        sku_or_asin: skuOrAsin,
        date_range: { start: startDate, end: endDate },
        total_quantity_sold: 0,
        total_revenue: 0,
        total_orders: 0,
        orders: [],
        summary: 'No orders found in date range'
      };
    }

    console.log(`✅ Found ${orders.length} orders in date range`);
    console.log('');

    // Step 2: Check each order for our SKU/ASIN (this is slow and rate-limited)
    console.log(`🔍 Step 2: Checking orders for SKU/ASIN "${skuOrAsin}"...`);
    console.log(`   This will take ~${Math.ceil(orders.length * (rateLimitSettings.orderDelay / 1000))} seconds due to rate limiting`);
    console.log('');

    let totalQuantity = 0;
    let totalRevenue = 0;
    let matchingOrders = [];
    let processedCount = 0;
    let errorCount = 0;

    for (const order of orders) {
      processedCount++;

      try {
        console.log(`   📦 [${processedCount}/${orders.length}] Checking order ${order.AmazonOrderId}...`);

        // Rate-limited delay
        if (processedCount > 1) {
          await new Promise(resolve => setTimeout(resolve, rateLimitSettings.orderDelay));
        }

        const orderItemsResponse = await amazonAPI.getOrderItems(order.AmazonOrderId);
        const orderItems = orderItemsResponse?.payload?.OrderItems || [];

        // Find items matching our SKU/ASIN
        const matchingItems = orderItems.filter(item =>
          item.SellerSKU === skuOrAsin ||
          item.ASIN === skuOrAsin
        );

        if (matchingItems.length > 0) {
          console.log(`   ✅ Found ${matchingItems.length} matching item(s) in this order!`);

          for (const item of matchingItems) {
            const quantity = parseInt(item.QuantityOrdered) || 0;
            const itemPrice = parseFloat(item.ItemPrice?.Amount) || 0;

            totalQuantity += quantity;
            totalRevenue += itemPrice;

            matchingOrders.push({
              order_id: order.AmazonOrderId,
              order_date: order.PurchaseDate,
              sku: item.SellerSKU,
              asin: item.ASIN,
              product_name: item.Title,
              quantity: quantity,
              unit_price: quantity > 0 ? itemPrice / quantity : 0,
              total_price: itemPrice,
              currency: item.ItemPrice?.CurrencyCode || 'GBP'
            });
          }
        } else {
          console.log(`   ⚪ No matching items in this order`);
        }

      } catch (error) {
        errorCount++;
        if (error.message.includes('RATE_LIMITED') || error.message.includes('QuotaExceeded')) {
          console.log(`   ⚠️  Rate limited on order ${order.AmazonOrderId} - skipping to avoid further limits`);
          break; // Stop processing to avoid further rate limits
        } else {
          console.log(`   ❌ Error checking order ${order.AmazonOrderId}: ${error.message}`);
        }
      }
    }

    console.log('');
    console.log(`🎯 Processing Summary:`);
    console.log(`   • Orders checked: ${processedCount}/${orders.length}`);
    console.log(`   • Errors encountered: ${errorCount}`);
    console.log(`   • Orders with matching items: ${matchingOrders.length}`);
    console.log('');

    const salesSummary = {
      sku_or_asin: skuOrAsin,
      date_range: {
        start: startDate,
        end: endDate
      },
      total_quantity_sold: totalQuantity,
      total_revenue: parseFloat(totalRevenue.toFixed(2)),
      total_orders: matchingOrders.length,
      average_order_value: matchingOrders.length > 0 ? parseFloat((totalRevenue / matchingOrders.length).toFixed(2)) : 0,
      orders: matchingOrders,
      processing_stats: {
        orders_checked: processedCount,
        orders_available: orders.length,
        errors: errorCount
      },
      summary: `Found ${totalQuantity} units sold across ${matchingOrders.length} orders, total revenue: £${totalRevenue.toFixed(2)}`
    };

    return salesSummary;

  } catch (error) {
    console.error('Error in rate-limited sales data retrieval:', error);
    throw error;
  }
}

async function testSalesData() {
  try {
    console.log(`🔍 Testing sales data retrieval for: ${skuOrAsin}`);
    console.log(`📅 Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    console.log('');

    // Initialize Amazon SP-API client
    const amazonAPI = new AmazonSPAPI(mockSupabaseClient);

    // Use our rate-limited sales data function
    const salesData = await getSalesDataWithRateLimit(
      amazonAPI,
      skuOrAsin,
      startDate,
      endDate
    );

    console.log('📊 SALES REPORT');
    console.log('================');
    console.log(`SKU/ASIN: ${salesData.sku_or_asin}`);
    console.log(`Date Range: ${salesData.date_range.start} to ${salesData.date_range.end}`);
    console.log(`Total Units Sold: ${salesData.total_quantity_sold}`);
    console.log(`Total Revenue: £${salesData.total_revenue}`);
    console.log(`Total Orders: ${salesData.total_orders}`);
    if (salesData.average_order_value > 0) {
      console.log(`Average Order Value: £${salesData.average_order_value}`);
    }
    console.log('');
    console.log(`Summary: ${salesData.summary}`);
    console.log('');

    // Show processing efficiency
    if (salesData.processing_stats) {
      console.log('🔧 PROCESSING STATS');
      console.log('===================');
      console.log(`Orders Available: ${salesData.processing_stats.orders_available}`);
      console.log(`Orders Checked: ${salesData.processing_stats.orders_checked}`);
      console.log(`API Errors: ${salesData.processing_stats.errors}`);
      console.log(`Success Rate: ${Math.round((salesData.processing_stats.orders_checked / salesData.processing_stats.orders_available) * 100)}%`);
      console.log('');
    }

    if (salesData.orders.length > 0) {
      console.log('📦 ORDER DETAILS');
      console.log('================');
      salesData.orders.forEach((order, index) => {
        console.log(`${index + 1}. Order ${order.order_id}`);
        console.log(`   Date: ${new Date(order.order_date).toLocaleDateString()}`);
        console.log(`   Product: ${order.product_name}`);
        console.log(`   SKU: ${order.sku}, ASIN: ${order.asin}`);
        console.log(`   Quantity: ${order.quantity}`);
        console.log(`   Unit Price: £${order.unit_price.toFixed(2)}`);
        console.log(`   Order Total: £${order.total_price.toFixed(2)} ${order.currency}`);
        console.log('');
      });
    } else {
      console.log('📝 No sales found for this SKU/ASIN in the specified date range.');
      console.log('');
      console.log('💡 Try:');
      console.log('   • Extending the date range (--days 30 or --days 60)');
      console.log('   • Checking a different SKU/ASIN');
      console.log('   • Verifying the SKU/ASIN is correct');
    }

    console.log('✅ Sales data retrieval completed successfully!');

    // Summary for quick reference
    if (salesData.total_quantity_sold > 0) {
      console.log('');
      console.log('🎯 QUICK SUMMARY');
      console.log('===============');
      console.log(`• ${salesData.total_quantity_sold} units sold`);
      console.log(`• £${salesData.total_revenue} total revenue`);
      console.log(`• ${salesData.total_orders} orders`);
      const dailyAvg = salesData.total_quantity_sold / Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      console.log(`• ~${dailyAvg.toFixed(1)} units/day average`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);

    if (error.message === 'ACCESS_DENIED') {
      console.log('');
      console.log('💡 This might be because:');
      console.log('   • Your SP-API application needs "Orders" permission');
      console.log('   • Your seller account may not have recent orders');
      console.log('   • The SKU/ASIN might not exist in your orders');
    } else if (error.message.includes('RATE_LIMITED') || error.message.includes('QuotaExceeded')) {
      console.log('');
      console.log('💡 Rate limit reached. Try:');
      console.log('   • Using --safe mode: node test-sales-data.cjs YOUR_SKU --safe');
      console.log('   • Waiting a few minutes before trying again');
      console.log('   • Using a shorter date range: --days 3');
    } else {
      console.log('');
      console.log('💡 Check your .env file has all required Amazon SP-API credentials.');
    }

    process.exit(1);
  }
}

// Run the test
testSalesData();
