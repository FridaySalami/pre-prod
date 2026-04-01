#!/usr/bin/env node
/**
 * check-active-asins.js
 * 
 * A utility to check how many active ASINs are available for Buy Box monitoring.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env file if present
dotenv.config();

// Supabase configuration
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

// Verify Supabase configuration
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: Supabase URL and key must be set in .env file');
  console.error('Required variables: PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Main function
 */
async function main() {
  try {
    console.log('Checking ASINs in sku_asin_mapping table...\n');

    // Get count by status
    const { data: statusCounts, error: statusError } = await supabase
      .from('sku_asin_mapping')
      .select('status')
      .not('asin1', 'is', null);

    if (statusError) {
      throw new Error(`Failed to fetch status counts: ${statusError.message}`);
    }

    // Count by status
    const counts = statusCounts.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});

    console.log('ASIN Count by Status:');
    console.log('=====================');
    Object.keys(counts).forEach(status => {
      console.log(`${status}: ${counts[status]}`);
    });

    console.log(`\nTotal ASINs with valid asin1: ${statusCounts.length}`);

    // Get active ASINs specifically
    const { data: activeAsins, error: activeError } = await supabase
      .from('sku_asin_mapping')
      .select('seller_sku, asin1, item_name')
      .eq('status', 'Active')
      .not('asin1', 'is', null)
      .limit(10);

    if (activeError) {
      throw new Error(`Failed to fetch active ASINs: ${activeError.message}`);
    }

    console.log('\nFirst 10 Active ASINs:');
    console.log('======================');
    activeAsins.forEach((item, index) => {
      console.log(`${index + 1}. SKU: ${item.seller_sku} | ASIN: ${item.asin1} | ${item.item_name || 'No name'}`);
    });

    console.log(`\n✅ The Buy Box monitor will check ${counts.Active || 0} active ASINs.`);
    console.log('🚫 Skipping:', Object.keys(counts).filter(s => s !== 'Active').map(s => `${counts[s]} ${s}`).join(', '));

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();
