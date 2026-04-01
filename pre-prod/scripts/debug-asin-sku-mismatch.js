/**
 * Debug ASIN-SKU Mismatch Issue
 * 
 * This script helps diagnose why ASINs in price_monitoring_config
 * are not found in amazon_listings table
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function debugAsinSkuMismatch() {
  console.log('🔍 Debugging ASIN-SKU Mismatch Issue\n');

  try {
    // 1. Check amazon_listings table
    console.log('📊 Checking amazon_listings table...');
    const { data: listingsData, error: listingsError, count: listingsCount } = await supabase
      .from('amazon_listings')
      .select('asin, seller_sku, item_name', { count: 'exact' })
      .limit(5);

    if (listingsError) {
      console.error('❌ Error querying amazon_listings:', listingsError);
    } else {
      console.log(`✅ amazon_listings has ${listingsCount} records`);
      console.log('📝 Sample listings data:');
      listingsData.forEach((item, i) => {
        console.log(`   ${i + 1}. ASIN: ${item.asin}, SKU: ${item.seller_sku}, Name: ${item.item_name?.substring(0, 50)}...`);
      });
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 2. Check price_monitoring_config table
    console.log('📊 Checking price_monitoring_config table...');
    const { data: configData, error: configError, count: configCount } = await supabase
      .from('price_monitoring_config')
      .select('asin, sku, monitoring_enabled', { count: 'exact' })
      .limit(10);

    if (configError) {
      console.error('❌ Error querying price_monitoring_config:', configError);
    } else {
      console.log(`✅ price_monitoring_config has ${configCount} records`);
      console.log('📝 Sample monitoring configs:');
      configData.forEach((item, i) => {
        console.log(`   ${i + 1}. ASIN: ${item.asin}, SKU: ${item.sku}, Enabled: ${item.monitoring_enabled}`);
      });
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 3. Find ASINs that are in monitoring but not in listings
    console.log('🔍 Finding ASINs in monitoring but not in listings...');

    // Get all monitoring ASINs
    const { data: allConfigs, error: allConfigsError } = await supabase
      .from('price_monitoring_config')
      .select('asin, sku');

    if (allConfigsError) {
      console.error('❌ Error getting all configs:', allConfigsError);
      return;
    }

    // Get all listing ASINs
    const { data: allListings, error: allListingsError } = await supabase
      .from('amazon_listings')
      .select('asin');

    if (allListingsError) {
      console.error('❌ Error getting all listings:', allListingsError);
      return;
    }

    const listingAsins = new Set(allListings.map(l => l.asin));
    const missingAsins = allConfigs.filter(config => !listingAsins.has(config.asin));

    console.log(`📈 Summary:`);
    console.log(`   • ASINs in monitoring config: ${allConfigs.length}`);
    console.log(`   • ASINs in amazon_listings: ${allListings.length}`);
    console.log(`   • ASINs in monitoring but NOT in listings: ${missingAsins.length}`);

    if (missingAsins.length > 0) {
      console.log('\n🚨 ASINs in monitoring but missing from amazon_listings:');
      missingAsins.slice(0, 10).forEach((item, i) => {
        console.log(`   ${i + 1}. ASIN: ${item.asin}, Current SKU: ${item.sku}`);
      });
      if (missingAsins.length > 10) {
        console.log(`   ... and ${missingAsins.length - 10} more`);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 4. Check for actual mismatches (same ASIN, different SKU)
    console.log('🔍 Checking for actual SKU mismatches...');

    const actualMismatches = [];
    for (const config of allConfigs) {
      const listing = allListings.find(l => l.asin === config.asin);
      if (listing) {
        // Get full listing data
        const { data: fullListing } = await supabase
          .from('amazon_listings')
          .select('seller_sku')
          .eq('asin', config.asin)
          .single();

        if (fullListing && fullListing.seller_sku !== config.sku) {
          actualMismatches.push({
            asin: config.asin,
            currentSku: config.sku,
            correctSku: fullListing.seller_sku
          });
        }
      }
    }

    if (actualMismatches.length > 0) {
      console.log(`🔧 Found ${actualMismatches.length} actual SKU mismatches:`);
      actualMismatches.slice(0, 10).forEach((item, i) => {
        console.log(`   ${i + 1}. ASIN: ${item.asin}`);
        console.log(`      Current SKU: ${item.currentSku}`);
        console.log(`      Correct SKU: ${item.correctSku}`);
      });
    } else {
      console.log('✅ No SKU mismatches found for ASINs that exist in both tables');
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 5. Recommendations
    console.log('💡 Recommendations:');
    if (missingAsins.length > 0) {
      console.log('   1. Import/update your amazon_listings table with current data');
      console.log('   2. Or remove monitoring configs for ASINs you no longer sell');
      console.log('   3. The "105 ASINs not found" message is referring to these missing ASINs');
    }

    if (actualMismatches.length > 0) {
      console.log('   4. Run the SKU fix tool to correct the actual mismatches');
    } else {
      console.log('   4. No SKU corrections needed for existing data');
    }

  } catch (error) {
    console.error('❌ Error during debug:', error);
  }
}

debugAsinSkuMismatch().catch(console.error);