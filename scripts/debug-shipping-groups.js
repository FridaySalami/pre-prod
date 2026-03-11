import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return {};

  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};

  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      env[match[1].trim()] = value;
    }
  });
  return env;
}

const env = loadEnv();
const supabaseUrl = env.PUBLIC_SUPABASE_URL;
const supabaseKey = env.PRIVATE_SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Fetching distinct merchant_shipping_group from sku_asin_mapping...');

  // Fetch all groups (could use .rpc if available, but let's just fetch column and distinct in JS for simplicity if not too huge)
  // Or check if we can use postgres distinct

  // Note: Supabase JS client doesn't support .distinct() directly easily on a column select without a hack, 
  // but we can just fetch all and set them unique in JS if the table isn't massive.
  // Alternatively, we can use a range to sample.

  const { data, error } = await supabase
    .from('sku_asin_mapping')
    .select('seller_sku, merchant_shipping_group')
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Sample data (first 10):');
  console.log(JSON.stringify(data, null, 2));

  const { count } = await supabase.from('sku_asin_mapping').select('*', { count: 'exact', head: true });
  console.log('Total rows:', count);

  // Now fetch all for full distinct check
  const { data: allData } = await supabase
    .from('sku_asin_mapping')
    .select('merchant_shipping_group');

  console.log('\nChecking linnworks_composition_summary structure...');
  const { data: linnSample } = await supabase
    .from('linnworks_composition_summary')
    .select('*')
    .limit(1);

  console.log(JSON.stringify(linnSample?.[0], null, 2));
}

main();
