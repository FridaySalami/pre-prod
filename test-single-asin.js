#!/usr/bin/env node
/**
 * test-single-asin.js
 * 
 * A utility to test Buy Box checking for a single ASIN and see if data is saved.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables from .env file if present
dotenv.config();

// Supabase configuration
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

// Verify Supabase configuration
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: Supabase URL and key must be set in .env file');
  console.error('Required variables: PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Main function
 */
async function main() {
  try {
    const asin = process.argv[2];
    if (!asin) {
      console.error('Usage: node test-single-asin.js <ASIN>');
      console.error('Example: node test-single-asin.js B0D45C1HQP');
      process.exit(1);
    }

    console.log(`Testing Buy Box check for ASIN: ${asin}`);
    console.log('=====================================\n');

    // First, check if this ASIN exists in our database
    const { data: skuData, error: skuError } = await supabase
      .from('sku_asin_mapping')
      .select('seller_sku, asin1, status, item_name')
      .eq('asin1', asin)
      .single();

    if (skuError || !skuData) {
      console.error(`ASIN ${asin} not found in sku_asin_mapping table`);
      console.log('\nFirst 5 active ASINs you can test with:');

      const { data: sampleAsins } = await supabase
        .from('sku_asin_mapping')
        .select('asin1, seller_sku, item_name')
        .eq('status', 'Active')
        .limit(5);

      sampleAsins?.forEach(item => {
        console.log(`- ${item.asin1} (${item.seller_sku}) - ${item.item_name}`);
      });

      process.exit(1);
    }

    console.log(`Found SKU: ${skuData.seller_sku}`);
    console.log(`Status: ${skuData.status}`);
    console.log(`Product: ${skuData.item_name || 'No name'}\n`);

    if (skuData.status !== 'Active') {
      console.warn(`⚠️  Warning: This ASIN has status "${skuData.status}" - it won't be included in normal scans.`);
    }

    // Create a test job first
    console.log('Creating test job...');
    const { data: jobData, error: jobError } = await supabase
      .from('buybox_jobs')
      .insert({
        status: 'running',
        started_at: new Date().toISOString(),
        total_asins: 1,
        successful_asins: 0,
        failed_asins: 0,
        source: 'test-single-asin',
        notes: `Test job for ASIN ${asin}`
      })
      .select()
      .single();

    if (jobError || !jobData) {
      throw new Error(`Failed to create test job: ${jobError?.message}`);
    }

    console.log(`Created test job: ${jobData.id}\n`);

    // Call the Buy Box API for this specific ASIN
    console.log('Calling Buy Box API...');

    try {
      const response = await fetch(`http://localhost:3000/api/buy-box-monitor/check?asin=${asin}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API call failed (${response.status}): ${errorText}`);
      }

      const buyBoxData = await response.json();
      console.log('Buy Box API Response:', JSON.stringify(buyBoxData, null, 2));

      // Now manually insert this data into buybox_data table to test the schema
      console.log('\nTesting database insertion...');

      const testData = {
        run_id: jobData.id,
        asin: asin,
        sku: skuData.seller_sku,
        price: buyBoxData.buyBoxPrice || null,
        currency: 'GBP',
        is_winner: buyBoxData.hasBuyBox || false,
        merchant_token: process.env.AMAZON_SELLER_ID || 'A2D8NG39VURSL3',
        buybox_merchant_token: buyBoxData.buyBoxOwner || null,
        competitor_id: buyBoxData.hasBuyBox ? null : buyBoxData.buyBoxOwner,
        competitor_name: buyBoxData.hasBuyBox ? null : 'Unknown',
        competitor_price: buyBoxData.hasBuyBox ? null : buyBoxData.buyBoxPrice,
        opportunity_flag: false, // Simplified for test
        min_profitable_price: null,
        margin_at_buybox: null,
        margin_percent_at_buybox: null,
        total_offers: buyBoxData.competitorInfo?.length || 0,
        fulfillment_channel: null,
        merchant_shipping_group: null,
        source: 'test'
      };

      console.log('Inserting test data:', JSON.stringify(testData, null, 2));

      const { data: insertResult, error: insertError } = await supabase
        .from('buybox_data')
        .insert(testData)
        .select();

      if (insertError) {
        console.error('❌ Database insertion failed:', insertError);
        console.log('\nThis explains why the full-scan is not saving data!');
      } else {
        console.log('✅ Database insertion successful:', insertResult);

        // Update job as completed
        await supabase
          .from('buybox_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            successful_asins: 1
          })
          .eq('id', jobData.id);

        console.log('\n✅ Test completed successfully!');
        console.log('The Buy Box data should now appear in your database.');
      }

    } catch (apiError) {
      console.error('❌ API call failed:', apiError.message);

      // Mark job as failed
      await supabase
        .from('buybox_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          notes: `API test failed: ${apiError.message}`
        })
        .eq('id', jobData.id);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();
