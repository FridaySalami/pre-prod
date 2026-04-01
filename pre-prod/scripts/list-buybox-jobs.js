#!/usr/bin/env node
/**
 * list-buybox-jobs.js
 * 
 * A simple utility to list all Buy Box jobs in the Supabase database.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

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
    console.log('Fetching Buy Box jobs...\n');

    // Get all jobs, sorted by started_at in descending order (newest first)
    const { data: jobs, error } = await supabase
      .from('buybox_jobs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(`Failed to fetch jobs: ${error.message}`);
    }

    if (!jobs || jobs.length === 0) {
      console.log('No Buy Box jobs found in the database.');
      return;
    }

    console.log(`Found ${jobs.length} jobs. Showing latest 10:`);
    console.log('==================================================');

    // Display job information
    jobs.forEach((job, index) => {
      console.log(`[${index + 1}] Job ID: ${job.id}`);
      console.log(`    Status: ${job.status}`);
      console.log(`    Started: ${new Date(job.started_at).toLocaleString()}`);
      console.log(`    ASINs: ${job.total_asins} total, ${job.successful_asins} successful, ${job.failed_asins} failed`);
      console.log(`    Source: ${job.source}`);

      if (job.notes) {
        console.log(`    Notes: ${job.notes}`);
      }

      console.log('--------------------------------------------------');
    });

    console.log('\nTo restart a job, use:');
    console.log(`node restart-buybox-job.js --job-id <JOB_ID> --rate-limit 0.2 --jitter 0.4 --max-retries 3`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();
