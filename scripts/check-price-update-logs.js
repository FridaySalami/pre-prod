// Check recent price update logs for specific ASIN
// Usage: node check-price-update-logs.js B08BPBWV1C

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function checkPriceUpdateLogs(asin) {
  try {
    console.log(`🔍 Checking price update logs for ASIN: ${asin}`);
    console.log('📅 Looking for updates from the last 24 hours...\n');

    // Get recent price update logs from audit_log
    const { data: auditLogs, error: auditError } = await supabase
      .from('audit_log')
      .select('*')
      .eq('event_type', 'AMAZON_PRICE_UPDATE')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (auditError) {
      console.error('❌ Error fetching audit logs:', auditError);
      return;
    }

    // Filter for our specific ASIN
    const asinLogs = auditLogs.filter(log =>
      log.details && log.details.asin === asin
    );

    if (asinLogs.length === 0) {
      console.log(`⚠️ No price update logs found for ASIN ${asin} in the last 24 hours`);
      console.log('🔍 This suggests the price update might not have been logged to the database');

      // Check if there are any logs at all for this ASIN
      const { data: allLogs, error: allError } = await supabase
        .from('audit_log')
        .select('*')
        .eq('event_type', 'AMAZON_PRICE_UPDATE')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!allError && allLogs.length > 0) {
        console.log('\n📋 Recent price update logs (any ASIN):');
        allLogs.forEach((log, index) => {
          const details = log.details || {};
          console.log(`${index + 1}. ASIN: ${details.asin || 'N/A'} | Price: £${details.new_price || 'N/A'} | ${new Date(log.created_at).toLocaleString()}`);
        });
      }

      return;
    }

    console.log(`✅ Found ${asinLogs.length} price update log(s) for ASIN ${asin}:\n`);

    asinLogs.forEach((log, index) => {
      const details = log.details || {};
      console.log(`📋 Update #${index + 1}:`);
      console.log(`   🕐 Time: ${new Date(log.created_at).toLocaleString()}`);
      console.log(`   💰 New Price: £${details.new_price || 'N/A'}`);
      console.log(`   🏪 Environment: ${details.environment || 'N/A'}`);
      console.log(`   📈 Status Code: ${details.status_code || 'N/A'}`);
      console.log(`   🌍 Marketplace: ${details.marketplace_id || 'N/A'}`);

      if (details.amazon_response) {
        console.log(`   📄 Amazon Response: ${JSON.stringify(details.amazon_response, null, 2)}`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error checking price update logs:', error);
  }
}

// Get ASIN from command line argument
const asin = process.argv[2];
if (!asin) {
  console.log('❌ Please provide an ASIN as an argument');
  console.log('Example: node check-price-update-logs.js B08BPBWV1C');
  process.exit(1);
}

checkPriceUpdateLogs(asin);
