// Manual price update script using Feeds API
// Usage: node manual-price-update.js B08BPBWV1C 42.15 COL01A

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import the standalone Amazon Feeds API (the one that actually works!)
import AmazonFeedsAPI from './amazon-feeds-api-standalone.js';

async function updatePriceWithLogging(asin, newPrice, sku = null) {
  try {
    console.log('🎯 Manual Price Update Script - Using Feeds API');
    console.log('===============================================');
    console.log(`📋 ASIN: ${asin}`);
    console.log(`🏷️ SKU: ${sku || 'Auto-detect from database'}`);
    console.log(`💰 New Price: £${newPrice}`);
    console.log(`🕐 Time: ${new Date().toLocaleString()}`);
    console.log('===============================================\n');

    // Initialize the Amazon Feeds API (the working one!)
    const amazonAPI = new AmazonFeedsAPI({
      environment: 'production'
    });

    // Get current price from database first
    console.log('📊 Checking current database status...');
    const supabase = createClient(
      process.env.PUBLIC_SUPABASE_URL,
      process.env.PRIVATE_SUPABASE_SERVICE_KEY
    );

    const { data: currentData, error: fetchError } = await supabase
      .from('buybox_data')
      .select('*')
      .eq('asin', asin)
      .single();

    if (fetchError) {
      console.warn('⚠️ Could not fetch current data from database:', fetchError.message);
    } else {
      console.log('✅ Current database status:');
      console.log(`   💰 Current Price: £${currentData.your_current_price}`);
      console.log(`   🎯 Buy Box Price: £${currentData.buybox_price}`);
      console.log(`   📊 Status: ${currentData.pricing_status}`);
      console.log(`   🔄 Last Update: ${currentData.last_price_update || 'Never'}`);
      console.log(`   🏷️ Database SKU: ${currentData.sku}`);

      // Use SKU from database if not provided
      if (!sku && currentData.sku) {
        sku = currentData.sku;
        console.log(`   ✅ Using SKU from database: ${sku}`);
      }
    }

    console.log('\n🚀 Attempting price update via Amazon Feeds API...');

    // Attempt the price update using Feeds API
    const result = await amazonAPI.updatePrice(
      asin,
      parseFloat(newPrice),
      currentData ? currentData.your_current_price : null,
      sku
    );

    console.log('\n📊 Price Update Result:');
    console.log('======================');
    console.log(`✅ Success: ${result.success}`);
    console.log(`📈 Status Code: ${result.status}`);
    console.log(`💰 New Price: £${result.newPrice}`);
    console.log(`🏷️ SKU Used: ${result.sku}`);

    if (result.feedId) {
      console.log(`📄 Feed ID: ${result.feedId}`);
      console.log(`📋 Feed Status: ${result.feedStatus}`);
    }

    console.log(`📄 Message: ${result.message}`);

    if (result.success) {
      console.log('\n💾 Updating database records...');

      // Update the buybox_data table with the new price
      const updateData = {
        your_current_price: parseFloat(newPrice),
        last_price_update: new Date().toISOString(),
        update_source: 'manual_feeds_api',
        update_attempts: (currentData?.update_attempts || 0) + 1,
        pricing_status: parseFloat(newPrice) <= (currentData?.buybox_price || 0) ? 'winning_buybox' : 'priced_above_buybox'
      };

      const { error: updateError } = await supabase
        .from('buybox_data')
        .update(updateData)
        .eq('asin', asin);

      if (updateError) {
        console.error('❌ Failed to update buybox_data:', updateError);
      } else {
        console.log('✅ Database updated successfully');
        console.log(`   💰 Price updated to: £${newPrice}`);
        console.log(`   📊 Status: ${updateData.pricing_status}`);
        console.log(`   🕐 Update time logged`);
      }

      console.log('\n🎉 PRICE UPDATE FEED SUBMITTED SUCCESSFULLY!');
      console.log('==========================================');
      console.log('✅ Amazon Feeds API call successful');
      console.log('✅ Feed submitted for processing');
      console.log('✅ Database logging enabled');
      console.log('✅ Update tracking active');
      console.log(`✅ Feed ID: ${result.feedId}`);
      console.log('\n⏱️ Feed Processing Timeline:');
      console.log('   • Feed submitted: Now');
      console.log('   • Processing starts: 1-5 minutes');
      console.log('   • Amazon systems updated: 5-15 minutes');
      console.log('   • Seller Central display: 15-60 minutes');
      console.log(`\n🔍 Check feed status with: Feed ID ${result.feedId}`);

    } else {
      console.log('\n❌ PRICE UPDATE FAILED');
      console.log('======================');
      console.log(`Error: ${result.error}`);
      console.log('🔍 Check the detailed logs above for troubleshooting information.');
    }

  } catch (error) {
    console.error('\n❌ Script execution failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Get command line arguments
const asin = process.argv[2];
const newPrice = process.argv[3];
const sku = process.argv[4];

if (!asin || !newPrice) {
  console.log('❌ Usage: node manual-price-update.js <ASIN> <NEW_PRICE> [SKU]');
  console.log('Example: node manual-price-update.js B08BPBWV1C 42.15 COL01A');
  process.exit(1);
}

console.log('🚀 Starting manual price update...\n');
updatePriceWithLogging(asin, newPrice, sku);
