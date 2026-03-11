#!/usr/bin/env node

const { supabase } = require('./render-service/services/supabase-client');

async function checkAsinSkuMapping() {
  console.log('🔍 Analyzing ASIN to SKU mapping in database...');
  console.log('=' + '='.repeat(60));

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
          console.log(`     Item: ${(record.item_name || 'N/A').substring(0, 50)}...`);
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
            console.log(`     Item: ${(match.item_name || 'N/A').substring(0, 50)}...`);
          });
        } else {
          console.log('❌ No ASINs from monitoring configs found in amazon_listings');
        }
      }
    }

    // 4. Check if there are ASINs in config that exist in listings
    console.log('\n4️⃣ Checking for missing ASIN-SKU matches...');
    if (configs && configs.length > 0) {
      let mismatchCount = 0;
      const mismatchedConfigs = [];

      for (const config of configs) {
        const { data: listing, error } = await supabase
          .from('amazon_listings')
          .select('seller_sku, asin, item_name')
          .eq('asin', config.asin)
          .single();

        if (!error && listing) {
          if (listing.seller_sku !== config.sku) {
            mismatchCount++;
            mismatchedConfigs.push({
              asin: config.asin,
              configSku: config.sku,
              realSku: listing.seller_sku,
              itemName: listing.item_name
            });
          }
        }
      }

      console.log(`📊 Total monitoring configs: ${configs.length}`);
      console.log(`📊 Configs with SKU mismatches: ${mismatchCount}`);

      if (mismatchedConfigs.length > 0) {
        console.log('\n⚠️ SKU Mismatches found:');
        mismatchedConfigs.forEach((mismatch, i) => {
          console.log(`  ${i + 1}. ASIN: ${mismatch.asin}`);
          console.log(`     Config SKU: ${mismatch.configSku}`);
          console.log(`     Actual SKU: ${mismatch.realSku}`);
          console.log(`     Item: ${(mismatch.itemName || 'N/A').substring(0, 50)}...`);
        });
      }
    }

    // 5. Summary and recommendations
    console.log('\n5️⃣ Summary and Recommendations:');
    console.log('=' + '='.repeat(60));

    if (configs && configs.length > 0) {
      console.log('\n💡 Recommendations:');
      console.log('   1. Create ASIN-to-SKU matching function');
      console.log('   2. Update existing configs with correct SKUs');
      console.log('   3. Modify ASIN addition process to auto-populate SKUs');
      console.log('   4. Add validation to prevent ASIN/SKU mismatches');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the analysis
checkAsinSkuMapping().catch(console.error);