
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function runMigration() {
  try {
    const sqlPath = path.join(__dirname, '../sql/add-shipping-cost-column.sql');
    const sqlContent = readFileSync(sqlPath, 'utf8');

    console.log('Executing SQL migration...');
    const { error } = await supabase.rpc('exec_sql', {
      sql_query: sqlContent
    });

    if (error) {
      console.error('Migration failed:', error);
      // Fallback: try to run it directly if exec_sql doesn't exist or fails
      // Note: This fallback is limited as supabase-js doesn't support raw SQL directly without RPC
      console.log('Note: If exec_sql RPC does not exist, you may need to run the SQL manually in the Supabase dashboard.');
    } else {
      console.log('Migration successful!');
    }
  } catch (e) {
    console.error('Error running migration:', e);
  }
}

runMigration();
