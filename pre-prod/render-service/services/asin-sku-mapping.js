/**
 * ASIN to SKU Mapping Service
 * 
 * Handles mapping ASINs to their corresponding SKUs using the sku_asin_mapping table
 * and provides utilities for fixing existing monitoring configurations
 */

const { supabase } = require('./supabase-client');

class AsinSkuMappingService {
  constructor() {
    this.supabase = supabase;
  }

  /**
   * Get the correct SKU for an ASIN from sku_asin_mapping table
   */
  async getSkuForAsin(asin) {
    try {
      const { data, error } = await this.supabase
        .from('sku_asin_mapping')
        .select('seller_sku, item_name, item_description, asin1, listing_id')
        .eq('asin1', asin)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          console.warn(`⚠️ No SKU found for ASIN ${asin} in sku_asin_mapping`);
          return null;
        }
        throw error;
      }

      return {
        sku: data.seller_sku,
        asin: data.asin1,
        itemName: data.item_name,
        description: data.item_description,
        listingId: data.listing_id
      };
    } catch (error) {
      console.error(`❌ Error getting SKU for ASIN ${asin}:`, error);
      return null;
    }
  }

  /**
   * Get SKUs for multiple ASINs in batch
   */
  async getSkusForAsins(asins) {
    try {
      const { data, error } = await this.supabase
        .from('sku_asin_mapping')
        .select('seller_sku, item_name, item_description, asin1, listing_id')
        .in('asin1', asins);

      if (error) {
        throw error;
      }

      // Create a map of ASIN -> SKU data
      const asinSkuMap = new Map();
      data.forEach(record => {
        asinSkuMap.set(record.asin1, {
          sku: record.seller_sku,
          asin: record.asin1,
          itemName: record.item_name,
          description: record.item_description,
          listingId: record.listing_id
        });
      });

      return asinSkuMap;
    } catch (error) {
      console.error('❌ Error getting SKUs for ASINs:', error);
      return new Map();
    }
  }

  /**
   * Check for mismatched SKUs in price_monitoring_config
   */
  async findMismatchedConfigs() {
    try {
      // Get all monitoring configs
      const { data: configs, error: configError } = await this.supabase
        .from('price_monitoring_config')
        .select('id, asin, sku, user_email, monitoring_enabled');

      if (configError) {
        throw configError;
      }

      if (!configs || configs.length === 0) {
        return [];
      }

      // Get the correct SKUs for all ASINs
      const asins = configs.map(c => c.asin);
      const asinSkuMap = await this.getSkusForAsins(asins);

      // Find mismatches
      const mismatches = [];
      for (const config of configs) {
        const correctData = asinSkuMap.get(config.asin);

        if (correctData) {
          if (correctData.sku !== config.sku) {
            mismatches.push({
              configId: config.id,
              asin: config.asin,
              currentSku: config.sku,
              correctSku: correctData.sku,
              itemName: correctData.itemName,
              userEmail: config.user_email,
              enabled: config.monitoring_enabled
            });
          }
        } else {
          // ASIN not found in sku_asin_mapping
          mismatches.push({
            configId: config.id,
            asin: config.asin,
            currentSku: config.sku,
            correctSku: null,
            itemName: 'ASIN not found in sku_asin_mapping',
            userEmail: config.user_email,
            enabled: config.monitoring_enabled,
            notFound: true
          });
        }
      }

      return mismatches;
    } catch (error) {
      console.error('❌ Error finding mismatched configs:', error);
      return [];
    }
  }

  /**
   * Update a single monitoring config with the correct SKU
   */
  async updateConfigSku(configId, correctSku) {
    try {
      const { error } = await this.supabase
        .from('price_monitoring_config')
        .update({ sku: correctSku })
        .eq('id', configId);

      if (error) {
        throw error;
      }

      console.log(`✅ Updated config ${configId} with correct SKU: ${correctSku}`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating config ${configId}:`, error);
      return false;
    }
  }

  /**
   * Bulk update all mismatched configs with correct SKUs
   */
  async fixAllMismatchedConfigs() {
    console.log('🔧 Starting bulk SKU correction process...');

    const mismatches = await this.findMismatchedConfigs();

    if (mismatches.length === 0) {
      console.log('✅ No SKU mismatches found - all configs are correct!');
      return { updated: 0, errors: 0, notFound: 0 };
    }

    console.log(`Found ${mismatches.length} configs that need SKU updates`);

    let updated = 0;
    let errors = 0;
    let notFound = 0;

    for (const mismatch of mismatches) {
      if (mismatch.notFound) {
        console.warn(`⚠️ ASIN ${mismatch.asin} not found in sku_asin_mapping - skipping`);
        notFound++;
        continue;
      }

      console.log(`Updating ASIN ${mismatch.asin}: ${mismatch.currentSku} -> ${mismatch.correctSku}`);

      const success = await this.updateConfigSku(mismatch.configId, mismatch.correctSku);
      if (success) {
        updated++;
      } else {
        errors++;
      }

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n📊 Update Summary:`);
    console.log(`   ✅ Successfully updated: ${updated}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   ⚠️ ASINs not found: ${notFound}`);

    return { updated, errors, notFound };
  }

  /**
   * Add a new ASIN to monitoring with automatic SKU lookup
   */
  async addAsinToMonitoring(asin, userEmail, options = {}) {
    console.log(`🔍 Adding ASIN ${asin} to monitoring for user ${userEmail}`);

    // First, get the correct SKU for this ASIN
    const skuData = await this.getSkuForAsin(asin);

    if (!skuData) {
      throw new Error(`ASIN ${asin} not found in sku_asin_mapping table. Cannot add to monitoring.`);
    }

    // Prepare the monitoring config
    const configData = {
      user_email: userEmail,
      asin: asin,
      sku: skuData.sku, // Use the real SKU from sku_asin_mapping
      monitoring_enabled: options.enabled !== false, // Default to true
      priority: options.priority || 5,
      price_change_threshold: options.priceChangeThreshold || 10,
      alert_types: options.alertTypes || ['buy_box_lost', 'price_change'],
      alert_frequency: options.alertFrequency || 'immediate'
    };

    try {
      const { data, error } = await this.supabase
        .from('price_monitoring_config')
        .insert(configData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log(`✅ Successfully added ASIN ${asin} with SKU ${skuData.sku} to monitoring`);
      console.log(`   Item: ${skuData.itemName}`);
      console.log(`   Price: £${skuData.price}`);

      return {
        success: true,
        config: data,
        skuData: skuData
      };
    } catch (error) {
      console.error(`❌ Error adding ASIN ${asin} to monitoring:`, error);
      throw error;
    }
  }

  /**
   * Validate that all monitoring configs have correct SKUs
   */
  async validateAllConfigs() {
    const mismatches = await this.findMismatchedConfigs();

    console.log('\n📋 Validation Report:');
    console.log('=' + '='.repeat(60));

    if (mismatches.length === 0) {
      console.log('✅ All monitoring configurations have correct SKUs!');
      return true;
    }

    console.log(`❌ Found ${mismatches.length} configurations with incorrect SKUs:`);

    mismatches.forEach((mismatch, i) => {
      console.log(`\n${i + 1}. ASIN: ${mismatch.asin}`);
      console.log(`   Current SKU: ${mismatch.currentSku}`);
      console.log(`   Correct SKU: ${mismatch.correctSku || 'NOT FOUND'}`);
      console.log(`   Item: ${mismatch.itemName}`);
      console.log(`   User: ${mismatch.userEmail}`);
      console.log(`   Status: ${mismatch.enabled ? 'Enabled' : 'Disabled'}`);
    });

    return false;
  }
}

module.exports = { AsinSkuMappingService };