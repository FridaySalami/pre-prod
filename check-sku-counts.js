#!/usr/bin/env node

// Import required modules
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Supabase configuration
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSkuCounts() {
  try {
    console.log('Checking SKU/ASIN mapping counts...\n');

    // Count total SKUs
    const { count: totalCount, error: totalError } = await supabase
      .from('sku_asin_mapping')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      throw new Error(`Count error: ${totalError.message}`);
    }
    console.log(`Total SKUs in mapping table: ${totalCount}`);

    // Count monitored SKUs
    const { count: monitoredCount, error: monitoredError } = await supabase
      .from('sku_asin_mapping')
      .select('*', { count: 'exact', head: true })
      .eq('monitoring_enabled', true);

    if (monitoredError) {
      throw new Error(`Monitored count error: ${monitoredError.message}`);
    }
    console.log(`SKUs with monitoring enabled: ${monitoredCount}`);

    // Count ASINs with non-null asin1
    const { count: asinCount, error: asinError } = await supabase
      .from('sku_asin_mapping')
      .select('*', { count: 'exact', head: true })
      .not('asin1', 'is', null);

    if (asinError) {
      throw new Error(`ASIN count error: ${asinError.message}`);
    }
    console.log(`SKUs with valid ASIN: ${asinCount}`);

    // Count monitored and valid ASINs
    const { count: validCount, error: validError } = await supabase
      .from('sku_asin_mapping')
      .select('*', { count: 'exact', head: true })
      .eq('monitoring_enabled', true)
      .not('asin1', 'is', null);

    if (validError) {
      throw new Error(`Valid count error: ${validError.message}`);
    }
    console.log(`SKUs with monitoring enabled AND valid ASIN: ${validCount}`);

    // These are the ones that will actually be monitored
    console.log('\nNOTE: The Buy Box API will process ${validCount} ASINs.');

    // Get a sample of SKUs that will be monitored
    const { data: sampleData, error: sampleError } = await supabase
      .from('sku_asin_mapping')
      .select('seller_sku, asin1, item_name, price')
      .eq('monitoring_enabled', true)
      .not('asin1', 'is', null)
      .order('seller_sku')
      .limit(5);

    if (sampleError) {
      throw new Error(`Sample error: ${sampleError.message}`);
    }

    console.log('\nSample of monitored SKUs:');
    console.table(sampleData);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the function
checkSkuCounts();
