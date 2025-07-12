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
    // Query the buybox_data table for the specific ID
    const { data, error } = await supabase
      .from('buybox_data')
      .select('*')
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
    console.log(`Cost Price: ${data.cost_price ? `£${data.cost_price.toFixed(2)}` : 'N/A'}`);

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

    // Job info
    if (data.job_id) {
      console.log(`\n🔄 Job Info:`);
      console.log(`Job ID: ${data.job_id}`);

      // Get job info
      const { data: jobData, error: jobError } = await supabase
        .from('buybox_jobs')
        .select('*')
        .eq('id', data.job_id)
        .single();

      if (!jobError && jobData) {
        console.log(`Job Status: ${jobData.status}`);
        console.log(`Started: ${new Date(jobData.started_at).toLocaleString()}`);
        console.log(`Completed: ${jobData.completed_at ? new Date(jobData.completed_at).toLocaleString() : 'N/A'}`);
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

    // Look up the SKU in the skus table
    if (data.sku) {
      const { data: skuData, error: skuError } = await supabase
        .from('skus')
        .select('*')
        .eq('sku', data.sku)
        .single();

      if (!skuError && skuData) {
        console.log('\n📦 Product Info:');
        console.log(`Title: ${skuData.title || 'N/A'}`);
        console.log(`Cost: ${skuData.cost ? `£${skuData.cost.toFixed(2)}` : 'N/A'}`);
        console.log(`Min Price: ${skuData.min_price ? `£${skuData.min_price.toFixed(2)}` : 'N/A'}`);
        console.log(`Product ID: ${skuData.product_id || 'N/A'}`);
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
          console.log(`Error: ${failure.reason}`);
          console.log(`Time: ${new Date(failure.captured_at).toLocaleString()}`);
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
const entryId = process.argv[2] || '00e53f3e-4c6f-435a-894b-fa0a46f23941';

// Display usage info
if (process.argv.length < 3) {
  console.log('⚠️ No ID provided as argument. Using default ID for demo purposes.');
  console.log('Usage: node check-buybox-entry.js <entry_id>');
}

// Run the query
checkBuyBoxEntry(entryId);
