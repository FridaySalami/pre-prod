/**
 * Import Amazon listings CSV data into database
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function createTable() {
  console.log('Creating amazon_listings table...');

  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS amazon_listings (
        id TEXT PRIMARY KEY,
        seller_sku TEXT NOT NULL,
        item_name TEXT,
        price NUMERIC(10,2),
        merchant_shipping_group TEXT,
        status TEXT,
        created_at BIGINT,
        updated_at BIGINT,
        UNIQUE(seller_sku)
      );

      CREATE INDEX IF NOT EXISTS idx_amazon_listings_seller_sku ON amazon_listings(seller_sku);
    `
  });

  if (error) {
    console.error('Error creating table:', error);
    throw error;
  }

  console.log('✅ Table created successfully');
}

async function importCsvData() {
  console.log('Importing CSV data...');

  const csvFilePath = path.join(__dirname, 'export_amazon_listings.csv');
  const listings = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        listings.push({
          id: row.id,
          seller_sku: row.sellerSku,
          item_name: row.itemName,
          price: parseFloat(row.price),
          merchant_shipping_group: row.merchantShippingGroup,
          status: row.status,
          created_at: parseInt(row.createdAt),
          updated_at: parseInt(row.updatedAt)
        });
      })
      .on('end', async () => {
        console.log(`Parsed ${listings.length} listings from CSV`);

        // Insert in batches of 100
        const batchSize = 100;
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < listings.length; i += batchSize) {
          const batch = listings.slice(i, i + batchSize);

          const { error } = await supabase
            .from('amazon_listings')
            .upsert(batch, { onConflict: 'seller_sku' });

          if (error) {
            console.error(`Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
            errorCount += batch.length;
          } else {
            successCount += batch.length;
            console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(listings.length / batchSize)}`);
          }
        }

        console.log(`\n📊 Import Summary:`);
        console.log(`✅ Successfully imported: ${successCount} listings`);
        console.log(`❌ Errors: ${errorCount} listings`);

        resolve();
      })
      .on('error', reject);
  });
}

async function verifyImport() {
  console.log('\nVerifying import...');

  // Check total count
  const { count } = await supabase
    .from('amazon_listings')
    .select('*', { count: 'exact', head: true });

  console.log(`Total listings in database: ${count}`);

  // Check BAR28 SKUs specifically
  const { data: bar28Data, error } = await supabase
    .from('amazon_listings')
    .select('seller_sku, price, merchant_shipping_group')
    .or('seller_sku.eq.BAR28 - 003,seller_sku.eq.BAR28 - prime');

  if (error) {
    console.error('Error checking BAR28 data:', error);
  } else {
    console.log('\nBAR28 SKU pricing:');
    bar28Data.forEach(item => {
      console.log(`  ${item.seller_sku}: £${item.price} (${item.merchant_shipping_group})`);
    });
  }
}

async function main() {
  try {
    await createTable();
    await importCsvData();
    await verifyImport();
    console.log('\n🎉 Import completed successfully!');
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

main();
