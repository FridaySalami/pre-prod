// Quick script to check buybox_data table schema
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function checkSchema() {
  try {
    // Get table schema using PostgreSQL system tables
    const { data: columns, error } = await supabase.rpc('get_table_columns', {
      table_name: 'buybox_data'
    });

    if (error) {
      console.log('RPC failed, trying alternative method...');

      // Alternative: Get a sample record to see the actual structure
      const { data: sample, error: sampleError } = await supabase
        .from('buybox_data')
        .select('*')
        .limit(1);

      if (!sampleError && sample && sample.length > 0) {
        console.log('\n=== BUYBOX_DATA TABLE - SAMPLE RECORD FIELDS ===');
        Object.keys(sample[0]).sort().forEach(key => {
          const value = sample[0][key];
          const type = typeof value;
          const preview = value === null ? 'NULL' :
            type === 'string' ? `"${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"` :
              String(value);
          console.log(`${key.padEnd(35)} | ${type.padEnd(10)} | ${preview}`);
        });

        console.log(`\nTotal fields: ${Object.keys(sample[0]).length}`);
      } else {
        console.error('No sample data found:', sampleError);
      }
      return;
    }

    console.log('\n=== BUYBOX_DATA TABLE SCHEMA ===');
    console.log(columns);

  } catch (error) {
    console.error('Script error:', error);
  }
}

checkSchema();
