#!/usr/bin/env node
/**
 * Backfill Product Titles for Competitive ASINs
 * Updates existing competitive ASIN records with product titles where missing
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  // Initialize Supabase client
  const url = process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.error("❌ Error: Missing Supabase credentials");
    return;
  }

  const supabase = createClient(url, key);

  console.log("🔍 Fetching competitive ASINs with missing titles...");

  // Get all competitive ASINs that are missing titles
  const { data: records, error } = await supabase
    .from('competitive_asins')
    .select('*')
    .or('competitive_product_title.is.null,competitive_product_title.eq.');

  if (error) {
    console.error("❌ Error fetching records:", error);
    return;
  }

  if (!records || records.length === 0) {
    console.log("✅ No competitive ASINs missing titles!");
    return;
  }

  console.log(`📝 Found ${records.length} competitive relationships missing titles`);

  let updated_count = 0;

  for (const record of records) {
    const competitive_asin = record.competitive_asin;
    const record_id = record.id;

    // Try to find the title in sku_asin_mapping
    const { data: mappingData } = await supabase
      .from('sku_asin_mapping')
      .select('item_name')
      .eq('asin1', competitive_asin)
      .single();

    let title = mappingData?.item_name;

    // If no title found, create a placeholder
    if (!title) {
      title = `Product ${competitive_asin}`;
    }

    // Update the record
    try {
      const { data: updateData, error: updateError } = await supabase
        .from('competitive_asins')
        .update({
          competitive_product_title: title
        })
        .eq('id', record_id)
        .select();

      if (updateError) {
        console.error(`❌ Failed to update ${competitive_asin}:`, updateError);
      } else {
        console.log(`✅ Updated ${competitive_asin}: ${title}`);
        updated_count++;
      }

    } catch (e) {
      console.error(`❌ Error updating ${competitive_asin}:`, e);
    }

    // Small delay to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n🎉 Backfill complete! Updated ${updated_count} records`);
}

main().catch(console.error);
