/**
 * Bulk Scan Route
 * 
 * Handles bulk ASIN scanning for Buy Box monitoring
 * Processes thousands of ASINs with proper rate limiting
 * 
 * Enhanced Features:
 * - Real-time pricing data updates to amazon_listings table during bulk scans
 * - Batch processing for both buybox and pricing data
 * - Integrated competitive analysis and pricing sync
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
  console.error('❌ PRODUCTION ERROR: USE_AMAZON_SPAPI not set to true');
  console.error('❌ This is a production system and MUST use real Amazon SP-API data');
  console.error('❌ Mock data would provide false information to users');
  console.error('❌ Please set USE_AMAZON_SPAPI=true in environment variables');
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
// Input validation middleware for /start
function validateBulkScanRequest(req, res, next) {
  const { filterType, maxAsins, customAsins } = req.body;
  const validFilterTypes = ['active', 'all', 'custom'];
  if (filterType && !validFilterTypes.includes(filterType)) {
    return res.status(400).json({ error: 'Invalid filterType', timestamp: new Date().toISOString() });
  }
  if (maxAsins !== null && maxAsins !== undefined) {
    if (!Number.isInteger(maxAsins) || maxAsins < 1 || maxAsins > 10000) {
      return res.status(400).json({ error: 'maxAsins must be between 1 and 10000', timestamp: new Date().toISOString() });
    }
  }
  if (filterType === 'custom') {
    if (!Array.isArray(customAsins) || customAsins.length === 0) {
      return res.status(400).json({ error: 'customAsins array required for custom filter', timestamp: new Date().toISOString() });
    }
    const asinRegex = /^B[0-9A-Z]{9}$/;
    const invalidAsins = customAsins.filter(asin => !asinRegex.test(asin));
    if (invalidAsins.length > 0) {
      return res.status(400).json({ error: 'Invalid ASIN format', invalidAsins: invalidAsins.slice(0, 5), timestamp: new Date().toISOString() });
    }
  }
  next();
}

router.post('/start', validateBulkScanRequest, async (req, res) => {
  try {
    const {
      source = 'api-request',
      filterType = 'active',
      maxAsins = null,
      notes = null,
      customAsins = null
    } = req.body;

    console.log('Starting bulk scan with parameters:', { source, filterType, maxAsins, notes, customAsins: customAsins?.length });

    // Get ASINs to process
    let asins;
    try {
      if (filterType === 'active') {
        asins = await SupabaseService.getActiveAsins();
      } else if (filterType === 'all') {
        asins = await SupabaseService.getAllAsins();
      } else if (filterType === 'custom') {
        // For custom ASINs, we need to get the corresponding SKUs from the database
        const asinSkuMap = await SupabaseService.getAsinSkuMappings(customAsins);
        asins = customAsins
          .flatMap(asin => {
            const mappings = asinSkuMap.filter(m => m.asin1 === asin);
            return mappings.map(mapping => ({ asin1: asin, seller_sku: mapping.seller_sku }));
          })
          .filter(Boolean);
        console.log(`Custom ASIN scan: ${customAsins.length} requested, ${asins.length} found in inventory`);
      } else {
        return res.status(400).json({ error: 'Invalid filterType. Must be "active", "all", or "custom"', timestamp: new Date().toISOString() });
      }
    } catch (dbError) {
      console.error('Database error getting ASINs:', dbError);
      return res.status(500).json({ error: 'Failed to retrieve ASINs from database', message: dbError.message, timestamp: new Date().toISOString() });
    }

    if (!asins || asins.length === 0) {
      return res.status(400).json({ error: 'No ASINs found to process', filterType: filterType, timestamp: new Date().toISOString() });
    }

    if (maxAsins && maxAsins > 0) {
      asins = asins.slice(0, maxAsins);
    }

    console.log(`Found ${asins.length} ASINs to process`);

    let job;
    try {
      job = await SupabaseService.createJob(
        asins.length,
        source
      );
    } catch (dbError) {
      console.error('Database error creating job:', dbError);
      return res.status(500).json({ error: 'Failed to create job record', message: dbError.message, timestamp: new Date().toISOString() });
    }

    console.log(`Created job ${job.id} for ${asins.length} ASINs`);

    processBulkScan(job.id, asins).catch(error => {
      console.error(`Background processing error for job ${job.id}:`, error);
      SupabaseService.failJob(job.id, `Processing error: ${error.message}`).catch(console.error);
    });

    res.json({
      message: 'Bulk scan started successfully',
      jobId: job.id,
      totalAsins: asins.length,
      estimatedDuration: Math.ceil((asins.length * 2.1) / 60),
      source: source,
      filterType: filterType,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Bulk scan start error:', error);
    res.status(500).json({ error: 'Failed to start bulk scan', message: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * Background processing function for bulk ASIN scanning
 */
