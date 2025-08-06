// Search for specific ASIN in buybox_data
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function searchSpecificAsin(targetAsin) {
  try {
    console.log(`🔍 Searching for ASIN: ${targetAsin} in buybox_data table...\n`);

    // Search for the specific ASIN
    const { data: asinData, error } = await supabase
      .from('buybox_data')
      .select('*')
      .eq('asin', targetAsin);

    if (error) {
      console.error('❌ Error searching for ASIN:', error);
      return;
    }

    if (asinData.length === 0) {
      console.log(`⚠️ No entries found for ASIN ${targetAsin}`);
      console.log('🔍 This means the price update was NOT logged to the database');
      console.log('\n📋 This confirms that:');
      console.log('   1. The Amazon Listings API is not logging updates to Supabase');
      console.log('   2. Your price update 2 hours ago was not saved');
      console.log('   3. We need to add proper logging to track price changes');
      return;
    }

    console.log(`✅ Found ${asinData.length} entry/entries for ASIN ${targetAsin}:\n`);

    asinData.forEach((entry, index) => {
      console.log(`📋 Entry #${index + 1}:`);
      console.log(`   🏷️ SKU: ${entry.sku}`);
      console.log(`   💰 Current Price: £${entry.your_current_price}`);
      console.log(`   🎯 Buy Box Price: £${entry.buybox_price}`);
      console.log(`   📊 Status: ${entry.pricing_status}`);
      console.log(`   🔄 Last Price Update: ${entry.last_price_update || 'Never'}`);
      console.log(`   📈 Update Source: ${entry.update_source || 'None'}`);
      console.log(`   🔢 Update Attempts: ${entry.update_attempts}`);
      console.log(`   📅 Captured At: ${new Date(entry.captured_at).toLocaleString()}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

const targetAsin = process.argv[2] || 'B08BPBWV1C';
searchSpecificAsin(targetAsin);
