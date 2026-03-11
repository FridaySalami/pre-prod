#!/usr/bin/env node

/**
 * Sales Data Example Usage
 * 
 * This shows how to integrate sales data retrieval into your existing workflow
 */

require('dotenv').config();
const { AmazonSPAPI } = require('./render-service/services/amazon-spapi');

// Example 1: Get sales data for a SKU
async function getSalesForSku() {
  // Mock Supabase client
  const mockSupabaseClient = {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null })
        })
      })
    })
  };

  const amazonAPI = new AmazonSPAPI(mockSupabaseClient);

  try {
    // Get sales data for last 30 days
    const salesData = await amazonAPI.getSalesDataBySkuOrAsin(
      'YOUR_SKU', // Replace with your actual SKU
      '2024-06-01', // Start date
      '2024-06-30', // End date
      20 // Check max 20 orders (to avoid rate limits)
    );

    console.log('📊 Sales Report:');
    console.log(`Units Sold: ${salesData.total_quantity_sold}`);
    console.log(`Revenue: £${salesData.total_revenue}`);
    console.log(`Orders: ${salesData.total_orders}`);

    return salesData;
  } catch (error) {
    console.error('Sales data error:', error.message);
  }
}

// Example 2: Add sales data to your existing getBuyBoxData workflow
async function enhancedBuyBoxWithSales(asin, sku) {
  const amazonAPI = new AmazonSPAPI(mockSupabaseClient);

  try {
    // 1. Get current pricing data (your existing functionality)
    const buyBoxData = await amazonAPI.getBuyBoxData(asin, sku, 'run-123');

    // 2. Get sales performance for last 30 days
    const salesData = await amazonAPI.getSalesDataBySkuOrAsin(
      sku,
      getDateDaysAgo(30),
      new Date().toISOString().split('T')[0],
      10 // Limited to 10 orders to avoid rate limits
    );

    // 3. Combine the data
    const enrichedData = {
      ...buyBoxData,
      sales_performance: {
        units_sold_30_days: salesData.total_quantity_sold,
        revenue_30_days: salesData.total_revenue,
        avg_daily_sales: salesData.total_quantity_sold / 30,
        velocity_score: calculateVelocityScore(salesData)
      }
    };

    console.log(`📈 ${sku}: Sold ${salesData.total_quantity_sold} units, £${salesData.total_revenue} revenue (30 days)`);

    return enrichedData;

  } catch (error) {
    console.error('Enhanced analysis error:', error.message);
  }
}

function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

function calculateVelocityScore(salesData) {
  if (salesData.total_quantity_sold === 0) return 'low';
  if (salesData.total_quantity_sold > 10) return 'high';
  if (salesData.total_quantity_sold > 3) return 'medium';
  return 'low';
}

// Export for use in other modules
module.exports = {
  getSalesForSku,
  enhancedBuyBoxWithSales
};
