// Script to cancel stuck jobs and start a new one with more conservative settings
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase configuration. Please check your .env file.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function restartJobWithConservativeRate() {
  try {
    // Find running jobs
    console.log("Looking for running jobs to cancel...");
    const { data: jobs, error: jobError } = await supabase
      .from('buybox_jobs')
      .select('*')
      .eq('status', 'running')
      .order('started_at', { ascending: false });

    if (jobError) {
      console.error("Error fetching jobs:", jobError);
      return;
    }

    if (!jobs || jobs.length === 0) {
      console.log("No running jobs found to cancel");
      return;
    }

    // Cancel running jobs
    for (const job of jobs) {
      console.log(`Cancelling job: ${job.id}...`);

      const { error: updateError } = await supabase
        .from('buybox_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          notes: 'Manually cancelled due to Amazon rate limiting'
        })
        .eq('id', job.id);

      if (updateError) {
        console.error(`Error cancelling job ${job.id}:`, updateError);
      } else {
        console.log(`✅ Job ${job.id} cancelled successfully`);
      }
    }

    // Wait a bit for the database to update
    console.log("\nWaiting 2 seconds before starting a new job...");
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Start a new job with much more conservative settings
    console.log("\nStarting a new job with very conservative settings...");
    const rateLimit = 0.2; // Just 1 request every 5 seconds
    const jitter = 1500;   // Large jitter to randomize requests
    const maxRetries = 5;  // More retries for each ASIN

    try {
      // Use the server API endpoint to start a new job
      const response = await fetch('http://localhost:3000/api/buybox/full-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rateLimit,
          jitter,
          maxRetries,
          source: 'recovery-script'
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to start new job: ${response.status} ${errorData}`);
      }

      const data = await response.json();
      console.log(`✅ New job started with ID: ${data.jobId}`);
      console.log(`Rate limit: ${rateLimit} req/s (1 request every ${Math.round(1 / rateLimit)} seconds)`);
      console.log(`Jitter: ${jitter}ms`);
      console.log(`Max retries: ${maxRetries}`);
      console.log("\nThis job will process ASINs much more slowly, but should avoid rate limits.");
      console.log("Check the UI in a few minutes to see progress.");
    } catch (error) {
      console.error("Error starting new job:", error);
    }
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

restartJobWithConservativeRate();
