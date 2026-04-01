const express = require('express');
const router = express.Router();

// Simple in-memory job status for testing
let jobStatus = {
  isRunning: false,
  intervalMinutes: 30,
  batchSize: 10,
  maxRetries: 3,
  retryDelayMs: 5000,
  lastRun: null,
  nextRun: null
};

let jobLogs = [
  {
    id: '1',
    status: 'system_initialized',
    metadata: { message: 'Job monitoring system initialized' },
    timestamp: new Date().toISOString()
  }
];

let jobStatistics = {
  totalRuns: 0,
  totalErrors: 0,
  totalProcessed: 0,
  totalAlerts: 0,
  averageDuration: 0,
  lastRun: null,
  recentLogs: []
};

/**
 * GET /api/monitoring-job/status
 * Get current monitoring job status
 */
router.get('/status', async (req, res) => {
  try {
    res.json({
      success: true,
      status: jobStatus,
      statistics: jobStatistics
    });
  } catch (error) {
    console.error('Error getting job status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/monitoring-job/start
 * Start the monitoring job
 */
router.post('/start', async (req, res) => {
  try {
    const { intervalMinutes = 30 } = req.body;

    if (intervalMinutes < 5 || intervalMinutes > 1440) {
      return res.status(400).json({
        success: false,
        error: 'Interval must be between 5 and 1440 minutes'
      });
    }

    jobStatus.isRunning = true;
    jobStatus.intervalMinutes = intervalMinutes;
    jobStatus.lastRun = new Date().toISOString();
    jobStatus.nextRun = new Date(Date.now() + (intervalMinutes * 60 * 1000)).toISOString();

    // Add log entry
    jobLogs.push({
      id: Date.now().toString(),
      status: 'started',
      metadata: { intervalMinutes },
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Monitoring job started with ${intervalMinutes} minute interval`,
      status: jobStatus
    });
  } catch (error) {
    console.error('Error starting job:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/monitoring-job/stop
 * Stop the monitoring job
 */
router.post('/stop', async (req, res) => {
  try {
    jobStatus.isRunning = false;
    jobStatus.nextRun = null;

    // Add log entry
    jobLogs.push({
      id: Date.now().toString(),
      status: 'stopped',
      metadata: {},
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Monitoring job stopped',
      status: jobStatus
    });
  } catch (error) {
    console.error('Error stopping job:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/monitoring-job/manual-check
 * Run manual check for specific ASIN
 */
router.post('/manual-check', async (req, res) => {
  try {
    const { asin, userEmail } = req.body;

    if (!asin || !userEmail) {
      return res.status(400).json({
        success: false,
        error: 'ASIN and userEmail are required'
      });
    }

    // Simulate manual check
    const result = {
      success: true,
      asin,
      alertsGenerated: Math.floor(Math.random() * 3), // Random 0-2 alerts
      timestamp: new Date().toISOString(),
      message: `Manual check completed for ${asin}`
    };

    // Add log entry
    jobLogs.push({
      id: Date.now().toString(),
      status: 'manual_check',
      metadata: { asin, userEmail, result },
      timestamp: new Date().toISOString()
    });

    res.json(result);
  } catch (error) {
    console.error('Error running manual check:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring-job/logs
 * Get recent job logs
 */
router.get('/logs', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const logs = jobLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('Error fetching job logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring-job/statistics
 * Get detailed job statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    // Calculate stats from logs
    const recentLogs = jobLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
      return logDate >= cutoffDate;
    });

    const stats = {
      totalRuns: recentLogs.filter(log => log.status === 'cycle_completed').length,
      totalErrors: recentLogs.filter(log => log.status === 'cycle_error').length,
      totalProcessed: recentLogs.reduce((sum, log) => {
        return sum + (log.metadata?.processed || 0);
      }, 0),
      totalAlerts: recentLogs.reduce((sum, log) => {
        return sum + (log.metadata?.alertsGenerated || 0);
      }, 0),
      averageDuration: 2500, // Mock average duration
      lastRun: recentLogs.find(log => log.status === 'cycle_completed')?.timestamp,
      recentLogs: recentLogs.slice(0, 10)
    };

    res.json({
      success: true,
      statistics: stats,
      period: `${days} days`
    });
  } catch (error) {
    console.error('Error fetching job statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring-job/active-configs
 * Get all active monitoring configurations
 */
router.get('/active-configs', async (req, res) => {
  try {
    // Mock active configurations
    const configs = [
      {
        id: '1',
        asin: 'B0D45C1HQP',
        priority: 1,
        last_checked: new Date(Date.now() - 1800000).toISOString(), // 30 mins ago
        check_count: 24,
        price_monitoring_stats: [{ total_alerts: 3 }]
      },
      {
        id: '2',
        asin: 'B0D3LZHNGZ',
        priority: 2,
        last_checked: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        check_count: 18,
        price_monitoring_stats: [{ total_alerts: 1 }]
      },
      {
        id: '3',
        asin: 'B0DHVZRSR2',
        priority: 1,
        last_checked: new Date(Date.now() - 900000).toISOString(), // 15 mins ago
        check_count: 31,
        price_monitoring_stats: [{ total_alerts: 5 }]
      }
    ];

    res.json({
      success: true,
      configs,
      count: configs.length
    });
  } catch (error) {
    console.error('Error fetching active configs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/monitoring-job/update-config
 * Update monitoring job configuration
 */
router.post('/update-config', async (req, res) => {
  try {
    const { batchSize, maxRetries, retryDelayMs } = req.body;

    if (batchSize && (batchSize < 1 || batchSize > 50)) {
      return res.status(400).json({
        success: false,
        error: 'Batch size must be between 1 and 50'
      });
    }

    if (maxRetries && (maxRetries < 1 || maxRetries > 10)) {
      return res.status(400).json({
        success: false,
        error: 'Max retries must be between 1 and 10'
      });
    }

    if (retryDelayMs && (retryDelayMs < 1000 || retryDelayMs > 60000)) {
      return res.status(400).json({
        success: false,
        error: 'Retry delay must be between 1000 and 60000 milliseconds'
      });
    }

    // Update job config
    if (batchSize) jobStatus.batchSize = batchSize;
    if (maxRetries) jobStatus.maxRetries = maxRetries;
    if (retryDelayMs) jobStatus.retryDelayMs = retryDelayMs;

    res.json({
      success: true,
      message: 'Job configuration updated',
      config: {
        batchSize: jobStatus.batchSize,
        maxRetries: jobStatus.maxRetries,
        retryDelayMs: jobStatus.retryDelayMs
      }
    });
  } catch (error) {
    console.error('Error updating job config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/monitoring-job/run-cycle
 * Manually trigger a monitoring cycle
 */
router.post('/run-cycle', async (req, res) => {
  try {
    if (jobStatus.isRunning) {
      return res.status(400).json({
        success: false,
        error: 'Cannot run manual cycle while scheduled job is running'
      });
    }

    // Simulate running a cycle
    setTimeout(() => {
      jobLogs.push({
        id: Date.now().toString(),
        status: 'cycle_completed',
        metadata: {
          duration: 2500,
          processed: 15,
          alertsGenerated: 3
        },
        timestamp: new Date().toISOString()
      });
    }, 1000);

    res.json({
      success: true,
      message: 'Manual monitoring cycle started',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error starting manual cycle:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;