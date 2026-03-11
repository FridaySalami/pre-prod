// Quick script to fix the buybox_jobs table schema
// Run this to add the missing updated_at column

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || 'https://gvowfbrpmotcfxfzzhxf.supabase.co';
const supabaseServiceKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ PRIVATE_SUPABASE_SERVICE_KEY not found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixBuyboxJobsSchema() {
  try {
    console.log('🔧 Fixing buybox_jobs table schema...');

    // Read the SQL migration
    const sql = fs.readFileSync('./fix-buybox-jobs-schema.sql', 'utf8');

    // Execute the migration
    const { data, error } = await supabase.rpc('sql', { sql });

    if (error) {
      console.error('❌ Error running migration:', error);
      return false;
    }

    console.log('✅ Schema migration completed successfully!');
    console.log('📊 buybox_jobs table now has updated_at column');
    return true;

  } catch (err) {
    console.error('❌ Failed to run migration:', err);
    return false;
  }
}

// Run the migration
fixBuyboxJobsSchema().then((success) => {
  if (success) {
    console.log('🚀 Ready to test Buy Box monitoring again!');
  }
  process.exit(success ? 0 : 1);
});
