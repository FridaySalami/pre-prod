#!/usr/bin/env node

/**
 * Orders Explorer - See what orders and SKUs are available for testing
 * 
 * This script shows your recent orders so you can identify actual SKUs
 * to test the sales data functionality with.
 * 
 * Usage:
 *   node explore-orders.cjs --days 7
 *   node explore-orders.cjs --start 2024-06-01 --end 2024-06-30
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
} else if (startIndex !== -1 && args[startIndex + 1]) {
  startDate = new Date(args[startIndex + 1]);
  if (endIndex !== -1 && args[endIndex + 1]) {
    endDate = new Date(args[endIndex + 1]);
  }
} else {
  // Default to last 7 days
  startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  endDate = new Date();
}

async function exploreOrders() {
  try {
    console.log('🔍 ORDERS EXPLORER');
    console.log('==================');
    console.log(`📅 Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    console.log('');

    // Initialize Amazon SP-API client
    const amazonAPI = new AmazonSPAPI(mockSupabaseClient);

    console.log('📋 Getting your recent orders...');
    const ordersResponse = await amazonAPI.getOrders(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0],
      10 // Check 10 orders max
    );

    const orders = ordersResponse?.payload?.Orders || [];

    if (orders.length === 0) {
      console.log('❌ No orders found in this date range.');
      console.log('💡 Try extending the date range: --days 30');
      return;
    }

    console.log(`✅ Found ${orders.length} orders`);
    console.log('');

    console.log('📊 ORDER SUMMARY');
    console.log('================');
    orders.forEach((order, index) => {
      console.log(`${index + 1}. Order: ${order.AmazonOrderId}`);
      console.log(`   Date: ${new Date(order.PurchaseDate).toLocaleDateString()}`);
      console.log(`   Status: ${order.OrderStatus}`);
      console.log(`   Channel: ${order.SalesChannel || 'Amazon'}`);
      console.log(`   Total: ${order.OrderTotal?.Amount} ${order.OrderTotal?.CurrencyCode || 'GBP'}`);
      console.log('');
    });

    // Get items from the first 3 orders to show available SKUs
    console.log('🔍 AVAILABLE SKUs (from first 3 orders)');
    console.log('=======================================');

    const availableSkus = new Set();
    const sampleOrders = orders.slice(0, 3);

    for (let i = 0; i < sampleOrders.length; i++) {
      const order = sampleOrders[i];

      try {
        console.log(`Checking order ${i + 1}/${sampleOrders.length}: ${order.AmazonOrderId}...`);

        // Add delay to avoid rate limits
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const orderItemsResponse = await amazonAPI.getOrderItems(order.AmazonOrderId);
        const orderItems = orderItemsResponse?.payload?.OrderItems || [];

        if (orderItems.length > 0) {
          console.log(`   Found ${orderItems.length} item(s):`);
          orderItems.forEach(item => {
            console.log(`   • SKU: ${item.SellerSKU}`);
            console.log(`     ASIN: ${item.ASIN}`);
            console.log(`     Product: ${item.Title}`);
            console.log(`     Quantity: ${item.QuantityOrdered}`);
            console.log(`     Price: £${item.ItemPrice?.Amount} ${item.ItemPrice?.CurrencyCode}`);
            console.log('');

            availableSkus.add(item.SellerSKU);
          });
        }

      } catch (error) {
        if (error.message.includes('RATE_LIMITED') || error.message.includes('QuotaExceeded')) {
          console.log(`   ⚠️  Rate limited - stopping to avoid further limits`);
          break;
        } else {
          console.log(`   ❌ Error: ${error.message}`);
        }
      }
    }

    if (availableSkus.size > 0) {
      console.log('🎯 TEST THESE SKUs');
      console.log('==================');
      console.log('You can now test sales data with these actual SKUs from your orders:');
      console.log('');

      const skuArray = Array.from(availableSkus);
      skuArray.forEach((sku, index) => {
        console.log(`${index + 1}. node test-sales-data.cjs "${sku}" --days 30`);
      });

      console.log('');
      console.log('💡 Or try safe mode for slower but more reliable results:');
      console.log(`   node test-sales-data.cjs "${skuArray[0]}" --days 14 --safe`);
    }

    console.log('');
    console.log('✅ Orders exploration completed!');

  } catch (error) {
    console.error('❌ Exploration failed:', error);

    if (error.message === 'ACCESS_DENIED') {
      console.log('');
      console.log('💡 Make sure your SP-API application has "Orders" permission.');
    } else if (error.message.includes('RATE_LIMITED')) {
      console.log('');
      console.log('💡 Rate limited. Wait a few minutes and try again.');
    }

    process.exit(1);
  }
}

// Run the exploration
exploreOrders();
