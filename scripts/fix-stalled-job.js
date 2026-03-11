// Script to fix the stalled job
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase configuration. Please check your .env file.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixStalledJob() {
  try {
    // Find running jobs with 0 rate_limit_per_second
    console.log("Looking for stalled jobs...");
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
      console.log("No running jobs found");
      return;
    }

    for (const job of jobs) {
      console.log(`Found job: ${job.id}`);
      console.log(`Current rate_limit_per_second: ${job.rate_limit_per_second}`);

      if (job.rate_limit_per_second <= 0) {
        console.log(`This job has a rate_limit of ${job.rate_limit_per_second}, which can cause it to stall.`);

        // Ask for confirmation before updating
        console.log("Fixing the job by setting rate_limit_per_second to 5 (0.5 req/s)...");

        const { error: updateError } = await supabase
          .from('buybox_jobs')
          .update({
            rate_limit_per_second: 5 // Set to 5 which means 0.5 req/sec
          })
          .eq('id', job.id);

        if (updateError) {
          console.error("Error updating job:", updateError);
        } else {
          console.log("✅ Job updated successfully!");
          console.log("The job should now continue processing. Check the UI in a minute to see progress.");
        }
      } else {
        console.log("This job has a valid rate limit and should be processing normally.");
        console.log("If it's still not processing, there might be another issue.");
      }
    }
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

fixStalledJob();
