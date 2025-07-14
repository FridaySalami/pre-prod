/**
 * Health Check Route
 * 
 * Provides system health status and basic diagnostics
 */

const express = require('express');
const { SupabaseService } = require('../services/supabase-client');

const router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();

    // Test database connection
    let dbStatus = 'disconnected';
    let asinCount = 0;

    try {
      asinCount = await SupabaseService.getActiveAsinCount();
      dbStatus = 'connected';
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    const responseTime = Date.now() - startTime;

    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Buy Box Render Service',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: {
        status: dbStatus,
        activeAsins: asinCount,
        responseTime: `${responseTime}ms`
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        port: process.env.PORT || 3001
      },
      features: [
        'Bulk ASIN scanning',
        'Rate limiting',
        'Progress tracking',
        'Job management'
      ]
    };

    // Set appropriate status code
    const statusCode = dbStatus === 'connected' ? 200 : 503;

    res.status(statusCode).json(healthData);

  } catch (error) {
    console.error('Health check error:', error);

    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      service: 'Buy Box Render Service'
    });
  }
});

// Detailed diagnostics endpoint
router.get('/detailed', async (req, res) => {
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      service: 'Buy Box Render Service',

      // System information
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        uptime: process.uptime(),
        pid: process.pid
      },

      // Memory usage
      memory: {
        ...process.memoryUsage(),
        freeMemory: require('os').freemem(),
        totalMemory: require('os').totalmem()
      },

      // Environment check
      environment: {
        hasSupabaseUrl: !!process.env.PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.PRIVATE_SUPABASE_SERVICE_KEY,
        hasAmazonConfig: !!(process.env.AMAZON_CLIENT_ID && process.env.AMAZON_CLIENT_SECRET),
        hasAwsConfig: !!(process.env.AMAZON_AWS_ACCESS_KEY_ID && process.env.AMAZON_AWS_SECRET_ACCESS_KEY),
        port: process.env.PORT || 3001,
        nodeEnv: process.env.NODE_ENV || 'development'
      },

      // Database status
      database: {
        connected: false,
        activeAsins: 0,
        tables: []
      }
    };

    // Test database connection and get detailed info
    try {
      const asinCount = await SupabaseService.getActiveAsinCount();
      diagnostics.database.connected = true;
      diagnostics.database.activeAsins = asinCount;
      diagnostics.database.tables = ['buybox_jobs', 'buybox_data', 'buybox_failures', 'sku_asin_mapping'];
    } catch (error) {
      diagnostics.database.error = error.message;
    }

    res.json(diagnostics);

  } catch (error) {
    console.error('Detailed diagnostics error:', error);

    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;
