// Check buybox_data for specific ASIN
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function checkBuyboxData(asin) {
  try {
    console.log(`🔍 Checking buybox_data for ASIN: ${asin}\n`);

    // Check for specific ASIN
    const { data: asinData, error: asinError } = await supabase
      .from('buybox_data')
      .select('*')
      .eq('asin', asin)
      .order('created_at', { ascending: false })
      .limit(10);

    if (asinError) {
      console.error('❌ Error fetching buybox data:', asinError);
      return;
    }

    if (asinData.length === 0) {
      console.log(`⚠️ No buybox data found for ASIN ${asin}`);

      // Check recent entries to see what ASINs are there
      console.log('\n🔍 Checking recent buybox entries (any ASIN)...');
      const { data: recentData, error: recentError } = await supabase
        .from('buybox_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!recentError && recentData.length > 0) {
        console.log('📋 Recent buybox entries:');
        recentData.forEach((entry, index) => {
          console.log(`${index + 1}. ASIN: ${entry.asin} | SKU: ${entry.sku || 'N/A'} | Price: £${entry.our_price || 'N/A'} | ${new Date(entry.created_at).toLocaleString()}`);
        });
      }

      return;
    }

    console.log(`✅ Found ${asinData.length} buybox entry/entries for ASIN ${asin}:\n`);

    asinData.forEach((entry, index) => {
      console.log(`📋 Entry #${index + 1}:`);
      console.log(`   🕐 Time: ${new Date(entry.created_at).toLocaleString()}`);
      console.log(`   🏷️ SKU: ${entry.sku || 'N/A'}`);
      console.log(`   💰 Our Price: £${entry.our_price || 'N/A'}`);
      console.log(`   🎯 Buy Box Price: £${entry.buy_box_price || 'N/A'}`);
      console.log(`   📊 Status: ${entry.status || 'N/A'}`);
      console.log(`   🔄 Last Updated: ${entry.last_updated ? new Date(entry.last_updated).toLocaleString() : 'N/A'}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error checking buybox data:', error);
  }
}

// Get ASIN from command line argument
const asin = process.argv[2] || 'B08BPBWV1C';
checkBuyboxData(asin);
