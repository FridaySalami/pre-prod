#!/usr/bin/env node

/**
 * Script to populate sku_product_types table from Excel product catalog files
 * 
 * This script reads the Amazon inventory template Excel files in temp-data/
 * and extracts SKU -> Product Type mappings to populate the sku_product_types table.
 * 
 * Usage: node scripts/populate-sku-product-types-from-excel.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function extractProductDataFromExcel() {
  console.log('📋 Extracting product data from Excel files...');

  return new Promise((resolve, reject) => {
    const pythonScript = `
import pandas as pd
import json

# Extract product data from Excel files
all_products = []
files = [
    '0_ABIS_MUSIC-CONTAINER_LID.xlsm',
    '1_COOKIE-FOOD_GLITTER_SPRINKLE.xlsm', 
    '2_FOOD_SCOOP-MILK_SUBSTITUTE.xlsm',
    '3_NON_DAIRY_CREAM-SIGNAGE.xlsm',
    '4_SKEWER-WRITING_INSTRUMENT.xlsm',
    '5.xlsm'
]

for file in files:
    try:
        # Read with row 3 as header (0-indexed)
        df = pd.read_excel(f'temp-data/{file}', sheet_name='Template', header=3)
        df = df.dropna(how='all')
        
        # Find SKU column
        sku_col = None
        for col in df.columns:
            if 'sku' in str(col).lower() and 'package' not in str(col).lower():
                sku_col = col
                break
        
        if sku_col:
            # Get valid SKUs (filter out template/placeholder values)
            skus = df[sku_col].dropna()
            valid_skus = []
            
            for sku in skus:
                sku_str = str(sku).strip()
                # Filter out template placeholders and system values
                if (sku_str and 
                    sku_str != 'nan' and 
                    not sku_str.startswith('child_parent_sku_relationship') and
                    sku_str != 'ABC123' and
                    len(sku_str) > 3):
                    valid_skus.append(sku_str)
            
            # Extract product types from filename
            filename_parts = file.replace('.xlsm', '').split('-')
            if len(filename_parts) >= 2:
                product_types = filename_parts[1].split('_')
            else:
                product_types = ['UNKNOWN']
            
            # Create SKU -> product type mappings
            for sku in valid_skus:
                for product_type in product_types:
                    all_products.append({
                        'sku': sku,
                        'product_type': product_type,
                        'source_file': file
                    })
                    
    except Exception as e:
        print(f"Error processing {file}: {e}", file=sys.stderr)

# Output as JSON
print(json.dumps(all_products))
`;

    const python = spawn('python3', ['-c', pythonScript], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        console.error('❌ Python script failed:', stderr);
        reject(new Error(`Python script exited with code ${code}`));
        return;
      }

      try {
        const products = JSON.parse(stdout.trim());
        resolve(products);
      } catch (error) {
        console.error('❌ Failed to parse Python output:', error);
        reject(error);
      }
    });
  });
}

async function populateSkuProductTypes(products) {
  console.log(`📦 Processing ${products.length} product records...`);

  // Group by SKU to avoid duplicates
  const skuMap = new Map();

  for (const product of products) {
    const sku = product.sku;
    if (!skuMap.has(sku)) {
      skuMap.set(sku, new Set());
    }
    skuMap.get(sku).add(product.product_type);
  }

  console.log(`📊 Found ${skuMap.size} unique SKUs with product types`);

  // Prepare records for insertion
  const records = [];
  for (const [sku, productTypes] of skuMap.entries()) {
    // For now, use the first product type found
    // In the future, we could store multiple types or prioritize certain types
    const primaryProductType = Array.from(productTypes)[0];

    records.push({
      sku: sku,
      product_type: primaryProductType,
      source: 'excel_import'
    });
  }

  console.log(`📋 Preparing to insert ${records.length} SKU -> product type mappings`);

  // Show sample records
  console.log('\n📋 Sample mappings:');
  records.slice(0, 10).forEach((record, i) => {
    console.log(`  ${i + 1}. ${record.sku} -> ${record.product_type}`);
  });

  // Insert in batches to avoid overwhelming the database
  const batchSize = 100;
  let insertedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    try {
      const { data, error } = await supabase
        .from('sku_product_types')
        .upsert(batch, {
          onConflict: 'sku',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
        errorCount += batch.length;
      } else {
        insertedCount += batch.length;
        console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1} (${batch.length} records)`);
      }
    } catch (error) {
      console.error(`❌ Exception inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
      errorCount += batch.length;
    }
  }

  console.log(`\n📈 SUMMARY:`);
  console.log(`✅ Successfully inserted: ${insertedCount} records`);
  console.log(`❌ Failed to insert: ${errorCount} records`);
  console.log(`📊 Total processed: ${records.length} records`);

  return { inserted: insertedCount, errors: errorCount, total: records.length };
}

async function verifyData() {
  console.log('\n🔍 Verifying inserted data...');

  try {
    const { data, error, count } = await supabase
      .from('sku_product_types')
      .select('*', { count: 'exact' })
      .eq('source', 'excel_import')
      .limit(10);

    if (error) {
      console.error('❌ Error verifying data:', error);
      return;
    }

    console.log(`📊 Total records with source 'excel_import': ${count}`);
    console.log('\n📋 Sample inserted records:');

    data.forEach((record, i) => {
      console.log(`  ${i + 1}. SKU: ${record.sku} | Type: ${record.product_type} | Source: ${record.source}`);
    });

  } catch (error) {
    console.error('❌ Exception during verification:', error);
  }
}

async function main() {
  try {
    console.log('🚀 Starting Excel product data import...\n');

    // Extract product data from Excel files
    const products = await extractProductDataFromExcel();

    if (!products || products.length === 0) {
      console.log('❌ No product data found in Excel files');
      return;
    }

    // Populate the database
    const result = await populateSkuProductTypes(products);

    // Verify the data was inserted correctly
    await verifyData();

    console.log('\n✅ Excel product data import completed!');

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
