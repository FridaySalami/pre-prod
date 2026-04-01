const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const JOB_ID = 'ffdcac3b-d123-4dec-aca3-e8fb2acc6b40';

async function getJobDetails() {
  console.log(`\n=== Checking job details for: ${JOB_ID} ===\n`);

  try {
    // Get the job record
    const { data: job, error: jobError } = await supabase
      .from('buybox_jobs')
      .select('*')
      .eq('job_id', JOB_ID)
      .single();

    if (jobError) {
      console.error('Error fetching job:', jobError);
      return;
    }

    if (!job) {
      console.log(`No job found with ID: ${JOB_ID}`);
      return;
    }

    // Print job details
    console.log('=== JOB DETAILS ===');
    console.log(JSON.stringify(job, null, 2));
    console.log('\n');

    // Get job results (successful checks)
    const { data: results, error: resultsError } = await supabase
      .from('buybox_data')
      .select('*')
      .eq('job_id', JOB_ID)
      .limit(10); // Limiting to 10 records for readability

    if (resultsError) {
      console.error('Error fetching results:', resultsError);
    } else {
      console.log(`=== JOB RESULTS (${results.length} records, showing first 10) ===`);
      console.log(JSON.stringify(results, null, 2));
      console.log('\n');

      // Get the total count
      const { count, error: countError } = await supabase
        .from('buybox_data')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', JOB_ID);

      if (!countError) {
        console.log(`Total successful results: ${count}`);
      }
    }

    // Get job failures
    const { data: failures, error: failuresError } = await supabase
      .from('buybox_failures')
      .select('*')
      .eq('job_id', JOB_ID)
      .limit(10); // Limiting to 10 records for readability

    if (failuresError) {
      console.error('Error fetching failures:', failuresError);
    } else {
      console.log(`\n=== JOB FAILURES (${failures.length} records, showing first 10) ===`);
      console.log(JSON.stringify(failures, null, 2));

      // Get the total count
      const { count, error: countError } = await supabase
        .from('buybox_failures')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', JOB_ID);

      if (!countError) {
        console.log(`\nTotal failure records: ${count}`);
      }
    }

    // Job progress summary
    if (job.status) {
      console.log('\n=== JOB PROGRESS SUMMARY ===');
      console.log(`Status: ${job.status}`);
      console.log(`Created: ${job.created_at}`);
      console.log(`Last updated: ${job.updated_at}`);
      console.log(`Rate limit: ${job.rate_limit_per_second} req/sec`);

      if (job.progress) {
        const progress = job.progress;
        console.log(`Progress: ${progress.processed_items || 0}/${progress.total_items || job.total_items || '?'} items (${progress.percent_complete?.toFixed(2) || '0'}%)`);
        console.log(`Success: ${progress.successful_items || 0}`);
        console.log(`Failed: ${progress.failed_items || 0}`);
      }
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

getJobDetails().catch(console.error);
