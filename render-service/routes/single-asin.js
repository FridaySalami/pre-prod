/**
 * Single ASIN Route
 * 
 * Handles individual ASIN scanning for Buy Box monitoring
 * Used for on-demand scanning of missing ASINs
 */

const express = require('express');
const { SupabaseService } = require('../services/supabase-client');
const { RateLimiter } = require('../utils/rate-limiter');
const { AmazonSPAPI } = require('../services/amazon-spapi');
const CostCalculator = require('../services/cost-calculator');

const router = express.Router();

// Global rate limiter for Amazon SP-API
const rateLimiter = new RateLimiter();

// Amazon SP-API client (only initialize if we have credentials)
let amazonAPI = null;
let costCalculator = null;
const USE_REAL_API = process.env.USE_AMAZON_SPAPI === 'true';

if (USE_REAL_API) {
  try {
    amazonAPI = new AmazonSPAPI(SupabaseService.client);
    console.log('✅ Single ASIN: Amazon SP-API client initialized');
  } catch (error) {
    console.warn('⚠️ Single ASIN: Amazon SP-API client initialization failed:', error.message);
    console.warn('⚠️ Single ASIN: Falling back to mock data');
  }
} else {
  console.log('ℹ️  Single ASIN: Using mock data (USE_AMAZON_SPAPI not set to true)');
}

// Initialize cost calculator for mock data enrichment
try {
  costCalculator = new CostCalculator(SupabaseService.client);
  console.log('✅ Single ASIN: Cost calculator initialized');
} catch (error) {
  console.warn('⚠️ Single ASIN: Cost calculator initialization failed:', error.message);
}

/**
 * POST /:asin - Scan a single ASIN
 */
router.post('/:asin', async (req, res) => {
  const asin = req.params.asin;

  if (!asin || !/^B[0-9A-Z]{9}$/.test(asin)) {
    return res.status(400).json({
      error: 'Invalid ASIN format',
      message: 'ASIN must be 10 characters starting with B',
      example: 'B0D45C1HQP'
    });
  }

  try {
    console.log(`🔍 Starting single ASIN scan for: ${asin}`);

    // Create a job record
    const jobData = {
      source: 'single-asin-fetch',
      status: 'in_progress',
      total_asins: 1,
      processed_asins: 0,
      failed_asins: 0,
      start_time: new Date().toISOString(),
      metadata: {
        asin: asin,
        request_ip: req.ip,
        user_agent: req.get('User-Agent')
      }
    };

    const { data: job, error: jobError } = await SupabaseService.client
      .from('buybox_jobs')
      .insert(jobData)
      .select()
      .single();

    if (jobError) {
      console.error('❌ Failed to create job:', jobError);
      return res.status(500).json({
        error: 'Failed to create scan job',
        details: jobError.message
      });
    }

    console.log(`✅ Created job ${job.id} for ASIN ${asin}`);

    // Process the single ASIN
    const result = await processSingleASIN(asin, job.id);

    // Update job status
    const endTime = new Date().toISOString();
    await SupabaseService.client
      .from('buybox_jobs')
      .update({
        status: result.success ? 'completed' : 'failed',
        processed_asins: result.success ? 1 : 0,
        failed_asins: result.success ? 0 : 1,
        end_time: endTime,
        metadata: {
          ...jobData.metadata,
          result: result
        }
      })
      .eq('id', job.id);

    if (result.success) {
      res.json({
        success: true,
        message: `Successfully processed ASIN ${asin}`,
        job_id: job.id,
        asin: asin,
        data: result.data,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        job_id: job.id,
        asin: asin,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ Single ASIN scan error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      asin: asin,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Process a single ASIN
 */
async function processSingleASIN(asin, jobId) {
  try {
    console.log(`📊 Processing ASIN: ${asin}`);

    let buyBoxData;

    if (USE_REAL_API && amazonAPI) {
      // Use real Amazon SP-API
      console.log(`🔍 Fetching real data for ${asin}`);
      await rateLimiter.waitForToken();
      buyBoxData = await amazonAPI.getBuyBoxPricing([asin]);
    } else {
      // Use mock data
      console.log(`🎭 Generating mock data for ${asin}`);
      buyBoxData = [{
        asin: asin,
        sku: `MOCK-${asin}`,
        condition: 'New',
        currency: 'GBP',
        landed_price: Math.floor(Math.random() * 50) + 10,
        listing_price: Math.floor(Math.random() * 45) + 8,
        shipping_price: Math.random() > 0.5 ? 0 : 2.99,
        is_buy_box_winner: Math.random() > 0.7,
        is_featured_merchant: Math.random() > 0.8,
        is_fulfilled_by_amazon: Math.random() > 0.6,
        shipping_time_min: 1,
        shipping_time_max: 3,
        seller_feedback_rating: Math.floor(Math.random() * 20) + 80,
        seller_feedback_count: Math.floor(Math.random() * 1000) + 100,
        prime_information: Math.random() > 0.5 ? 'eligible' : null,
        merchant_shipping_group: Math.random() > 0.5 ? 'Nationwide Prime' : 'UK Shipping'
      }];
    }

    if (!buyBoxData || buyBoxData.length === 0) {
      return {
        success: false,
        error: `No pricing data found for ASIN ${asin}`
      };
    }

    // Enrich with cost calculator if available
    if (costCalculator) {
      console.log(`💰 Enriching data with cost calculations for ${asin}`);
      buyBoxData = await costCalculator.enrichBuyBoxData(buyBoxData);
    }

    // Save to database
    console.log(`💾 Saving ${buyBoxData.length} records for ${asin}`);

    const dataToInsert = buyBoxData.map(item => ({
      ...item,
      job_id: jobId,
      run_id: `single-${Date.now()}`,
      created_at: new Date().toISOString()
    }));

    const { error: insertError } = await SupabaseService.client
      .from('buybox_data')
      .insert(dataToInsert);

    if (insertError) {
      console.error('❌ Database insert error:', insertError);
      return {
        success: false,
        error: `Database insert failed: ${insertError.message}`
      };
    }

    console.log(`✅ Successfully saved data for ASIN ${asin}`);

    return {
      success: true,
      data: {
        asin: asin,
        records_inserted: dataToInsert.length,
        sample_data: dataToInsert[0]
      }
    };

  } catch (error) {
    console.error(`❌ Error processing ASIN ${asin}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = router;
