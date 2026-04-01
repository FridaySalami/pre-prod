// Quick script to add test data to the daily_metric_review table
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

async function addTestData() {
  // Add test data for December 2024
  const testData = [
    {
      date: '2024-12-01',
      total_sales: 1250.50,
      amazon_sales: 750.30,
      ebay_sales: 300.20,
      shopify_sales: 200.00,
      linnworks_total_orders: 45,
      linnworks_amazon_orders: 25,
      linnworks_ebay_orders: 12,
      linnworks_shopify_orders: 8,
      amazon_orders_percent: 55.56,
      ebay_orders_percent: 26.67,
      shopify_orders_percent: 17.78,
      actual_hours_worked: 8.5,
      labor_efficiency: 5.29
    },
    {
      date: '2024-12-02',
      total_sales: 980.75,
      amazon_sales: 580.45,
      ebay_sales: 250.30,
      shopify_sales: 150.00,
      linnworks_total_orders: 38,
      linnworks_amazon_orders: 22,
      linnworks_ebay_orders: 10,
      linnworks_shopify_orders: 6,
      amazon_orders_percent: 57.89,
      ebay_orders_percent: 26.32,
      shopify_orders_percent: 15.79,
      actual_hours_worked: 7.5,
      labor_efficiency: 5.07
    },
    {
      date: '2024-12-03',
      total_sales: 1450.25,
      amazon_sales: 870.15,
      ebay_sales: 380.10,
      shopify_sales: 200.00,
      linnworks_total_orders: 52,
      linnworks_amazon_orders: 31,
      linnworks_ebay_orders: 14,
      linnworks_shopify_orders: 7,
      amazon_orders_percent: 59.62,
      ebay_orders_percent: 26.92,
      shopify_orders_percent: 13.46,
      actual_hours_worked: 8.0,
      labor_efficiency: 6.50
    },
    {
      date: '2024-12-04',
      total_sales: 1125.80,
      amazon_sales: 675.48,
      ebay_sales: 281.32,
      shopify_sales: 169.00,
      linnworks_total_orders: 42,
      linnworks_amazon_orders: 25,
      linnworks_ebay_orders: 11,
      linnworks_shopify_orders: 6,
      amazon_orders_percent: 59.52,
      ebay_orders_percent: 26.19,
      shopify_orders_percent: 14.29,
      actual_hours_worked: 8.5,
      labor_efficiency: 4.94
    },
    {
      date: '2024-12-05',
      total_sales: 1650.90,
      amazon_sales: 990.54,
      ebay_sales: 412.23,
      shopify_sales: 248.13,
      linnworks_total_orders: 58,
      linnworks_amazon_orders: 35,
      linnworks_ebay_orders: 15,
      linnworks_shopify_orders: 8,
      amazon_orders_percent: 60.34,
      ebay_orders_percent: 25.86,
      shopify_orders_percent: 13.79,
      actual_hours_worked: 8.0,
      labor_efficiency: 7.25
    }
  ];

  console.log('Adding test data to daily_metric_review table...');

  const { data, error } = await supabase
    .from('daily_metric_review')
    .upsert(testData, { onConflict: 'date' });

  if (error) {
    console.error('Error adding test data:', error);
  } else {
    console.log('Successfully added test data:', data);
  }
}

addTestData().catch(console.error);
