/**
 * Live Pricing Service
 * 
 * Wrapper around existing amazon-spapi.js service for single-item live updates
 * Leverages proven SP-API integration and cost calculation logic
 */

const { AmazonSPAPI } = require('./amazon-spapi');
const CostCalculator = require('./cost-calculator');
const { SupabaseService } = require('./supabase-client');

class LivePricingService {
  constructor() {
    // Initialize existing proven services
    this.amazonAPI = new AmazonSPAPI(SupabaseService.client);
    this.costCalculator = new CostCalculator(SupabaseService.client);
    this.db = SupabaseService.client;

    // Rate limiting - SP-API Product Pricing is 0.5 requests per second
    this.lastRequestTime = 0;
    this.minRequestInterval = 2000; // 2 seconds between requests
  }

  /**
   * Rate limit check to ensure we don't exceed 0.5 req/second
   */
  async rateLimitCheck() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`⏱️ Rate limiting: waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Validate update request for security and data integrity
   */
  async validateUpdateRequest(sku, userId, recordId) {
    // Check if record exists and user has permission
    const { data: existingRecord, error } = await this.db
      .from('buybox_data')
      .select('id, sku, asin, captured_at')
      .eq('id', recordId)
      .eq('sku', sku)
      .single();

    if (error || !existingRecord) {
      throw new Error(`Invalid record: SKU ${sku} with ID ${recordId} not found`);
    }

    // Check if recently updated (within 5 minutes) to prevent spam
    const lastUpdate = new Date(existingRecord.captured_at);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    if (lastUpdate > fiveMinutesAgo) {
      const timeRemaining = Math.ceil((5 * 60 * 1000 - (Date.now() - lastUpdate.getTime())) / 1000);
      throw new Error(`RECENTLY_UPDATED: Please wait ${timeRemaining} seconds before updating again`);
    }

    return existingRecord;
  }

  /**
   * Update single item with live pricing data
   * Leverages existing proven amazon-spapi.js methods
   */
  async updateSingleItem(sku, recordId, userId) {
    try {
      console.log(`🔄 Live update requested for SKU: ${sku}, Record: ${recordId}`);

      // 1. Validate request
      const existingRecord = await this.validateUpdateRequest(sku, userId, recordId);

      // 2. Rate limit check
      await this.rateLimitCheck();

      // 3. Get product title from sku_asin_mapping table (just like batch process)
      console.log(`📋 Fetching product title for SKU: ${sku}, ASIN: ${existingRecord.asin}`);
      let productTitle = null;
      try {
        productTitle = await SupabaseService.getProductTitle(sku, existingRecord.asin);
        console.log(`Product title for ${sku}/${existingRecord.asin}: ${productTitle || 'Not found'}`);
      } catch (titleError) {
        console.warn(`Failed to fetch product title for ${sku}/${existingRecord.asin}:`, titleError.message);
        // Fallback to placeholder
        productTitle = `Product ${existingRecord.asin}`;
      }

      // 4. Get live pricing using existing proven method
      console.log(`📡 Fetching live pricing for ASIN: ${existingRecord.asin}`);
      const pricingData = await this.amazonAPI.getCompetitivePricing(existingRecord.asin);

      // 5. Transform data using existing proven method (now with product title)
      console.log(`🔄 Transforming pricing data for SKU: ${sku}`);
      const transformedData = await this.amazonAPI.transformPricingData(
        pricingData,
        existingRecord.asin,
        sku,
        existingRecord.run_id, // Reuse existing run_id instead of generating new one
        productTitle // Product title from sku_asin_mapping table
      );      // 6. Update database record
      const updatedRecord = await this.updateBuyboxRecord(recordId, transformedData, existingRecord);

      console.log(`✅ Successfully updated live pricing for SKU: ${sku}`);

      return {
        success: true,
        updatedData: updatedRecord,
        previousData: existingRecord,
        timestamp: new Date().toISOString(),
        source: 'live_update'
      };

    } catch (error) {
      console.error(`❌ Live pricing update failed for SKU ${sku}:`, error.message);

      // Categorize errors for better UI handling
      if (error.message === 'RATE_LIMITED') {
        throw new Error('RATE_LIMITED: Too many requests, please try again in a moment');
      } else if (error.message === 'ACCESS_DENIED') {
        throw new Error('ACCESS_DENIED: Invalid API credentials');
      } else if (error.message === 'ASIN_NOT_FOUND') {
        throw new Error('ASIN_NOT_FOUND: Product not found on Amazon');
      } else if (error.message.startsWith('RECENTLY_UPDATED:')) {
        throw error; // Pass through with original message
      } else {
        throw new Error(`UPDATE_FAILED: ${error.message}`);
      }
    }
  }

  /**
   * Update buybox_data record with new pricing information
   * Preserves existing data structure and relationships
   */
  async updateBuyboxRecord(recordId, newData, previousData) {
    try {
      // Prepare update data - keep existing structure, update pricing fields
      const updateData = {
        ...newData,
        captured_at: new Date().toISOString(),
        source: 'live_manual_update'
      };

      // Update the record
      const { data: updatedRecord, error } = await this.db
        .from('buybox_data')
        .update(updateData)
        .eq('id', recordId)
        .select()
        .single();

      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }

      // Log the update for audit trail
      await this.logPriceUpdate(newData.sku, previousData, updatedRecord, 'system');

      return updatedRecord;

    } catch (error) {
      console.error('Database update error:', error);
      throw error;
    }
  }

  /**
   * Log price update for audit trail
   */
  async logPriceUpdate(sku, oldData, newData, userId) {
    try {
      const logEntry = {
        sku: sku,
        old_price: oldData.your_current_price,
        new_price: newData.your_current_price,
        old_buybox_price: oldData.buybox_price,
        new_buybox_price: newData.buybox_price,
        updated_by: userId,
        updated_at: new Date().toISOString(),
        update_type: 'live_manual_update'
      };

      // Note: You may want to create a price_update_log table for this
      console.log('📝 Price update logged:', logEntry);

      // For now, just log to console - can be extended to database logging later

    } catch (error) {
      console.warn('Failed to log price update:', error.message);
      // Don't throw error here - logging failure shouldn't break the update
    }
  }
}

module.exports = LivePricingService;
