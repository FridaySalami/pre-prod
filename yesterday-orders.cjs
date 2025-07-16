#!/usr/bin/env node

/**
 * Yesterday's Orders Report - Show all orders from yesterday
 * 
 * This script retrieves and displays all orders from yesterday with full details,
 * including all items in each order. No limits applied.
 * 
 * Usage:
 *   node yesterday-orders.cjs
 *   node yesterday-orders.cjs --date 2024-07-15  (specific date)
 *   node yesterday-orders.cjs --detailed          (show all order items)
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
const isDetailed = args.includes('--detailed');
const dateIndex = args.indexOf('--date');

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

async function getAllOrdersForDate() {
  try {
    console.log('📅 YESTERDAY\'S ORDERS REPORT');
    console.log('============================');
    console.log(`Target Date: ${targetDate.toDateString()}`);
    console.log(`Time Range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log('');

    // Initialize Amazon SP-API client
    const amazonAPI = new AmazonSPAPI(mockSupabaseClient);

    console.log('🔍 Fetching ALL orders for this date (no limits)...');
    console.log('This may take a while for busy days due to API rate limits.');
    console.log('');

    let allOrders = [];
    let nextToken = null;
    let pageCount = 0;

    // Get all orders using pagination
    do {
      pageCount++;
      console.log(`📋 Fetching page ${pageCount}${nextToken ? ` (continuation)` : ''}...`);

      const queryParams = {
        MarketplaceIds: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
        CreatedAfter: startDate.toISOString(),
        CreatedBefore: endDate.toISOString(),
        MaxResultsPerPage: 100 // Amazon's maximum
      };

      if (nextToken) {
        queryParams.NextToken = nextToken;
      }

      // Get orders page
      const ordersResponse = await amazonAPI.getOrders(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        100
      );

      const orders = ordersResponse?.payload?.Orders || [];
      allOrders = allOrders.concat(orders);

      // Check for more pages
      nextToken = ordersResponse?.payload?.NextToken;

      console.log(`   ✅ Found ${orders.length} orders on this page`);

      // Add delay between pages to respect rate limits
      if (nextToken) {
        console.log('   ⏱️  Waiting 2 seconds before next page...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } while (nextToken);

    console.log('');
    console.log(`🎯 TOTAL ORDERS FOUND: ${allOrders.length}`);
    console.log('');

    if (allOrders.length === 0) {
      console.log('❌ No orders found for this date.');
      console.log('💡 Try a different date or check if orders exist in your seller account.');
      return;
    }

    // Calculate summary statistics
    let totalRevenue = 0;
    let totalItems = 0;
    const channels = {};
    const statuses = {};

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

      // Item count (approximate from order)
      totalItems += parseInt(order.NumberOfItemsShipped || 0) + parseInt(order.NumberOfItemsUnshipped || 0);
    });

    // Display summary
    console.log('📊 SUMMARY STATISTICS');
    console.log('====================');
    console.log(`Total Orders: ${allOrders.length}`);
    console.log(`Total Revenue: £${totalRevenue.toFixed(2)}`);
    console.log(`Average Order Value: £${(totalRevenue / allOrders.length).toFixed(2)}`);
    console.log(`Estimated Items: ${totalItems}`);
    console.log('');

    console.log('📈 BY SALES CHANNEL:');
    Object.entries(channels).forEach(([channel, count]) => {
      const percentage = ((count / allOrders.length) * 100).toFixed(1);
      console.log(`   ${channel}: ${count} orders (${percentage}%)`);
    });
    console.log('');

    console.log('📋 BY STATUS:');
    Object.entries(statuses).forEach(([status, count]) => {
      const percentage = ((count / allOrders.length) * 100).toFixed(1);
      console.log(`   ${status}: ${count} orders (${percentage}%)`);
    });
    console.log('');

    // Display all orders
    console.log('📦 ALL ORDERS');
    console.log('=============');

    allOrders.forEach((order, index) => {
      console.log(`${index + 1}. Order ID: ${order.AmazonOrderId}`);
      console.log(`   Date: ${new Date(order.PurchaseDate).toLocaleString()}`);
      console.log(`   Status: ${order.OrderStatus}`);
      console.log(`   Channel: ${order.SalesChannel || 'Amazon'}`);
      console.log(`   Total: ${order.OrderTotal?.Amount} ${order.OrderTotal?.CurrencyCode || 'GBP'}`);
      console.log(`   Ship To: ${order.ShipServiceLevel || 'Standard'}`);

      if (order.BuyerInfo?.BuyerEmail) {
        console.log(`   Buyer: ${order.BuyerInfo.BuyerEmail}`);
      }

      if (order.ShippingAddress) {
        const addr = order.ShippingAddress;
        console.log(`   Address: ${addr.City}, ${addr.StateOrRegion}, ${addr.PostalCode}, ${addr.CountryCode}`);
      }

      console.log('');
    });

    // Detailed order items if requested
    if (isDetailed && allOrders.length > 0) {
      console.log('🔍 DETAILED ORDER ITEMS');
      console.log('=======================');
      console.log('⚠️  This will make additional API calls and may take several minutes...');
      console.log('');

      // Process first 10 orders for detailed items to avoid excessive API calls
      const ordersToDetail = allOrders.slice(0, 10);
      console.log(`Showing detailed items for first ${ordersToDetail.length} orders:`);
      console.log('');

      for (let i = 0; i < ordersToDetail.length; i++) {
        const order = ordersToDetail[i];

        try {
          console.log(`📦 Order ${i + 1}/${ordersToDetail.length}: ${order.AmazonOrderId}`);

          // Rate limiting delay
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }

          const orderItemsResponse = await amazonAPI.getOrderItems(order.AmazonOrderId);
          const orderItems = orderItemsResponse?.payload?.OrderItems || [];

          if (orderItems.length > 0) {
            orderItems.forEach((item, itemIndex) => {
              console.log(`   ${itemIndex + 1}. ${item.Title}`);
              console.log(`      SKU: ${item.SellerSKU}`);
              console.log(`      ASIN: ${item.ASIN}`);
              console.log(`      Quantity: ${item.QuantityOrdered}`);
              console.log(`      Price: £${item.ItemPrice?.Amount} ${item.ItemPrice?.CurrencyCode}`);
              console.log(`      Condition: ${item.ConditionId || 'New'}`);
              console.log('');
            });
          } else {
            console.log('   No items found for this order');
          }

        } catch (error) {
          if (error.message.includes('RATE_LIMITED') || error.message.includes('QuotaExceeded')) {
            console.log(`   ⚠️  Rate limited - stopping detailed analysis`);
            break;
          } else {
            console.log(`   ❌ Error getting items: ${error.message}`);
          }
        }
      }

      if (allOrders.length > 10) {
        console.log(`💡 Note: Only showed details for first 10 orders. Total orders: ${allOrders.length}`);
        console.log('   Use the individual order IDs above to get full details for specific orders.');
      }
    }

    console.log('');
    console.log('✅ Yesterday\'s orders report completed!');

    // Quick command suggestions
    console.log('');
    console.log('💡 QUICK COMMANDS:');
    console.log(`   • Re-run with details: node yesterday-orders.cjs --detailed`);
    console.log(`   • Specific date: node yesterday-orders.cjs --date 2024-07-15`);
    console.log(`   • Sales for specific SKU: node test-sales-data.cjs "YOUR_SKU" --days 1`);

  } catch (error) {
    console.error('❌ Report failed:', error);

    if (error.message === 'ACCESS_DENIED') {
      console.log('');
      console.log('💡 Make sure your SP-API application has "Orders" permission.');
    } else if (error.message.includes('RATE_LIMITED')) {
      console.log('');
      console.log('💡 Rate limited. Wait a few minutes and try again.');
    } else {
      console.log('');
      console.log('💡 Check your .env file has all required Amazon SP-API credentials.');
    }

    process.exit(1);
  }
}

// Run the report
getAllOrdersForDate();
