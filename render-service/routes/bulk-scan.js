/**
 * Bulk Scan Route
 * 
 * Handles bulk ASIN scanning for Buy Box monitoring
 * Processes thousands of ASINs with proper rate limiting
 */

const express = require('express');
const { SupabaseService } = require('../services/supabase-client');
const { RateLimiter, BatchProcessor } = require('../utils/rate-limiter');
const { AmazonSPAPI } = require('../services/amazon-spapi');

const router = express.Router();

// Global rate limiter for Amazon SP-API
const rateLimiter = new RateLimiter();

// Amazon SP-API client (only initialize if we have credentials)
let amazonAPI = null;
const USE_REAL_API = process.env.USE_AMAZON_SPAPI === 'true';

if (USE_REAL_API) {
  try {
    amazonAPI = new AmazonSPAPI(SupabaseService.client);
    console.log('✅ Amazon SP-API client initialized with Supabase client');
  } catch (error) {
    console.warn('⚠️ Amazon SP-API client initialization failed:', error.message);
    console.warn('⚠️ Falling back to mock data');
  }
}

/**
 * POST /start - Start a bulk ASIN scan
 */
router.post('/start', async (req, res) => {
  try {
    const {
      source = 'api-request',
      filterType = 'active',
      maxAsins = null,
      notes = null
    } = req.body;

    console.log('Starting bulk scan with parameters:', { source, filterType, maxAsins, notes });

    // Get ASINs to process
    let asins;
    try {
      if (filterType === 'active') {
        asins = await SupabaseService.getActiveAsins();
      } else if (filterType === 'all') {
        asins = await SupabaseService.getAllAsins();
      } else {
        return res.status(400).json({
          error: 'Invalid filterType. Must be "active" or "all"',
          timestamp: new Date().toISOString()
        });
      }
    } catch (dbError) {
      console.error('Database error getting ASINs:', dbError);
      return res.status(500).json({
        error: 'Failed to retrieve ASINs from database',
        message: dbError.message,
        timestamp: new Date().toISOString()
      });
    }

    if (!asins || asins.length === 0) {
      return res.status(400).json({
        error: 'No ASINs found to process',
        filterType: filterType,
        timestamp: new Date().toISOString()
      });
    }

    // Apply maxAsins limit if specified
    if (maxAsins && maxAsins > 0) {
      asins = asins.slice(0, maxAsins);
    }

    console.log(`Found ${asins.length} ASINs to process`);

    // Create job record
    let job;
    try {
      job = await SupabaseService.createJob(
        asins.length,
        source
      );
    } catch (dbError) {
      console.error('Database error creating job:', dbError);
      return res.status(500).json({
        error: 'Failed to create job record',
        message: dbError.message,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`Created job ${job.id} for ${asins.length} ASINs`);

    // Start processing asynchronously (don't await)
    processBulkScan(job.id, asins).catch(error => {
      console.error(`Background processing error for job ${job.id}:`, error);
      SupabaseService.failJob(job.id, `Processing error: ${error.message}`).catch(console.error);
    });

    // Return immediate response
    res.json({
      message: 'Bulk scan started successfully',
      jobId: job.id,
      totalAsins: asins.length,
      estimatedDuration: Math.ceil((asins.length * 2.1) / 60), // minutes
      source: source,
      filterType: filterType,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Bulk scan start error:', error);
    res.status(500).json({
      error: 'Failed to start bulk scan',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Background processing function for bulk ASIN scanning
 */
async function processBulkScan(jobId, asins) {
  console.log(`Starting background processing for job ${jobId} with ${asins.length} ASINs`);

  try {
    // Update job status to running
    await SupabaseService.updateJobProgress(jobId, 0, 0, 'running');

    // Create batch processor
    const batchProcessor = new BatchProcessor(50, 30000); // 50 ASINs per batch, 30 second delay

    let successCount = 0;
    let failCount = 0;

    // Process batches
    const batches = batchProcessor.createBatches(asins);
    console.log(`Processing ${batches.length} batches for job ${jobId}`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} ASINs`);

      // Process each ASIN in the batch
      for (const asin of batch) {
        try {
          // Rate limit before API call
          await rateLimiter.waitForNextRequest();

          let buyBoxData = null;

          if (USE_REAL_API && amazonAPI) {
            // Use real Amazon SP-API
            try {
              buyBoxData = await amazonAPI.getBuyBoxData(asin.asin1, asin.seller_sku, jobId);
            } catch (apiError) {
              console.error(`Amazon SP-API error for ASIN ${asin.asin1}:`, apiError.message);

              // Record the API failure
              await SupabaseService.recordFailure(
                jobId,
                asin.asin1,
                asin.seller_sku,
                `Amazon SP-API error: ${apiError.message}`,
                apiError.message.includes('RATE_LIMITED') ? 'RATE_LIMITED' : 'SP_API_ERROR',
                1,
                { error: apiError.message, asin: asin.asin1, sku: asin.seller_sku }
              );

              failCount++;
              continue; // Skip to next ASIN
            }
          } else {
            // Use mock API for testing
            buyBoxData = await mockAmazonApiCall(asin.asin1, asin.seller_sku, jobId);
          }

          if (buyBoxData) {
            // Store successful result
            await SupabaseService.insertBuyBoxData(buyBoxData);
            successCount++;
          } else {
            // Record the mock failure
            try {
              await SupabaseService.recordFailure(
                jobId,
                asin.asin1,
                asin.seller_sku,
                'Mock API call failed - simulated failure',
                'MOCK_FAILURE',
                1,
                { message: 'Simulated failure for testing' }
              );
            } catch (logError) {
              console.error('Failed to log mock failure:', logError);
            }
            failCount++;
          }

          // Update progress every 10 ASINs
          if ((successCount + failCount) % 10 === 0) {
            await SupabaseService.updateJobProgress(jobId, successCount, failCount, 'running');
          }

        } catch (asinError) {
          console.error(`Error processing ASIN ${asin.asin1} (SKU: ${asin.seller_sku}):`, asinError);

          // Record the failure with detailed information
          try {
            await SupabaseService.recordFailure(
              jobId,
              asin.asin1,
              asin.seller_sku,
              `Processing error: ${asinError.message}`,
              'PROCESSING_ERROR',
              1,
              { error: asinError.message, stack: asinError.stack }
            );
          } catch (logError) {
            console.error('Failed to log failure:', logError);
          }

          failCount++;
        }
      }

      // Wait between batches (except for last batch)
      if (batchIndex < batches.length - 1) {
        console.log(`Waiting ${30} seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
      }
    }

    // Complete the job
    await SupabaseService.completeJob(jobId, successCount, failCount);
    console.log(`Job ${jobId} completed: ${successCount} successful, ${failCount} failed`);

  } catch (error) {
    console.error(`Processing error for job ${jobId}:`, error);
    await SupabaseService.failJob(jobId, error.message);
  }
}

/**
 * Mock Amazon API call with margin analysis
 */
async function mockAmazonApiCall(asinCode, sku, runId) {
  // Simulate API processing time
  await new Promise(resolve => setTimeout(resolve, 100));

  // Mock success/failure (10% failure rate for testing)
  if (Math.random() < 0.1) {
    return null; // Simulate failure
  }

  // Return data structure that matches buybox_data table schema with margin fields
  const mockPrice = parseFloat((Math.random() * 100 + 10).toFixed(2));
  const competitorPrice = parseFloat((mockPrice + (Math.random() - 0.5) * 20).toFixed(2));

  // Get your seller ID for comparison
  const yourSellerId = process.env.YOUR_SELLER_ID || process.env.AMAZON_SELLER_ID || 'A2D8NG39VURSL3';

  // 30% chance you're the winner for testing
  const isWinner = Math.random() < 0.3;
  const competitorId = isWinner ? yourSellerId : 'A' + Math.random().toString(36).substring(2, 15).toUpperCase();

  // Mock cost data for margin calculations
  const baseCost = parseFloat((Math.random() * 30 + 5).toFixed(2));
  const shippingCost = parseFloat((Math.random() * 8 + 3).toFixed(2));
  const materialTotalCost = parseFloat((baseCost + Math.random() * 10 + 2).toFixed(2));

  // Calculate mock margins
  const amazonFee = mockPrice * 0.15;
  const yourMargin = mockPrice - amazonFee - materialTotalCost - shippingCost;
  const yourMarginPercent = mockPrice > 0 ? (yourMargin / mockPrice) * 100 : 0;

  const buyboxAmazonFee = competitorPrice * 0.15;
  const buyboxMargin = competitorPrice - buyboxAmazonFee - materialTotalCost - shippingCost;
  const buyboxMarginPercent = competitorPrice > 0 ? (buyboxMargin / competitorPrice) * 100 : 0;

  const marginDifference = buyboxMargin - yourMargin;
  const profitOpportunity = Math.max(0, marginDifference);
  const breakEvenPrice = (materialTotalCost + shippingCost) / 0.85;

  // Determine recommended action
  let recommendedAction;
  if (buyboxMarginPercent < 5) {
    recommendedAction = 'not_profitable';
  } else if (buyboxMarginPercent < 10) {
    recommendedAction = 'investigate';
  } else if (profitOpportunity > 1) {
    recommendedAction = 'match_buybox';
  } else {
    recommendedAction = 'hold_price';
  }

  console.log(`Mock ASIN ${asinCode}: Your ID: ${yourSellerId}, Winner: ${isWinner}, Action: ${recommendedAction}`);

  return {
    // Required fields that match the database schema
    run_id: runId,
    asin: asinCode,
    sku: sku || `SKU-${asinCode}`,
    price: mockPrice,
    currency: 'GBP',
    is_winner: isWinner,
    competitor_id: competitorId,
    competitor_name: `MockSeller${Math.floor(Math.random() * 1000)}`,
    competitor_price: competitorPrice,
    marketplace: 'UK',
    opportunity_flag: !isWinner && (competitorPrice - mockPrice) > 5,
    min_profitable_price: parseFloat((mockPrice * 0.8).toFixed(2)),
    margin_at_buybox: parseFloat((mockPrice * 0.3).toFixed(2)),
    margin_percent_at_buybox: parseFloat((0.3 + Math.random() * 0.2).toFixed(4)),
    total_offers: Math.floor(Math.random() * 10) + 1,
    category: 'Electronics',
    brand: 'MockBrand',
    captured_at: new Date().toISOString(),
    fulfillment_channel: Math.random() > 0.5 ? 'AMAZON' : 'DEFAULT',
    merchant_shipping_group: 'UK Shipping',
    source: 'mock-api',
    merchant_token: yourSellerId,
    buybox_merchant_token: competitorId,

    // New margin analysis fields
    your_cost: parseFloat(baseCost.toFixed(2)),
    your_shipping_cost: parseFloat(shippingCost.toFixed(2)),
    your_material_total_cost: parseFloat(materialTotalCost.toFixed(2)),
    your_box_cost: parseFloat((Math.random() * 2).toFixed(2)),
    your_vat_amount: parseFloat((baseCost * 0.2).toFixed(2)),
    your_fragile_charge: Math.random() < 0.3 ? 0.66 : 0.00,

    // Current pricing margins
    your_margin_at_current_price: parseFloat(yourMargin.toFixed(2)),
    your_margin_percent_at_current_price: parseFloat(yourMarginPercent.toFixed(2)),

    // Competitor analysis
    margin_at_buybox_price: parseFloat(buyboxMargin.toFixed(2)),
    margin_percent_at_buybox_price: parseFloat(buyboxMarginPercent.toFixed(2)),
    margin_difference: parseFloat(marginDifference.toFixed(2)),
    profit_opportunity: parseFloat(profitOpportunity.toFixed(2)),

    // Recommendations
    recommended_action: recommendedAction,
    price_adjustment_needed: parseFloat((competitorPrice - mockPrice).toFixed(2)),
    break_even_price: parseFloat(breakEvenPrice.toFixed(2)),

    // Metadata
    margin_calculation_version: 'v1.0',
    cost_data_source: 'mock'
  };
}

/**
 * GET /test - Test endpoint for development
 */
router.get('/test', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    // Get small sample of ASINs for testing
    const asins = await SupabaseService.getActiveAsins();
    const testAsins = asins.slice(0, limit);

    res.json({
      message: 'Bulk scan test endpoint',
      availableAsins: asins.length,
      testAsins: testAsins,
      rateLimiter: {
        delayMs: rateLimiter.delayMs,
        lastRequestTime: rateLimiter.lastRequestTime
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Bulk scan test error:', error);
    res.status(500).json({
      error: 'Test endpoint failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
