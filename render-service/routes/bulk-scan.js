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
    console.log('✅ Amazon SP-API client initialized with Supabase client');
  } catch (error) {
    console.warn('⚠️ Amazon SP-API client initialization failed:', error.message);
    console.warn('⚠️ Falling back to mock data');
  }
} else {
  console.log('ℹ️  Using mock data (USE_AMAZON_SPAPI not set to true)');
}

// Initialize cost calculator for mock data enrichment
try {
  costCalculator = new CostCalculator(SupabaseService.client);
  console.log('✅ Cost calculator initialized');
} catch (error) {
  console.warn('⚠️ Cost calculator initialization failed:', error.message);
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

    // Create batch processor with normal timing now that we have smart retry
    const batchProcessor = new BatchProcessor(50, 30000); // 50 ASINs per batch, 30 second delay

    let successCount = 0;
    let failCount = 0;

    // Process batches
    const batches = batchProcessor.createBatches(asins);
    console.log(`Processing ${batches.length} batches for job ${jobId}`);

    // Print initial rate limiter status
    rateLimiter.printReport();

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
              buyBoxData = await amazonAPI.getBuyBoxData(asin.asin1, asin.seller_sku, jobId, rateLimiter);
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

            // Enrich mock data with cost calculator if available
            if (buyBoxData && costCalculator) {
              try {
                buyBoxData = await costCalculator.enrichBuyBoxData(buyBoxData);
              } catch (enrichError) {
                console.warn(`Failed to enrich mock data for ASIN ${asin.asin1}:`, enrichError.message);
              }
            }
          }

          if (buyBoxData) {
            // Store successful result
            try {
              await SupabaseService.insertBuyBoxData(buyBoxData);
              successCount++;
              console.log(`✅ Stored data for ASIN ${asin.asin1}, SKU: ${asin.seller_sku}`);
            } catch (insertError) {
              console.error(`❌ Failed to store data for ASIN ${asin.asin1}:`, insertError.message);

              // Record the database insertion failure
              try {
                await SupabaseService.recordFailure(
                  jobId,
                  asin.asin1,
                  asin.seller_sku,
                  `Database insertion failed: ${insertError.message}`,
                  'DB_INSERT_ERROR',
                  1,
                  { error: insertError.message, buyBoxData }
                );
              } catch (logError) {
                console.error('Failed to log database insertion failure:', logError);
              }
              failCount++;
            }
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
            // Print rate limiter stats every 10 items
            rateLimiter.printReport();
          }

          // If we hit too many consecutive rate limits, pause for extra time
          const stats = rateLimiter.getStats();
          if (stats.consecutiveRateLimits >= 3) {
            console.log(`⚠️  Pausing for 60 seconds due to consecutive rate limits...`);
            await new Promise(resolve => setTimeout(resolve, 60000));
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
        console.log(`⏸️  Batch ${batchIndex + 1} completed. Waiting 30s before next batch...`);
        rateLimiter.printReport(); // Show stats between batches
        await rateLimiter.sleep(30000); // 30 second gap between batches
      }
    }

    // Complete the job with final stats
    rateLimiter.printReport();
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

  // Get product title from sku_asin_mapping - NO LONGER SAVING TO buybox_data
  let productTitle = null;
  try {
    productTitle = await SupabaseService.getProductTitle(sku, asinCode);
    console.log(`Mock API - Product title for ${sku}/${asinCode}: ${productTitle || 'Not found'}`);
    // Note: We still fetch the title for logging/validation but don't save it to buybox_data
  } catch (titleError) {
    console.warn(`Failed to fetch product title for ${sku}/${asinCode}:`, titleError.message);
  }

  // Return data structure that matches buybox_data table schema with margin fields
  const mockPrice = parseFloat((Math.random() * 100 + 10).toFixed(2));
  const competitorPrice = parseFloat((mockPrice + (Math.random() - 0.5) * 20).toFixed(2));

  // Get your seller ID for comparison
  const yourSellerId = process.env.YOUR_SELLER_ID || process.env.AMAZON_SELLER_ID || 'A2D8NG39VURSL3';

  // 30% chance you're the winner for testing
  const isWinner = Math.random() < 0.3;
  const competitorId = isWinner ? yourSellerId : 'A' + Math.random().toString(36).substring(2, 15).toUpperCase();

  // Determine pricing scenario
  let yourCurrentPrice, buyBoxPrice;
  if (isWinner) {
    // If you're the winner, your price IS the buy box price
    yourCurrentPrice = mockPrice;
    buyBoxPrice = mockPrice;
  } else {
    // If you're not the winner, create a price gap
    buyBoxPrice = competitorPrice;
    // Your price could be higher (missed buy box) or lower (but not winning due to other factors)
    yourCurrentPrice = Math.random() < 0.7
      ? parseFloat((buyBoxPrice + Math.random() * 5 + 0.5).toFixed(2)) // 70% chance you're priced higher
      : parseFloat((buyBoxPrice - Math.random() * 2).toFixed(2)); // 30% chance you're priced lower but not winning
  }

  const priceGap = yourCurrentPrice - buyBoxPrice;
  const pricingStatus = isWinner ? 'winning_buybox' : (priceGap > 0 ? 'priced_above_buybox' : 'priced_below_buybox');

  console.log(`Mock ASIN ${asinCode}: Your ID: ${yourSellerId}, Winner: ${isWinner}, Your Price: £${yourCurrentPrice}, Buy Box: £${buyBoxPrice}, Gap: £${priceGap.toFixed(2)}`);

  // Mock cost data for margin calculations
  const baseCost = parseFloat((Math.random() * 30 + 5).toFixed(2));
  const shippingCost = parseFloat((Math.random() * 8 + 3).toFixed(2));
  const materialTotalCost = parseFloat((baseCost + Math.random() * 10 + 2).toFixed(2));

  // Calculate mock margins using the correct pricing
  const amazonFee = yourCurrentPrice * 0.15;
  const yourMargin = yourCurrentPrice - amazonFee - materialTotalCost - shippingCost;
  const yourMarginPercent = yourCurrentPrice > 0 ? (yourMargin / yourCurrentPrice) * 100 : 0;

  // Calculate buy box margin only if there's actual competition
  let buyboxAmazonFee, buyboxMargin, buyboxMarginPercent, marginDifference, profitOpportunity;

  if (buyBoxPrice && buyBoxPrice > 0) {
    // There's actual competition - calculate buy box margins
    buyboxAmazonFee = buyBoxPrice * 0.15;
    buyboxMargin = buyBoxPrice - buyboxAmazonFee - materialTotalCost - shippingCost;
    buyboxMarginPercent = (buyboxMargin / buyBoxPrice) * 100;
    marginDifference = buyboxMargin - yourMargin;
    profitOpportunity = Math.max(0, marginDifference);
  } else {
    // No competition - set null values
    buyboxAmazonFee = null;
    buyboxMargin = null;
    buyboxMarginPercent = null;
    marginDifference = null;
    profitOpportunity = null;
  }

  const breakEvenPrice = (materialTotalCost + shippingCost) / 0.85;

  // Determine recommended action
  let recommendedAction;
  if (!buyBoxPrice || buyBoxPrice <= 0) {
    // No competition - suggest investigation
    recommendedAction = 'investigate';
  } else if (buyboxMarginPercent < 5) {
    recommendedAction = 'not_profitable';
  } else if (buyboxMarginPercent < 10) {
    recommendedAction = 'investigate';
  } else if (profitOpportunity > 1) {
    recommendedAction = 'match_buybox';
  } else {
    recommendedAction = 'hold_price';
  }

  return {
    // Essential core fields
    run_id: runId,
    asin: asinCode,
    sku: sku || `SKU-${asinCode}`,
    // product_title: productTitle, // REMOVED - no longer saving to buybox_data to reduce response size

    // Essential pricing fields
    price: yourCurrentPrice, // Use YOUR current price for margin calculations
    is_winner: isWinner,
    competitor_id: competitorId,
    competitor_name: `MockSeller${Math.floor(Math.random() * 1000)}`,
    competitor_price: buyBoxPrice, // This is the buy box price
    opportunity_flag: !isWinner && (buyBoxPrice - yourCurrentPrice) > 5,
    total_offers: Math.floor(Math.random() * 10) + 1,
    captured_at: new Date().toISOString(),
    merchant_token: yourSellerId,
    buybox_merchant_token: competitorId,

    // Enhanced pricing clarity fields
    your_current_price: yourCurrentPrice,
    your_current_shipping: 0, // Mock free shipping
    your_current_total: yourCurrentPrice,
    buybox_price: buyBoxPrice,
    buybox_shipping: 0, // Mock free shipping
    buybox_total: buyBoxPrice,
    price_gap: parseFloat(priceGap.toFixed(2)),
    price_gap_percentage: yourCurrentPrice > 0 ? parseFloat(((priceGap / yourCurrentPrice) * 100).toFixed(2)) : 0,
    pricing_status: pricingStatus,
    your_offer_found: true, // Mock that your offer was found

    // New margin analysis fields (essential for frontend display)
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
    margin_at_buybox_price: buyboxMargin !== null ? parseFloat(buyboxMargin.toFixed(2)) : null,
    margin_percent_at_buybox_price: buyboxMarginPercent !== null ? parseFloat(buyboxMarginPercent.toFixed(2)) : null,
    margin_difference: marginDifference !== null ? parseFloat(marginDifference.toFixed(2)) : null,
    profit_opportunity: profitOpportunity !== null ? parseFloat(profitOpportunity.toFixed(2)) : null,

    // Recommendations
    recommended_action: recommendedAction,
    price_adjustment_needed: buyBoxPrice && buyBoxPrice > 0 ? parseFloat((buyBoxPrice - yourCurrentPrice).toFixed(2)) : null,
    break_even_price: parseFloat(breakEvenPrice.toFixed(2)),

    // Essential metadata
    margin_calculation_version: 'v1.0',
    cost_data_source: 'mock'

    // REMOVED to reduce payload size (not used by frontend):
    // currency: 'GBP',
    // marketplace: 'UK',
    // min_profitable_price: parseFloat((yourCurrentPrice * 0.8).toFixed(2)),
    // margin_at_buybox: parseFloat((yourCurrentPrice * 0.3).toFixed(2)),
    // margin_percent_at_buybox: parseFloat((0.3 + Math.random() * 0.2).toFixed(4)),
    // category: 'Electronics',
    // brand: 'MockBrand',
    // fulfillment_channel: Math.random() > 0.5 ? 'AMAZON' : 'DEFAULT',
    // merchant_shipping_group: 'UK Shipping',
    // source: 'mock-api'
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
