#!/usr/bin/env node

/**
 * Setup script for Sales Dashboard Phase 1
 * 
 * This script:
 * 1. Creates the materialized view in your Supabase database
 * 2. Tests the view with a sample query
 * 3. Provides instructions for setting up daily refresh
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   - PUBLIC_SUPABASE_URL');
  console.error('   - PRIVATE_SUPABASE_SERVICE_KEY');
  console.error('\nMake sure these are set in your .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupMaterializedView() {
  console.log('🚀 Setting up Sales Dashboard Materialized View...\n');

  try {
    // Read the SQL file
    const sqlFile = path.join(__dirname, 'create-sales-dashboard-view.sql');
    const sql = fs.readFileSync(sqlFile, 'utf-8');

    console.log('📄 Read SQL file: create-sales-dashboard-view.sql');
    console.log('📊 This will create:');
    console.log('   - Materialized view: sales_dashboard_30d');
    console.log('   - Multiple indexes for fast queries');
    console.log('   - Function: refresh_sales_dashboard()');
    console.log('');

    // Note: Supabase client doesn't directly support executing raw SQL with multiple statements
    // You'll need to run this via the Supabase SQL Editor or psql
    console.log('⚠️  Important: Materialized views must be created via Supabase SQL Editor\n');
    console.log('📝 Instructions:');
    console.log('   1. Open your Supabase Dashboard');
    console.log('   2. Go to SQL Editor');
    console.log('   3. Copy and paste the contents of: create-sales-dashboard-view.sql');
    console.log('   4. Run the SQL');
    console.log('');
    console.log('🔗 Quick link: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new');
    console.log('');

    // Test if the view exists
    console.log('🔍 Testing if materialized view exists...');
    const { data, error } = await supabase
      .from('sales_dashboard_30d')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log('❌ Materialized view not found (this is expected if not created yet)');
      console.log(`   Error: ${error.message}`);
      console.log('');
      console.log('👉 Follow the instructions above to create it.');
      return false;
    } else {
      console.log('✅ Materialized view exists!');
      console.log(`   Found ${data?.length || 0} records`);

      // Get a sample
      const { data: sample } = await supabase
        .from('sales_dashboard_30d')
        .select('*')
        .order('total_revenue', { ascending: false })
        .limit(5);

      if (sample && sample.length > 0) {
        console.log('\n📊 Sample data (top 5 by revenue):');
        sample.forEach((row, i) => {
          console.log(`   ${i + 1}. ASIN: ${row.asin} - Revenue: £${row.total_revenue.toFixed(2)}`);
        });
      }

      console.log('\n✅ Setup complete! The dashboard will now use the materialized view.');
      return true;
    }

  } catch (err) {
    console.error('❌ Error during setup:', err);
    return false;
  }
}

async function setupDailyCron() {
  console.log('\n📅 Setting up daily refresh (optional)...\n');
  console.log('To keep the materialized view up-to-date, you should refresh it daily.');
  console.log('');
  console.log('Option 1: Supabase SQL Cron Extension');
  console.log('   Add to your Supabase SQL Editor:');
  console.log('');
  console.log('   -- Enable pg_cron extension');
  console.log('   CREATE EXTENSION IF NOT EXISTS pg_cron;');
  console.log('');
  console.log('   -- Schedule daily refresh at midnight UTC');
  console.log('   SELECT cron.schedule(');
  console.log('     \'refresh-sales-dashboard\',');
  console.log('     \'0 0 * * *\',');
  console.log('     $$REFRESH MATERIALIZED VIEW CONCURRENTLY sales_dashboard_30d$$');
  console.log('   );');
  console.log('');
  console.log('Option 2: Manual refresh as needed');
  console.log('   Run this SQL when needed:');
  console.log('   REFRESH MATERIALIZED VIEW CONCURRENTLY sales_dashboard_30d;');
  console.log('');
  console.log('Option 3: Node.js cron job');
  console.log('   Add to your existing cron jobs in your app');
  console.log('');
}

// Run setup
console.log('═══════════════════════════════════════════════════════════');
console.log('  Sales Dashboard - Phase 1 Setup');
console.log('═══════════════════════════════════════════════════════════\n');

setupMaterializedView()
  .then((success) => {
    if (success) {
      setupDailyCron();
    }
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('Setup script complete!');
    console.log('═══════════════════════════════════════════════════════════\n');
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
