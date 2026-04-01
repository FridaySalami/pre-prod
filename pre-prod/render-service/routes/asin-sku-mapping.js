/**
 * ASIN-SKU Mapping API Routes
 * 
 * Provides API endpoints for managing ASIN to SKU mappings
 * and fixing monitoring configuration issues
 */

const express = require('express');
const { AsinSkuMappingService } = require('../services/asin-sku-mapping');

const router = express.Router();
const mappingService = new AsinSkuMappingService();

/**
 * GET /api/asin-sku/validate
 * Validate all monitoring configurations and return mismatches
 */
router.get('/validate', async (req, res) => {
  try {
    const mismatches = await mappingService.findMismatchedConfigs();

    res.json({
      success: true,
      isValid: mismatches.length === 0,
      totalConfigs: mismatches.length,
      mismatches: mismatches,
      summary: {
        needsUpdate: mismatches.filter(m => !m.notFound).length,
        notFound: mismatches.filter(m => m.notFound).length
      }
    });
  } catch (error) {
    console.error('Error validating configs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/asin-sku/fix-all
 * Fix all mismatched SKUs in monitoring configurations
 */
router.post('/fix-all', async (req, res) => {
  try {
    console.log('🔧 API request to fix all ASIN-SKU mismatches');

    const results = await mappingService.fixAllMismatchedConfigs();

    res.json({
      success: true,
      message: 'SKU correction completed',
      results: results
    });
  } catch (error) {
    console.error('Error fixing configs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/asin-sku/add-asin
 * Add a new ASIN to monitoring with automatic SKU lookup
 */
router.post('/add-asin', async (req, res) => {
  try {
    const { asin, userEmail, options = {} } = req.body;

    if (!asin || !userEmail) {
      return res.status(400).json({
        success: false,
        error: 'ASIN and userEmail are required'
      });
    }

    const result = await mappingService.addAsinToMonitoring(asin, userEmail, options);

    res.json({
      success: true,
      message: `Successfully added ASIN ${asin} to monitoring`,
      data: result
    });
  } catch (error) {
    console.error('Error adding ASIN to monitoring:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/asin-sku/lookup/:asin
 * Look up the correct SKU for a specific ASIN
 */
router.get('/lookup/:asin', async (req, res) => {
  try {
    const { asin } = req.params;

    const skuData = await mappingService.getSkuForAsin(asin);

    if (!skuData) {
      return res.status(404).json({
        success: false,
        error: `ASIN ${asin} not found in amazon_listings table`
      });
    }

    res.json({
      success: true,
      data: skuData
    });
  } catch (error) {
    console.error('Error looking up ASIN:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/asin-sku/update-config
 * Update a specific monitoring config with correct SKU
 */
router.post('/update-config', async (req, res) => {
  try {
    const { configId, correctSku } = req.body;

    if (!configId || !correctSku) {
      return res.status(400).json({
        success: false,
        error: 'configId and correctSku are required'
      });
    }

    const success = await mappingService.updateConfigSku(configId, correctSku);

    if (success) {
      res.json({
        success: true,
        message: `Updated config ${configId} with SKU ${correctSku}`
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to update configuration'
      });
    }
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/asin-sku/batch-lookup
 * Look up SKUs for multiple ASINs
 */
router.post('/batch-lookup', async (req, res) => {
  try {
    const { asins } = req.body;

    if (!asins || !Array.isArray(asins)) {
      return res.status(400).json({
        success: false,
        error: 'asins array is required'
      });
    }

    const asinSkuMap = await mappingService.getSkusForAsins(asins);

    // Convert Map to object for JSON response
    const results = {};
    for (const [asin, skuData] of asinSkuMap.entries()) {
      results[asin] = skuData;
    }

    res.json({
      success: true,
      data: results,
      summary: {
        requested: asins.length,
        found: asinSkuMap.size,
        notFound: asins.length - asinSkuMap.size
      }
    });
  } catch (error) {
    console.error('Error batch lookup:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;