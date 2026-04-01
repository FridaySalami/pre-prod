const express = require('express');
const { supabase, SupabaseService } = require('../services/supabase-client');
const { AmazonSQSService } = require('../services/amazon-sqs-notifications');
const { SPAPINotificationsService } = require('../services/spapi-notifications');

// Rate limiter for different Amazon SP-API endpoints
class APIRateLimiter {
  constructor() {
    this.rateLimits = {
      getItemOffers: {
        requestsPerSecond: 0.5,
        burstCapacity: 1,
        lastRequest: 0,
        queuedRequests: 0
      },
      getCompetitiveSummary: {
        requestsPerSecond: 0.033, // ~1 request per 30 seconds
        burstCapacity: 1,
        lastRequest: 0,
        queuedRequests: 0
      }
    };
  }

  async waitForRateLimit(endpoint) {
    const config = this.rateLimits[endpoint];
    if (!config) {
      throw new Error(`Unknown endpoint: ${endpoint}`);
    }

    const now = Date.now();
    const timeSinceLastRequest = now - config.lastRequest;
    const requiredInterval = 1000 / config.requestsPerSecond; // ms between requests

    if (timeSinceLastRequest < requiredInterval) {
      const waitTime = requiredInterval - timeSinceLastRequest;
      console.log(`⏳ Rate limiting ${endpoint}: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    config.lastRequest = Date.now();
    return true;
  }

  getStats() {
    return this.rateLimits;
  }
}

const rateLimiter = new APIRateLimiter();

const router = express.Router();

// Live job management using actual database with dual-endpoint support
let jobStatus = {
  isRunning: false,
  intervalMinutes: 30,
  batchSize: 10,
  maxRetries: 3,
  retryDelayMs: 5000,
  lastRun: null,
  nextRun: null,
  // Dual endpoint configuration
  useEnhancedAPI: false,  // Use getCompetitiveSummary for enhanced data
  enhancedIntervalMinutes: 120, // Run enhanced API every 2 hours (slower)
  lastEnhancedRun: null
};

let jobInterval = null;

/**
 * GET /api/monitoring-job/status
 * Get current monitoring job status with real data
 */
router.get('/status', async (req, res) => {
  try {
    // Get real statistics from database
    const stats = await getJobStatistics(7);

    res.json({
      success: true,
      status: jobStatus,
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
 * Start the monitoring job with real monitoring cycle
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

    if (jobStatus.isRunning) {
      return res.status(400).json({
        success: false,
        error: 'Job is already running'
      });
    }

    // Start the monitoring job
    jobStatus.isRunning = true;
    jobStatus.intervalMinutes = intervalMinutes;
    jobStatus.lastRun = new Date().toISOString();
    jobStatus.nextRun = new Date(Date.now() + (intervalMinutes * 60 * 1000)).toISOString();

    // Log job start
    await logJobStatus('started', { intervalMinutes });

    // Start the monitoring cycle
    jobInterval = setInterval(async () => {
      await runMonitoringCycle();
    }, intervalMinutes * 60 * 1000);

    // Run initial cycle
    runMonitoringCycle();

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
    if (!jobStatus.isRunning) {
      return res.status(400).json({
        success: false,
        error: 'Job is not running'
      });
    }

    // Stop the job
    jobStatus.isRunning = false;
    jobStatus.nextRun = null;

    if (jobInterval) {
      clearInterval(jobInterval);
      jobInterval = null;
    }

    // Log job stop
    await logJobStatus('stopped', {});

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
 * Run manual check for specific ASIN using real API
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

    console.log(`Running manual check for ASIN ${asin} for user ${userEmail}`);

    // Check if monitoring config exists for this ASIN
    const { data: config, error: configError } = await supabase
      .from('price_monitoring_config')
      .select('*')
      .eq('asin', asin)
      .eq('user_email', userEmail)
      .single();

    if (configError || !config) {
      return res.status(404).json({
        success: false,
        error: `No monitoring configuration found for ASIN ${asin}`
      });
    }

    // Use the existing competitive pricing API
    const { AmazonSPAPI } = require('../services/amazon-spapi');
    const amazonAPI = new AmazonSPAPI(supabase); let pricingData;
    let alertsGenerated = 0;

    let retryCount = 0;
    const maxRetries = 3;
    let success = false;

    while (retryCount < maxRetries && !success) {
      try {
        // Get current pricing data for single ASIN
        pricingData = await amazonAPI.getCompetitivePricing(asin);

        if (pricingData) {
          // Store pricing data in history
          await storePricingHistory(config.id, asin, pricingData);

          // Check for alerts (simplified - just check buy box status)
          const currentData = pricingData;
          if (currentData && currentData.buyBoxWinner !== config.user_email) {
            // Generate buy box loss alert
            await generateAlert({
              type: 'buy_box_ownership_change',
              severity: 'high',
              asin: asin,
              sku: config.sku || asin,
              user_email: userEmail,
              message: `Buy box lost for ${asin}`,
              alert_data: currentData
            });
            alertsGenerated = 1;
          }
        }

        // Update last checked timestamp
        await supabase
          .from('price_monitoring_config')
          .update({
            last_checked: new Date().toISOString()
          })
          .eq('id', config.id);

        // Increment check_count separately using RPC call
        await supabase.rpc('increment_check_count', { config_id: config.id });

        success = true;
      } catch (apiError) {
        if (apiError.message === 'RATE_LIMITED' && retryCount < maxRetries - 1) {
          retryCount++;
          console.log(`⚠️ Rate limited for ${asin}, retry ${retryCount}/${maxRetries} in 6 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 6000)); // Sleep for 6 seconds
        } else {
          console.warn(`API error for ${asin}:`, apiError.message);
          pricingData = null;
          break; // Exit retry loop for non-rate-limit errors or max retries reached
        }
      }
    }

    const result = {
      success: true,
      asin,
      alertsGenerated,
      pricingData: pricingData || null,
      timestamp: new Date().toISOString(),
      message: `Manual check completed for ${asin}${pricingData ? '' : ' (API error - check logs)'}`
    };

    // Log manual check
    await logJobStatus('manual_check', { asin, userEmail, result });

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
 * Get recent job logs from database
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
 * Get detailed job statistics from database
 */
