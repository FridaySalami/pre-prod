#!/usr/bin/env node
/**
 * restart-buybox-job.js
 * 
 * A command-line utility to restart a stalled or failed buy box job 
 * with more conservative rate limits to avoid Amazon SP-API throttling.
 */

import { createClient } from '@supabase/supabase-js';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables from .env file if present
dotenv.config();

// Supabase configuration
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Verify Supabase configuration
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: Supabase URL and key must be set in .env file');
  console.error('Required variables: PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Create readline interface for user prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Parse command line arguments
 */
function parseArgs() {
  return yargs(hideBin(process.argv))
    .option('job-id', {
      alias: 'j',
      description: 'Job ID to restart (UUID format)',
      type: 'string',
      demandOption: true
    })
    .option('rate-limit', {
      alias: 'r',
      description: 'New rate limit (requests per second)',
      type: 'number',
      default: 0.2
    })
    .option('jitter', {
      alias: 'j',
      description: 'Jitter percentage (0-1)',
      type: 'number',
      default: 0.4
    })
    .option('max-retries', {
      alias: 'm',
      description: 'Maximum retries for each request',
      type: 'number',
      default: 3
    })
    .option('yes', {
      alias: 'y',
      description: 'Skip confirmation prompts',
      type: 'boolean',
      default: false
    })
    .option('copy-only', {
      alias: 'c',
      description: 'Only copy unprocessed ASINs, not completed ones',
      type: 'boolean',
      default: false
    })
    .option('start', {
      alias: 's',
      description: 'Start the job immediately after creation',
      type: 'boolean',
      default: false
    })
    .check((argv) => {
      if (!argv.jobId) {
        throw new Error('Job ID is required');
      }

      // Basic UUID validation (it should have 36 characters with hyphens)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(argv.jobId)) {
        throw new Error('Job ID must be a valid UUID format (e.g., 123e4567-e89b-12d3-a456-426614174000)');
      }

      if (argv.rateLimit <= 0 || argv.rateLimit > 1) {
        throw new Error('Rate limit must be between 0 and 1');
      }
      if (argv.jitter < 0 || argv.jitter > 1) {
        throw new Error('Jitter must be between 0 and 1');
      }
      if (argv.maxRetries < 1) {
        throw new Error('Max retries must be at least 1');
      }
      return true;
    })
    .usage('Usage: $0 --job-id <job_id> [options]')
    .example('$0 --job-id 123e4567-e89b-12d3-a456-426614174000 --rate-limit 0.2', 'Restart job with conservative rate limit')
    .example('$0 --job-id 123e4567-e89b-12d3-a456-426614174000 --start', 'Restart and immediately start the job')
    .help()
    .alias('help', 'h')
    .argv;
}

/**
 * Get job details from Supabase
 */
async function getJobDetails(jobId) {
  const { data, error } = await supabase
    .from('buybox_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    throw new Error(`Failed to get job details: ${error.message}`);
  }

  return data;
}

/**
 * Get processed ASINs for a job
 */
async function getProcessedAsins(jobId) {
  // Get successful ASINs
  const { data: successData, error: successError } = await supabase
    .from('buybox_data')
    .select('asin')
    .eq('run_id', jobId);  // Changed from job_id to run_id based on updated schema

  if (successError) {
    throw new Error(`Failed to get successful ASINs: ${successError.message}`);
  }

  // Get failed ASINs (but not rate-limited ones, we'll retry those)
  const { data: failedData, error: failedError } = await supabase
    .from('buybox_failures')
    .select('asin')
    .eq('job_id', jobId)
    .not('error_code', 'ilike', '%RATE_LIMIT%'); // Updated to match error_code field

  if (failedError) {
    throw new Error(`Failed to get failed ASINs: ${failedError.message}`);
  }

  // Combine and deduplicate
  const processedAsins = [
    ...successData.map(item => item.asin),
    ...failedData.map(item => item.asin)
  ];

  return [...new Set(processedAsins)];
}

/**
 * Get all ASINs for a job
 */
async function getAllAsins(jobId) {
  // First check if we can get the ASINs directly from the buybox_jobs table
  const { data, error } = await supabase
    .from('buybox_jobs')
    .select('total_asins')
    .eq('id', jobId)
    .single();

  if (error) {
    throw new Error(`Failed to get job details: ${error.message}`);
  }

  // Now fetch all ASINs from sku_asin_mapping table where status is Active
  const { data: skuData, error: skuError } = await supabase
    .from('sku_asin_mapping')
    .select('asin1')
    .eq('status', 'Active')
    .not('asin1', 'is', null);

  if (skuError) {
    throw new Error(`Failed to get ASINs: ${skuError.message}`);
  }

  // Extract just the ASIN values from the results
  return skuData.map(item => item.asin1);
}

/**
 * Create a new job
 */
async function createNewJob(originalJob, asins, options) {
  const newJobId = uuidv4();

  const newJob = {
    id: newJobId,
    status: 'running', // Updated to match schema's status values
    started_at: new Date().toISOString(),
    total_asins: asins.length,
    successful_asins: 0,
    failed_asins: 0,
    source: 'manual',
    notes: `Restarted from job ${originalJob.id} with conservative settings: ${options.rateLimit} req/sec, ${(options.jitter * 100).toFixed(0)}% jitter, ${options.maxRetries} retries`,
    rate_limit_per_second: options.rateLimit * 10, // Store as requests per 10 seconds
    jitter_ms: Math.floor(options.jitter * 1000), // Convert jitter percentage to milliseconds
    max_retries: options.maxRetries
  };

  const { data, error } = await supabase
    .from('buybox_jobs')
    .insert([newJob]);

  if (error) {
    throw new Error(`Failed to create new job: ${error.message}`);
  }

  return newJobId;
}

