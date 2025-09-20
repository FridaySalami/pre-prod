/**
 * Supabase Client for Render Service
 * 
 * Handles all database operations for the Buy Box monitoring service
 */

const { createClient } = require('@supabase/supabase-js');

// Verify required environment variables
if (!process.env.PUBLIC_SUPABASE_URL || !process.env.PRIVATE_SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required Supabase environment variables');
}

// Create Supabase client with service role key
const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

/**
 * Database operations for Buy Box jobs
 */
class SupabaseService {

  /**
   * Create a new Buy Box job
   */
  async createJob(totalAsins, source = 'render-service') {
    const { data, error } = await supabase
      .from('buybox_jobs')
      .insert({
        status: 'running',
        started_at: new Date().toISOString(),
        total_asins: totalAsins,
        successful_asins: 0,
        failed_asins: 0,
        source: source,
        notes: `Bulk scan job for ${totalAsins} ASINs via Render service`
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create job: ${error.message}`);
    }

    return data;
  }

  /**
   * Update job progress
   */
  async updateJobProgress(jobId, successfulAsins, failedAsins, notes = null) {
    const updateData = {
      successful_asins: successfulAsins,
      failed_asins: failedAsins,
      updated_at: new Date().toISOString()
    };

    if (notes) {
      updateData.notes = notes;
    }

    const { data, error } = await supabase
      .from('buybox_jobs')
      .update(updateData)
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update job progress: ${error.message}`);
    }

    return data;
  }

  /**
   * Mark job as completed
   */
  async completeJob(jobId, successfulAsins, failedAsins, notes = null) {
    const updateData = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      successful_asins: successfulAsins,
      failed_asins: failedAsins
    };

    if (notes) {
      updateData.notes = notes;
    }

    const { data, error } = await supabase
      .from('buybox_jobs')
      .update(updateData)
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to complete job: ${error.message}`);
    }

    return data;
  }

  /**
   * Mark job as failed
   */
  async failJob(jobId, errorMessage) {
    const { data, error } = await supabase
      .from('buybox_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        notes: `Job failed: ${errorMessage}`
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to mark job as failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Get job status
   */
  async getJob(jobId) {
    const { data, error } = await supabase
      .from('buybox_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      throw new Error(`Failed to get job: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all active ASINs for monitoring
   */
  async getActiveAsins(limit = null, offset = 0) {
    // If a specific limit is requested, use the original logic
    if (limit) {
      let query = supabase
        .from('sku_asin_mapping')
        .select('seller_sku, asin1, item_name, price')
        .eq('status', 'Active')
        .not('asin1', 'is', null)
        .order('seller_sku')
        .range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to get active ASINs: ${error.message}`);
      }

      return data;
    }

    // No limit specified - fetch ALL records using pagination
    console.log('📊 Fetching all active ASINs from database (may take a moment)...');
    let allAsins = [];
    let currentOffset = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('sku_asin_mapping')
        .select('seller_sku, asin1, item_name, price')
        .eq('status', 'Active')
        .not('asin1', 'is', null)
        .order('seller_sku')
        .range(currentOffset, currentOffset + pageSize - 1);

      if (error) {
        throw new Error(`Failed to get active ASINs at offset ${currentOffset}: ${error.message}`);
      }

      if (data && data.length > 0) {
        allAsins = allAsins.concat(data);
        console.log(`📄 Fetched page ${Math.floor(currentOffset / pageSize) + 1}: ${data.length} ASINs (total: ${allAsins.length})`);

        // If we got less than pageSize, we've reached the end
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          currentOffset += pageSize;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`✅ Fetched ${allAsins.length} active ASINs from database (${Math.ceil(allAsins.length / pageSize)} pages)`);
    return allAsins;
  }

  /**
   * Get total count of active ASINs
   */
  async getActiveAsinCount() {
    const { count, error } = await supabase
      .from('sku_asin_mapping')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Active')
      .not('asin1', 'is', null);

    if (error) {
      throw new Error(`Failed to get active ASIN count: ${error.message}`);
    }

    return count;
  }

  /**
   * Insert Buy Box data result
   */
  async insertBuyBoxData(buyBoxData) {
    const { data, error } = await supabase
      .from('buybox_data')
      .insert(buyBoxData)
      .select();

    if (error) {
      throw new Error(`Failed to insert Buy Box data: ${error.message}`);
    }

    return data;
  }

  /**
   * Insert a batch of Buy Box data summaries
   */
  async insertBuyBoxDataBatch(records) {
    const { data, error } = await supabase
      .from('buybox_data')
      .insert(records)
      .select();

    if (error) {
      throw new Error(`Failed to insert Buy Box data batch: ${error.message}`);
    }

    return data;
  }

  /**
   * Insert competitor offers for a run into child table buybox_offers
   */
  async insertBuyBoxOffers(offers) {
    if (!offers || offers.length === 0) return [];

    const { data, error } = await supabase
      .from('buybox_offers')
      .insert(offers)
      .select();

    if (error) {
      throw new Error(`Failed to insert competitor offers: ${error.message}`);
    }

    return data;
  }

  /**
   * Log failed ASIN processing (Legacy method - deprecated)
   */
  async logFailure(runId, asin, sku, errorMessage) {
    // Deprecated - use recordFailure instead
    return this.recordFailure(runId, asin, sku, errorMessage, 'PROCESSING_FAILED', 1, {});
  }

  /**
   * Record detailed failure information
   */
  async recordFailure(jobId, asin, sku, reason, errorCode = 'UNKNOWN', attemptNumber = 1, rawError = {}) {
    const { data, error } = await supabase
      .from('buybox_failures')
      .insert({
        job_id: jobId,
        asin: asin,
        sku: sku,
        reason: reason,
        error_code: errorCode,
        attempt_number: attemptNumber,
        raw_error: typeof rawError === 'string' ? rawError : JSON.stringify(rawError),
        captured_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('Failed to record failure:', error);
      // Don't throw here as it's just logging
    }

    return data;
  }

  /**
   * Get all ASINs (including inactive ones)
   */
  async getAllAsins(limit = null, offset = 0) {
    let query = supabase
      .from('sku_asin_mapping')
      .select('seller_sku, asin1, item_name, price, status')
      .not('asin1', 'is', null)
      .order('seller_sku');

    if (limit) {
      query = query.range(offset, offset + limit - 1);
    } else {
      // No limit specified - fetch all records (Supabase default limit is 1000, so set high limit)
      query = query.limit(10000); // Set high limit to get all records
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get all ASINs: ${error.message}`);
    }

