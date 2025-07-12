import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import process from 'process';

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

async function checkJobDetails(jobId) {
  console.log(`🔍 Looking up job with ID: ${jobId}`);

  try {
    // Query the buybox_jobs table for the specific ID
    const { data: jobData, error: jobError } = await supabase
      .from('buybox_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError) {
      console.error('❌ Error querying buybox_jobs:', jobError);
      return;
    }

    if (!jobData) {
      console.log(`⚠️ No job found with ID: ${jobId}`);
      return;
    }

    // Print job details in a formatted way
    console.log('\n📊 === BUY BOX JOB DETAILS ===');
    console.log(`\n🏷️  Basic Info:`);
    console.log(`ID: ${jobData.id}`);
    console.log(`Status: ${jobData.status}`);
    console.log(`Created at: ${new Date(jobData.created_at).toLocaleString()}`);
    console.log(`Started at: ${jobData.started_at ? new Date(jobData.started_at).toLocaleString() : 'N/A'}`);
    console.log(`Completed at: ${jobData.completed_at ? new Date(jobData.completed_at).toLocaleString() : 'N/A'}`);

    console.log(`\n⚙️  Job Configuration:`);
    console.log(`Rate Limit: ${jobData.rate_limit || 'N/A'} requests/sec`);
    console.log(`Total Items: ${jobData.total_items || 'Unknown'}`);
    console.log(`Items Processed: ${jobData.items_processed || 0}`);
    console.log(`Items Succeeded: ${jobData.items_succeeded || 0}`);
    console.log(`Items Failed: ${jobData.items_failed || 0}`);
    console.log(`Progress: ${jobData.total_items ? Math.round((jobData.items_processed / jobData.total_items) * 100) : 0}%`);

    if (jobData.error_message) {
      console.log(`\n❌ Last Error Message:`);
      console.log(jobData.error_message);
    }

    if (jobData.metadata) {
      console.log(`\n📝 Metadata:`);
      console.log(JSON.stringify(jobData.metadata, null, 2));
    }

    // Get statistics for the job
    console.log(`\n📈 Results Statistics:`);

    // Query for buy box winners
    const { count: winnerCount, error: winnerError } = await supabase
      .from('buybox_data')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .eq('is_winner', true);

    if (!winnerError) {
      console.log(`Buy Box Winners: ${winnerCount}`);
    }

    // Query for opportunities
    const { count: opportunityCount, error: opportunityError } = await supabase
      .from('buybox_data')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .eq('opportunity_flag', true);

    if (!opportunityError) {
      console.log(`Opportunity Flags: ${opportunityCount}`);
    }

    // Check failures
    const { data: failureData, error: failureError } = await supabase
      .from('buybox_failures')
      .select('*')
      .eq('job_id', jobId);

    if (!failureError) {
      console.log(`\n⚠️ Failures: ${failureData.length}`);

      if (failureData.length > 0) {
        // Group failures by reason
        const reasonCounts = {};
        failureData.forEach(failure => {
          const reason = failure.reason || 'Unknown';
          reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
        });

        console.log('\nFailure Reasons:');
        Object.entries(reasonCounts)
          .sort((a, b) => b[1] - a[1])
          .forEach(([reason, count]) => {
            console.log(`- ${reason}: ${count}`);
          });

        // Show the first 5 failures
        console.log('\nSample Failures:');
        failureData.slice(0, 5).forEach((failure, i) => {
          console.log(`\nFailure ${i + 1}:`);
          console.log(`ID: ${failure.id}`);
          console.log(`ASIN: ${failure.asin}`);
          console.log(`SKU: ${failure.sku}`);
          console.log(`Attempt: ${failure.attempt_number}`);
          console.log(`Error: ${failure.reason}`);
          console.log(`Time: ${new Date(failure.captured_at).toLocaleString()}`);
          if (failure.details) {
            console.log(`Details: ${JSON.stringify(failure.details, null, 2)}`);
          }
        });
      }
    }

    // Raw job data
    console.log('\n🔍 Raw Job Data (JSON):');
    console.log(JSON.stringify(jobData, null, 2));

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

// Get the job ID from command line argument
const jobId = process.argv[2];

if (!jobId) {
  console.error('❌ No job ID provided');
  console.log('Usage: node check-specific-job.js <job_id>');
  process.exit(1);
}

// Run the query
checkJobDetails(jobId);
