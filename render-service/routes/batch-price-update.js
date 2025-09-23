/**
 * Batch Price Update Route for Render Service
 * 
 * Handles batch price submissions to Amazon Feeds API
 * Respects the 5 submissions per 5 minutes rate limit by using single feed with multiple items
 */

const express = require('express');
const { AmazonSPAPI } = require('../services/amazon-spapi');
const { SupabaseService } = require('../services/supabase-client');

const router = express.Router();

// Initialize Amazon SP-API
let amazonAPI = null;
const USE_REAL_API = process.env.USE_AMAZON_SPAPI === 'true';

if (USE_REAL_API) {
  try {
    amazonAPI = new AmazonSPAPI();
    console.log('✅ Batch Price Update: Amazon SP-API initialized');
  } catch (error) {
    console.error('❌ Batch Price Update: Amazon SP-API initialization failed:', error.message);
  }
}

/**
 * POST /api/batch-price-update
 * Submit multiple price updates in a single feed to Amazon
 */
router.post('/', async (req, res) => {
  try {
    const { items, userEmail, source = 'batch_update' } = req.body;

    console.log(`🛒 Processing batch price update for ${items.length} items`);
    console.log(`📧 User: ${userEmail}`);
    console.log(`📊 Source: ${source}`);

    // Validate request
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No items provided for batch update',
        code: 'NO_ITEMS'
      });
    }

    if (items.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Batch size too large. Maximum 1000 items per batch.',
        code: 'BATCH_TOO_LARGE'
      });
    }

    // Validate each item
    for (const item of items) {
      if (!item.sku || !item.newPrice) {
        return res.status(400).json({
          success: false,
          error: 'Invalid item data. Each item must have sku and newPrice.',
          code: 'INVALID_ITEM_DATA'
        });
      }
    }

    if (!USE_REAL_API || !amazonAPI) {
      // Demo mode - simulate success
      console.log('🎭 Demo mode: Simulating batch price update success');

      return res.json({
        success: true,
        feedId: `demo_batch_${Date.now()}`,
        processedItems: items.length,
        failedItems: 0,
        mode: 'demo',
        message: `Demo: Successfully "submitted" ${items.length} price updates`,
        estimatedProcessingTime: '5-15 minutes',
        items: items.map(item => ({
          sku: item.sku,
          status: 'demo_success',
          newPrice: item.newPrice
        }))
      });
    }

    // Real API mode - submit to Amazon
    console.log('🚀 Real API mode: Submitting batch to Amazon...');

    const result = await submitBatchToAmazon(items, userEmail, source);

    console.log('✅ Batch submission completed:', {
      feedId: result.feedId,
      processedItems: result.processedItems,
      failedItems: result.failedItems
    });

    res.json(result);

  } catch (error) {
    console.error('❌ Batch price update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process batch price update',
      code: 'INTERNAL_ERROR',
      details: error.message
    });
  }
});

/**
 * Submit batch price updates to Amazon using enhanced JSON feed format
 */
async function submitBatchToAmazon(items, userEmail, source) {
  try {
    console.log('📝 Creating batch feed document...');

    // Step 1: Get access token
    const accessToken = await amazonAPI.getAccessToken();

    // Step 2: Create feed document
    const feedDocument = await amazonAPI.createFeedDocument(accessToken);
    console.log('✅ Feed document created:', feedDocument.feedDocumentId);

    // Step 3: Upload batch pricing data
    console.log('📤 Uploading batch pricing data...');
    await uploadBatchPricingData(feedDocument.url, items);
    console.log('✅ Batch pricing data uploaded successfully');

    // Step 4: Submit feed
    console.log('🚀 Submitting batch feed...');
    const feed = await amazonAPI.submitFeed(accessToken, feedDocument.feedDocumentId);
    console.log('✅ Batch feed submitted:', feed.feedId);

    // Step 5: Log to database
    try {
      await logBatchSubmission(items, userEmail, source, feed);
    } catch (logError) {
      console.warn('⚠️ Failed to log batch submission:', logError.message);
    }

    return {
      success: true,
      feedId: feed.feedId,
      processedItems: items.length,
      failedItems: 0,
      estimatedProcessingTime: '5-15 minutes',
      feedStatus: 'SUBMITTED',
      feedType: 'JSON_LISTINGS_FEED_BATCH',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Amazon batch submission failed:', error);
    throw new Error(`Batch submission failed: ${error.message}`);
  }
}

/**
 * Upload batch pricing data in JSON format
 */
async function uploadBatchPricingData(uploadUrl, items) {
  const jsonData = {
    "header": {
      "sellerId": process.env.AMAZON_SELLER_ID || "A2D8NG39VURSL3",
      "version": "2.0"
    },
    "messages": items.map((item, index) => ({
      "messageId": index + 1,
      "sku": item.sku,
      "operationType": "PARTIAL_UPDATE",
      "productType": "GROCERY", // Default - should be detected per product in production
      "attributes": {
        "purchasable_offer": [
          {
            "marketplace_id": process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
            "currency": "GBP",
            "our_price": [
              {
                "schedule": [
                  {
                    "value_with_tax": item.newPrice.toFixed(2)
                  }
                ]
              }
            ]
          }
        ]
      }
    }))
  };

  console.log(`📊 Batch feed contains ${items.length} price updates`);
  console.log('🔍 Sample batch item:', {
    sku: items[0]?.sku,
    newPrice: items[0]?.newPrice,
    messageId: 1
  });

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(jsonData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload batch pricing data: ${response.status} ${response.statusText} - ${errorText}`);
  }

  console.log('✅ Batch pricing data uploaded to S3');
}

/**
 * Log batch submission to database
 */
async function logBatchSubmission(items, userEmail, source, feedResult) {
  try {
    // Log the batch submission
    await SupabaseService.client
      .from('batch_price_updates')
      .insert({
        user_email: userEmail,
        item_count: items.length,
        feed_id: feedResult.feedId,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        source: source,
        total_price_change: items.reduce((sum, item) =>
          sum + (item.newPrice - (item.currentPrice || 0)), 0
        ),
        items: items
      });

    // Log individual price updates for audit trail
    const priceUpdateRecords = items.map(item => ({
      sku: item.sku,
      asin: item.asin,
      old_price: item.currentPrice,
      new_price: item.newPrice,
      feed_id: feedResult.feedId,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      source: `batch_${source}`,
      reason: item.reason || 'Batch price update'
    }));

    await SupabaseService.client
      .from('price_updates')
      .insert(priceUpdateRecords);

    console.log('💾 Batch submission logged to database');

  } catch (error) {
    console.error('❌ Database logging failed:', error);
    throw error;
  }
}

/**
 * GET /api/batch-price-update/status/:feedId
 * Check the status of a batch feed submission
 */
router.get('/status/:feedId', async (req, res) => {
  try {
    const { feedId } = req.params;

    if (!USE_REAL_API || !amazonAPI) {
      return res.json({
        feedId: feedId,
        status: 'demo_completed',
        message: 'Demo mode - feed processing simulated'
      });
    }

    // In production, implement feed status checking
    // const feedStatus = await amazonAPI.getFeedStatus(feedId);

    res.json({
      feedId: feedId,
      status: 'submitted',
      message: 'Feed status checking not yet implemented'
    });

  } catch (error) {
    console.error('❌ Feed status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check feed status',
      details: error.message
    });
  }
});

module.exports = router;