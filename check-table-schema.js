import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableSchema() {
  console.log('🔍 Checking buybox_data table schema...\n');

  try {
    // Get a sample record to see the columns
    const { data, error } = await supabase
      .from('buybox_data')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error querying buybox_data table:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('✅ Current buybox_data table columns:');
      const columns = Object.keys(data[0]);
      columns.forEach(col => {
        console.log(`   • ${col}`);
      });

      console.log(`\n📊 Total columns: ${columns.length}`);

      // Check specifically for job_id
      if (columns.includes('job_id')) {
        console.log('✅ job_id column EXISTS');
      } else {
        console.log('❌ job_id column MISSING');

        // Check what we have instead
        const possibleJobCols = columns.filter(col =>
          col.includes('job') || col.includes('run') || col.includes('id')
        );

        if (possibleJobCols.length > 0) {
          console.log('🔍 Possible job/run related columns:');
          possibleJobCols.forEach(col => {
            console.log(`   • ${col}`);
          });
        }
      }

    } else {
      console.log('⚠️ Table exists but is empty - cannot inspect columns');
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

checkTableSchema();
