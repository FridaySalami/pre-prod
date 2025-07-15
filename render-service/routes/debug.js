/**
 * Debug Route
 * 
 * Provides debugging endpoints for the Render service
 */

const express = require('express');
const { SupabaseService } = require('../services/supabase-client');

const router = express.Router();

/**
 * GET / - Basic debug info
 */
router.get('/', async (req, res) => {
  try {
    const debugInfo = {
      service: 'Buy Box Render Service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      config: {
        useRealAPI: process.env.USE_AMAZON_SPAPI === 'true',
        hasSupabaseUrl: !!process.env.PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.PRIVATE_SUPABASE_SERVICE_KEY,
        hasAmazonCredentials: !!(
          process.env.AMAZON_CLIENT_ID &&
          process.env.AMAZON_CLIENT_SECRET &&
          process.env.AMAZON_REFRESH_TOKEN &&
          process.env.AMAZON_AWS_ACCESS_KEY_ID &&
          process.env.AMAZON_AWS_SECRET_ACCESS_KEY
        )
      }
    };

    res.json({
      success: true,
      debug: debugInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Debug endpoint failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /test-db - Test database connection
 */
router.get('/test-db', async (req, res) => {
  try {
    const asinCount = await SupabaseService.getActiveAsinCount();
    
    res.json({
      success: true,
      database: {
        status: 'connected',
        activeAsins: asinCount,
        testQuery: 'SELECT COUNT(*) FROM sku_asin_mapping WHERE status = \'Active\''
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      success: false,
      error: 'Database test failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
