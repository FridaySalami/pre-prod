// Debug script to test job creation in buybox_jobs table
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase configuration. Please check your .env file.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testJobCreation() {
  console.log("Testing connection to Supabase...");

  try {
    // First check if we can connect and if the table exists
    console.log("Checking if buybox_jobs table exists...");
    const { error: tableCheckError } = await supabase
      .from('buybox_jobs')
      .select('id')
      .limit(1);

    if (tableCheckError) {
      console.error("Error checking table:", tableCheckError);
      return;
    }

    console.log("Table exists, attempting to create a test job record...");

    // Attempt to create a job record
    const { data: job, error: jobError } = await supabase
      .from('buybox_jobs')
      .insert({
        status: 'running',
        started_at: new Date().toISOString(),
        source: 'test',
        // Convert to integer for rate_limit_per_second
        rate_limit_per_second: 1,
        jitter_ms: 400,
        max_retries: 3
      })
      .select('*')
      .single();

    if (jobError) {
      console.error("Failed to create job record:", jobError);

      // Check database schema
      console.log("\nChecking table schema...");
      const { data: schema, error: schemaError } = await supabase
        .rpc('get_table_definition', { table_name: 'buybox_jobs' });

      if (schemaError) {
        console.error("Error fetching schema:", schemaError);
      } else {
        console.log("Table definition:", schema);
      }
    } else {
      console.log("Successfully created job record:", job);

      // Clean up
      console.log("\nCleaning up test record...");
      const { error: deleteError } = await supabase
        .from('buybox_jobs')
        .delete()
        .eq('id', job.id);

      if (deleteError) {
        console.error("Error cleaning up:", deleteError);
      } else {
        console.log("Test record deleted");
      }
    }
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

testJobCreation();
