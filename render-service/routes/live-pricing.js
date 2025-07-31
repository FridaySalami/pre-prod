/**
 * Live Pricing API Route
 * 
 * Handles live pricing update requests from the Buy Box Manager UI
 * Leverages existing proven amazon-spapi.js and cost-calculator.js services
 */

const express = require('express');
const LivePricingService = require('../services/live-pricing');
const DatabaseUpdater = require('../services/database-updater');

const router = express.Router();

// Initialize services
let livePricingService = null;
let databaseUpdater = null;

try {
  livePricingService = new LivePricingService();
  databaseUpdater = new DatabaseUpdater();
  console.log('✅ Live Pricing API: Services initialized successfully');
} catch (error) {
  console.error('❌ Live Pricing API: Service initialization failed:', error.message);
}

/**
 * POST /api/live-pricing/update
 * Update live pricing for a single SKU
 */
router.post('/update', async (req, res) => {
  try {
    const { sku, recordId, userId } = req.body;

    // Validate request
    if (!sku || !recordId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'SKU and recordId are required'
      });
    }

    // Check if services are available
    if (!livePricingService) {
      return res.status(503).json({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        message: 'Live pricing service is not available'
      });
    }

    console.log(`🚀 Live pricing update request: SKU=${sku}, RecordId=${recordId}, User=${userId}`);

    // Perform the live update
    const result = await livePricingService.updateSingleItem(sku, recordId, userId);

    // Return success response
    res.json({
      success: true,
      data: result.updatedData,
      previousData: result.previousData,
      timestamp: result.timestamp,
      source: result.source,
      message: `Successfully updated live pricing for SKU ${sku}`
    });

  } catch (error) {
    console.error('Live pricing update error:', error.message);

    // Handle specific error types with appropriate HTTP status codes
    if (error.message.startsWith('RATE_LIMITED')) {
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMITED',
        message: error.message,
        retryAfter: 30 // seconds
      });
    }

    if (error.message.startsWith('RECENTLY_UPDATED')) {
      return res.status(429).json({
        success: false,
        error: 'RECENTLY_UPDATED',
        message: error.message
      });
    }

    if (error.message.startsWith('ACCESS_DENIED')) {
      return res.status(403).json({
        success: false,
        error: 'ACCESS_DENIED',
        message: error.message
      });
    }

    if (error.message.startsWith('ASIN_NOT_FOUND')) {
      return res.status(404).json({
        success: false,
        error: 'ASIN_NOT_FOUND',
        message: error.message
      });
    }

    if (error.message.includes('Invalid record')) {
      return res.status(404).json({
        success: false,
        error: 'RECORD_NOT_FOUND',
        message: error.message
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      error: 'UPDATE_FAILED',
      message: error.message || 'Failed to update live pricing'
    });
  }
});

/**
 * GET /api/live-pricing/status/:recordId
 * Check if a record can be updated (rate limiting, permissions, etc.)
 */
router.get('/status/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const { userId } = req.query;

    if (!recordId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Record ID is required'
      });
    }

    if (!databaseUpdater) {
      return res.status(503).json({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database service is not available'
      });
    }

    // Check recent update status
    const updateStatus = await databaseUpdater.checkRecentUpdate(recordId);

    // Get current record for additional info
    const currentRecord = await databaseUpdater.getCurrentRecord(recordId);

    res.json({
      success: true,
      canUpdate: updateStatus.canUpdate,
      lastUpdated: updateStatus.lastUpdateTime,
      minutesSinceUpdate: updateStatus.minutesSinceUpdate,
      record: {
        id: currentRecord.id,
        sku: currentRecord.sku,
        asin: currentRecord.asin,
        captured_at: currentRecord.captured_at
      }
    });

  } catch (error) {
    console.error('Status check error:', error.message);

    res.status(500).json({
      success: false,
      error: 'STATUS_CHECK_FAILED',
      message: error.message
    });
  }
});

/**
 * GET /api/live-pricing/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      livePricing: livePricingService ? 'available' : 'unavailable',
      database: databaseUpdater ? 'available' : 'unavailable'
    }
  };

  const allServicesAvailable = livePricingService && databaseUpdater;

  res.status(allServicesAvailable ? 200 : 503).json(health);
});

module.exports = router;
