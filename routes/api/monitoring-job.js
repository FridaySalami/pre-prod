const express = require('express');
const { buyBoxMonitoringJob } = require('../../services/buy-box-monitoring-job');
const { supabase } = require('../../render-service/services/supabase-client');

const router = express.Router();

/**
 * GET /api/monitoring-job/status
 * Get current monitoring job status
 */
router.get('/status', async (req, res) => {
  try {
    const status = buyBoxMonitoringJob.getStatus();
    const stats = await buyBoxMonitoringJob.getJobStatistics(7); // Last 7 days

    res.json({
      success: true,
      status,
      statistics: stats
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

    await buyBoxMonitoringJob.start(intervalMinutes);

    res.json({
      success: true,
      message: `Monitoring job started with ${intervalMinutes} minute interval`,
      status: buyBoxMonitoringJob.getStatus()
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
    await buyBoxMonitoringJob.stop();

    res.json({
      success: true,
      message: 'Monitoring job stopped',
      status: buyBoxMonitoringJob.getStatus()
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

    const result = await buyBoxMonitoringJob.runManualCheck(asin, userEmail);

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

    const { data, error } = await supabase
      .from('price_monitoring_job_log')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    res.json({
      success: true,
      logs: data || []
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

    const stats = await buyBoxMonitoringJob.getJobStatistics(parseInt(days));

    if (!stats) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve statistics'
      });
    }

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
    const { data, error } = await supabase
      .from('price_monitoring_config')
      .select(`
        *,
        price_monitoring_stats (
          total_checks,
          total_alerts,
          last_alert_date
        )
      `)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      configs: data || [],
      count: data?.length || 0
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

    if (batchSize) {
      if (batchSize < 1 || batchSize > 50) {
        return res.status(400).json({
          success: false,
          error: 'Batch size must be between 1 and 50'
        });
      }
      buyBoxMonitoringJob.jobConfig.batchSize = batchSize;
    }

    if (maxRetries) {
      if (maxRetries < 1 || maxRetries > 10) {
        return res.status(400).json({
          success: false,
          error: 'Max retries must be between 1 and 10'
        });
      }
      buyBoxMonitoringJob.jobConfig.maxRetries = maxRetries;
    }

    if (retryDelayMs) {
      if (retryDelayMs < 1000 || retryDelayMs > 60000) {
        return res.status(400).json({
          success: false,
          error: 'Retry delay must be between 1000 and 60000 milliseconds'
        });
      }
      buyBoxMonitoringJob.jobConfig.retryDelayMs = retryDelayMs;
    }

    res.json({
      success: true,
      message: 'Job configuration updated',
      config: buyBoxMonitoringJob.jobConfig
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
    if (buyBoxMonitoringJob.isRunning) {
      return res.status(400).json({
        success: false,
        error: 'Cannot run manual cycle while scheduled job is running'
      });
    }

    // Run cycle asynchronously
    buyBoxMonitoringJob.runMonitoringCycle().catch(error => {
      console.error('Error in manual monitoring cycle:', error);
    });

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