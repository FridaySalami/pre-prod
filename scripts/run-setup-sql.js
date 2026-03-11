import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read environment variables from .env
const envFile = fs.readFileSync('./.env', 'utf8');
const envVars = envFile.split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    // Remove quotes if present
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    acc[key] = value;
  }
  return acc;
}, {});

// Initialize Supabase client with service role key
const supabaseUrl = envVars.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.PRIVATE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Read SQL file
const sql = fs.readFileSync('./setup-sku-asin-mapping.sql', 'utf8');

// Split SQL into individual statements
const statements = sql.split(';')
  .map(statement => statement.trim())
  .filter(statement => statement.length > 0);

// Execute each statement
async function runSql() {
  try {
    console.log(`Found ${statements.length} SQL statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}`);
      console.log(`SQL: ${statement.substring(0, 50)}...`);

      const { error } = await supabase.rpc('pgmoon_exec', { query_text: statement });

      if (error) {
        console.error(`Error executing statement ${i + 1}:`, error);
        // Continue with next statement even if one fails
      } else {
        console.log(`Statement ${i + 1} executed successfully`);
      }
    }

    console.log('All statements executed');
  } catch (error) {
    console.error('Error executing SQL:', error);
  }
}

runSql();
