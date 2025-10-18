#!/usr/bin/env node

/**
 * Render Cron Job Scheduler for Buy Box Monitoring
 * 1. Clears all existing data
 * 2. Triggers fresh bulk scan
 * Runs daily at 4 AM GMT
 */

require('dotenv').config();
const axios = require('axios');

const FRONTEND_URL = 'https://operations.chefstorecookbook.com';
const RENDER_SERVICE_URL = process.env.RENDER_SERVICE_URL || 'https://buy-box-render-service-4603.onrender.com';
const API_KEY = process.env.EXTERNAL_API_KEY || process.env.MAKE_COM_API_KEY;

async function clearAllData() {
  try {
    console.log('🧹 Clearing all existing buy box data...');
    console.log(`📡 Calling: ${FRONTEND_URL}/api/buybox/clear`);

    const response = await axios.delete(`${FRONTEND_URL}/api/buybox/clear`, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      }
    });

    console.log('✅ Data cleared successfully');
    console.log(`� Cleared records: buybox_data: ${response.data.buyboxDataDeleted}, buybox_offers: ${response.data.buyboxOffersDeleted}`);

    return true;

  } catch (error) {
    console.error('❌ Failed to clear data:', error.message);

    if (error.response) {
      console.error('📋 Response status:', error.response.status);
      console.error('📋 Response data:', error.response.data);
    }

    throw error;
  }
}

async function triggerBulkScan() {
  try {
    console.log('🕐 Starting fresh bulk scan...');
    console.log(`📡 Triggering scan via: ${RENDER_SERVICE_URL}/api/bulk-scan/start`);

    const response = await axios.post(`${RENDER_SERVICE_URL}/api/bulk-scan/start`, {
      source: 'scheduled_fresh_scan_' + new Date().toISOString().split('T')[0],
      filterType: 'active',
      maxAsins: null,
      notes: `Scheduled fresh scan (after data clear) started automatically at ${new Date().toISOString()}`
    }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Bulk scan triggered successfully');
    console.log(`📊 Job ID: ${response.data.jobId}`);
    console.log(`🔢 ASINs to process: ${response.data.totalAsins}`);
    console.log(`⏱️ Estimated completion: ${response.data.estimatedCompletion}`);

    return true;

  } catch (error) {
    console.error('❌ Failed to trigger bulk scan:', error.message);

    if (error.response) {
      console.error('📋 Response status:', error.response.status);
      console.error('📋 Response data:', error.response.data);
    }

    throw error;
  }
}

async function runScheduledTask() {
  try {
    console.log('🚀 Buy Box Scheduler Starting...');
    console.log(`📅 Execution time: ${new Date().toISOString()}`);
    console.log(`🌍 GMT Time: ${new Date().toUTCString()}`);

    // Step 1: Clear all existing data
    await clearAllData();

    // Step 2: Wait a moment for database cleanup
    console.log('⏳ Waiting 5 seconds for database cleanup...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 3: Trigger fresh bulk scan
    await triggerBulkScan();

    console.log('🎉 Scheduled task completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('💥 Scheduled task failed:', error.message);
    process.exit(1);
  }
}

// Add validation
if (!RENDER_SERVICE_URL) {
  console.error('❌ RENDER_SERVICE_URL environment variable is required');
  process.exit(1);
}

if (!API_KEY) {
  console.error('❌ API key not configured. Please set EXTERNAL_API_KEY or MAKE_COM_API_KEY environment variable');
  process.exit(1);
}

console.log(`🎯 Target frontend: ${FRONTEND_URL}`);
console.log(`🎯 Target service: ${RENDER_SERVICE_URL}`);
console.log(`🔑 API key configured: ${API_KEY ? '✓' : '✗'}`);

// Run the scheduled task
runScheduledTask();