async function processBulkScan(jobId, asins) {
  console.log(`Starting background processing for job ${jobId} with ${asins.length} ASINs`);
  try {
    await SupabaseService.updateJobProgress(jobId, 0, 0, 'running');
    const batchProcessor = new BatchProcessor(50, 30000); // 50 ASINs per batch, 30 second delay
    let successCount = 0;
    let failCount = 0;
    let pricingUpdateCount = 0;
    let jobCancelled = false;
    const batches = batchProcessor.createBatches(asins);
    console.log(`Processing ${batches.length} batches for job ${jobId}`);
    rateLimiter.printReport();
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      // Check if job has been cancelled before processing each batch
      try {
        const currentJob = await SupabaseService.getJob(jobId);
        if (currentJob && currentJob.status === 'failed') {
          console.log(`🛑 Job ${jobId} has been cancelled. Stopping bulk scan at batch ${batchIndex + 1}/${batches.length}`);
          jobCancelled = true;
          break;
        }
      } catch (statusError) {
        console.warn(`⚠️ Could not check job status for cancellation: ${statusError.message}`);
        // Continue processing if we can't check status
      }

      const batch = batches[batchIndex];
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} ASINs`);
      // Collect buyBoxData summaries, competitor offers, and pricing data for batch insert
      const batchBuyBoxData = [];
      const batchOffers = [];
      const batchPricingUpdates = [];
      for (const asin of batch) {
        // Check for cancellation every 10 ASINs within a batch (to avoid too many DB calls)
        const asinIndex = batch.indexOf(asin);
        if (asinIndex % 10 === 0 && asinIndex > 0) {
          try {
            const currentJob = await SupabaseService.getJob(jobId);
            if (currentJob && currentJob.status === 'failed') {
              console.log(`🛑 Job ${jobId} cancelled during ASIN processing. Stopping at ASIN ${asinIndex + 1}/${batch.length} in batch ${batchIndex + 1}`);
              jobCancelled = true;
              break;
            }
          } catch (statusError) {
            console.warn(`⚠️ Could not check job status during ASIN processing: ${statusError.message}`);
          }
        }

        let retryCount = 0;
        const maxRetries = 3;
        let buyBoxData = null;
        let lastError = null;
        while (retryCount < maxRetries) {
          try {
            await rateLimiter.waitForNextRequest();
            if (USE_REAL_API && amazonAPI) {
              try {
                const result = await amazonAPI.getBuyBoxData(asin.asin1, asin.seller_sku, jobId, rateLimiter);
                // result contains { summary, offers }
                console.log(`🔍 ASIN ${asin.asin1}: API result structure:`, {
                  hasSummary: !!result?.summary,
                  hasOffers: !!result?.offers,
                  offersCount: Array.isArray(result?.offers) ? result.offers.length : 0,
                  offersType: typeof result?.offers
                });
                if (result?.summary) batchBuyBoxData.push(result.summary);
                if (Array.isArray(result?.offers) && result.offers.length > 0) {
                  console.log(`📊 Found ${result.offers.length} competitor offers for ASIN ${asin.asin1}`);
                  batchOffers.push(...result.offers);
                } else {
                  console.log(`📭 No competitor offers found for ASIN ${asin.asin1}`);
                }
                buyBoxData = result?.summary;

                // Extract pricing data from the same API response for amazon_listings table updates
                if (result?.summary) {
                  const pricingData = {
                    sku: asin.seller_sku,
                    asin: asin.asin1,
                    current_price: result.summary.your_current_price || null,
                    item_name: result.summary.item_name || `Product ${asin.asin1}`,
                    status: 'active',
                    fulfillment_channel: result.summary.fulfillment_type || 'MFN',
                    last_updated: new Date().toISOString(),
                    source: 'bulk_scan_competitive_pricing'
                  };
                  batchPricingUpdates.push(pricingData);
                  console.log(`💰 Collected pricing data for SKU ${asin.seller_sku}: £${pricingData.current_price}`);
                }
              } catch (apiError) {
                lastError = apiError;
                if (retryCount < maxRetries - 1) {
                  const backoff = Math.min(1000 * Math.pow(2, retryCount), 10000);
                  console.warn(`Retrying ASIN ${asin.asin1} after API error: ${apiError.message} (retry ${retryCount + 1})`);
                  await new Promise(resolve => setTimeout(resolve, backoff));
                  retryCount++;
                  continue;
                } else {
                  console.error(`Amazon SP-API error for ASIN ${asin.asin1}:`, apiError.message);
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
                  buyBoxData = null;
                  break;
                }
              }
            } else {
              // No real API available - this is a production error
              console.error(`❌ Amazon SP-API not available for ASIN ${asin.asin1} - this is a production system and requires real data`);
              await SupabaseService.recordFailure(
                jobId,
                asin.asin1,
                asin.seller_sku,
                'Amazon SP-API not available - production system requires real data',
                'NO_API_AVAILABLE',
                1,
                { asin: asin.asin1, sku: asin.seller_sku, error: 'Production system must use real Amazon SP-API data' }
              );
              failCount++;
              buyBoxData = null;
            }
            break; // Success, exit retry loop
          } catch (err) {
            lastError = err;
            if (retryCount < maxRetries - 1) {
              const backoff = Math.min(1000 * Math.pow(2, retryCount), 10000);
              console.warn(`Retrying ASIN ${asin.asin1} after error: ${err.message} (retry ${retryCount + 1})`);
              await new Promise(resolve => setTimeout(resolve, backoff));
              retryCount++;
            } else {
              break;
            }
          }
        }
        if (buyBoxData) {
          successCount++;
          console.log(`✅ Stored data for ASIN ${asin.asin1}, SKU: ${asin.seller_sku}`);
        } else {
          if (lastError) {
            try {
              await SupabaseService.recordFailure(
                jobId,
                asin.asin1,
                asin.seller_sku,
                `Processing error: ${lastError.message}`,
                'PROCESSING_ERROR',
                1,
                { error: lastError.message, stack: lastError.stack }
              );
            } catch (logError) {
              console.error('Failed to log failure:', logError);
            }
          } else {
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
          }
          failCount++;
        }
        if ((successCount + failCount) % 10 === 0) {
          await SupabaseService.updateJobProgress(jobId, successCount, failCount, 'running');
          rateLimiter.printReport();
        }
        const stats = rateLimiter.getStats();
        if (stats.consecutiveRateLimits >= 3) {
          console.log(`⚠️  Pausing for 60 seconds due to consecutive rate limits...`);
          await new Promise(resolve => setTimeout(resolve, 60000));
        }
      }

      // Check if job was cancelled during ASIN processing
      if (jobCancelled) {
        console.log(`🛑 Breaking out of batch processing due to job cancellation`);
        break;
      }

      // Batch insert for summaries
      if (batchBuyBoxData.length > 0) {
        try {
          if (typeof SupabaseService.insertBuyBoxDataBatch === 'function') {
            await SupabaseService.insertBuyBoxDataBatch(batchBuyBoxData);
          } else {
            for (const data of batchBuyBoxData) {
              await SupabaseService.insertBuyBoxData(data);
            }
          }
        } catch (insertError) {
          console.error('❌ Batch insert error (summaries):', insertError.message);
        }
      }
      // Batch insert competitor offers (only when real API provided offers)
      console.log(`🔍 Batch ${batchIndex + 1}: batchOffers.length = ${batchOffers.length}, type = ${typeof batchOffers}, isArray = ${Array.isArray(batchOffers)}`);
      if (batchOffers.length > 0) {
        console.log(`🎯 Sample batchOffers[0]:`, batchOffers[0]);
      }
      if (batchOffers.length > 0 && typeof SupabaseService.insertBuyBoxOffers === 'function') {
        try {
          console.log(`🚀 Attempting to insert ${batchOffers.length} competitor offers...`);
          await SupabaseService.insertBuyBoxOffers(batchOffers);
          console.log(`📥 Inserted ${batchOffers.length} competitor offers for batch ${batchIndex + 1}`);
        } catch (offersError) {
          console.error('❌ Batch insert error (offers):', offersError.message);
        }
      } else if (batchOffers.length === 0) {
        console.log(`📭 No offers to insert for batch ${batchIndex + 1}`);
      } else if (typeof SupabaseService.insertBuyBoxOffers !== 'function') {
        console.error('❌ insertBuyBoxOffers function not available!');
      }

      // Batch update amazon_listings table with pricing data (when real API provided pricing)
      if (batchPricingUpdates.length > 0 && USE_REAL_API) {
        try {
          console.log(`💰 Attempting to update amazon_listings table for ${batchPricingUpdates.length} SKUs...`);
          await SupabaseService.upsertPricingDataBatch(batchPricingUpdates);
          pricingUpdateCount += batchPricingUpdates.length;
          console.log(`💰 Updated amazon_listings table for ${batchPricingUpdates.length} SKUs in batch ${batchIndex + 1}`);
        } catch (pricingError) {
          console.error('❌ Batch amazon_listings update error:', pricingError.message);
        }
      } else if (batchPricingUpdates.length === 0) {
        console.log(`💰 No amazon_listings updates to process for batch ${batchIndex + 1}`);
      }

      if (batchIndex < batches.length - 1) {
        console.log(`⏸️  Batch ${batchIndex + 1} completed. Waiting 30s before next batch...`);
        rateLimiter.printReport();
        await rateLimiter.sleep(30000);
      }
    }
    rateLimiter.printReport();

    // Handle job completion based on whether it was cancelled
    if (jobCancelled) {
      console.log(`Job ${jobId} was cancelled after processing ${successCount} successful, ${failCount} failed, ${pricingUpdateCount} pricing updates`);
      // Job is already marked as failed by the cancel endpoint, no need to complete it
    } else {
      await SupabaseService.completeJob(jobId, successCount, failCount);
      console.log(`Job ${jobId} completed: ${successCount} successful, ${failCount} failed, ${pricingUpdateCount} pricing updates`);
    }
  } catch (error) {
    console.error(`Processing error for job ${jobId}:`, error);
    await SupabaseService.failJob(jobId, error.message);
  }
}

/**
 * GET /status/:jobId - Get bulk scan job status
 */
router.get('/status/:jobId', async (req, res) => {
  try {
    const jobId = req.params.jobId;

    if (!jobId) {
      return res.status(400).json({
        error: 'Job ID is required',
        timestamp: new Date().toISOString()
      });
    }

    // Get job status from database
    const { data: job, error } = await SupabaseService.client
      .from('buybox_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      console.error('Error fetching job status:', error);
      return res.status(500).json({
        error: 'Failed to fetch job status',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        job_id: jobId,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      job_id: job.id,
      status: job.status,
      total_asins: job.total_asins,
      successful_asins: job.successful_asins,
      failed_asins: job.failed_asins,
      started_at: job.started_at,
      completed_at: job.completed_at,
      source: job.source,
      notes: job.notes,
      error_message: job.error_message,
      progress_percentage: job.total_asins ? Math.round(((job.successful_asins + job.failed_asins) / job.total_asins) * 100) : 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Bulk scan status error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

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
