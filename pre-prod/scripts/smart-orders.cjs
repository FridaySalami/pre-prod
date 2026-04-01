#!/usr/bin/env node

/**
 * Smart Orders Report - Efficiently display orders with pagination control
 * 
 * This script retrieves orders with smart pagination and gives you control
 * over how many to process to avoid long waits.
 * 
 * Usage:
 *   node smart-orders.cjs                    (yesterday, first 50 orders)
 *   node smart-orders.cjs --limit 20         (yesterday, first 20 orders)
 *   node smart-orders.cjs --date 2024-07-15  (specific date, first 50)
 *   node smart-orders.cjs --all              (all orders, no limit - be careful!)
 *   node smart-orders.cjs --summary-only     (just summary stats, fast)
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
const limitIndex = args.indexOf('--limit');
const dateIndex = args.indexOf('--date');
const isAll = args.includes('--all');
const isSummaryOnly = args.includes('--summary-only');

// Set processing limit
let orderLimit;
if (isAll) {
  orderLimit = null; // No limit
} else if (limitIndex !== -1 && args[limitIndex + 1]) {
  orderLimit = parseInt(args[limitIndex + 1]);
} else {
  orderLimit = 50; // Default safe limit
}

// Set target date (yesterday by default)
let targetDate;
if (dateIndex !== -1 && args[dateIndex + 1]) {
  targetDate = new Date(args[dateIndex + 1]);
} else {
  targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - 1); // Yesterday
}

// Set date range for the entire day
const startDate = new Date(targetDate);
startDate.setHours(0, 0, 0, 0); // Start of day

const endDate = new Date(targetDate);
endDate.setHours(23, 59, 59, 999); // End of day

async function getSmartOrdersReport() {
  try {
    console.log('📅 SMART ORDERS REPORT');
    console.log('======================');
    console.log(`Target Date: ${targetDate.toDateString()}`);

    if (orderLimit) {
      console.log(`Processing Limit: ${orderLimit} orders`);
    } else {
      console.log(`Processing Limit: ALL orders (this may take a while!)`);
    }

    if (isSummaryOnly) {
      console.log('Mode: Summary only (fast)');
    }

    console.log('');

    // Initialize Amazon SP-API client
    const amazonAPI = new AmazonSPAPI(mockSupabaseClient);

    console.log('🔍 Fetching orders...');

    let allOrders = [];
    let processedPages = 0;
    const maxPages = orderLimit ? Math.ceil(orderLimit / 100) : 10; // Reasonable max for safety

    // Get orders efficiently
    const ordersResponse = await amazonAPI.getOrders(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0],
      orderLimit || 100
    );

    allOrders = ordersResponse?.payload?.Orders || [];

    // Limit results if specified
    if (orderLimit && allOrders.length > orderLimit) {
      allOrders = allOrders.slice(0, orderLimit);
    }

    console.log(`✅ Retrieved ${allOrders.length} orders`);
    console.log('');

    if (allOrders.length === 0) {
      console.log('❌ No orders found for this date.');
      console.log('💡 Try a different date or check if orders exist in your seller account.');
      return;
    }

    // Calculate summary statistics quickly
    let totalRevenue = 0;
    let totalItems = 0;
    const channels = {};
    const statuses = {};
    const hourlyDistribution = {};

    allOrders.forEach(order => {
      // Revenue
      const orderTotal = parseFloat(order.OrderTotal?.Amount) || 0;
      totalRevenue += orderTotal;

      // Sales channels
      const channel = order.SalesChannel || 'Amazon';
      channels[channel] = (channels[channel] || 0) + 1;

      // Order statuses
      const status = order.OrderStatus || 'Unknown';
      statuses[status] = (statuses[status] || 0) + 1;

      // Hourly distribution
      const hour = new Date(order.PurchaseDate).getHours();
      hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;

      // Item count estimate
      totalItems += parseInt(order.NumberOfItemsShipped || 0) + parseInt(order.NumberOfItemsUnshipped || 0);
    });

    // Display comprehensive summary
    console.log('📊 SUMMARY STATISTICS');
    console.log('====================');
    console.log(`Date: ${targetDate.toDateString()}`);
    console.log(`Total Orders: ${allOrders.length}`);
    console.log(`Total Revenue: £${totalRevenue.toFixed(2)}`);
    console.log(`Average Order Value: £${(totalRevenue / allOrders.length).toFixed(2)}`);
    console.log(`Estimated Items: ${totalItems}`);
    console.log('');

    console.log('📈 BY SALES CHANNEL:');
    Object.entries(channels)
      .sort(([, a], [, b]) => b - a)
      .forEach(([channel, count]) => {
        const percentage = ((count / allOrders.length) * 100).toFixed(1);
        const revenue = allOrders
          .filter(o => (o.SalesChannel || 'Amazon') === channel)
          .reduce((sum, o) => sum + (parseFloat(o.OrderTotal?.Amount) || 0), 0);
        console.log(`   ${channel}: ${count} orders (${percentage}%) - £${revenue.toFixed(2)}`);
      });
    console.log('');

    console.log('📋 BY STATUS:');
    Object.entries(statuses)
      .sort(([, a], [, b]) => b - a)
      .forEach(([status, count]) => {
        const percentage = ((count / allOrders.length) * 100).toFixed(1);
        console.log(`   ${status}: ${count} orders (${percentage}%)`);
      });
    console.log('');

    // Show hourly distribution
    console.log('🕐 HOURLY DISTRIBUTION:');
    Object.entries(hourlyDistribution)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([hour, count]) => {
        const percentage = ((count / allOrders.length) * 100).toFixed(1);
        const timeLabel = `${hour.padStart(2, '0')}:00-${hour.padStart(2, '0')}:59`;
        console.log(`   ${timeLabel}: ${count} orders (${percentage}%)`);
      });
    console.log('');

    // If summary only, stop here
    if (isSummaryOnly) {
      console.log('✅ Summary report completed!');
      console.log('');
      console.log('💡 NEXT STEPS:');
      console.log(`   • Full details: node smart-orders.cjs --limit ${Math.min(20, allOrders.length)}`);
      console.log(`   • All orders: node smart-orders.cjs --all (⚠️  may take time)`);
      return;
    }

    // Show order details
    console.log('📦 ORDER DETAILS');
    console.log('================');

    // Show top orders by value first
    const sortedOrders = [...allOrders].sort((a, b) => {
      const aTotal = parseFloat(a.OrderTotal?.Amount) || 0;
      const bTotal = parseFloat(b.OrderTotal?.Amount) || 0;
      return bTotal - aTotal;
    });

    sortedOrders.forEach((order, index) => {
      console.log(`${index + 1}. Order ID: ${order.AmazonOrderId}`);
      console.log(`   Date: ${new Date(order.PurchaseDate).toLocaleString()}`);
      console.log(`   Status: ${order.OrderStatus}`);
      console.log(`   Channel: ${order.SalesChannel || 'Amazon'}`);
      console.log(`   Total: £${order.OrderTotal?.Amount} ${order.OrderTotal?.CurrencyCode || 'GBP'}`);
      console.log(`   Ship Service: ${order.ShipServiceLevel || 'Standard'}`);

      if (order.ShippingAddress) {
        const addr = order.ShippingAddress;
        console.log(`   Ship To: ${addr.City || ''}, ${addr.StateOrRegion || ''}, ${addr.PostalCode || ''}, ${addr.CountryCode || ''}`);
      }

      console.log('');
    });

    console.log('✅ Smart orders report completed!');
    console.log('');

    // Performance suggestions
    console.log('💡 PERFORMANCE TIPS:');
    if (allOrders.length >= 50) {
      console.log(`   • Large dataset (${allOrders.length} orders) - consider using --summary-only for quick insights`);
    }
    console.log(`   • Check specific SKU: node test-sales-data.cjs "YOUR_SKU" --days 1`);
    console.log(`   • Different date: node smart-orders.cjs --date 2024-07-15 --limit 30`);

    // Export suggestion
    console.log('');
    console.log('📁 EXPORT OPTIONS:');
    console.log(`   • Pipe to file: node smart-orders.cjs --summary-only > orders-summary.txt`);
    console.log(`   • JSON export: Available in your Amazon Seller Central > Reports`);

  } catch (error) {
    console.error('❌ Report failed:', error);

    if (error.message === 'ACCESS_DENIED') {
      console.log('');
      console.log('💡 Make sure your SP-API application has "Orders" permission.');
    } else if (error.message.includes('RATE_LIMITED')) {
      console.log('');
      console.log('💡 Rate limited. Try:');
      console.log('   • Smaller limit: node smart-orders.cjs --limit 10');
      console.log('   • Summary only: node smart-orders.cjs --summary-only');
      console.log('   • Wait and retry in a few minutes');
    } else {
      console.log('');
      console.log('💡 Check your .env file has all required Amazon SP-API credentials.');
    }

    process.exit(1);
  }
}

// Show usage if no valid arguments
if (args.length === 0 || (args.length === 1 && !['--all', '--summary-only'].includes(args[0]))) {
  console.log('📋 SMART ORDERS REPORT');
  console.log('======================');
  console.log('');
  console.log('Usage:');
  console.log('  node smart-orders.cjs                    (yesterday, first 50 orders)');
  console.log('  node smart-orders.cjs --limit 20         (yesterday, first 20 orders)');
  console.log('  node smart-orders.cjs --date 2024-07-15  (specific date, first 50)');
  console.log('  node smart-orders.cjs --summary-only     (just stats, very fast)');
  console.log('  node smart-orders.cjs --all              (all orders - may be slow!)');
  console.log('');
  console.log('Examples:');
  console.log('  node smart-orders.cjs --summary-only     # Quick overview');
  console.log('  node smart-orders.cjs --limit 10         # Just 10 orders');
  console.log('  node smart-orders.cjs --date 2024-07-15 --limit 25');
  console.log('');
} else {
  // Run the report
  getSmartOrdersReport();
}
