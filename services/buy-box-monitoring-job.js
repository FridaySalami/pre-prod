const { supabase } = require('../render-service/services/supabase-client');
const { getCompetitivePricing } = require('../render-service/services/amazon-spapi');
const { checkForAlerts } = require('../render-service/services/alert-detection');
const { processAlertNotifications } = require('../render-service/services/alert-notification');

class BuyBoxMonitoringJob {
  constructor() {
    this.isRunning = false;
    this.currentInterval = null;
    this.jobConfig = {
      intervalMinutes: 30, // Default: check every 30 minutes
      batchSize: 10, // Process 10 ASINs at a time
      maxRetries: 3,
      retryDelayMs: 5000
    };
  }

  /**
   * Start the monitoring job with specified interval
   */
  async start(intervalMinutes = this.jobConfig.intervalMinutes) {
    if (this.isRunning) {
      console.log('Buy box monitoring job is already running');
      return;
    }

    this.isRunning = true;
    this.jobConfig.intervalMinutes = intervalMinutes;

    console.log(`Starting buy box monitoring job - checking every ${intervalMinutes} minutes`);

    // Run immediately
    await this.runMonitoringCycle();

    // Schedule recurring runs
    this.currentInterval = setInterval(async () => {
      await this.runMonitoringCycle();
    }, intervalMinutes * 60 * 1000);

    // Log job status to database
    await this.logJobStatus('started', { intervalMinutes });
  }

  /**
   * Stop the monitoring job
   */
  async stop() {
    if (!this.isRunning) {
      console.log('Buy box monitoring job is not running');
      return;
    }

    this.isRunning = false;

    if (this.currentInterval) {
      clearInterval(this.currentInterval);
      this.currentInterval = null;
    }

    console.log('Buy box monitoring job stopped');
    await this.logJobStatus('stopped');
  }