router.get('/statistics', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const stats = await getJobStatistics(parseInt(days));

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
 * Get all active monitoring configurations from database
 */
router.get('/active-configs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('price_monitoring_config')
      .select('*')
      .eq('monitoring_enabled', true)
      .order('priority', { ascending: true }); // 1 = highest priority

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
    const { batchSize, maxRetries, retryDelayMs, useEnhancedAPI, enhancedIntervalMinutes } = req.body;

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
    if (typeof useEnhancedAPI === 'boolean') jobStatus.useEnhancedAPI = useEnhancedAPI;
    if (enhancedIntervalMinutes && enhancedIntervalMinutes >= 60) {
      jobStatus.enhancedIntervalMinutes = enhancedIntervalMinutes;
    }

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
 * GET /api/monitoring-job/rate-limits
 * Get current rate limiter statistics
 */
router.get('/rate-limits', (req, res) => {
  try {
    const stats = rateLimiter.getStats();

    // Calculate time until next allowed request for each endpoint
    const now = Date.now();
    const enrichedStats = {};

    for (const [endpoint, config] of Object.entries(stats)) {
      const timeSinceLastRequest = now - config.lastRequest;
      const requiredInterval = 1000 / config.requestsPerSecond;
      const timeUntilNext = Math.max(0, requiredInterval - timeSinceLastRequest);

      enrichedStats[endpoint] = {
        ...config,
        timeUntilNextRequest: timeUntilNext,
        canRequestNow: timeUntilNext === 0,
        estimatedRequestsPerHour: config.requestsPerSecond * 3600
      };
    }

    res.json({
      success: true,
      rateLimits: enrichedStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/monitoring-job/test-enhanced-api
 * Test the getCompetitiveSummary endpoint with rate limiting
 */
router.post('/test-enhanced-api', async (req, res) => {
  try {
    const { asins } = req.body;

    if (!asins || !Array.isArray(asins) || asins.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'asins array is required'
      });
    }

    if (asins.length > 5) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 5 ASINs for testing (due to slow rate limit)'
      });
    }

    const { AmazonSPAPI } = require('../services/amazon-spapi');
    const amazonAPI = new AmazonSPAPI(supabase);

    console.log(`Testing Enhanced API for ${asins.length} ASINs`);
    const startTime = Date.now();

    try {
      // Apply rate limiting for getCompetitiveSummary
      await rateLimiter.waitForRateLimit('getCompetitiveSummary');

      const summaryData = await amazonAPI.getCompetitiveSummary(asins);
      const duration = Date.now() - startTime;

      res.json({
        success: true,
        asins,
        data: summaryData,
        duration,
        timestamp: new Date().toISOString(),
        message: `Enhanced API test completed in ${duration}ms`
      });

    } catch (apiError) {
      res.json({
        success: false,
        asins,
        error: apiError.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
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

    // Run cycle asynchronously
    runMonitoringCycle().catch(error => {
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

// Helper Functions

async function runMonitoringCycle() {
  const startTime = Date.now();
  console.log(`Starting monitoring cycle at ${new Date().toISOString()}`);

  try {
    // Get active monitoring configs
    const { data: configs, error } = await supabase
      .from('price_monitoring_config')
      .select('*')
      .eq('monitoring_enabled', true)
      .order('priority', { ascending: true });

    if (error) throw error;

    if (!configs || configs.length === 0) {
      console.log('No active monitoring configurations found');
      return;
    }

    console.log(`Found ${configs.length} active monitoring configurations`);

    let processed = 0;
    let alertsGenerated = 0;
    const { AmazonSPAPI } = require('../services/amazon-spapi');
    const amazonAPI = new AmazonSPAPI(supabase);

    // Process in batches
    const batchSize = jobStatus.batchSize;
    for (let i = 0; i < configs.length; i += batchSize) {
      const batch = configs.slice(i, i + batchSize);
      const asins = batch.map(c => c.asin);

      try {
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}: ${asins.join(', ')}`);

        // Process each ASIN individually with rate limiting
        for (const config of batch) {
          let retryCount = 0;
          const maxRetries = 3;
          let success = false;

          while (retryCount < maxRetries && !success) {
            try {
              // Apply rate limiting for getItemOffers endpoint
              await rateLimiter.waitForRateLimit('getItemOffers');

              const asinData = await amazonAPI.getCompetitivePricing(config.asin);
              if (asinData) {
                // Store history
                await storePricingHistory(config.id, config.asin, asinData);

                // Check for alerts (simplified)
                if (asinData.buyBoxWinner !== config.user_email) {
                  await generateAlert({
                    type: 'buy_box_ownership_change',
                    severity: 'high',
                    asin: config.asin,
                    sku: config.sku || config.asin,
                    user_email: config.user_email,
                    message: `Buy box lost for ${config.asin}`,
                    alert_data: asinData
                  });
                  alertsGenerated++;
                }

                // Update last checked
                await supabase
                  .from('price_monitoring_config')
                  .update({
                    last_checked: new Date().toISOString()
                  })
                  .eq('id', config.id);

                // Increment check_count separately using RPC call
                await supabase.rpc('increment_check_count', { config_id: config.id });

                processed++;
                success = true;
              }
            } catch (asinError) {
              if (asinError.message === 'RATE_LIMITED' && retryCount < maxRetries - 1) {
                retryCount++;
                console.log(`⚠️ Rate limited for ${config.asin}, retry ${retryCount}/${maxRetries} in 6 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 6000)); // Sleep for 6 seconds
              } else {
                console.error(`Error processing ASIN ${config.asin}:`, asinError.message);
                break; // Exit retry loop for non-rate-limit errors or max retries reached
              }
            }
          }
        }

        // Brief delay between batches
        if (i + batchSize < configs.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (batchError) {
        console.error(`Error processing batch:`, batchError);
      }
    }

    const duration = Date.now() - startTime;
    jobStatus.lastRun = new Date().toISOString();
    jobStatus.nextRun = new Date(Date.now() + (jobStatus.intervalMinutes * 60 * 1000)).toISOString();

    console.log(`Monitoring cycle completed: ${processed} processed, ${alertsGenerated} alerts, ${duration}ms`);

    // Log completion
    await logJobStatus('cycle_completed', {
      duration,
      processed,
      alertsGenerated,
      totalConfigs: configs.length
    });

  } catch (error) {
    console.error('Error in monitoring cycle:', error);
    await logJobStatus('cycle_error', { error: error.message });
  }
}

async function storePricingHistory(configId, asin, pricingData) {
  try {
    await supabase
      .from('price_monitoring_history')
      .insert({
        monitoring_config_id: configId,
        asin: asin,
        sku: pricingData.sku || asin,
        buy_box_price: pricingData.buyBoxPrice,
        your_price: pricingData.yourPrice,
        lowest_competitor_price: pricingData.lowestPrice,
        competitor_count: pricingData.offerCount || 0,
        buy_box_owner: pricingData.buyBoxWinner,
        is_buy_box_yours: pricingData.yourBuyBox || false,
        raw_data: pricingData
      });
  } catch (error) {
    console.error(`Error storing pricing history for ${asin}:`, error);
  }
}

async function generateAlert(alertData) {
  try {
    await supabase
      .from('price_monitoring_alerts')
      .insert(alertData);
    console.log(`Alert generated: ${alertData.type} for ${alertData.asin}`);
  } catch (error) {
    console.error(`Error generating alert for ${alertData.asin}:`, error);
  }
}

async function logJobStatus(status, metadata = {}) {
  try {
    await supabase
      .from('price_monitoring_job_log')
      .insert({
        status,
        metadata,
        timestamp: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error logging job status:', error);
  }
}

async function getJobStatistics(days) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('price_monitoring_job_log')
      .select('*')
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: false });

    if (error) throw error;

    const logs = data || [];

    return {
      totalRuns: logs.filter(log => log.status === 'cycle_completed').length,
      totalErrors: logs.filter(log => log.status === 'cycle_error').length,
      totalProcessed: logs
        .filter(log => log.status === 'cycle_completed' && log.metadata?.processed)
        .reduce((sum, log) => sum + (log.metadata.processed || 0), 0),
      totalAlerts: logs
        .filter(log => log.status === 'cycle_completed' && log.metadata?.alertsGenerated)
        .reduce((sum, log) => sum + (log.metadata.alertsGenerated || 0), 0),
      averageDuration: calculateAverageDuration(logs),
      lastRun: logs.find(log => log.status === 'cycle_completed')?.timestamp,
      recentLogs: logs.slice(0, 10)
    };
  } catch (error) {
    console.error('Error getting job statistics:', error);
    return {
      totalRuns: 0,
      totalErrors: 0,
      totalProcessed: 0,
      totalAlerts: 0,
      averageDuration: 0,
      lastRun: null,
      recentLogs: []
    };
  }
}

function calculateAverageDuration(logs) {
  const completedRuns = logs.filter(log =>
    log.status === 'cycle_completed' &&
    log.metadata?.duration
  );

  if (completedRuns.length === 0) return 0;

  const totalDuration = completedRuns.reduce((sum, log) =>
    sum + (log.metadata.duration || 0), 0
  );

  return Math.round(totalDuration / completedRuns.length);
}

// SQS Notifications Management
router.post('/setup-sqs-notifications', async (req, res) => {
  try {
    console.log('🔄 Setting up SQS notifications...');

    const sqsService = new AmazonSQSService();
    const notificationsService = new SPAPINotificationsService();

    // Create the SQS queue if it doesn't exist
    const queueUrl = await sqsService.createQueue();
    const queueArn = await sqsService.getQueueArn();

    console.log('📫 Queue created/verified:', queueUrl);
    console.log('🏷️ Queue ARN:', queueArn);

    // Set up the queue policy for Amazon SP-API
    await sqsService.setupQueuePolicy();
    console.log('🔐 Queue policy configured');

    // Create SP-API destination
    const destination = await notificationsService.createDestination(queueArn);
    console.log('🎯 SP-API destination created:', destination.destinationId);

    // Subscribe to notifications
    const pricingSubscription = await notificationsService.createSubscription(
      destination.destinationId,
      'PRICING_HEALTH'
    );

    const offerSubscription = await notificationsService.createSubscription(
      destination.destinationId,
      'ANY_OFFER_CHANGED'
    );

    console.log('🔔 Subscriptions created:', {
      pricing: pricingSubscription.subscriptionId,
      offers: offerSubscription.subscriptionId
    });

    // Store configuration in database
    const { error } = await supabase
      .from('notification_config')
      .upsert({
        id: 'sqs-notifications',
        queue_url: queueUrl,
        queue_arn: queueArn,
        destination_id: destination.destinationId,
        pricing_subscription_id: pricingSubscription.subscriptionId,
        offers_subscription_id: offerSubscription.subscriptionId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }

    res.json({
      success: true,
      message: 'SQS notifications set up successfully',
      configuration: {
        queueUrl,
        queueArn,
        destinationId: destination.destinationId,
        subscriptions: {
          pricing: pricingSubscription.subscriptionId,
          offers: offerSubscription.subscriptionId
        }
      }
    });

  } catch (error) {
    console.error('❌ Error setting up SQS notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set up SQS notifications',
      details: error.message
    });
  }
});

// Start SQS message polling
router.post('/start-sqs-polling', async (req, res) => {
  try {
    console.log('🔄 Starting SQS message polling...');

    const sqsService = new AmazonSQSService();

    // Start polling with a callback to handle notifications
    sqsService.startPolling(async (notification) => {
      try {
        console.log('📨 Received notification:', notification.NotificationType);

        // Process the notification based on type
        if (notification.NotificationType === 'PRICING_HEALTH' ||
          notification.NotificationType === 'ANY_OFFER_CHANGED') {

          const asin = notification.Payload?.ASIN;
          const marketplaceId = notification.Payload?.MarketplaceId;

          if (asin) {
            console.log(`🚨 Buy box alert for ASIN: ${asin}`);

            // Trigger immediate check for this ASIN
            const rateLimiter = new APIRateLimiter();
            await rateLimiter.waitForRateLimit('getItemOffers');

            const { AmazonSPAPI } = require('../services/amazon-spapi');
            const amazonAPI = new AmazonSPAPI();

            try {
              const priceData = await amazonAPI.getItemOffers(asin, 'Used');

              // Store the real-time update
              const { error } = await supabase
                .from('buybox_price_monitoring')
                .insert({
                  asin: asin,
                  current_price: priceData.summary?.LowestPrices?.[0]?.LandedPrice?.Amount || null,
                  buy_box_price: priceData.summary?.BuyBoxPrices?.[0]?.LandedPrice?.Amount || null,
                  competitor_count: priceData.offers?.length || 0,
                  has_buy_box: priceData.summary?.BuyBoxEligibleOffers?.length > 0,
                  notification_type: 'real_time_sqs',
                  raw_data: priceData,
                  created_at: new Date().toISOString()
                });

              if (error) {
                console.error('❌ Database error storing real-time data:', error);
              } else {
                console.log('✅ Real-time data stored for ASIN:', asin);
              }

            } catch (apiError) {
              console.error('❌ API error during real-time check:', apiError.message);
            }
          }
        }

      } catch (processingError) {
        console.error('❌ Error processing notification:', processingError);
      }
    });

    console.log('✅ SQS polling started');

    res.json({
      success: true,
      message: 'SQS polling started successfully'
    });

  } catch (error) {
    console.error('❌ Error starting SQS polling:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start SQS polling',
      details: error.message
    });
  }
});

// Get SQS statistics
router.get('/sqs-stats', async (req, res) => {
  try {
    const sqsService = new AmazonSQSService();

    // Try to get quick stats first (synchronous)
    const quickStats = sqsService.getStats();

    // Try to get detailed stats with timeout
    let detailedStats = null;
    try {
      const statsPromise = Promise.race([
        sqsService.getQueueStats(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
      detailedStats = await statsPromise;
    } catch (error) {
      console.log('⚠️ Could not get detailed stats:', error.message);
    }

    res.json({
      success: true,
      statistics: {
        ...quickStats,
        detailedStats: detailedStats
      }
    });

  } catch (error) {
    console.error('❌ Error getting SQS stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get SQS statistics',
      details: error.message
    });
  }
});

// Check notification configuration
router.get('/notification-config', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notification_config')
      .select('*')
      .eq('id', 'sqs-notifications')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return res.json({
        success: true,
        configured: false,
        message: 'SQS notifications not yet configured'
      });
    }

    res.json({
      success: true,
      configured: true,
      configuration: data
    });

  } catch (error) {
    console.error('❌ Error checking notification config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check notification configuration',
      details: error.message
    });
  }
});

module.exports = router;