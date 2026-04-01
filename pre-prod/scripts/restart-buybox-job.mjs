#!/usr/bin/env node
/**
 * restart-buybox-job.mjs
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

// Load environment variables from .env file if present
dotenv.config();

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
      description: 'Job ID to restart',
      type: 'string'
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
    .check((argv) => {
      if (!argv.jobId) {
        throw new Error('Job ID is required');
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
    .example('$0 --job-id abc123 --rate-limit 0.2 --jitter 0.4 --max-retries 3', 'Restart job with conservative settings')
    .help()
    .alias('help', 'h')
    .parseSync();
}

/**
 * Prompt for user confirmation
 * @param {string} question - The question to ask
 * @returns {Promise<boolean>} User's response (true for yes, false for no)
 */
function promptForConfirmation(question) {
  return new Promise((resolve) => {
    rl.question(`${question} (y/n): `, (answer) => {
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

/**
 * Get job details from Supabase
 * @param {string} jobId - The job ID to fetch
 * @returns {Promise<object>} Job details
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

  if (!data) {
    throw new Error(`Job with ID ${jobId} not found`);
  }

  return data;
}

/**
 * Get unprocessed ASINs from job
 * @param {string} jobId - The job ID
 * @param {number} totalAsins - Total ASINs in the job
 * @returns {Promise<Array>} List of unprocessed ASINs
 */
async function getUnprocessedAsins(jobId, totalAsins) {
  // Get all processed ASINs
  const { data: processedData, error: processedError } = await supabase
    .from('buybox_data')
    .select('asin')
    .eq('run_id', jobId);

  if (processedError) {
    throw new Error(`Failed to get processed ASINs: ${processedError.message}`);
  }

  // Get all failed ASINs
  const { data: failedData, error: failedError } = await supabase
    .from('buybox_failures')
    .select('asin')
    .eq('job_id', jobId);

  if (failedError) {
    throw new Error(`Failed to get failed ASINs: ${failedError.message}`);
  }

  // Get all enabled ASINs for monitoring
  const { data: allAsins, error: asinsError } = await supabase
    .from('sku_asin_mapping')
    .select('asin1')
    .eq('monitoring_enabled', true)
    .not('asin1', 'is', null)
    .order('asin1');

  if (asinsError) {
    throw new Error(`Failed to get all ASINs: ${asinsError.message}`);
  }

  // Create sets for quick lookup
  const processedSet = new Set(processedData.map(item => item.asin));
  const failedSet = new Set(failedData.map(item => item.asin));

  // Get ASINs that haven't been processed or failed
  const unprocessedAsins = allAsins
    .filter(item => !processedSet.has(item.asin1) && !failedSet.has(item.asin1))
    .map(item => ({ asin: item.asin1 }));

  return unprocessedAsins;
}

/**
 * Create a new job
 * @param {object} originalJob - Original job details
 * @param {Array} asins - ASINs to process
 * @param {object} options - Job options
 * @returns {Promise<string>} New job ID
 */
async function createNewJob(originalJob, asins, options) {
  const newJobId = uuidv4();

  const { error } = await supabase
    .from('buybox_jobs')
    .insert({
      id: newJobId,
      status: 'pending', // Will be started by API
      started_at: new Date().toISOString(),
      total_asins: asins.length,
      source: `restart_from_${originalJob.id.slice(0, 8)}`,
      rate_limit_per_second: Math.round(options.rateLimit * 10),
      jitter_ms: Math.round(options.jitter * 1000),
      max_retries: options.maxRetries,
      notes: `Restarted from job ${originalJob.id} with more conservative settings`
    });

  if (error) {
    throw new Error(`Failed to create new job: ${error.message}`);
  }

  return newJobId;
}

/**
 * Cancel a job
 * @param {string} jobId - The job ID to cancel
 */
async function cancelJob(jobId) {
  const { error } = await supabase
    .from('buybox_jobs')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
      notes: 'Cancelled by restart-buybox-job.mjs script'
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to cancel job: ${error.message}`);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Parse command line arguments
    const args = parseArgs();

    // Get job details
    console.log(`\nFetching details for job ${args.jobId}...`);
    const originalJob = await getJobDetails(args.jobId);
    console.log(`Found job: ${originalJob.id}`);
    console.log(`Status: ${originalJob.status}`);
    console.log(`ASINs: ${originalJob.total_asins} total, ${originalJob.successful_asins} successful, ${originalJob.failed_asins} failed`);

    if (originalJob.status === 'running') {
      console.log('\nWARNING: This job is currently running!');
      const shouldContinue = args.yes || await promptForConfirmation(
        'Do you want to continue anyway?'
      );

      if (!shouldContinue) {
        console.log('Operation cancelled');
        process.exit(1);
      }
    }

    // Calculate ASINs to process
    console.log('\nCalculating ASINs to process...');

    let newJobAsins = [];

    if (args.copyOnly) {
      // Only include ASINs that haven't been processed yet
      console.log('Including only unprocessed ASINs...');
      newJobAsins = await getUnprocessedAsins(args.jobId, originalJob.total_asins);
    } else {
      // Include all ASINs from original job
      console.log('Including all ASINs from original job...');
      const { data: allAsins, error: asinsError } = await supabase
        .from('sku_asin_mapping')
        .select('asin1')
        .eq('monitoring_enabled', true)
        .not('asin1', 'is', null)
        .order('asin1');

      if (asinsError) {
        throw new Error(`Failed to get all ASINs: ${asinsError.message}`);
      }

      newJobAsins = allAsins.map(item => ({ asin: item.asin1 }));
    }

    console.log(`New job will process ${newJobAsins.length} ASINs`);

    if (newJobAsins.length === 0) {
      console.log('\nNo ASINs to process! Operation cancelled.');
      process.exit(0);
    }

    // Show settings
    console.log('\nNew job settings:');
    console.log(`- Rate limit: ${args.rateLimit} requests/second`);
    console.log(`- Jitter: ${args.jitter * 100}%`);
    console.log(`- Max retries: ${args.maxRetries}`);

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
    if (!['COMPLETED', 'CANCELLED', 'FAILED'].includes(originalJob.status)) {
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

    console.log('\nDONE! New job is ready to be started by the API.');
    console.log(`To start the job, make a request to: POST /api/buybox/jobs/${newJobId}/start`);

    // Close readline interface
    rl.close();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();
