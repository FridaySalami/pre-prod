#!/usr/bin/env node

/**
 * Fix ASIN-SKU Mapping Utility
 * 
 * This script identifies and fixes SKU mismatches in the price_monitoring_config table
 * by looking up the correct SKUs from the amazon_listings table
 */

const { AsinSkuMappingService } = require('./render-service/services/asin-sku-mapping');

async function main() {
  console.log('🔧 ASIN-SKU Mapping Fix Utility');
  console.log('=' + '='.repeat(60));

  const mappingService = new AsinSkuMappingService();

  try {
    // 1. Validate current state
    console.log('\n1️⃣ Validating current monitoring configurations...');
    const isValid = await mappingService.validateAllConfigs();

    if (isValid) {
      console.log('\n🎉 All configurations are already correct!');
      return;
    }

    // 2. Ask for confirmation (in a real scenario)
    console.log('\n2️⃣ Ready to fix SKU mismatches...');
    console.log('⚠️ This will update the price_monitoring_config table');

    // In this automated version, we'll proceed directly
    // In production, you might want to add a confirmation prompt

    // 3. Fix all mismatches
    console.log('\n3️⃣ Applying SKU corrections...');
    const results = await mappingService.fixAllMismatchedConfigs();

    // 4. Final validation
    console.log('\n4️⃣ Final validation...');
    const finalValidation = await mappingService.validateAllConfigs();

    // 5. Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL SUMMARY:');
    console.log(`   ✅ Configurations updated: ${results.updated}`);
    console.log(`   ❌ Update errors: ${results.errors}`);
    console.log(`   ⚠️ ASINs not found: ${results.notFound}`);
    console.log(`   🎯 All configs now valid: ${finalValidation ? 'YES' : 'NO'}`);

    if (finalValidation) {
      console.log('\n🎉 All ASIN-SKU mappings have been successfully corrected!');
    } else {
      console.log('\n⚠️ Some issues remain - please check the validation report above');
    }

  } catch (error) {
    console.error('\n❌ Fatal error during SKU correction:', error);
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { main };