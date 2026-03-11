import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('No .env file found');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};

  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  });

  return env;
}

const env = loadEnvFile();
const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY);

async function insertMapping() {
  const sku = 'WRA04 - 006 Prime';
  console.log(`Attempting to insert mapping for ${sku}...`);

  const { data, error } = await supabase
    .from('sku_asin_mapping')
    .upsert({
      seller_sku: sku,
      asin1: 'B0CX95GBQT',
      item_name: 'Test Title',
      merchant_shipping_group: 'Nationwide Prime',
      updated_at: new Date().toISOString()
    }, { onConflict: 'seller_sku' })
    .select();

  if (error) {
    console.error('Error inserting mapping:', error);
  } else {
    console.log('Success:', data);
  }
}

insertMapping();
