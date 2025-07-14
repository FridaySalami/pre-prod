const express = require('express');
const { SupabaseService } = require('../services/supabase-client');
const CostCalculator = require('../services/cost-calculator');

const router = express.Router();

/**
 * POST /test-cost-calc - Test the cost calculator directly
 */
router.post('/test-cost-calc', async (req, res) => {
  try {
    const { sku } = req.body;
    
    if (!sku) {
      return res.status(400).json({ 
        error: 'SKU is required',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[DEBUG] Testing cost calculation for SKU: ${sku}`);

    // Initialize cost calculator
    const costCalculator = new CostCalculator(SupabaseService.client);
    
    // Test the cost calculation
    const costs = await costCalculator.calculateProductCosts(sku);
    
    if (!costs) {
      return res.json({
        sku,
        status: 'no_cost_data',
        message: 'Cost calculation returned null',
        timestamp: new Date().toISOString()
      });
    }

    // Test margin calculation
    const testPrice = 20.00;
    const testCompetitorPrice = 18.50;
    const margins = costCalculator.calculateMargins(costs, testPrice, testCompetitorPrice);

    res.json({
      sku,
      status: 'success',
      costs,
      margins,
      testPrices: {
        yourPrice: testPrice,
        competitorPrice: testCompetitorPrice
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[DEBUG] Cost calculation test error:', error);
    res.status(500).json({
      error: 'Cost calculation failed',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /test-data-access - Test database access
 */
router.get('/test-data-access', async (req, res) => {
  try {
    console.log('[DEBUG] Testing database access...');

    // Test inventory access
    const { data: inventoryData, error: inventoryError } = await SupabaseService.client
      .from('inventory')
      .select('sku, depth, height, width, weight')
      .eq('sku', '0X-U12R-J16J')
      .single();

    // Test linnworks access
    const { data: linnworksData, error: linnworksError } = await SupabaseService.client
      .from('linnworks_composition_summary')
      .select('parent_sku, total_value, child_vats')
      .eq('parent_sku', '0X-U12R-J16J')
      .single();

    res.json({
      status: 'success',
      inventory: {
        data: inventoryData,
        error: inventoryError
      },
      linnworks: {
        data: linnworksData,
        error: linnworksError
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[DEBUG] Database access test error:', error);
    res.status(500).json({
      error: 'Database access failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
