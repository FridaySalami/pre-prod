#!/usr/bin/env node

/**
 * Product Type Backfill Script for Match Buy Box
 * Fetches product types for all SKUs that don't have them yet
 */

import { createClient } from '@supabase/supabase-js';
import AmazonFeedsAPI from './amazon-feeds-api-standalone.js';
import dotenv from 'dotenv';

dotenv.config();

// Rate limiter class
class RateLimiter {
  constructor(requestsPerSecond = 0.2) {
    this.delay = 1000 / requestsPerSecond; // Convert to milliseconds
    this.lastRequestTime = 0;
  }

  async wait() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.delay) {
      const waitTime = this.delay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}

class ProductTypeBackfill {
  constructor() {
    this.supabase = createClient(
      process.env.PUBLIC_SUPABASE_URL,
      process.env.PRIVATE_SUPABASE_SERVICE_KEY
    );
    this.amazonAPI = new AmazonFeedsAPI();
    this.rateLimiter = new RateLimiter(0.2); // 1 request per 5 seconds
    this.results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };
  }

  async backfillAllProductTypes() {
    console.log('🔄 Starting product type backfill for Match Buy Box...');
    console.log('📊 This script will fetch product types for SKUs without them');

    try {
      // Get all unique SKUs without product types
      const skusToProcess = await this.getSkusNeedingProductTypes();

      if (skusToProcess.length === 0) {
        console.log('✅ All SKUs already have product types! Nothing to do.');
        return this.results;
      }

      console.log(`📊 Found ${skusToProcess.length} SKUs needing product types`);
      console.log(`⏱️  Estimated time: ${Math.ceil(skusToProcess.length * 5 / 60)} minutes`);
      console.log('🚀 Starting backfill process...\n');

      let processed = 0;
      for (const { sku, asin } of skusToProcess) {
        try {
          processed++;
          console.log(`[${processed}/${skusToProcess.length}] Processing ${sku}...`);

          await this.rateLimiter.wait();

          const productType = await this.fetchProductType(sku);

          if (productType) {
            await this.updateProductType(sku, asin, productType);
            this.results.success++;
            console.log(`✅ ${sku}: ${productType}`);
          } else {
            this.results.failed++;
            console.log(`❌ ${sku}: Could not determine product type`);
          }

        } catch (error) {
          this.results.failed++;
          this.results.errors.push({ sku, error: error.message });
          console.error(`❌ ${sku}: ${error.message}`);
        }

        // Progress update every 10 items
        if (processed % 10 === 0) {
          console.log(`\n📈 Progress: ${processed}/${skusToProcess.length} (${Math.round(processed / skusToProcess.length * 100)}%)`);
          console.log(`✅ Success: ${this.results.success} | ❌ Failed: ${this.results.failed}\n`);
        }
      }

      console.log('\n🎉 Backfill process complete!');
      console.log('📋 Final Results:');
      console.log(`  ✅ Successfully processed: ${this.results.success}`);
      console.log(`  ❌ Failed: ${this.results.failed}`);
      console.log(`  📊 Total processed: ${processed}`);

      if (this.results.errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        this.results.errors.forEach(({ sku, error }) => {
          console.log(`  - ${sku}: ${error}`);
        });
      }

      // Verify the results
      await this.verifyBackfill();

      return this.results;

    } catch (error) {
      console.error('❌ Backfill process failed:', error);
      throw error;
    }
  }

  async getSkusNeedingProductTypes() {
    console.log('📊 Fetching all SKUs needing product types (with pagination)...');

    let allSkus = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await this.supabase
        .from('buybox_data')
        .select('sku, asin')
        .is('product_type', null)
        .not('sku', 'is', null)
        .order('sku')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        throw new Error(`Failed to fetch SKUs (page ${page + 1}): ${error.message}`);
      }

      if (data && data.length > 0) {
        allSkus.push(...data);
        console.log(`   📄 Page ${page + 1}: ${data.length} SKUs (total so far: ${allSkus.length})`);

        // Check if we got a full page (more data might exist)
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    console.log(`📊 Total SKUs fetched: ${allSkus.length}`);

    // Remove duplicates manually since Supabase doesn't support DISTINCT properly
    const uniqueSkus = [];
    const seenSkus = new Set();

    for (const item of allSkus) {
      if (!seenSkus.has(item.sku)) {
        seenSkus.add(item.sku);
        uniqueSkus.push(item);
      }
    }

    return uniqueSkus;
  }

  async fetchProductType(sku) {
    try {
      const token = await this.amazonAPI.getAccessToken();
      const productType = await this.amazonAPI.getProductType(token, sku);
      return productType;
    } catch (error) {
      console.error(`Failed to fetch product type for ${sku}:`, error.message);
      return null;
    }
  }

  async updateProductType(sku, asin, productType) {
    try {
      // Update buybox_data table
      const { error: updateError } = await this.supabase
        .from('buybox_data')
        .update({ product_type: productType })
        .eq('sku', sku);

      if (updateError) {
        console.warn(`Warning: Could not update buybox_data for ${sku}:`, updateError.message);
      }

      // Insert/update into reference table
      const { error: upsertError } = await this.supabase
        .from('sku_product_types')
        .upsert({
          sku,
          asin,
          product_type: productType,
          source: 'backfill_script',
          verified_at: new Date().toISOString(),
          marketplace_id: 'A1F83G8C2ARO7P'
        });

      if (upsertError) {
        throw new Error(`Failed to update sku_product_types: ${upsertError.message}`);
      }

    } catch (error) {
      throw new Error(`Database update failed for ${sku}: ${error.message}`);
    }
  }

  async verifyBackfill() {
    console.log('\n🔍 Verifying backfill results...');

    try {
      // Check how many SKUs still need product types
      const { data: remainingSkus, error } = await this.supabase
        .from('buybox_data')
        .select('COUNT(*)')
        .is('product_type', null)
        .not('sku', 'is', null);

      if (error) {
        console.error('❌ Verification failed:', error.message);
        return;
      }

      const remainingCount = remainingSkus[0]?.count || 0;

      // Check total SKUs with product types
      const { data: totalWithTypes, error: totalError } = await this.supabase
        .from('buybox_data')
        .select('COUNT(*)')
        .not('product_type', 'is', null)
        .not('sku', 'is', null);

      if (totalError) {
        console.error('❌ Total count verification failed:', totalError.message);
        return;
      }

      const successCount = totalWithTypes[0]?.count || 0;

      console.log('📊 Verification Results:');
      console.log(`  ✅ SKUs with product types: ${successCount}`);
      console.log(`  ❌ SKUs still missing product types: ${remainingCount}`);

      if (remainingCount === 0) {
        console.log('🎉 Perfect! All SKUs now have product types.');
      } else {
        console.log(`⚠️  ${remainingCount} SKUs still need product types. You may need to run this script again or investigate manually.`);
      }

      // Show some sample product types
      const { data: samples } = await this.supabase
        .from('buybox_data')
        .select('sku, product_type')
        .not('product_type', 'is', null)
        .limit(5);

      if (samples && samples.length > 0) {
        console.log('\n📋 Sample product types discovered:');
        samples.forEach(({ sku, product_type }) => {
          console.log(`  - ${sku}: ${product_type}`);
        });
      }

    } catch (error) {
      console.error('❌ Verification failed:', error);
    }
  }

  // Method to backfill specific SKUs (useful for testing)
  async backfillSpecificSkus(skus) {
    console.log(`🎯 Backfilling specific SKUs: ${skus.join(', ')}`);

    for (const sku of skus) {
      try {
        console.log(`🔄 Processing ${sku}...`);

        // Get ASIN for this SKU
        const { data: skuData } = await this.supabase
          .from('buybox_data')
          .select('asin')
          .eq('sku', sku)
          .limit(1)
          .single();

        if (!skuData) {
          console.log(`❌ ${sku}: SKU not found in database`);
          continue;
        }

        await this.rateLimiter.wait();

        const productType = await this.fetchProductType(sku);

        if (productType) {
          await this.updateProductType(sku, skuData.asin, productType);
          console.log(`✅ ${sku}: ${productType}`);
        } else {
          console.log(`❌ ${sku}: Could not determine product type`);
        }

      } catch (error) {
        console.error(`❌ ${sku}: ${error.message}`);
      }
    }
  }
}

// Command line interface
async function main() {
  const backfill = new ProductTypeBackfill();

  // Check command line arguments
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Backfill specific SKUs
    console.log('🎯 Running targeted backfill for specific SKUs...');
    await backfill.backfillSpecificSkus(args);
  } else {
    // Backfill all SKUs
    console.log('🔄 Running full backfill for all SKUs...');
    await backfill.backfillAllProductTypes();
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default ProductTypeBackfill;
