#!/usr/bin/env node

/**
 * Manage Buy Box Monitor Jobs
 * 
 * This script allows you to manage Buy Box Monitor jobs:
 * - Cancel running jobs
 * - View job status
 * - Run a new job with custom settings
 * 
 * Usage:
 *   node manage-buybox-jobs.js cancel <job_id>  - Cancel a running job
 *   node manage-buybox-jobs.js status <job_id>  - Check job status
 *   node manage-buybox-jobs.js list             - List recent jobs
 *   node manage-buybox-jobs.js run              - Run a new job with custom settings
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import process from 'process';
import fetch from 'node-fetch';
import readline from 'readline';

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

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask questions
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Cancel a job
async function cancelJob(jobId) {
  if (!jobId) {
    console.error('Please provide a job ID');
    return;
  }

  console.log(`\n🔄 CANCELLING JOB: ${jobId}`);
  console.log('═'.repeat(60));

  try {
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

    if (!job) {
      console.error('Job not found');
      return;
    }

    console.log('Current Job Status:', job.status);
    console.log('Started At:', new Date(job.started_at).toLocaleString());
    console.log('Total ASINs:', job.total_asins || 0);
    console.log('Processed:', (job.successful_asins || 0) + (job.failed_asins || 0));
    console.log('-'.repeat(60));

    if (job.status !== 'running') {
      console.log(`Job is not running (status: ${job.status}). Only running jobs can be cancelled.`);
      return;
    }

    // Ask for confirmation
    const confirm = await askQuestion('Are you sure you want to cancel this job? (y/n): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('Operation cancelled by user');
      return;
    }

    // Update job status to failed
    const { error: updateError } = await supabase
      .from('buybox_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        notes: 'Manually cancelled via manage-buybox-jobs.js script',
        duration_seconds: Math.floor((Date.now() - new Date(job.started_at).getTime()) / 1000)
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('Error cancelling job:', updateError);
      return;
    }

    console.log(`✅ Job ${jobId} has been cancelled successfully`);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Check job status
async function checkJobStatus(jobId) {
  if (!jobId) {
    console.error('Please provide a job ID');
    return;
  }

  console.log(`\n🔍 CHECKING JOB STATUS: ${jobId}`);
  console.log('═'.repeat(60));

  try {
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

    if (!job) {
      console.error('Job not found');
      return;
    }

    console.log('Job Status:', job.status);
    console.log('Started At:', new Date(job.started_at).toLocaleString());

    if (job.completed_at) {
      console.log('Completed At:', new Date(job.completed_at).toLocaleString());
    }

    console.log('Duration:', job.duration_seconds ? `${job.duration_seconds} seconds` : 'N/A');
    console.log('Total ASINs:', job.total_asins || 0);
    console.log('Successful ASINs:', job.successful_asins || 0);
    console.log('Failed ASINs:', job.failed_asins || 0);
    console.log('Success Rate:', job.total_asins > 0
      ? `${Math.floor((job.successful_asins / job.total_asins) * 100)}%`
      : 'N/A');
    console.log('Source:', job.source || 'N/A');

    if (job.notes) {
      console.log('Notes:', job.notes);
    }

    // Get failure counts for this job
    const { data: failures, error: failuresError } = await supabase
      .from('buybox_failures')
      .select('error_code, count(*)')
      .eq('job_id', jobId)
      .group('error_code');

    if (!failuresError && failures && failures.length > 0) {
      console.log('\nFailure Breakdown:');
      console.log('-'.repeat(60));

      failures.forEach(failure => {
        console.log(`${failure.error_code}: ${failure.count} occurrences`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// List recent jobs
async function listJobs() {
  console.log('\n📋 RECENT BUY BOX JOBS');
  console.log('═'.repeat(60));

  try {
    // Get recent jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('buybox_jobs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10);

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
      return;
    }

    if (!jobs || jobs.length === 0) {
      console.log('No jobs found');
      return;
    }

    console.log('%-36s | %-10s | %-10s | %-10s | %-10s | %-20s',
      'Job ID', 'Status', 'Total', 'Success', 'Failed', 'Started At');
    console.log('-'.repeat(110));

    for (const job of jobs) {
      console.log('%-36s | %-10s | %-10s | %-10s | %-10s | %-20s',
        job.id,
        job.status,
        job.total_asins || 0,
        job.successful_asins || 0,
        job.failed_asins || 0,
        new Date(job.started_at).toLocaleString()
      );
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run a new job with custom settings
async function runNewJob() {
  console.log('\n🚀 START NEW BUY BOX JOB');
  console.log('═'.repeat(60));

  try {
    // Get user input for settings
    console.log('Please enter scan settings (or press enter for defaults):');

    let rateLimit = parseFloat(await askQuestion('Rate Limit (req/sec) [default: 0.5]: ')) || 0.5;
    let jitter = parseInt(await askQuestion('Jitter (ms) [default: 800]: ')) || 800;
    let maxRetries = parseInt(await askQuestion('Max Retries [default: 5]: ')) || 5;

    // Confirm settings
    console.log('\nScan Settings:');
    console.log('- Rate Limit:', rateLimit, 'req/sec');
    console.log('- Jitter:', jitter, 'ms');
    console.log('- Max Retries:', maxRetries);

    const confirm = await askQuestion('\nStart scan with these settings? (y/n): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('Operation cancelled by user');
      return;
    }

    // Create job directly in the database
    const { data: job, error: jobError } = await supabase
      .from('buybox_jobs')
      .insert({
        status: 'running',
        started_at: new Date().toISOString(),
        source: 'cli_tool',
        rate_limit_per_second: rateLimit,
        jitter_ms: jitter,
        max_retries: maxRetries
      })
      .select('*')
      .single();

    if (jobError || !job) {
      console.error('Failed to create job record:', jobError);
      return;
    }

    console.log(`\n✅ Job created with ID: ${job.id}`);
    console.log('Job will start processing ASINs immediately.');
    console.log('You can check the status with:');
    console.log(`node manage-buybox-jobs.js status ${job.id}`);

    // Make a call to start the scan process
    try {
      const apiUrl = 'http://localhost:3000/api/buybox/full-scan';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jobId: job.id,
          rateLimit,
          jitter,
          maxRetries,
          source: 'cli_tool'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error starting scan process:', errorData);
      }
    } catch (error) {
      console.error('Failed to trigger scan process. You may need to start it manually:', error);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Main execution
async function main() {
  try {
    const args = process.argv.slice(2);
    const command = args[0];
    const jobId = args[1];

    if (!command) {
      console.log('\nUsage:');
      console.log('  node manage-buybox-jobs.js cancel <job_id>  - Cancel a running job');
      console.log('  node manage-buybox-jobs.js status <job_id>  - Check job status');
      console.log('  node manage-buybox-jobs.js list             - List recent jobs');
      console.log('  node manage-buybox-jobs.js run              - Run a new job with custom settings');
      rl.close();
      return;
    }

    switch (command) {
      case 'cancel':
        await cancelJob(jobId);
        break;
      case 'status':
        await checkJobStatus(jobId);
        break;
      case 'list':
        await listJobs();
        break;
      case 'run':
        await runNewJob();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        break;
    }

    rl.close();

  } catch (error) {
    console.error('Error:', error);
    rl.close();
  }
}

// Run the script
main();
