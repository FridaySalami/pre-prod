#!/usr/bin/env node

/**
 * Clear all buybox data and run a fresh comprehensive check
 * Updated: Fixed database schema issue (job_id vs run_id) - ready for deployment
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_KEY environment variables must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Import the enhanced Buy Box checker
import { analyzeBuyBoxStatus } from './enhanced-buy-box-checker.cjs';

/**
 * Clear all data from the buybox-data table
 * @returns {Promise<Object>} Result of the delete operation
 */
async function clearBuyBoxData() {
  console.log('Clearing all data from buybox-data table...');

  try {
    // Delete all records from the buybox-data table
    const { data, error } = await supabase
      .from('buybox_data')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Just a safeguard to ensure we're using a valid delete operation

    if (error) {
      throw error;
    }

    console.log('Successfully cleared all data from buybox-data table');
    return data;
  } catch (error) {
    console.error('Error clearing buybox-data:', error);
    throw error;
  }
}

/**
 * Create a new Buy Box job record
 * @returns {Promise<String>} The new job ID
 */
async function createNewBuyBoxJob() {
  try {
    const { data, error } = await supabase
      .from('buybox_jobs')
      .insert({
        status: 'PENDING',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total_items: 0, // Will be updated by the job
        processed_items: 0,
        successful_items: 0,
        failed_items: 0,
        settings: {
          requestsPerSecond: 0.1, // Very conservative: 1 request per 10 seconds
          maxRetries: 5,
          baseDelayMs: 3000,
          jitterPercentage: 0.4
        }
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    console.log(`Created new Buy Box job with ID: ${data.id}`);
    return data.id;
  } catch (error) {
    console.error('Error creating new Buy Box job:', error);
    throw error;
  }
}

/**
 * Main function to run the script
 */
async function main() {
  try {
    console.log('Starting clearance and fresh Buy Box check...');

    // Step 1: Clear all existing Buy Box data
    await clearBuyBoxData();

    // Step 2: Create a new job record
    const jobId = await createNewBuyBoxJob();

    // Step 3: Get an access token to use for the API calls
    console.log('Starting fresh Buy Box check with conservative rate limits...');

    // Let's fetch all active ASINs that we need to process
    const { data: asinData, error: asinError } = await supabase
      .from('sku_asin_mapping')
      .select('asin')
      .not('asin', 'is', null);

    if (asinError) {
      throw new Error(`Failed to fetch ASINs: ${asinError.message}`);
    }

    // Extract unique ASINs
    const asins = [...new Set(asinData.map(item => item.asin))];
    console.log(`Found ${asins.length} unique ASINs to process`);

    // We'll need to update this to process all ASINs with rate limiting
    console.log('Processing first few ASINs as a test...');

    // Take first 5 ASINs as a test
    const testAsins = asins.slice(0, 5);

    // Update job with total count
    await supabase
      .from('buybox_jobs')
      .update({
        total_items: asins.length,
        status: 'RUNNING',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Process test ASINs
    for (const asin of testAsins) {
      try {
        console.log(`Processing ASIN: ${asin}`);
        const result = await analyzeBuyBoxStatus(null, asin);

        if (result) {
          // Store the result in the database
          await supabase
            .from('buybox_data')
            .insert({
              run_id: jobId,
              asin: asin,
              total_offers: result.totalOffers,
              buy_box_price: result.buyBoxWinner?.totalPrice,
              lowest_price: result.lowestPrice?.totalPrice,
              highest_price: result.highestPrice?.totalPrice,
              buy_box_seller_id: result.buyBoxWinner?.sellerId,
              you_have_listing: result.youHaveListing,
              offers: result.offers,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          // Update job progress
          await supabase
            .from('buybox_jobs')
            .update({
              processed_items: supabase.raw('processed_items + 1'),
              successful_items: supabase.raw('successful_items + 1'),
              updated_at: new Date().toISOString()
            })
            .eq('id', jobId);
        } else {
          // Log failure
          await supabase
            .from('buybox_failures')
            .insert({
              job_id: jobId,
              asin: asin,
              reason: 'No data returned',
              created_at: new Date().toISOString()
            });

          // Update job progress
          await supabase
            .from('buybox_jobs')
            .update({
              processed_items: supabase.raw('processed_items + 1'),
              failed_items: supabase.raw('failed_items + 1'),
              updated_at: new Date().toISOString()
            })
            .eq('id', jobId);
        }

        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
      } catch (error) {
        console.error(`Error processing ASIN ${asin}:`, error);
        // Log failure
        await supabase
          .from('buybox_failures')
          .insert({
            job_id: jobId,
            asin: asin,
            reason: `Error: ${error.message}`,
            created_at: new Date().toISOString()
          });

        // Update job progress
        await supabase
          .from('buybox_jobs')
          .update({
            processed_items: supabase.raw('processed_items + 1'),
            failed_items: supabase.raw('failed_items + 1'),
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);
      }
    }

    console.log('Test processing completed. Updating job status.');

    // Update job status to indicate more processing needed
    await supabase
      .from('buybox_jobs')
      .update({
        status: 'PARTIAL',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    console.log('Buy Box checking process started successfully.');
    console.log(`Job ID: ${jobId}`);
    console.log('You can monitor progress using the monitor-rate-limiting.js script.');

  } catch (error) {
    console.error('Error during process:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

export { clearBuyBoxData, createNewBuyBoxJob };
