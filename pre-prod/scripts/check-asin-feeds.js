#!/usr/bin/env node

/**
 * Check recent Amazon feeds for a specific ASIN
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAsinFeeds(asin) {
  console.log(`🔍 Checking recent activity for ASIN: ${asin}`);

  try {
    // Check buy box monitoring data
    const { data: buyBoxData, error: buyBoxError } = await supabase
      .from('buybox_data')
      .select('*')
      .eq('asin', asin)
      .order('timestamp', { ascending: false })
      .limit(10);

    if (buyBoxError) {
      console.warn('⚠️ Error fetching buy box data:', buyBoxError);
    } else if (buyBoxData && buyBoxData.length > 0) {
      console.log(`\n🎯 Recent Buy Box Activity for ${asin}:`);
      buyBoxData.forEach((entry, index) => {
        console.log(`   ${index + 1}. ${new Date(entry.timestamp).toLocaleString()}`);
        console.log(`      Your Price: £${entry.your_price || entry.current_price || 'Unknown'}`);
        console.log(`      Buy Box Price: £${entry.buybox_price || 'Unknown'}`);
        console.log(`      Lowest Price: £${entry.lowest_price || 'Unknown'}`);
        console.log(`      Status: ${entry.status || 'Unknown'}`);
        if (entry.sku) console.log(`      SKU: ${entry.sku}`);
      });
    } else {
      console.log(`⚠️ No recent buy box data found for ASIN ${asin}`);
    }

    // Check if there are any pricing operations in the audit log
    const { data: auditData, error: auditError } = await supabase
      .from('audit_logs')
      .select('*')
      .or(`details.cs.{"asin":"${asin}"},details.cs.{"ASIN":"${asin}"}`)
      .order('timestamp', { ascending: false })
      .limit(5);

    if (auditError) {
      console.warn('⚠️ Error fetching audit data:', auditError);
    } else if (auditData && auditData.length > 0) {
      console.log(`\n📋 Recent Audit Log Entries for ${asin}:`);
      auditData.forEach((entry, index) => {
        console.log(`   ${index + 1}. ${new Date(entry.timestamp).toLocaleString()}`);
        console.log(`      Action: ${entry.action}`);
        console.log(`      User: ${entry.user_id}`);
        if (entry.details) {
          console.log(`      Details: ${JSON.stringify(entry.details, null, 8)}`);
        }
      });
    }

    // Try to check amazon_listings table for current price
    const { data: listingData, error: listingError } = await supabase
      .from('amazon_listings')
      .select('*')
      .eq('asin', asin)
      .single();

    if (listingError) {
      console.warn('⚠️ Error fetching listing data (table may not exist):', listingError.message);
    } else if (listingData) {
      console.log(`\n📊 Current Listing Data for ${asin}:`);
      console.log(`   SKU: ${listingData.sku}`);
      console.log(`   Current Price: £${listingData.price || 'Unknown'}`);
      console.log(`   Title: ${listingData.title || 'Unknown'}`);
      console.log(`   Last Updated: ${new Date(listingData.updated_at || listingData.last_updated).toLocaleString()}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Get ASIN from command line argument
const targetAsin = process.argv[2] || 'B08BPBWV1C';
checkAsinFeeds(targetAsin);
