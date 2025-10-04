/**
 * Buy Box Alert Detection Service
 * 
 * Monitors buy box changes and triggers alerts based on user configurations
 * Detects: buy box ownership changes, price threshold breaches, new competitors
 */

const { SupabaseService } = require('./supabase-client');

class AlertDetectionService {
  constructor() {
    this.supabase = SupabaseService.client;
  }

  /**
   * Check all configured ASINs for alert conditions
   */
  async checkAllConfiguredAsins() {
    console.log('🔍 Starting alert detection check for all configured ASINs');

    try {
      // Get all active monitoring configurations
      const { data: configs, error: configError } = await this.supabase
        .from('price_monitoring_config')
        .select('*')
        .eq('monitoring_enabled', true)
        .order('priority'); // Check highest priority first

      if (configError) {
        console.error('Error fetching monitoring configs:', configError);
        return;
      }

      console.log(`Found ${configs.length} ASINs configured for monitoring`);

      let alertsGenerated = 0;
      const startTime = Date.now();

      for (const config of configs) {
        try {
          const alerts = await this.checkAsinForAlerts(config);
          alertsGenerated += alerts.length;

          // Add small delay to avoid overwhelming the system
          if (configs.length > 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`Error checking ASIN ${config.asin}:`, error);
        }
      }

      const duration = (Date.now() - startTime) / 1000;
      console.log(`✅ Alert detection completed: ${alertsGenerated} alerts generated in ${duration}s`);

      // Log monitoring statistics
      await this.logMonitoringStats({
        items_requested: configs.length,
        items_processed: configs.length,
        alerts_generated: alertsGenerated,
        run_duration_seconds: duration
      });

      return { alertsGenerated, configsChecked: configs.length };

    } catch (error) {
      console.error('Error in alert detection:', error);
      throw error;
    }
  }

  /**
   * Check a specific ASIN for alert conditions
   */
  async checkAsinForAlerts(config) {
    const alerts = [];

    try {
      // Get current buy box data
      const currentData = await this.getCurrentBuyBoxData(config.asin);
      if (!currentData) {
        console.log(`No current data found for ASIN ${config.asin}`);
        return alerts;
      }

      // Get historical data for comparison
      const historicalData = await this.getHistoricalData(config.asin, config.user_email);

      // Check for buy box ownership changes
      const ownershipAlert = await this.checkBuyBoxOwnershipChange(config, currentData, historicalData);
      if (ownershipAlert) alerts.push(ownershipAlert);

      // Check for price threshold breaches
      const priceAlert = await this.checkPriceThresholdBreach(config, currentData, historicalData);
      if (priceAlert) alerts.push(priceAlert);

      // Check for competitive reactions
      const competitiveAlert = await this.checkCompetitiveReaction(config, currentData, historicalData);
      if (competitiveAlert) alerts.push(competitiveAlert);

      // Check for new competitors
      const newCompetitorAlert = await this.checkNewCompetitors(config, currentData, historicalData);
      if (newCompetitorAlert) alerts.push(newCompetitorAlert);

      // Store alerts in database
      for (const alert of alerts) {
        await this.storeAlert(alert);
      }

      // Update monitoring history
      await this.updateMonitoringHistory(config, currentData);

      return alerts;

    } catch (error) {
      console.error(`Error checking alerts for ASIN ${config.asin}:`, error);
      return alerts;
    }
  }

  /**
   * Get current buy box data for an ASIN
   */
  async getCurrentBuyBoxData(asin) {
    const { data, error } = await this.supabase
      .from('buybox_data')
      .select('*')
      .eq('asin', asin)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error(`Error fetching current data for ${asin}:`, error);
      return null;
    }

