/**
 * Bulk Scan Route
 * 
 * Handles bulk ASIN scanning for Buy Box monitoring
 * Processes thousands of ASINs with proper rate limiting
 */

const express = require('express');
const { SupabaseService } = require('../services/supabase-client');
const { RateLimiter, BatchProcessor } = require('../utils/rate-limiter');

const router = express.Router();

// Global rate limiter for Amazon SP-API
const rateLimiter = new RateLimiter();

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

          // TODO: Implement actual Amazon SP-API call here
          const buyBoxData = await mockAmazonApiCall(asin);

          if (buyBoxData) {
            // Store successful result
            await SupabaseService.insertBuyBoxData(buyBoxData);
            successCount++;
          } else {
            failCount++;
          }

          // Update progress every 10 ASINs
          if ((successCount + failCount) % 10 === 0) {
            await SupabaseService.updateJobProgress(jobId, successCount, failCount, 'running');
          }

        } catch (asinError) {
          console.error(`Error processing ASIN ${asin}:`, asinError);
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
 * Mock Amazon API call - TO BE REPLACED with actual SP-API integration
 */
async function mockAmazonApiCall(asin) {
  // Simulate API processing time
  await new Promise(resolve => setTimeout(resolve, 100));

  // Mock success/failure (90% success rate)
  if (Math.random() < 0.9) {
    return {
      asin: asin,
      buyBoxPrice: (Math.random() * 100 + 10).toFixed(2),
      buyBoxSeller: 'MockSeller' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      source: 'mock-api'
    };
  }

  return null; // Simulate failure
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
