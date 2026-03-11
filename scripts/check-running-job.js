// Script to check status of running jobs in the database
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase configuration. Please check your .env file.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkRunningJob() {
  try {
    // Get the currently running job
    console.log("Checking for running jobs...");
    const { data: runningJobs, error: jobError } = await supabase
      .from('buybox_jobs')
      .select('*')
      .eq('status', 'running')
      .order('started_at', { ascending: false });

    if (jobError) {
      console.error("Error fetching jobs:", jobError);
      return;
    }

    if (!runningJobs || runningJobs.length === 0) {
      console.log("No running jobs found");

      // Check for recently completed or failed jobs
      const { data: recentJobs } = await supabase
        .from('buybox_jobs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(3);

      if (recentJobs && recentJobs.length > 0) {
        console.log("\nMost recent jobs:");
        recentJobs.forEach(job => {
          console.log(`- ID: ${job.id}`);
          console.log(`  Status: ${job.status}`);
          console.log(`  Started: ${job.started_at}`);
          console.log(`  Completed: ${job.completed_at || 'N/A'}`);
          console.log(`  ASINs: ${job.successful_asins + job.failed_asins}/${job.total_asins}`);
          console.log(`  Notes: ${job.notes || 'None'}`);
          console.log("");
        });
      }
      return;
    }

    // Display details for running jobs
    console.log(`Found ${runningJobs.length} running jobs:`);
    for (const job of runningJobs) {
      console.log(`\nRunning Job ID: ${job.id}`);
      console.log(`Started at: ${new Date(job.started_at).toLocaleString()}`);
      console.log(`Source: ${job.source}`);
      console.log(`Total ASINs: ${job.total_asins}`);
      console.log(`Processed: ${job.successful_asins + job.failed_asins} of ${job.total_asins} ASINs`);
      console.log(`Success: ${job.successful_asins} / Failed: ${job.failed_asins}`);
      console.log(`Rate limit: ${job.rate_limit_per_second} requests/second`);
      console.log(`Jitter: ${job.jitter_ms}ms`);
      console.log(`Max retries: ${job.max_retries}`);

      // Check the progress in more detail
      if (job.total_asins > 0 && job.successful_asins + job.failed_asins === 0) {
        console.log("\n⚠️ WARNING: Job is running but no ASINs have been processed yet");
        console.log("Let's check the database for any SKUs that should be processed:");

        const { data: skus, error: skusError } = await supabase
          .from('sku_asin_mapping')
          .select('seller_sku, asin1')
          .eq('monitoring_enabled', true)
          .not('asin1', 'is', null)
          .limit(5);

        if (skusError) {
          console.log("Error fetching SKUs:", skusError);
        } else {
          console.log(`\nFound ${skus?.length || 0} SKUs with monitoring enabled:`);
          if (skus && skus.length > 0) {
            skus.forEach((sku, i) => {
              console.log(`${i + 1}. SKU: ${sku.seller_sku}, ASIN: ${sku.asin1}`);
            });
            console.log(`...and more`);
          } else {
            console.log("No SKUs found with monitoring enabled! This could be the problem.");
          }
        }
      }

      // Check for any failures
      console.log("\nChecking for recent failures for this job...");
      const { data: failures, error: failuresError } = await supabase
        .from('buybox_failures')
        .select('*')
        .eq('job_id', job.id)
        .limit(5);

      if (failuresError) {
        console.log("Error fetching failures:", failuresError);
      } else if (failures && failures.length > 0) {
        console.log(`Found ${failures.length} recent failures:`);
        failures.forEach(failure => {
          console.log(`- ASIN: ${failure.asin}, SKU: ${failure.sku || 'N/A'}`);
          console.log(`  Reason: ${failure.reason}`);
          console.log(`  Error code: ${failure.error_code || 'N/A'}`);
          console.log(`  Attempt: ${failure.attempt_number}`);
          console.log("");
        });
      } else {
        console.log("No failures found for this job");
      }
    }
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

checkRunningJob();
