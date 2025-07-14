// Quick script to check CON12B-003 data
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSkuData() {
  console.log('Checking CON12B-003 data...\n');

  // Get recent data for this SKU
  const { data, error } = await supabase
    .from('buybox_data')
    .select('*')
    .eq('sku', 'CON12B-003')
    .order('captured_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No data found for CON12B-003');
    return;
  }

  console.log(`Found ${data.length} recent records for CON12B-003:`);
  console.log('='.repeat(60));

  data.forEach((item, i) => {
    console.log(`${i + 1}. Captured: ${new Date(item.captured_at).toLocaleString()}`);
    console.log(`   Price: £${item.price}`);
    console.log(`   Competitor Price: £${item.competitor_price || 'N/A'}`);
    console.log(`   Is Winner: ${item.is_winner}`);
    console.log(`   Job ID: ${item.job_id}`);
    console.log(`   ASIN: ${item.asin}`);
    console.log('   ---');
  });

  // Also check the latest job info
  const { data: jobs, error: jobError } = await supabase
    .from('buybox_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  if (!jobError && jobs) {
    console.log('\nRecent Buy Box Jobs:');
    console.log('='.repeat(40));
    jobs.forEach((job, i) => {
      console.log(`${i + 1}. Job ID: ${job.id}`);
      console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
      console.log(`   Status: ${job.status}`);
      console.log(`   Items Processed: ${job.items_processed || 'N/A'}`);
      console.log('   ---');
    });
  }
}

checkSkuData().catch(console.error);
