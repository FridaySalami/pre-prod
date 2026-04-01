#!/usr/bin/env node
/**
 * Process ASIN List - Clean duplicates and prepare for batch setup
 */

require('dotenv').config({ path: './render-service/.env' });
const { supabase } = require('./render-service/services/supabase-client');

// Your raw ASIN list
const RAW_ASIN_LIST = `
B0BGPMD867
B0BGPMD867
B0B46GGBBP
B0DVS6YBJW
B09RQS4SBQ
B09T3GDNGT
B004BTED72
B0DPLFN2WF
B0F7MNF5WY
B0DPJ458LV
B0DJ95JVD3
B0CP9JP9NG
B085PN6X4C
B09T3GDNGT
B0D8C3WGTL
B0DF2M5ZWS
B08TQPBQLV
B0CLS4K9FT
B08BPBPYTF
B0DVJ17T8C
B00CS6K6AS
B078VB2BF7
B0DCK7QJYP
B0DZ2Z6586
B077B43TXT
B0C5418F7F
B0DTV3Q76H
B0B46GGBBP
B0CSZ4ZD16
B0DFD3HJ7Z
B0D6NLL4CY
B00OD06BYM
B0BLW2232P
B01H5GE1PG
B01LY54FZD
B09T3DYBGQ
B07QDB3FLX
B0BQZ3GQTF
B07W5W7YCT
B09RV19H2N
B00FXMJ15U
B0CD7Z3H81
B0CYPZMDR4
B0B998R6L4
B0CF2C7JDG
B0CD2QKD7V
B0CYHJYDSD
B0D7J2JD91
B077B43VD5
B078VB2BF7
B07CYTX6MD
B08TRJRNWK
B09J5CNBYK
B0DHD2H45F
B0DZDVXYD1
B01AAABOF4
B073WRG21Q
B0DFMRZ5DP
B0FGYBZRPX
B00CJV396A
B08T5Z2P9Y
B0CGMYDC3V
B0CLGWW5P6
B0DHKYQ62W
B077P8VZGM
B0CCPFNNJ1
B0CD7W81FQ
B0CPKCVG66
B0CTQWB8HG
B0DCZWT1K6
B0F678TNLY
B00BEVBS50
B00BOO74EQ
B07ZB5K9ZD
B088CG2ZC1
B0CCPQ9FK2
B0D184G3RW
B0046HQ2B4
B004BLBWXI
B004CS23EW
B008LE65XS
B01BTOSIQI
B01DDG8Q7G
B07Z1P8CY1
B0B61D6XB1
B0CTTNW46W
B0CV7Z6WJX
B0D9HPY6SZ
B0DK7NKW5D
B00G02FXE0
B0CM9YYM7J
B0CTQQZLW5
B08J856MT8
B0CVLCWXB3
B0D45NPK7W
B0000DC32H
B00279RYEM
B01DDG8LDK
B01FKE7EGS
B079H1QM33
B085S732DW
B08TRF9ZYP
B00FU0E010
B00IORZ7JU
B01GU0TK22
B0CJQJJT1X
B004Y18G8E
B008JYGOPE
B00DX05G4Y
`.trim();

async function processAsinList() {
  console.log('🔄 Processing ASIN list...\n');

  // Parse and clean ASINs
  const rawAsins = RAW_ASIN_LIST.split('\n').map(asin => asin.trim()).filter(asin => asin);
  console.log(`📋 Raw ASINs found: ${rawAsins.length}`);

  // Remove duplicates
  const uniqueAsins = [...new Set(rawAsins)];
  console.log(`🧹 Unique ASINs: ${uniqueAsins.length}`);
  console.log(`🗑️  Duplicates removed: ${rawAsins.length - uniqueAsins.length}`);

  // Get existing ASINs from database
  console.log('\n🔍 Checking existing ASINs in database...');
  const { data: existingConfigs, error } = await supabase
    .from('price_monitoring_config')
    .select('asin, priority, monitoring_enabled')
    .eq('user_email', 'jack.w@parkersfoodservice.co.uk');

  if (error) {
    console.error('❌ Error fetching existing ASINs:', error);
    return;
  }

  const existingAsins = new Set(existingConfigs.map(config => config.asin));
  console.log(`📊 Currently monitored ASINs: ${existingAsins.size}`);

  // Categorize ASINs
  const newAsins = uniqueAsins.filter(asin => !existingAsins.has(asin));
  const existingAsinsList = uniqueAsins.filter(asin => existingAsins.has(asin));

  console.log(`\n📈 Analysis:`);
  console.log(`   • New ASINs to add: ${newAsins.length}`);
  console.log(`   • Already monitored: ${existingAsinsList.length}`);

  // Show existing ASINs and their current priorities
  if (existingAsinsList.length > 0) {
    console.log('\n⚠️  Already monitored ASINs:');
    existingAsinsList.forEach(asin => {
      const config = existingConfigs.find(c => c.asin === asin);
      const status = config.monitoring_enabled ? '✅' : '❌';
      console.log(`   ${status} ${asin} - Current Priority: ${config.priority}`);
    });
  }

  // Generate configuration for new ASINs
  console.log('\n📝 Generating batch configuration...');

  const newAsinConfigs = newAsins.map(asin => ({
    asin: asin,
    sku: `AUTO-${asin}`, // You can update SKUs later if needed
    priority: 1
  }));

  // Generate priority updates for existing ASINs that aren't already Priority 1
  const priorityUpdates = existingAsinsList
    .map(asin => {
      const config = existingConfigs.find(c => c.asin === asin);
      return { asin, currentPriority: config.priority };
    })
    .filter(item => item.currentPriority !== 1)
    .map(item => ({ asin: item.asin, priority: 1 }));

  console.log(`\n🎯 Configuration Summary:`);
  console.log(`   • New ASINs to add at Priority 1: ${newAsinConfigs.length}`);
  console.log(`   • Existing ASINs to upgrade to Priority 1: ${priorityUpdates.length}`);
  console.log(`   • Already at Priority 1: ${existingAsinsList.length - priorityUpdates.length}`);

  // Write to configuration file
  const configContent = `/**
 * ASIN Batch Configuration - Auto-generated
 * ${new Date().toLocaleString()}
 */

// New ASINs to add (all Priority 1 - Critical monitoring every 15 minutes)
const NEW_ASINS = [
${newAsinConfigs.map(config => `    { asin: '${config.asin}', sku: '${config.sku}', priority: ${config.priority} },`).join('\n')}
];

// Priority updates for existing ASINs (upgrade to Priority 1)
const PRIORITY_UPDATES = [
${priorityUpdates.map(update => `    { asin: '${update.asin}', priority: ${update.priority} }, // Upgrade to Critical`).join('\n')}
];

module.exports = {
    NEW_ASINS,
    PRIORITY_UPDATES
};`;

  require('fs').writeFileSync('./asin-batch-config.cjs', configContent);
  console.log('\n✅ Configuration written to asin-batch-config.cjs');

  console.log('\n🚀 Next steps:');
  console.log('   1. Review the generated configuration: cat asin-batch-config.cjs');
  console.log('   2. Run batch setup: node batch-setup-asins.cjs');
  console.log('   3. Verify results: node list-current-asins.cjs');

  return {
    total: uniqueAsins.length,
    new: newAsins.length,
    existing: existingAsinsList.length,
    priorityUpdates: priorityUpdates.length
  };
}

if (require.main === module) {
  processAsinList().then(() => process.exit(0)).catch(console.error);
}

module.exports = { processAsinList };