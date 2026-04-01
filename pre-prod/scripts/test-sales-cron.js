#!/usr/bin/env node

/**
 * Test Script for Daily Sales Report Cron Job
 * 
 * This script tests the cron job endpoint locally.
 * 
 * Usage:
 *   node test-sales-cron.js
 * 
 * Prerequisites:
 * 1. Dev server must be running: npm run dev
 * 2. CRON_SECRET must be set in .env
 * 3. Database migrations must be applied
 */

import * as dotenv from 'dotenv';
dotenv.config();

const CRON_SECRET = process.env.CRON_SECRET;
const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';

if (!CRON_SECRET) {
  console.error('❌ CRON_SECRET not found in .env file');
  process.exit(1);
}

console.log('🧪 Testing Daily Sales Report Cron Job');
console.log('━'.repeat(50));
console.log(`API URL: ${API_URL}`);
console.log(`Auth: Bearer ${CRON_SECRET.substring(0, 10)}...`);
console.log('━'.repeat(50));
console.log('');

async function testCronJob() {
  try {
    console.log('📡 Sending POST request to /api/cron/daily-sales-report...');

    const response = await fetch(`${API_URL}/api/cron/daily-sales-report`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    console.log('');

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Cron Job Successful!');
      console.log('━'.repeat(50));
      console.log('Results:');
      console.log(`  Report ID: ${data.reportId || 'N/A'}`);
      console.log(`  Document ID: ${data.documentId || 'N/A'}`);
      console.log(`  Date: ${data.date || 'N/A'}`);
      console.log(`  Duration: ${data.duration}s`);
      console.log('');
      console.log('Processing Stats:');
      console.log(`  ✅ Processed: ${data.stats?.processed || 0} records`);
      console.log(`  🔄 Updated: ${data.stats?.updated || 0} records`);
      console.log(`  ❌ Failed: ${data.stats?.failed || 0} records`);

      if (data.stats?.errors && data.stats.errors.length > 0) {
        console.log('');
        console.log('Errors:');
        data.stats.errors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err}`);
        });
      }
    } else {
      console.log('❌ Cron Job Failed!');
      console.log('━'.repeat(50));
      console.log('Error:', data.error || 'Unknown error');
      console.log('Report ID:', data.reportId || 'N/A');
      console.log('Duration:', data.duration + 's');
    }

    console.log('');
    console.log('━'.repeat(50));

    // Query database to verify data was stored
    console.log('');
    console.log('🔍 Verifying data in database...');

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.PUBLIC_SUPABASE_URL,
      process.env.PRIVATE_SUPABASE_SERVICE_KEY
    );

    // Check job logs
    const { data: logs } = await supabase
      .from('report_job_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1);

    if (logs && logs.length > 0) {
      const log = logs[0];
      console.log('');
      console.log('Latest Job Log:');
      console.log(`  ID: ${log.id}`);
      console.log(`  Status: ${log.status}`);
      console.log(`  Type: ${log.job_type}`);
      console.log(`  Started: ${new Date(log.started_at).toLocaleString()}`);
      console.log(`  Completed: ${log.completed_at ? new Date(log.completed_at).toLocaleString() : 'N/A'}`);
      console.log(`  Duration: ${log.duration_seconds}s`);
      console.log(`  Records: ${log.records_processed} processed, ${log.records_failed} failed`);

      if (log.error_message) {
        console.log(`  Error: ${log.error_message}`);
      }
    }

    // Check sales data
    const { data: salesData, count } = await supabase
      .from('amazon_sales_data')
      .select('*', { count: 'exact' })
      .order('imported_at', { ascending: false })
      .limit(5);

    console.log('');
    console.log(`Sales Data Records: ${count || 0} total`);

    if (salesData && salesData.length > 0) {
      console.log('');
      console.log('Latest 5 Sales Records:');
      salesData.forEach((record, i) => {
        console.log(`  ${i + 1}. ASIN ${record.asin} - ${record.report_date}: £${record.ordered_product_sales} (${record.ordered_units} units)`);
      });
    }

    console.log('');
    console.log('✅ Test Complete!');

  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    console.error('');
    console.error('Make sure:');
    console.error('  1. Dev server is running (npm run dev)');
    console.error('  2. Database migrations are applied');
    console.error('  3. CRON_SECRET is set in .env');
    process.exit(1);
  }
}

// Run the test
testCronJob();
