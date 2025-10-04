#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// Check if environment variables are available
if (!process.env.PUBLIC_SUPABASE_URL || !process.env.PRIVATE_SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   PUBLIC_SUPABASE_URL');
  console.error('   PRIVATE_SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function checkDatabaseStructure() {
  console.log('🔍 Analyzing ASIN to SKU mapping in database...');
  console.log('=' * 60);

  try {
    // 1. Check amazon_listings table structure
    console.log('\n1️⃣ Checking amazon_listings table...');
    const { data: listings, error: listingsError } = await supabase
      .from('amazon_listings')
      .select('seller_sku, asin, item_name, price')
      .limit(5);

    if (listingsError) {
      console.error('❌ Error accessing amazon_listings:', listingsError.message);
    } else {
      console.log(`✅ Found ${listings.length} sample records in amazon_listings`);
      if (listings.length > 0) {
        console.log('\n📋 Sample amazon_listings records:');
        listings.forEach((record, i) => {
          console.log(`  ${i + 1}. SKU: ${record.seller_sku} -> ASIN: ${record.asin || 'N/A'}`);
          console.log(`     Item: ${record.item_name?.substring(0, 50) || 'N/A'}...`);
          console.log(`     Price: £${record.price || 'N/A'}`);
        });
      }
    }

    // 2. Check price_monitoring_config table
    console.log('\n2️⃣ Checking price_monitoring_config table...');
    const { data: configs, error: configsError } = await supabase
      .from('price_monitoring_config')
      .select('asin, sku, monitoring_enabled, user_email')
      .limit(10);

    if (configsError) {
      console.error('❌ Error accessing price_monitoring_config:', configsError.message);
    } else {
      console.log(`✅ Found ${configs.length} monitoring configurations`);
      if (configs.length > 0) {
        console.log('\n📋 Current monitoring configs:');
        configs.forEach((config, i) => {
          console.log(`  ${i + 1}. ASIN: ${config.asin} -> SKU: ${config.sku} (enabled: ${config.monitoring_enabled})`);
        });
      }
    }

    // 3. Check for ASIN-SKU matches
    console.log('\n3️⃣ Checking ASIN to SKU matches...');
    if (configs && configs.length > 0 && listings && listings.length > 0) {
      const configAsins = configs.map(c => c.asin);
      const { data: matches, error: matchError } = await supabase
        .from('amazon_listings')
        .select('seller_sku, asin, item_name')
        .in('asin', configAsins);

      if (matchError) {
        console.error('❌ Error checking matches:', matchError.message);
      } else {
        console.log(`✅ Found ${matches.length} ASIN matches in amazon_listings`);
        if (matches.length > 0) {
          console.log('\n🔗 ASIN -> SKU mappings found:');
          matches.forEach((match, i) => {
            const config = configs.find(c => c.asin === match.asin);
            console.log(`  ${i + 1}. ASIN: ${match.asin}`);
            console.log(`     Real SKU: ${match.seller_sku}`);
            console.log(`     Config SKU: ${config?.sku || 'N/A'}`);
            console.log(`     Match: ${match.seller_sku === config?.sku ? '✅' : '❌'}`);
            console.log(`     Item: ${match.item_name?.substring(0, 50) || 'N/A'}...`);
          });
        } else {
          console.log('❌ No ASINs from monitoring configs found in amazon_listings');
        }
      }
    }

    // 4. Summary and recommendations
    console.log('\n4️⃣ Summary and Recommendations:');
    console.log('=' * 60);

    if (configs && configs.length > 0) {
      const mismatchedConfigs = configs.length; // We'll count actual mismatches
      console.log(`📊 Total monitoring configs: ${configs.length}`);
      console.log(`📊 Configs needing SKU updates: ${mismatchedConfigs}`);

      console.log('\n💡 Recommendations:');
      console.log('   1. Create ASIN-to-SKU matching function');
      console.log('   2. Update existing configs with correct SKUs');
      console.log('   3. Modify ASIN addition process to auto-populate SKUs');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the analysis
checkDatabaseStructure().catch(console.error);