// Script to manually check the Buy Box for a specific ASIN
import { exec } from 'child_process';
import { promisify } from 'util';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const execPromise = promisify(exec);

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase configuration. Please check your .env file.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testBuyBoxCheck() {
  try {
    // Get a sample SKU/ASIN
    console.log("Fetching a sample SKU/ASIN from the database...");
    const { data: skus, error: skusError } = await supabase
      .from('sku_asin_mapping')
      .select('seller_sku, asin1')
      .eq('monitoring_enabled', true)
      .not('asin1', 'is', null)
      .limit(1);

    if (skusError) {
      console.error("Error fetching SKUs:", skusError);
      return;
    }

    if (!skus || skus.length === 0) {
      console.log("No SKUs found with monitoring enabled");
      return;
    }

    const sku = skus[0];
    console.log(`Testing Buy Box check for SKU: ${sku.seller_sku}, ASIN: ${sku.asin1}`);

    // Call the Buy Box checker script directly
    console.log("\nRunning Buy Box checker for this ASIN...");

    const command = `node my-buy-box-monitor.cjs ${sku.asin1}`;
    const { stdout, stderr } = await execPromise(command);

    if (stderr) {
      console.error("Error running Buy Box checker:", stderr);
    } else {
      console.log("Buy Box checker output:");
      console.log(stdout);

      try {
        // Try to parse the JSON response
        const result = JSON.parse(stdout);
        console.log("\nBuy Box data parsed successfully!");
        console.log(`ASIN: ${result.asin}`);
        console.log(`Is Winner: ${result.isWinner}`);
        console.log(`Price: ${result.price}`);
      } catch (parseError) {
        console.error("Failed to parse Buy Box checker output as JSON:", parseError);
      }
    }

    // Check if the underlying script exists and is accessible
    console.log("\nChecking if Buy Box monitor script exists...");
    try {
      await execPromise('ls -la my-buy-box-monitor.cjs');
      console.log("✅ Buy Box monitor script exists");
    } catch (err) {
      console.error("❌ Buy Box monitor script not found or not accessible");
    }

    // Check if the database tables are working
    console.log("\nChecking database tables...");
    const { data: jobsCount, error: jobsError } = await supabase
      .from('buybox_jobs')
      .select('*', { count: 'exact', head: true });

    if (jobsError) {
      console.error("Error accessing buybox_jobs table:", jobsError);
    } else {
      console.log(`✅ buybox_jobs table is accessible`);
    }

    const { data: dataCount, error: dataError } = await supabase
      .from('buybox_data')
      .select('*', { count: 'exact', head: true });

    if (dataError) {
      console.error("Error accessing buybox_data table:", dataError);
    } else {
      console.log(`✅ buybox_data table is accessible`);
    }
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

testBuyBoxCheck();
