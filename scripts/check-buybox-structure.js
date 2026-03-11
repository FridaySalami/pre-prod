// Check buybox_data structure
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function checkBuyboxStructure() {
  try {
    console.log('🔍 Checking buybox_data table structure...\n');

    // Get any entry to see structure
    const { data: entries, error } = await supabase
      .from('buybox_data')
      .select('*')
      .limit(5);

    if (error) {
      console.error('❌ Error fetching buybox data:', error);
      return;
    }

    if (entries.length === 0) {
      console.log('⚠️ No entries found in buybox_data table');
      return;
    }

    console.log(`📋 Found ${entries.length} entries. Table structure:`);
    console.log('Columns:', Object.keys(entries[0]));

    console.log('\nSample entries:');
    entries.forEach((entry, index) => {
      console.log(`\n${index + 1}. ${JSON.stringify(entry, null, 2)}`);

      // Check if this is our ASIN
      if (entry.asin === 'B08BPBWV1C') {
        console.log('   ⭐ FOUND YOUR ASIN B08BPBWV1C!');
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkBuyboxStructure();
