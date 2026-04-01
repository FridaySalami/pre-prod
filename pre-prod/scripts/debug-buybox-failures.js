#!/usr/bin/env node

/**
 * Debug Buy Box Failures
 * 
 * This script analyzes buy box failures and provides options to:
 * 1. Show failure statistics
 * 2. Retry failed ASINs for a specific job
 * 3. Reset a job's status for re-running
 * 
 * Usage:
 *   node debug-buybox-failures.js stats
 *   node debug-buybox-failures.js failures [job_id]
 *   node debug-buybox-failures.js retry [job_id]
 *   node debug-buybox-failures.js reset [job_id]
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import process from 'process';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

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

// Check Buy Box status using my-buy-box-monitor.cjs
async function checkBuyBox(asin) {
  return new Promise((resolve, reject) => {
    const buyBoxScript = path.join(process.cwd(), 'my-buy-box-monitor.cjs');

    // Check if script exists
    if (!fs.existsSync(buyBoxScript)) {
      console.warn('Buy Box checker script not found, returning mock data');
      return reject(new Error('Buy Box checker script not found'));
    }

    const childProcess = spawn('node', [buyBoxScript, asin, '--json']);

    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    childProcess.on('close', (code) => {
      // Clean stdout to handle any potential non-JSON content before or after the JSON
      const cleanedOutput = stdout.trim();

      if (code !== 0) {
        console.error(`Buy Box checker exited with code ${code}`);
        console.error(`stderr: ${stderr}`);

        // If we have stderr that mentions rate limiting, explicitly mark as rate limit error
        if (stderr.includes("429") || stderr.includes("rate") || stderr.includes("limit") || stderr.includes("throttl")) {
          return reject(new Error('Rate limit exceeded (429)'));
        }

        return reject(new Error(`Buy Box check failed: ${stderr.substring(0, 100)}`));
      }

      try {
        // If output is empty, reject with specific message
        if (!cleanedOutput) {
          return reject(new Error('Buy Box checker returned empty output'));
        }

        // Look for a JSON object in the output
        let jsonStartPos = cleanedOutput.indexOf('{');
        let jsonEndPos = cleanedOutput.lastIndexOf('}');

        if (jsonStartPos === -1 || jsonEndPos === -1) {
          console.error('Failed to find valid JSON in output:', cleanedOutput);
          return reject(new Error('No valid JSON in Buy Box data'));
        }

        const jsonStr = cleanedOutput.substring(jsonStartPos, jsonEndPos + 1);
        const result = JSON.parse(jsonStr);

        // Validate required fields
        if (!result.asin) {
          console.error('Missing required fields in Buy Box data:', result);
          return reject(new Error('Invalid Buy Box data format'));
        }

        resolve(result);
      } catch (error) {
        console.error('Failed to parse Buy Box checker output:', error);
        console.error('Raw output:', stdout.substring(0, 200) + '...');
        reject(new Error('Failed to parse Buy Box data'));
      }
    });
  });
}

// Show failure statistics
async function showStats() {
  console.log('\n📊 BUY BOX FAILURE STATISTICS');
  console.log('═'.repeat(60));

  // Get overall statistics
  const { data: jobs, error: jobsError } = await supabase
    .from('buybox_jobs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(10);

  if (jobsError) {
    console.error('Error fetching jobs:', jobsError);
    return;
  }

  console.log('🔄 Recent Jobs:');
  console.log('-'.repeat(60));
  console.log('%-36s | %-10s | %-10s | %-10s | %-10s', 'Job ID', 'Status', 'Total', 'Success', 'Failed');
  console.log('-'.repeat(60));

  for (const job of jobs) {
    console.log('%-36s | %-10s | %-10d | %-10d | %-10d',
      job.id,
      job.status,
      job.total_asins || 0,
      job.successful_asins || 0,
      job.failed_asins || 0
    );
  }

  // Get failure reasons (using raw counts instead of group by)
  const { data: failures, error: failuresError } = await supabase
    .from('buybox_failures')
    .select('*');

  if (failuresError) {
    console.error('Error fetching failures:', failuresError);
    return;
  }

  // Count by error code manually
  const errorCounts = {};
  if (failures) {
    failures.forEach(failure => {
      const code = failure.error_code || 'UNKNOWN';
      errorCounts[code] = (errorCounts[code] || 0) + 1;
    });
  }

  console.log('\n🚨 Failure Reasons:');
  console.log('-'.repeat(60));
  console.log('%-30s | %-10s', 'Error Code', 'Count');
  console.log('-'.repeat(60));

  for (const [code, count] of Object.entries(errorCounts)) {
    console.log('%-30s | %-10d', code, count);
  }
}

// Show failures for a specific job
async function showFailures(jobId) {
  if (!jobId) {
    console.error('Please provide a job ID');
    return;
  }

  console.log(`\n🚨 FAILURES FOR JOB: ${jobId}`);
  console.log('═'.repeat(60));

  // Get job details
  const { data: job, error: jobError } = await supabase
    .from('buybox_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError) {
    console.error('Error fetching job:', jobError);
    return;
  }

  console.log('Job Status:', job.status);
  console.log('Started At:', new Date(job.started_at).toLocaleString());
  console.log('Total ASINs:', job.total_asins || 0);
  console.log('Successful:', job.successful_asins || 0);
  console.log('Failed:', job.failed_asins || 0);
  console.log('Notes:', job.notes || 'N/A');
  console.log('-'.repeat(60));

  // Get failures for this job
  const { data: failures, error: failuresError } = await supabase
    .from('buybox_failures')
    .select('*')
    .eq('job_id', jobId);

  if (failuresError) {
    console.error('Error fetching failures:', failuresError);
    return;
  }

  if (!failures || failures.length === 0) {
    console.log('No failures recorded for this job.');
    return;
  }

  // Group failures by error code
  const errorGroups = {};
  failures.forEach(failure => {
    if (!errorGroups[failure.error_code]) {
      errorGroups[failure.error_code] = [];
    }
    errorGroups[failure.error_code].push(failure);
  });

  // Display failures by group
  for (const [errorCode, errorFailures] of Object.entries(errorGroups)) {
    console.log(`\n🔴 Error Code: ${errorCode} (${errorFailures.length} occurrences)`);
    console.log('-'.repeat(60));

    // Show sample error messages
    const uniqueReasons = new Set();
    errorFailures.forEach(f => uniqueReasons.add(f.reason));

    console.log('Sample error reasons:');
    Array.from(uniqueReasons).slice(0, 3).forEach(reason => {
      console.log(`- ${reason}`);
    });

    // Show up to 5 examples
    console.log('\nSample failures:');
    errorFailures.slice(0, 5).forEach(failure => {
      console.log(`- ASIN: ${failure.asin}, SKU: ${failure.sku || 'N/A'}, Attempts: ${failure.attempt_number}`);
    });
  }

  console.log(`\nTotal failures: ${failures.length}`);
}

// Retry failed ASINs for a specific job
async function retryFailedAsins(jobId) {
  if (!jobId) {
    console.error('Please provide a job ID');
    return;
  }

  console.log(`\n🔄 RETRYING FAILED ASINS FOR JOB: ${jobId}`);
  console.log('═'.repeat(60));

  // Get failures for this job
  const { data: failures, error: failuresError } = await supabase
    .from('buybox_failures')
    .select('*')
    .eq('job_id', jobId);

  if (failuresError) {
    console.error('Error fetching failures:', failuresError);
    return;
  }

  if (!failures || failures.length === 0) {
    console.log('No failures to retry for this job.');
    return;
  }

  console.log(`Found ${failures.length} failures to retry.`);
  console.log('This will retry each ASIN with a delay between requests to avoid rate limits.');
  console.log('Press Ctrl+C to abort at any time.');

  // Wait for confirmation
  await new Promise(resolve => {
    console.log('\nPress Enter to continue...');
    process.stdin.once('data', () => resolve());
  });

  // Create a new retry job
  const { data: retryJob, error: jobError } = await supabase
    .from('buybox_jobs')
    .insert({
      status: 'running',
      started_at: new Date().toISOString(),
      source: `retry_${jobId}`,
      total_asins: failures.length,
      successful_asins: 0,
      failed_asins: 0
    })
    .select('*')
    .single();

  if (jobError) {
    console.error('Failed to create retry job:', jobError);
    return;
  }

  console.log(`Created retry job: ${retryJob.id}`);
  console.log('-'.repeat(60));

  // Track progress
  let successCount = 0;
  let failureCount = 0;

  // Process each failed ASIN with a delay
  for (const [index, failure] of failures.entries()) {
    const { asin, sku } = failure;
    console.log(`[${index + 1}/${failures.length}] Retrying ASIN: ${asin} (SKU: ${sku || 'N/A'})`);

    try {
      // Get Buy Box data
      const buyBoxData = await checkBuyBox(asin);

      // Store the result in buybox_data
      await supabase
        .from('buybox_data')
        .insert({
          run_id: retryJob.id,
          asin: asin,
          sku: sku,
          is_winner: buyBoxData.youOwnBuyBox === true,
          source: 'retry'
        });

      console.log(`✅ Successfully processed ASIN: ${asin}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to process ASIN ${asin}:`, error.message);

      // Log the failure
      await supabase
        .from('buybox_failures')
        .insert({
          job_id: retryJob.id,
          asin: asin,
          sku: sku,
          reason: `Retry failed: ${error.message}`,
          error_code: 'RETRY_FAILED',
          attempt_number: 1
        });

      failureCount++;
    }

    // Update job progress
    await supabase
      .from('buybox_jobs')
      .update({
        successful_asins: successCount,
        failed_asins: failureCount
      })
      .eq('id', retryJob.id);

    // Add a delay between requests (3 seconds)
    if (index < failures.length - 1) {
      const delayMs = 3000;
      console.log(`Waiting ${delayMs}ms before next request...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Update job as completed
  await supabase
    .from('buybox_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      successful_asins: successCount,
      failed_asins: failureCount,
      duration_seconds: Math.floor((Date.now() - new Date(retryJob.started_at).getTime()) / 1000)
    })
    .eq('id', retryJob.id);

  console.log('\n📊 RETRY SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Total ASINs processed: ${failures.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failureCount}`);
  console.log(`Success rate: ${Math.round((successCount / failures.length) * 100)}%`);
}

// Reset a job's status for re-running
async function resetJob(jobId) {
  if (!jobId) {
    console.error('Please provide a job ID');
    return;
  }

  console.log(`\n🔄 RESETTING JOB: ${jobId}`);
  console.log('═'.repeat(60));

  // Get job details
  const { data: job, error: jobError } = await supabase
    .from('buybox_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError) {
    console.error('Error fetching job:', jobError);
    return;
  }

  console.log('Current Job Status:', job.status);
  console.log('Started At:', new Date(job.started_at).toLocaleString());
  console.log('Total ASINs:', job.total_asins || 0);
  console.log('-'.repeat(60));
  console.log('This will reset the job status to "failed" and clear progress counters.');
  console.log('You can then restart the scan process with the same job ID.');

  // Wait for confirmation
  await new Promise(resolve => {
    console.log('\nPress Enter to continue...');
    process.stdin.once('data', () => resolve());
  });

  // Update job status
  const { error: updateError } = await supabase
    .from('buybox_jobs')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      notes: 'Job manually reset for debugging',
      successful_asins: 0,
      failed_asins: 0
    })
    .eq('id', jobId);

  if (updateError) {
    console.error('Error updating job:', updateError);
    return;
  }

  console.log(`✅ Job ${jobId} has been reset to failed status.`);
  console.log('You can now restart the scan with this job ID if needed.');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const jobId = args[1];

  if (!command) {
    console.log('\nUsage:');
    console.log('  node debug-buybox-failures.js stats              - Show failure statistics');
    console.log('  node debug-buybox-failures.js failures [job_id]  - Show failures for a specific job');
    console.log('  node debug-buybox-failures.js retry [job_id]     - Retry failed ASINs for a job');
    console.log('  node debug-buybox-failures.js reset [job_id]     - Reset a job\'s status');
    process.exit(1);
  }

  switch (command) {
    case 'stats':
      await showStats();
      break;
    case 'failures':
      await showFailures(jobId);
      break;
    case 'retry':
      await retryFailedAsins(jobId);
      break;
    case 'reset':
      await resetJob(jobId);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      break;
  }
}

// Run the script
main().catch(console.error).finally(() => process.exit(0));