    console.log(`✅ Fetched ${data.length} total ASINs from database`);
    return data;
  }

  /**
   * Get ASIN to SKU mappings for specific ASINs
   */
  async getAsinSkuMappings(asins) {
    if (!asins || asins.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('sku_asin_mapping')
      .select('seller_sku, asin1, item_name, price, status')
      .in('asin1', asins)
      .eq('status', 'Active'); // Only get active products

    if (error) {
      throw new Error(`Failed to get ASIN/SKU mappings: ${error.message}`);
    }

    console.log(`✅ Found ${data.length} ASIN/SKU mappings for ${asins.length} requested ASINs`);
    return data;
  }

  /**
   * Get total count of ASINs (including inactive ones)
   */
  async getAllAsinCount() {
    const { count, error } = await supabase
      .from('sku_asin_mapping')
      .select('*', { count: 'exact', head: true })
      .not('asin1', 'is', null);

    if (error) {
      throw new Error(`Failed to get ASIN count: ${error.message}`);
    }

    return count;
  }

  /**
   * List jobs with pagination
   */
  async listJobs(limit = 20, offset = 0) {
    const { data, error } = await supabase
      .from('buybox_jobs')
      .select('*')
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to list jobs: ${error.message}`);
    }

    return data;
  }

  /**
   * Get job failures
   */
  async getJobFailures(jobId) {
    const { data, error } = await supabase
      .from('buybox_failures')
      .select('*')
      .eq('job_id', jobId)
      .order('captured_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get job failures: ${error.message}`);
    }

    return data;
  }

  /**
   * Get job results with filters
   */
  async getJobResults(options) {
    const {
      jobId,
      asin,
      sku,
      page = 1,
      limit = 25,
      offset = 0,
      showOpportunities = false,
      showWinners = false,
      showProfitable = false,
      minMargin = 0,
      recommendation = null,
      includeAllJobs = false
    } = options;

    // Build query
    let query = supabase
      .from('buybox_data')
      .select('*', { count: 'exact' });

    // Apply filters
    if (jobId && !includeAllJobs) {
      query = query.eq('run_id', jobId);
    }

    if (asin) {
      query = query.eq('asin', asin);
    }

    if (sku) {
      query = query.eq('sku', sku);
    }

    if (showOpportunities) {
      query = query.eq('opportunity_flag', true);
    }

    if (showWinners) {
      query = query.eq('is_winner', true);
    }

    // New margin-based filters
    if (showProfitable) {
      query = query.gt('profit_opportunity', 0);
    }

    if (minMargin > 0) {
      query = query.gte('your_margin_percent_at_current_price', minMargin);
    }

    if (recommendation) {
      query = query.eq('recommended_action', recommendation);
    }

    // Apply pagination
    query = query
      .order('captured_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to get job results: ${error.message}`);
    }

    return {
      data,
      total: count
    };
  }

  /**
   * Get job summary statistics
   */
  async getJobSummaryStats(options) {
    const {
      jobId,
      asin,
      sku,
      includeAllJobs = false
    } = options;

    // Build base query for the same job/filters
    let baseQuery = supabase.from('buybox_data').select('*');

    // Apply same filters as main query
    if (jobId && !includeAllJobs) {
      baseQuery = baseQuery.eq('run_id', jobId);
    }

    if (asin) {
      baseQuery = baseQuery.eq('asin', asin);
    }

    if (sku) {
      baseQuery = baseQuery.eq('sku', sku);
    }

    const { data: allResults, error } = await baseQuery;

    if (error) {
      throw new Error(`Failed to get job summary stats: ${error.message}`);
    }

    // Calculate summary statistics
    const winners_count = allResults.filter(r => r.is_winner).length;
    const opportunities_count = allResults.filter(r => r.opportunity_flag).length;
    const profitable_opportunities_count = allResults.filter(r => r.profit_opportunity && r.profit_opportunity > 0).length;
    const margin_data_count = allResults.filter(r => r.your_margin_percent_at_current_price !== null).length;

    // Calculate total profit opportunity (sum of all positive profit opportunities)
    const total_profit_opportunity = allResults
      .filter(r => r.profit_opportunity && r.profit_opportunity > 0)
      .reduce((sum, r) => sum + (r.profit_opportunity || 0), 0);

    // Calculate SKUs needing price adjustments (recommended to match buy box)
    const match_buybox_count = allResults.filter(r => r.recommended_action === 'match_buybox').length;

    // Calculate average current profit for SKUs with margin data
    const skus_with_actual_profit = allResults.filter(r => r.current_actual_profit !== null);
    const average_current_profit = skus_with_actual_profit.length > 0
      ? skus_with_actual_profit.reduce((sum, r) => sum + (r.current_actual_profit || 0), 0) / skus_with_actual_profit.length
      : 0;

    return {
      winners_count,
      opportunities_count,
      profitable_opportunities_count,
      margin_data_count,
      total_profit_opportunity: parseFloat(total_profit_opportunity.toFixed(2)),
      match_buybox_count,
      average_current_profit: parseFloat(average_current_profit.toFixed(2)),
      total_results: allResults.length
    };
  }

  /**
   * Get product title for SKU and ASIN combination
   */
  async getProductTitle(sku, asin) {
    const { data, error } = await supabase
      .from('sku_asin_mapping')
      .select('item_name')
      .eq('seller_sku', sku)
      .eq('asin1', asin)
      .single();

    if (error) {
      console.warn(`Failed to get product title for ${sku}/${asin}:`, error.message);
      return null;
    }

    return data?.item_name || null;
  }

  /**
   * Get SKU-specific pricing from Amazon listings data
   */
  async getSkuPricing(sku) {
    try {
      // First try to get from amazon_listings table if it exists
      const { data: listingData, error: listingError } = await supabase
        .from('amazon_listings')
        .select('price, merchant_shipping_group')
        .eq('seller_sku', sku)
        .single();

      if (!listingError && listingData) {
        console.log(`Found SKU pricing in database for ${sku}: £${listingData.price}`);
        return {
          price: parseFloat(listingData.price),
          shippingGroup: listingData.merchant_shipping_group
        };
      }

      // Fallback: try to get from sku_asin_mapping if it has pricing data
      const { data: mappingData, error: mappingError } = await supabase
        .from('sku_asin_mapping')
        .select('*')
        .eq('seller_sku', sku)
        .single();

      if (!mappingError && mappingData) {
        // Check if there's a price field in the mapping data
        const price = mappingData.price || mappingData.listing_price || mappingData.amazon_price;
        if (price) {
          console.log(`Found SKU pricing in mapping for ${sku}: £${price}`);
          return {
            price: parseFloat(price),
            shippingGroup: mappingData.merchant_shipping_group || 'UK Shipping'
          };
        }
      }

      console.warn(`No pricing data found for SKU: ${sku}`);
      return null;

    } catch (error) {
      console.error(`Error getting SKU pricing for ${sku}:`, error.message);
      return null;
    }
  }

  /**
   * Upsert pricing data in batch for efficiency during bulk scans
   * Uses existing amazon_listings table
   */
  async upsertPricingDataBatch(pricingUpdates) {
    if (!pricingUpdates || pricingUpdates.length === 0) {
      console.log('📊 No pricing updates to process');
      return [];
    }

    console.log(`📊 Upserting ${pricingUpdates.length} pricing records to amazon_listings table...`);

    try {
      // Transform pricing updates to match amazon_listings table structure
      const amazonListingsUpdates = pricingUpdates.map(update => ({
        seller_sku: update.sku,
        item_name: update.item_name || `Product ${update.asin}`,
        price: update.current_price,
        merchant_shipping_group: update.fulfillment_channel === 'FBA' ? 'FBA' : 'Standard',
        status: update.status || 'active',
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('amazon_listings')
        .upsert(amazonListingsUpdates, {
          onConflict: 'seller_sku',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        throw new Error(`Failed to upsert pricing data to amazon_listings: ${error.message}`);
      }

      console.log(`✅ Successfully updated pricing for ${data?.length || pricingUpdates.length} SKUs in amazon_listings`);
      return data;

    } catch (error) {
      console.error('❌ Batch pricing update error:', error.message);
      throw error;
    }
  }
}

module.exports = {
  supabase,
  SupabaseService: new SupabaseService()
};

// Add client property to SupabaseService for easy access
module.exports.SupabaseService.client = supabase;
