import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import process from 'process';

// Load environment variables
dotenv.config();

// Use the same environment variable names as used elsewhere in the project
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || 'https://gvowfbrpmotcfxfzzhxf.supabase.co';
const supabaseKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

console.log('Using Supabase URL:', supabaseUrl);
console.log('Supabase Key available:', supabaseKey ? 'Yes' : 'No');

if (!supabaseKey) {
  console.error('Missing Supabase key in environment variables');
  console.error('Please make sure either PRIVATE_SUPABASE_SERVICE_KEY or PUBLIC_SUPABASE_ANON_KEY is defined in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkBuyBoxEntry(id) {
  console.log(`🔍 Looking up buy box data entry with ID: ${id}`);

  try {
    // Query the buybox_data table for the specific ID with related data
    const { data, error } = await supabase
      .from('buybox_data')
      .select(`
        *,
        skus(cost, min_price, title, product_id),
        buybox_jobs(id, status, created_at, completed_at)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Error querying buybox_data:', error);
      return;
    }

    if (!data) {
      console.log(`⚠️ No entry found with ID: ${id}`);
      return;
    }

    // Print the entry details in a formatted way
    console.log('\n📊 === BUY BOX DATA ENTRY ===');

    // Basic info
    console.log(`\n🏷️  Basic Info:`);
    console.log(`ID: ${data.id}`);
    console.log(`ASIN: ${data.asin}`);
    console.log(`SKU: ${data.sku}`);
    console.log(`Captured at: ${new Date(data.captured_at).toLocaleString()}`);

    // Pricing info
    console.log(`\n💰 Pricing:`);
    console.log(`Current Price: ${data.price ? `£${data.price.toFixed(2)}` : 'N/A'}`);
    console.log(`Lowest Price: ${data.lowest_price ? `£${data.lowest_price.toFixed(2)}` : 'N/A'}`);
    console.log(`Target Price: ${data.target_price ? `£${data.target_price.toFixed(2)}` : 'N/A'}`);
    if (data.skus?.cost) {
      console.log(`Cost Price: £${data.skus.cost.toFixed(2)}`);
    }

    // Buy Box info
    console.log(`\n🏆 Buy Box Status:`);
    console.log(`Buy Box Winner: ${data.is_winner ? '✅ YES' : '❌ NO'}`);
    if (data.merchant_token && data.buybox_merchant_token) {
      console.log(`Our Merchant Token: ${data.merchant_token}`);
      console.log(`Buy Box Merchant Token: ${data.buybox_merchant_token}`);
      console.log(`Match: ${data.merchant_token === data.buybox_merchant_token ? '✅ YES' : '❌ NO'}`);
    }

    // Profitability info
    console.log(`\n📈 Profitability:`);
    console.log(`Opportunity Flag: ${data.opportunity_flag ? '✅ YES' : '❌ NO'}`);
    console.log(`Margin at Buy Box: ${data.margin_at_buybox !== null ? `£${data.margin_at_buybox.toFixed(2)}` : 'N/A'}`);
    console.log(`Margin Percent: ${data.margin_percent_at_buybox !== null ? `${data.margin_percent_at_buybox.toFixed(2)}%` : 'N/A'}`);

    // Product info if available
    if (data.skus) {
      console.log(`\n📦 Product Info:`);
      console.log(`Title: ${data.skus.title || 'N/A'}`);
      console.log(`Product ID: ${data.skus.product_id || 'N/A'}`);
      console.log(`Min Price: ${data.skus.min_price ? `£${data.skus.min_price.toFixed(2)}` : 'N/A'}`);
    }

    // Job info
    if (data.job_id) {
      console.log(`\n🔄 Job Info:`);
      console.log(`Job ID: ${data.job_id}`);
      if (data.buybox_jobs) {
        console.log(`Job Status: ${data.buybox_jobs.status}`);
        console.log(`Created: ${new Date(data.buybox_jobs.created_at).toLocaleString()}`);
        console.log(`Completed: ${data.buybox_jobs.completed_at ? new Date(data.buybox_jobs.completed_at).toLocaleString() : 'N/A'}`);
      }
    }

    // Check the sku_asin_mapping table
    if (data.sku && data.asin) {
      const { data: mappingData, error: mappingError } = await supabase
        .from('sku_asin_mapping')
        .select('*')
        .eq('sku', data.sku)
        .eq('asin', data.asin)
        .single();

      if (!mappingError && mappingData) {
        console.log('\n🔗 SKU-ASIN Mapping:');
        console.log(`ID: ${mappingData.id}`);
        console.log(`SKU: ${mappingData.sku}`);
        console.log(`ASIN: ${mappingData.asin}`);
        console.log(`Created: ${new Date(mappingData.created_at).toLocaleString()}`);
        console.log(`Active: ${mappingData.is_active ? 'Yes' : 'No'}`);
        if (mappingData.metadata) {
          console.log(`Metadata: ${JSON.stringify(mappingData.metadata)}`);
        }
      }
    }

    // Check if there are any failures for this ASIN/SKU in the same job
    if (data.job_id) {
      const { data: failureData, error: failureError } = await supabase
        .from('buybox_failures')
        .select('*')
        .eq('job_id', data.job_id)
        .eq('asin', data.asin);

      if (!failureError && failureData && failureData.length > 0) {
        console.log('\n⚠️ Failures Found:');
        failureData.forEach((failure, i) => {
          console.log(`\nFailure ${i + 1}:`);
          console.log(`ID: ${failure.id}`);
          console.log(`Attempt: ${failure.attempt_number}`);
          console.log(`Error: ${failure.error_message}`);
          console.log(`Time: ${new Date(failure.created_at).toLocaleString()}`);
        });
      }
    }

    // Raw data (optional)
    console.log('\n🔍 Raw Data (JSON):');
    console.log(JSON.stringify(data, null, 2));

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

// Get the ID from command line argument or use default
const entryId = process.argv[2] || '01450a7a-649a-4795-a82d-40f5d59d80d6';

// Display usage info
if (process.argv.length < 3) {
  console.log('⚠️ No ID provided as argument. Using default ID for demo purposes.');
  console.log('Usage: node check-buybox-entry.js <entry_id>');
}

// Run the query
checkBuyBoxEntry(entryId);
