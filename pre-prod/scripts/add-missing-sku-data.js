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

async function addMissingSkuData() {
  const sku = 'WRA04 - 006 Prime';
  const asin = 'B0CX95GBQT';
  const title = 'Wrapmaster 4500 Aluminium Foil Refill (Large) 3 x 90 metres (3 Boxes of 3 Rolls)';

  console.log(`Adding missing data for SKU: ${sku}`);

  // 1. Insert into inventory
  console.log('Inserting into inventory...');
  const { error: invError } = await supabase
    .from('inventory')
    .upsert({
      sku: sku,
      asin: asin,
      title: title,
      width: 30,
      height: 30,
      depth: 30,
      weight: 5,
      updated_at: new Date().toISOString()
    }, { onConflict: 'sku' });

  if (invError) console.error('Error inserting inventory:', invError);
  else console.log('Inventory updated.');

  // 2. Insert into sku_asin_mapping
  console.log('Inserting into sku_asin_mapping...');
  const { error: mapError } = await supabase
    .from('sku_asin_mapping')
    .upsert({
      seller_sku: sku,
      asin1: asin,
      item_name: title,
      merchant_shipping_group: 'Nationwide Prime',
      updated_at: new Date().toISOString()
    }, { onConflict: 'seller_sku' });

  if (mapError) console.error('Error inserting mapping:', mapError);
  else console.log('Mapping updated.');

  // 3. Insert into linnworks_composition_summary
  console.log('Inserting into linnworks_composition_summary...');
  const { error: compError } = await supabase
    .from('linnworks_composition_summary')
    .upsert({
      parent_sku: sku,
      parent_title: title,
      total_value: 100.00, // Estimated cost
      total_qty: 1,
      child_skus: JSON.stringify(['WRA04']),
      child_titles: JSON.stringify(['Wrapmaster 4500 Foil']),
      child_quantities: JSON.stringify([9]),
      child_prices: JSON.stringify([11.00]),
      child_vats: JSON.stringify([20]),
      updated_at: new Date().toISOString()
    }, { onConflict: 'parent_sku' });

  if (compError) console.error('Error inserting composition:', compError);
  else console.log('Composition updated.');

  console.log('Done.');
}

addMissingSkuData();
