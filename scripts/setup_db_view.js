import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
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
const connectionString = env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false } // Required for Supabase/Heroku usually
});

async function main() {
  await client.connect();

  const query = `
    CREATE OR REPLACE VIEW cost_manager_view AS
    SELECT 
        lcs.id as composition_id,
        lcs.parent_sku as sku, 
        lcs.parent_title as title, 
        lcs.total_value, 
        lcs.child_vats as vat_rates_json,
        COALESCE(sam.merchant_shipping_group, 'Off Amazon') as merchant_shipping_group,
        inv.width,
        inv.height,
        inv.depth,
        inv.weight
    FROM linnworks_composition_summary lcs
    LEFT JOIN sku_asin_mapping sam ON lcs.parent_sku = sam.seller_sku
    LEFT JOIN inventory inv ON lcs.parent_sku = inv.sku;
  `;

  console.log('Creating view...');
  try {
    await client.query(query);
    console.log('View "cost_manager_view" created successfully.');

    // Grant select permissions if needed (usually public needs it if accessing via API)
    // await client.query('GRANT SELECT ON cost_manager_view TO anon, authenticated, service_role;');
    // Or just ensuring it works.

    // Let's test a count
    const res = await client.query('SELECT COUNT(*) FROM cost_manager_view');
    console.log('Row count in view:', res.rows[0].count);

  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

main();
