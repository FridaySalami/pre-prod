/**
 * One-Time Sales Data Backfill Script
 * 
 * Fetches the last 30 days of sales data from Amazon Reports API
 * to populate the database immediately. This is a one-time operation
 * to seed your database before the daily incremental cron takes over.
 * 
 * Usage:
 *   node backfill-sales-data.js
 * 
 * Optional: Specify custom date range
 *   node backfill-sales-data.js 30  # Last 30 days (default)
 *   node backfill-sales-data.js 90  # Last 90 days
 * 
 * This script:
 * 1. Calculates date range (default: last 30 days)
 * 2. Requests Amazon Sales & Traffic report
 * 3. Polls until complete (~15-20 minutes)
 * 4. Downloads and decompresses data
 * 5. Stores in database (upsert handles duplicates)
 * 6. Shows summary of records processed
 */

import 'dotenv/config';
import fetch from 'node-fetch';

const CRON_ENDPOINT = process.env.PUBLIC_APP_URL
  ? `${process.env.PUBLIC_APP_URL}/api/cron/backfill-sales-report`
  : 'http://localhost:3000/api/cron/backfill-sales-report';

const CRON_SECRET = process.env.CRON_SECRET;

// Get days from command line argument, default to 30
const daysToBackfill = parseInt(process.argv[2] || '30', 10);

console.log('🔄 Sales Data Backfill');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📅 Backfilling last ${daysToBackfill} days of sales data`);
console.log(`🔗 Endpoint: ${CRON_ENDPOINT}`);
console.log(`🔐 Using CRON_SECRET: ${CRON_SECRET ? '✓' : '✗ MISSING!'}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (!CRON_SECRET) {
  console.error('❌ Error: CRON_SECRET not found in environment variables');
  console.error('   Make sure you have a .env file with CRON_SECRET defined');
  process.exit(1);
}

async function runBackfill() {
  try {
    console.log('\n🚀 Starting backfill request...\n');

    const response = await fetch(CRON_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        days: daysToBackfill
      })
    });

    console.log(`📡 Response Status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Backfill failed:');
      console.error(errorText);
      process.exit(1);
    }

    const result = await response.json();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Backfill Completed Successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Results:');
    console.log(`   Report ID: ${result.reportId || 'N/A'}`);
    console.log(`   Records Processed: ${result.recordsProcessed || 0}`);
    console.log(`   Records Updated: ${result.recordsUpdated || 0}`);
    console.log(`   Execution Time: ${result.executionTime || 'N/A'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Verify data in database
    console.log('🔍 To verify the data, run:');
    console.log('   SELECT COUNT(*), MIN(report_date), MAX(report_date)');
    console.log('   FROM amazon_sales_data;');
    console.log('');

  } catch (error) {
    console.error('❌ Backfill error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runBackfill();