    return data;
  }

  /**
   * Get historical data for comparison
   */
  async getHistoricalData(asin, userEmail) {
    const { data, error } = await this.supabase
      .from('price_monitoring_history')
      .select('*')
      .eq('asin', asin)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error(`Error fetching historical data for ${asin}:`, error);
      return [];
    }

    return data || [];
  }

  /**
   * Check for buy box ownership changes
   */
  async checkBuyBoxOwnershipChange(config, currentData, historicalData) {
    if (!currentData || historicalData.length === 0) return null;

    const latestHistorical = historicalData[0];
    const wasWinning = latestHistorical.is_buy_box_yours;
    const isWinning = currentData.is_winner;

    // Alert if ownership status changed
    if (wasWinning !== isWinning) {
      const alertType = isWinning ? 'buy_box_gained' : 'buy_box_lost';
      const severity = isWinning ? 'medium' : 'high';

      return {
        type: 'buy_box_ownership_change',
        severity: severity,
        asin: config.asin,
        sku: config.sku,
        user_email: config.user_email,
        message: isWinning
          ? `🎉 Buy Box regained for ${config.asin}`
          : `⚠️ Buy Box lost for ${config.asin}`,
        alert_data: {
          previous_owner: latestHistorical.buy_box_owner,
          current_owner: currentData.buybox_seller_id,
          previous_status: wasWinning,
          current_status: isWinning,
          price_when_lost: currentData.your_current_price,
          competitor_price: currentData.buybox_price,
          timestamp: currentData.timestamp
        }
      };
    }

    return null;
  }

  /**
   * Check for price threshold breaches
   */
  async checkPriceThresholdBreach(config, currentData, historicalData) {
    if (!currentData || historicalData.length === 0) return null;

    const latestHistorical = historicalData[0];
    const previousPrice = latestHistorical.your_price;
    const currentPrice = currentData.your_current_price;

    if (!previousPrice || !currentPrice) return null;

    const priceChangePercent = Math.abs((currentPrice - previousPrice) / previousPrice) * 100;

    if (priceChangePercent >= config.price_change_threshold) {
      const isIncrease = currentPrice > previousPrice;

      return {
        type: 'price_threshold_breach',
        severity: priceChangePercent > 15 ? 'high' : 'medium',
        asin: config.asin,
        sku: config.sku,
        user_email: config.user_email,
        message: `💰 Significant price change for ${config.asin}: ${isIncrease ? '+' : '-'}${priceChangePercent.toFixed(1)}%`,
        alert_data: {
          previous_price: previousPrice,
          current_price: currentPrice,
          price_change_percent: priceChangePercent,
          threshold: config.price_change_threshold,
          is_increase: isIncrease,
          timestamp: currentData.timestamp
        }
      };
    }

    return null;
  }

  /**
   * Check for competitive reactions (competitors changing prices after you)
   */
  async checkCompetitiveReaction(config, currentData, historicalData) {
    if (!currentData || historicalData.length < 2) return null;

    const latest = historicalData[0];
    const previous = historicalData[1];

    // Check if competitors changed prices after your price change
    const yourPriceChanged = latest.your_price !== previous.your_price;
    const competitorPriceChanged = latest.buy_box_price !== previous.buy_box_price;

    if (yourPriceChanged && competitorPriceChanged) {
      // Check timing - if competitor changed within reasonable timeframe
      const timeDiff = new Date(latest.created_at).getTime() - new Date(previous.created_at).getTime();
      const hoursAgo = timeDiff / (1000 * 60 * 60);

      if (hoursAgo <= 24) { // Within 24 hours
        return {
          type: 'competitive_reaction',
          severity: 'medium',
          asin: config.asin,
          sku: config.sku,
          user_email: config.user_email,
          message: `🎯 Competitor reacted to your price change on ${config.asin}`,
          alert_data: {
            your_old_price: previous.your_price,
            your_new_price: latest.your_price,
            competitor_old_price: previous.buy_box_price,
            competitor_new_price: latest.buy_box_price,
            reaction_time_hours: hoursAgo,
            timestamp: currentData.timestamp
          }
        };
      }
    }

    return null;
  }

  /**
   * Check for new competitors
   */
  async checkNewCompetitors(config, currentData, historicalData) {
    if (!currentData || historicalData.length === 0) return null;

    const latestHistorical = historicalData[0];
    const previousCompetitorCount = latestHistorical.competitor_count || 0;
    const currentCompetitorCount = currentData.competitor_count || 0;

    if (currentCompetitorCount > previousCompetitorCount) {
      const newCompetitors = currentCompetitorCount - previousCompetitorCount;

      return {
        type: 'new_competitor',
        severity: newCompetitors > 2 ? 'high' : 'medium',
        asin: config.asin,
        sku: config.sku,
        user_email: config.user_email,
        message: `👥 ${newCompetitors} new competitor(s) detected for ${config.asin}`,
        alert_data: {
          previous_competitor_count: previousCompetitorCount,
          current_competitor_count: currentCompetitorCount,
          new_competitors: newCompetitors,
          lowest_competitor_price: currentData.lowest_competitor_price,
          timestamp: currentData.timestamp
        }
      };
    }

    return null;
  }

  /**
   * Store alert in database
   */
  async storeAlert(alert) {
    try {
      const { error } = await this.supabase
        .from('price_monitoring_alerts')
        .insert({
          type: alert.type,
          severity: alert.severity,
          asin: alert.asin,
          sku: alert.sku,
          user_email: alert.user_email,
          message: alert.message,
          alert_data: alert.alert_data,
          status: 'active'
        });

      if (error) {
        console.error('Error storing alert:', error);
      } else {
        console.log(`✅ Alert stored for ${alert.asin}: ${alert.message}`);
      }
    } catch (error) {
      console.error('Error storing alert:', error);
    }
  }

  /**
   * Update monitoring history
   */
  async updateMonitoringHistory(config, currentData) {
    try {
      const { error } = await this.supabase
        .from('price_monitoring_history')
        .insert({
          asin: config.asin,
          sku: config.sku,
          buy_box_price: currentData.buybox_price,
          your_price: currentData.your_current_price,
          lowest_competitor_price: currentData.lowest_competitor_price,
          competitor_count: currentData.competitor_count,
          buy_box_owner: currentData.buybox_seller_id,
          is_buy_box_yours: currentData.is_winner,
          raw_data: currentData
        });

      if (error) {
        console.error('Error updating monitoring history:', error);
      }
    } catch (error) {
      console.error('Error updating monitoring history:', error);
    }
  }

  /**
   * Log monitoring statistics
   */
  async logMonitoringStats(stats) {
    try {
      const { error } = await this.supabase
        .from('price_monitoring_stats')
        .insert({
          run_started_at: new Date(Date.now() - (stats.run_duration_seconds * 1000)),
          run_completed_at: new Date(),
          run_duration_seconds: stats.run_duration_seconds,
          items_requested: stats.items_requested,
          items_processed: stats.items_processed,
          alerts_generated: stats.alerts_generated
        });

      if (error) {
        console.error('Error logging monitoring stats:', error);
      }
    } catch (error) {
      console.error('Error logging monitoring stats:', error);
    }
  }

  /**
   * Get alerts for a specific user
   */
  async getUserAlerts(userEmail, limit = 50, offset = 0) {
    const { data, error } = await this.supabase
      .from('price_monitoring_alerts')
      .select('*')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching user alerts:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId, userEmail) {
    const { error } = await this.supabase
      .from('price_monitoring_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userEmail
      })
      .eq('id', alertId)
      .eq('user_email', userEmail);

    if (error) {
      console.error('Error acknowledging alert:', error);
      return false;
    }

    return true;
  }
}

module.exports = { AlertDetectionService };