  /**
   * Get current job status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMinutes: this.jobConfig.intervalMinutes,
      batchSize: this.jobConfig.batchSize,
      lastRun: this.lastRunTime,
      nextRun: this.isRunning ? new Date(Date.now() + (this.jobConfig.intervalMinutes * 60 * 1000)) : null
    };
  }

  /**
   * Run a complete monitoring cycle
   */
  async runMonitoringCycle() {
    const startTime = Date.now();
    this.lastRunTime = new Date();

    console.log(`Starting buy box monitoring cycle at ${this.lastRunTime.toISOString()}`);

    try {
      // Get all active monitoring configurations
      const monitoringConfigs = await this.getActiveMonitoringConfigs();

      if (monitoringConfigs.length === 0) {
        console.log('No active monitoring configurations found');
        return;
      }

      console.log(`Found ${monitoringConfigs.length} active monitoring configurations`);

      // Process configurations in batches
      const batches = this.createBatches(monitoringConfigs, this.jobConfig.batchSize);
      let totalProcessed = 0;
      let totalAlerts = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} ASINs)`);

        try {
          const batchResults = await this.processBatch(batch);
          totalProcessed += batchResults.processed;
          totalAlerts += batchResults.alertsGenerated;

          // Brief delay between batches to avoid rate limiting
          if (i < batches.length - 1) {
            await this.sleep(2000);
          }
        } catch (error) {
          console.error(`Error processing batch ${i + 1}:`, error);
          // Continue with next batch even if this one fails
        }
      }

      const duration = Date.now() - startTime;
      console.log(`Monitoring cycle completed in ${duration}ms - processed ${totalProcessed} ASINs, generated ${totalAlerts} alerts`);

      // Log cycle completion
      await this.logJobStatus('cycle_completed', {
        duration,
        processed: totalProcessed,
        alertsGenerated: totalAlerts,
        batches: batches.length
      });

    } catch (error) {
      console.error('Error in monitoring cycle:', error);
      await this.logJobStatus('cycle_error', { error: error.message });
    }
  }

  /**
   * Get all active monitoring configurations
   */
  async getActiveMonitoringConfigs() {
    try {
      const { data, error } = await supabase
        .from('price_monitoring_config')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false }); // High priority first

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching monitoring configs:', error);
      return [];
    }
  }

  /**
   * Process a batch of monitoring configurations
   */
  async processBatch(configs) {
    const asins = configs.map(config => config.asin);
    let processed = 0;
    let alertsGenerated = 0;

    try {
      // Get current competitive pricing data for all ASINs in batch
      const pricingData = await this.getPricingDataWithRetry(asins);

      if (!pricingData || pricingData.length === 0) {
        console.warn('No pricing data received for batch');
        return { processed: 0, alertsGenerated: 0 };
      }

      // Process each ASIN
      for (const config of configs) {
        try {
          const asinPricingData = pricingData.find(data => data.asin === config.asin);

          if (!asinPricingData) {
            console.warn(`No pricing data found for ASIN ${config.asin}`);
            continue;
          }

          // Check for alerts
          const alerts = await checkForAlerts(config, asinPricingData);

          if (alerts && alerts.length > 0) {
            console.log(`Generated ${alerts.length} alerts for ASIN ${config.asin}`);

            // Process notifications for generated alerts
            await processAlertNotifications(alerts, config);
            alertsGenerated += alerts.length;
          }

          // Update last checked timestamp
          await this.updateLastChecked(config.id);
          processed++;

        } catch (error) {
          console.error(`Error processing ASIN ${config.asin}:`, error);
          // Continue with next ASIN
        }
      }

    } catch (error) {
      console.error('Error processing batch:', error);
    }

    return { processed, alertsGenerated };
  }

  /**
   * Get pricing data with retry logic
   */
  async getPricingDataWithRetry(asins, retries = this.jobConfig.maxRetries) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Attempting to get pricing data for ${asins.length} ASINs (attempt ${attempt}/${retries})`);

        const pricingData = await getCompetitivePricing(asins);

        if (pricingData && pricingData.length > 0) {
          return pricingData;
        }

        throw new Error('No pricing data returned');

      } catch (error) {
        console.error(`Pricing data attempt ${attempt} failed:`, error.message);

        if (attempt === retries) {
          throw error;
        }

        // Wait before retry
        await this.sleep(this.jobConfig.retryDelayMs * attempt);
      }
    }
  }

  /**
   * Update last checked timestamp for a configuration
   */
  async updateLastChecked(configId) {
    try {
      const { error } = await supabase
        .from('price_monitoring_config')
        .update({
          last_checked: new Date().toISOString(),
          check_count: supabase.sql`check_count + 1`
        })
        .eq('id', configId);

      if (error) throw error;
    } catch (error) {
      console.error(`Error updating last checked for config ${configId}:`, error);
    }
  }

  /**
   * Create batches from array
   */
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log job status to database
   */
  async logJobStatus(status, metadata = {}) {
    try {
      const { error } = await supabase
        .from('price_monitoring_job_log')
        .insert({
          status,
          metadata,
          timestamp: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error logging job status:', error);
    }
  }

  /**
   * Run manual check for specific ASIN
   */
  async runManualCheck(asin, userEmail) {
    console.log(`Running manual check for ASIN ${asin}`);

    try {
      // Get monitoring config for this ASIN
      const { data: config, error: configError } = await supabase
        .from('price_monitoring_config')
        .select('*')
        .eq('asin', asin)
        .eq('user_email', userEmail)
        .single();

      if (configError || !config) {
        throw new Error(`No monitoring configuration found for ASIN ${asin}`);
      }

      // Get current pricing data
      const pricingData = await this.getPricingDataWithRetry([asin]);

      if (!pricingData || pricingData.length === 0) {
        throw new Error('No pricing data available');
      }

      const asinPricingData = pricingData[0];

      // Check for alerts
      const alerts = await checkForAlerts(config, asinPricingData);

      if (alerts && alerts.length > 0) {
        console.log(`Manual check generated ${alerts.length} alerts for ASIN ${asin}`);
        await processAlertNotifications(alerts, config);
      } else {
        console.log(`Manual check found no alerts for ASIN ${asin}`);
      }

      // Update last checked timestamp
      await this.updateLastChecked(config.id);

      return {
        success: true,
        asin,
        alertsGenerated: alerts ? alerts.length : 0,
        pricingData: asinPricingData,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`Error in manual check for ASIN ${asin}:`, error);
      return {
        success: false,
        asin,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get job statistics
   */
  async getJobStatistics(days = 7) {
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

      const stats = {
        totalRuns: logs.filter(log => log.status === 'cycle_completed').length,
        totalErrors: logs.filter(log => log.status === 'cycle_error').length,
        totalProcessed: logs
          .filter(log => log.status === 'cycle_completed' && log.metadata?.processed)
          .reduce((sum, log) => sum + (log.metadata.processed || 0), 0),
        totalAlerts: logs
          .filter(log => log.status === 'cycle_completed' && log.metadata?.alertsGenerated)
          .reduce((sum, log) => sum + (log.metadata.alertsGenerated || 0), 0),
        averageDuration: this.calculateAverageDuration(logs),
        lastRun: logs.find(log => log.status === 'cycle_completed')?.timestamp,
        recentLogs: logs.slice(0, 10)
      };

      return stats;
    } catch (error) {
      console.error('Error getting job statistics:', error);
      return null;
    }
  }

  calculateAverageDuration(logs) {
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
}

// Create singleton instance
const buyBoxMonitoringJob = new BuyBoxMonitoringJob();

module.exports = {
  buyBoxMonitoringJob,
  BuyBoxMonitoringJob
};