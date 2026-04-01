/**
 * Batch Price Change Monitor & Alert System
 * 
 * This service monitors selected ASINs/SKUs for price changes using Amazon SP-API
 * and sends alerts when significant changes are detected.
 */

require('dotenv').config();

const { SupabaseService } = require('./render-service/services/supabase-client');
const { AmazonSPAPI } = require('./render-service/services/amazon-spapi');
const nodemailer = require('nodemailer');
const axios = require('axios');

class BatchPriceMonitor {
  constructor() {
    this.spapi = new AmazonSPAPI();
    this.isRunning = false;
    this.monitoringInterval = null;
    this.emailTransporter = this.setupEmailTransporter();

    // Rate limiting: Amazon allows 36 requests per hour for competitive pricing
    this.rateLimiter = {
      requestsPerHour: 35, // Leave some buffer
      currentHour: new Date().getHours(),
      requestsThisHour: 0,
      requestQueue: []
    };
  }

  setupEmailTransporter() {
    if (!process.env.SMTP_HOST) {
      console.warn('⚠️ SMTP not configured - email alerts disabled');
      return null;
    }

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  /**
   * Get list of ASINs/SKUs to monitor based on user preferences
   */
  async getMonitoringList() {
    try {
      const { data, error } = await SupabaseService.client
        .from('price_monitoring_config')
        .select(`
          asin,
          sku,
          priority,
          price_change_threshold,
          alert_types,
          user_email,
          monitoring_enabled,
          last_checked
        `)
        .eq('monitoring_enabled', true)
        .order('priority', { ascending: false }); // High priority first

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('❌ Error fetching monitoring list:', error);
      return [];
    }
  }

  /**
   * Batch check competitive pricing for multiple ASINs
   */
  async batchCheckPrices(monitoringItems) {
    const results = [];

    console.log(`📡 Processing ${monitoringItems.length} items individually using working API pattern`);

    for (const item of monitoringItems) {
      try {
        // Check rate limiting for each individual call
        await this.enforceRateLimit();

        console.log(`📡 Checking ASIN: ${item.asin} (SKU: ${item.sku})`);

        // Use the working single ASIN API pattern from your bulk scan
        const pricingResponse = await this.spapi.getBuyBoxData(item.asin, item.sku, `monitor-${Date.now()}`);

        if (pricingResponse && pricingResponse.summary) {
          // Convert getBuyBoxData response to our expected format
          const priceAnalysis = this.analyzePriceChangesFromBuyBoxData(item, pricingResponse);

          results.push({
            ...item,
            currentData: priceAnalysis,
            timestamp: new Date().toISOString()
          });

          console.log(`✅ Processed ${item.asin}: Buy Box at £${pricingResponse.summary.buybox_price}`);
        }

        this.rateLimiter.requestsThisHour++;

        // Delay between individual calls
        await this.sleep(1000);

      } catch (error) {
        console.error(`❌ Error processing ${item.asin}:`, error.message);

        // If rate limited, wait and skip this item
        if (error.message === 'RATE_LIMITED') {
          console.log('⏳ Rate limited - waiting 60 seconds...');
          await this.sleep(60000);
        }
      }
    }

    return results;
  }

  /**
   * Analyze price changes and competitive movements
   */
  analyzePriceChanges(monitoringItem, offers) {
    const buyBoxOffer = offers.find(offer => offer.IsBuyBoxWinner === true);
    const yourSellerId = process.env.AMAZON_SELLER_ID;
    const yourOffer = offers.find(offer => offer.SellerId === yourSellerId);

    // Current prices
    const currentBuyBoxPrice = buyBoxOffer?.ListingPrice?.Amount || null;
    const currentYourPrice = yourOffer?.ListingPrice?.Amount || null;
    const competitorOffers = offers.filter(offer => offer.SellerId !== yourSellerId);

    // Price analysis
    const analysis = {
      asin: monitoringItem.asin,
      sku: monitoringItem.sku,
      currentBuyBoxPrice,
      currentYourPrice,
      competitorCount: competitorOffers.length,
      lowestCompetitorPrice: competitorOffers.length > 0
        ? Math.min(...competitorOffers.map(o => o.ListingPrice?.Amount || Infinity))
        : null,
      buyBoxOwnership: {
        isYours: buyBoxOffer?.SellerId === yourSellerId,
        currentOwner: buyBoxOffer?.SellerId || null,
        buyBoxChanged: false // Will be set by comparison logic
      },
      priceChanges: {
        buyBoxPriceChange: 0,
        yourPriceChange: 0,
        competitorPriceChanges: []
      },
      alerts: []
    };

    return analysis;
  }

  /**
   * Compare current data with historical data to detect changes
   */
  async detectPriceChanges(currentResults) {
    const alerts = [];

    for (const result of currentResults) {
      try {
        // Get last recorded data for this ASIN/SKU
        const { data: lastRecord } = await SupabaseService.client
          .from('price_monitoring_history')
          .select('*')
          .eq('asin', result.asin)
          .eq('sku', result.sku)
          .order('created_at', { ascending: false })
          .limit(1);

        if (lastRecord && lastRecord.length > 0) {
          const previous = lastRecord[0];
          const current = result.currentData;

          // Detect Buy Box price changes
          if (previous.buy_box_price !== current.currentBuyBoxPrice) {
            const change = current.currentBuyBoxPrice - previous.buy_box_price;
            const changePercent = (change / previous.buy_box_price) * 100;

            if (Math.abs(changePercent) >= result.price_change_threshold) {
              alerts.push({
                type: 'buy_box_price_change',
                severity: Math.abs(changePercent) > 10 ? 'high' : 'medium',
                asin: result.asin,
                sku: result.sku,
                itemName: result.sku,
                message: `Buy Box price changed by ${changePercent.toFixed(1)}% (${change > 0 ? '+' : ''}£${change.toFixed(2)})`,
                previousPrice: previous.buy_box_price,
                currentPrice: current.currentBuyBoxPrice,
                changePercent,
                timestamp: result.timestamp,
                userEmail: result.user_email
              });
            }
          }

          // Detect Buy Box ownership changes
          if (previous.buy_box_owner !== current.buyBoxOwnership.currentOwner) {
            const lostBuyBox = previous.buy_box_owner === process.env.AMAZON_SELLER_ID &&
              current.buyBoxOwnership.currentOwner !== process.env.AMAZON_SELLER_ID;
            const wonBuyBox = previous.buy_box_owner !== process.env.AMAZON_SELLER_ID &&
              current.buyBoxOwnership.currentOwner === process.env.AMAZON_SELLER_ID;

            alerts.push({
              type: 'buy_box_ownership_change',
              severity: lostBuyBox ? 'high' : wonBuyBox ? 'medium' : 'low',
              asin: result.asin,
              sku: result.sku,
              itemName: result.sku,
              message: lostBuyBox ? 'Lost Buy Box!' : wonBuyBox ? 'Won Buy Box!' : 'Buy Box changed hands',
              previousOwner: previous.buy_box_owner,
              currentOwner: current.buyBoxOwnership.currentOwner,
              timestamp: result.timestamp,
              userEmail: result.user_email
            });
          }

          // Detect competitive reactions (new low prices after your price changes)
          if (current.lowestCompetitorPrice && previous.lowest_competitor_price) {
            const competitorChange = current.lowestCompetitorPrice - previous.lowest_competitor_price;
            const wasRecentYourPriceChange = result.last_price_update &&
              new Date(result.last_price_update) > new Date(Date.now() - 2 * 60 * 60 * 1000); // Within 2 hours

            if (competitorChange < -0.01 && wasRecentYourPriceChange) {
              alerts.push({
                type: 'competitive_reaction',
                severity: 'medium',
                asin: result.asin,
                sku: result.sku,
                itemName: result.sku,
                message: `Competitor reacted to your price change - dropped to £${current.lowestCompetitorPrice}`,
                competitorChange,
                timestamp: result.timestamp,
                userEmail: result.user_email
              });
            }
          }
        }

        // Store current data for future comparisons
        await this.storeMonitoringResult(result);

      } catch (error) {
        console.error(`❌ Error detecting changes for ${result.asin}:`, error);
      }
    }

    return alerts;
  }

  /**
   * Store monitoring results for historical comparison
   */
  async storeMonitoringResult(result) {
    try {
      const { error } = await SupabaseService.client
        .from('price_monitoring_history')
        .insert({
          asin: result.asin,
          sku: result.sku,
          buy_box_price: result.currentData.currentBuyBoxPrice,
          your_price: result.currentData.currentYourPrice,
          lowest_competitor_price: result.currentData.lowestCompetitorPrice,
          competitor_count: result.currentData.competitorCount,
          buy_box_owner: result.currentData.buyBoxOwnership.currentOwner,
          is_buy_box_yours: result.currentData.buyBoxOwnership.isYours,
          monitoring_config_id: result.id,
          raw_data: result.currentData
        });

      if (error) throw error;
    } catch (error) {
      console.error(`❌ Error storing monitoring result:`, error);
    }
  }

  /**
   * Send alerts via configured channels
   */
  async sendAlerts(alerts) {
    const groupedAlerts = this.groupAlertsByUser(alerts);

    for (const [userEmail, userAlerts] of Object.entries(groupedAlerts)) {
      // Send email summary
      await this.sendEmailAlert(userEmail, userAlerts);

      // Send webhook notifications for high-severity alerts
      const highSeverityAlerts = userAlerts.filter(alert => alert.severity === 'high');
      if (highSeverityAlerts.length > 0) {
        await this.sendWebhookAlert(userEmail, highSeverityAlerts);
      }
    }

    // Log all alerts to database
    await this.logAlerts(alerts);
  }

  groupAlertsByUser(alerts) {
    return alerts.reduce((groups, alert) => {
      const userEmail = alert.userEmail || 'system@default.com';
      if (!groups[userEmail]) {
        groups[userEmail] = [];
      }
      groups[userEmail].push(alert);
      return groups;
    }, {});
  }

  async sendEmailAlert(userEmail, alerts) {
    if (!this.emailTransporter) return;

    const highSeverity = alerts.filter(a => a.severity === 'high');
    const mediumSeverity = alerts.filter(a => a.severity === 'medium');

    const subject = `🚨 Price Alert: ${highSeverity.length} High Priority Changes`;

    const html = `
      <h2>🔔 Amazon Price Monitoring Alert</h2>
      <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
      
      ${highSeverity.length > 0 ? `
        <h3>🚨 High Priority Alerts (${highSeverity.length})</h3>
        <ul>
          ${highSeverity.map(alert => `
            <li>
              <strong>${alert.itemName || alert.sku}</strong><br>
              ${alert.message}<br>
              <small>ASIN: ${alert.asin} | SKU: ${alert.sku}</small>
            </li>
          `).join('')}
        </ul>
      ` : ''}
      
      ${mediumSeverity.length > 0 ? `
        <h3>⚠️ Medium Priority Alerts (${mediumSeverity.length})</h3>
        <ul>
          ${mediumSeverity.map(alert => `
            <li>
              <strong>${alert.itemName || alert.sku}</strong><br>
              ${alert.message}<br>
              <small>ASIN: ${alert.asin} | SKU: ${alert.sku}</small>
            </li>
          `).join('')}
        </ul>
      ` : ''}
      
      <hr>
      <p><small>This is an automated alert from your Amazon Price Monitoring System.</small></p>
    `;

    try {
      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || 'alerts@yourstore.com',
        to: userEmail,
        subject,
        html
      });

      console.log(`✅ Email alert sent to ${userEmail}`);
    } catch (error) {
      console.error(`❌ Failed to send email to ${userEmail}:`, error);
    }
  }

  async sendWebhookAlert(userEmail, alerts) {
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) return;

    const payload = {
      type: 'price_alert',
      severity: 'high',
      userEmail,
      alertCount: alerts.length,
      alerts: alerts.map(alert => ({
        type: alert.type,
        asin: alert.asin,
        sku: alert.sku,
        message: alert.message,
        timestamp: alert.timestamp
      })),
      timestamp: new Date().toISOString()
    };

    try {
      await axios.post(webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      console.log(`✅ Webhook alert sent for ${userEmail}`);
    } catch (error) {
      console.error(`❌ Failed to send webhook alert:`, error);
    }
  }

  async logAlerts(alerts) {
    try {
      const alertRecords = alerts.map(alert => ({
        type: alert.type,
        severity: alert.severity,
        asin: alert.asin,
        sku: alert.sku,
        message: alert.message,
        user_email: alert.userEmail,
        alert_data: alert,
        created_at: new Date().toISOString()
      }));

      const { error } = await SupabaseService.client
        .from('price_monitoring_alerts')
        .insert(alertRecords);

      if (error) throw error;

      console.log(`✅ Logged ${alerts.length} alerts to database`);
    } catch (error) {
      console.error(`❌ Failed to log alerts:`, error);
    }
  }

  /**
   * Main monitoring loop
   */
  async runMonitoringCycle() {
    try {
      console.log(`🔄 Starting price monitoring cycle at ${new Date().toISOString()}`);

      // Get items to monitor
      const monitoringItems = await this.getMonitoringList();

      if (monitoringItems.length === 0) {
        console.log('📝 No items configured for monitoring');
        return;
      }

      console.log(`📋 Monitoring ${monitoringItems.length} items`);

      // Batch check prices
      const results = await this.batchCheckPrices(monitoringItems);

      // Detect changes and generate alerts
      const alerts = await this.detectPriceChanges(results);

      if (alerts.length > 0) {
        console.log(`🚨 Generated ${alerts.length} alerts`);
        await this.sendAlerts(alerts);
      } else {
        console.log('✅ No significant price changes detected');
      }

    } catch (error) {
      console.error('❌ Error in monitoring cycle:', error);
    }
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(intervalMinutes = 30) {
    if (this.isRunning) {
      console.log('⚠️ Monitoring already running');
      return;
    }

    this.isRunning = true;
    console.log(`🚀 Starting price monitoring every ${intervalMinutes} minutes`);

    // Run immediately
    this.runMonitoringCycle();

    // Then run on interval
    this.monitoringInterval = setInterval(() => {
      this.runMonitoringCycle();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Price monitoring stopped');
  }

  // Utility functions
  async enforceRateLimit() {
    const currentHour = new Date().getHours();

    // Reset counter if hour changed
    if (currentHour !== this.rateLimiter.currentHour) {
      this.rateLimiter.currentHour = currentHour;
      this.rateLimiter.requestsThisHour = 0;
    }

    // Check if we've hit the limit
    if (this.rateLimiter.requestsThisHour >= this.rateLimiter.requestsPerHour) {
      const minutesToWait = 60 - new Date().getMinutes();
      console.log(`⏳ Rate limit reached. Waiting ${minutesToWait} minutes...`);
      await this.sleep(minutesToWait * 60 * 1000);
    }
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { BatchPriceMonitor };