/**
 * Cancel existing job
 */
async function cancelJob(jobId) {
  const { data, error } = await supabase
    .from('buybox_jobs')
    .update({
      status: 'failed', // Updated to match schema's status values
      completed_at: new Date().toISOString(),
      notes: 'Job cancelled manually and replaced with a new job'
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to cancel job: ${error.message}`);
  }

  return true;
}

/**
 * Prompt for confirmation
 */
function promptForConfirmation(message) {
  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Main function
 */
async function main() {
  try {
    // Parse arguments
    const args = parseArgs();

    // Get original job details
    console.log(`Getting details for job ${args.jobId}...`);
    const originalJob = await getJobDetails(args.jobId);

    if (!originalJob) {
      console.error(`Job ${args.jobId} not found`);
      process.exit(1);
    }

    console.log('\nORIGINAL JOB DETAILS:');
    console.log(`Job ID: ${originalJob.id}`);
    console.log(`Status: ${originalJob.status}`);
    console.log(`Started: ${new Date(originalJob.started_at).toLocaleString()}`);
    console.log(`Rate limit: ${originalJob.rate_limit_per_second / 10} req/sec`);
    console.log(`Jitter: ${originalJob.jitter_ms || 'not set'}ms`);
    console.log(`Total ASINs: ${originalJob.total_asins}`);
    console.log(`Successful ASINs: ${originalJob.successful_asins}`);
    console.log(`Failed ASINs: ${originalJob.failed_asins}`);

    // Check if job is already completed or failed
    if (['completed', 'failed'].includes(originalJob.status)) {
      const proceed = args.yes || await promptForConfirmation(
        `Job is already ${originalJob.status}. Do you want to proceed anyway?`
      );

      if (!proceed) {
        console.log('Operation cancelled by user');
        process.exit(0);
      }
    }

    // Get all ASINs
    const allAsins = await getAllAsins(args.jobId);

    // Get processed ASINs
    console.log('\nGetting processed ASINs...');
    const processedAsins = await getProcessedAsins(args.jobId);
    console.log(`Found ${processedAsins.length} processed ASINs`);

    // Calculate unprocessed ASINs
    const unprocessedAsins = allAsins.filter(asin => !processedAsins.includes(asin));
    console.log(`Found ${unprocessedAsins.length} unprocessed ASINs`);

    // Determine which ASINs to include in the new job
    let newJobAsins = [];
    if (args.copyOnly) {
      newJobAsins = unprocessedAsins;
      console.log(`\nCreating new job with ONLY unprocessed ASINs (${newJobAsins.length})`);
    } else {
      newJobAsins = allAsins;
      console.log(`\nCreating new job with ALL ASINs (${newJobAsins.length})`);
    }

    if (newJobAsins.length === 0) {
      console.log('No ASINs to process. Nothing to do.');
      process.exit(0);
    }

    // Show new job settings
    console.log('\nNEW JOB SETTINGS:');
    console.log(`Rate limit: ${args.rateLimit} req/sec (${originalJob.rate_limit_per_second ? originalJob.rate_limit_per_second / 10 : '?'} req/sec in original job)`);
    console.log(`Jitter: ${(args.jitter * 100).toFixed(0)}% (${originalJob.jitter_ms || 'not set'}ms in original job)`);
    console.log(`Max retries: ${args.maxRetries} (${originalJob.max_retries || 3} in original job)`);
    console.log(`ASINs count: ${newJobAsins.length}`);

    // Confirm creation
    const confirmCreate = args.yes || await promptForConfirmation(
      '\nDo you want to create a new job with these settings?'
    );

    if (!confirmCreate) {
      console.log('Operation cancelled by user');
      process.exit(0);
    }

    // Ask if the original job should be cancelled
    let shouldCancelOriginal = false;
    if (!['completed', 'failed'].includes(originalJob.status)) {
      shouldCancelOriginal = args.yes || await promptForConfirmation(
        '\nDo you want to cancel the original job?'
      );
    }

    // Create new job
    console.log('\nCreating new job...');
    const newJobId = await createNewJob(originalJob, newJobAsins, {
      rateLimit: args.rateLimit,
      jitter: args.jitter,
      maxRetries: args.maxRetries
    });

    console.log(`\nSuccess! Created new job with ID: ${newJobId}`);

    // Cancel original job if requested
    if (shouldCancelOriginal) {
      console.log(`\nCancelling original job ${args.jobId}...`);
      await cancelJob(args.jobId);
      console.log('Original job cancelled');
    }

    // Start the job immediately if requested
    if (args.start) {
      console.log('\nStarting the new job immediately...');
      try {
        // Call the local API endpoint directly
        const apiUrl = 'http://localhost:3000/api/buybox/full-scan';
        console.log(`Calling API endpoint: ${apiUrl}`);

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            jobId: newJobId,
            rateLimit: args.rateLimit,
            jitter: args.jitter * 1000, // Convert to ms
            maxRetries: args.maxRetries,
            source: 'restart-script'
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Job started successfully!', data);
        } else {
          try {
            const errorData = await response.json();
            console.error('Failed to start job:', errorData);
          } catch (e) {
            console.error('Failed to start job. Status:', response.status);
          }
        }
      } catch (error) {
        console.error('Error starting job:', error.message);
        console.log('\nYou will need to start the job manually through the API.');
      }
    }

    console.log('\nDONE! Job has been created successfully.');
    console.log(`Job ID: ${newJobId}`);
    console.log('You can monitor this job in the Buy Box Monitor Jobs dashboard.');

    // Close readline interface
    rl.close();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();
