/**
 * Buy Box Real-time Status API Routes
 * Provides real-time buy box status for UI dashboard
 */

const express = require('express');
const { supabase } = require('../services/supabase-client');

const router = express.Router();

/**
 * GET /api/buybox-status/dashboard
 * Get current buy box status for all monitored ASINs
 */
router.get('/dashboard', async (req, res) => {
  try {
    // Get recent alerts grouped by ASIN
    const { data: recentAlerts, error: alertError } = await supabase
      .from('price_monitoring_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100); // Get last 100 alerts

    if (alertError) throw alertError;

    if (!recentAlerts || recentAlerts.length === 0) {
      return res.json({
        success: true,
        data: [],
        summary: {
          total_asins: 0,
          has_buy_box: 0,
          lost_buy_box: 0,
          warnings: 0,
          last_update: new Date().toISOString()
        }
      });
    }

    // Get unique ASINs and SKUs from alerts
    const uniqueAsins = [...new Set(recentAlerts.map(alert => alert.asin))];
    const uniqueSkus = [...new Set(recentAlerts.map(alert => alert.sku).filter(Boolean))];

    console.log('Looking for ASINs:', uniqueAsins);
    console.log('Looking for SKUs:', uniqueSkus);

    // Get product data from amazon_listings table - try both seller_sku and any ASIN matches
    const { data: listings, error: listingsError } = await supabase
      .from('amazon_listings')
      .select('seller_sku, item_name, price, merchant_shipping_group')
      .or(`seller_sku.in.(${[...uniqueAsins, ...uniqueSkus].join(',')})`);

    console.log('Found listings:', listings?.length || 0);
    if (listings && listings.length > 0) {
      console.log('Sample listing:', listings[0]);
    }

    if (listingsError) {
      console.warn('Could not fetch amazon_listings data:', listingsError);
    }

    // Create a map of listings data by SKU/ASIN
    const listingsMap = new Map();
    if (listings) {
      listings.forEach(listing => {
        listingsMap.set(listing.seller_sku, listing);
      });
    }

    // Group alerts by ASIN to get latest alert for each
    const asinMap = new Map();
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    recentAlerts.forEach(alert => {
      if (!asinMap.has(alert.asin)) {
        asinMap.set(alert.asin, {
          latest: alert,
          count24h: 0
        });
      }

      // Count alerts in last 24 hours
      if (new Date(alert.created_at) > last24Hours) {
        asinMap.get(alert.asin).count24h++;
      }
    });

    // Transform data for dashboard
    let debugCount = 0;
    const dashboardData = Array.from(asinMap.entries()).map(([asin, data]) => {
      const alert = data.latest;
      const alertData = alert.alert_data || {};
      const listing = listingsMap.get(asin) || listingsMap.get(alert.sku);

      // Debug: Log alert data structure for first few items
      if (debugCount < 3) {
        console.log(`Alert data for ${asin}:`, JSON.stringify(alertData, null, 2));
        debugCount++;
      }

      // Extract competitor count from the nested payload structure
      const payload = alertData.payload || alertData;
      const totalOffers = payload?.Summary?.TotalOfferCount ||
        payload?.TotalOfferCount ||
        payload?.Offers?.length ||
        alertData.total_offers ||
        alertData.totalOffers ||
        0;

      // Competitor count is total offers minus 1 (assuming you have 1 offer)
      const competitorCount = Math.max(0, totalOffers - 1);

      // Get buy box winner from the payload structure
      const buyBoxWinner = payload?.Offers?.find(offer => offer.IsBuyBoxWinner)?.SellerId ||
        alertData.buyBoxWinner ||
        'Unknown';

      // Get current buy box price
      const buyBoxPrice = payload?.Summary?.BuyBoxPrices?.[0]?.ListingPrice?.Amount ||
        payload?.BuyBoxPrices?.[0]?.ListingPrice?.Amount ||
        alertData.buyBoxPrice ||
        null;

      // Check if you have the buy box using environment variable
      const yourSellerId = process.env.AMAZON_SELLER_ID;
      const hasBuyBox = buyBoxWinner === yourSellerId;

      return {
        asin: asin,
        sku: alert.sku || null,
        title: listing?.item_name || alertData.title || asin,
        has_buy_box: hasBuyBox,
        buy_box_winner: buyBoxWinner,
        current_price: buyBoxPrice,
        our_price: alertData.yourPrice || listing?.price || null,
        competitor_count: competitorCount,
        merchant_shipping_group: listing?.merchant_shipping_group || null,
        last_checked: alert.created_at,
        last_alert: alert.created_at,
        alert_count_24h: data.count24h,
        status: hasBuyBox ? 'success' : (buyBoxWinner && buyBoxWinner !== 'Unknown') ? 'warning' : 'danger',
        priority: alert.priority || 5,
        user_email: alert.user_email
      };
    });

    // Sort by priority and status
    dashboardData.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.status === 'danger' && b.status !== 'danger') return -1;
      if (a.status !== 'danger' && b.status === 'danger') return 1;
      return new Date(b.last_checked || 0) - new Date(a.last_checked || 0);
    });

    res.json({
      success: true,
      data: dashboardData,
      summary: {
        total_asins: dashboardData.length,
        has_buy_box: dashboardData.filter(d => d.has_buy_box).length,
        lost_buy_box: dashboardData.filter(d => d.status === 'danger').length,
        warnings: dashboardData.filter(d => d.status === 'warning').length,
        last_update: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/buybox-status/debug
 * Debug endpoint to see raw alert_data structure
 */
router.get('/debug', async (req, res) => {
  try {
    const { data: rawAlerts, error } = await supabase
      .from('price_monitoring_alerts')
      .select('asin, sku, alert_data, created_at')
      .order('created_at', { ascending: false })
      .limit(3);

    if (error) throw error;

    res.json({
      success: true,
      debug_data: rawAlerts?.map(alert => ({
        asin: alert.asin,
        sku: alert.sku,
        created_at: alert.created_at,
        alert_data_keys: Object.keys(alert.alert_data || {}),
        alert_data_sample: alert.alert_data
      })) || []
    });

  } catch (error) {
    console.error('Error fetching debug data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/buybox-status/alerts
 * Get recent buy box alerts with pagination
 */
router.get('/alerts', async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      asin = null,
      type = null,
      severity = null,
      unread_only = false
    } = req.query;

    let query = supabase
      .from('price_monitoring_alerts')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (asin) query = query.eq('asin', asin);
    if (type) query = query.eq('type', type);
    if (severity) query = query.eq('severity', severity);

    // Apply pagination
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: alerts, error } = await query;
    if (error) throw error;

    // Get total count for pagination
    let countQuery = supabase
      .from('price_monitoring_alerts')
      .select('*', { count: 'exact', head: true });

    if (asin) countQuery = countQuery.eq('asin', asin);
    if (type) countQuery = countQuery.eq('type', type);
    if (severity) countQuery = countQuery.eq('severity', severity);

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    res.json({
      success: true,
      alerts: alerts || [],
      pagination: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: count > (parseInt(offset) + parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/buybox-status/asin/:asin
 * Get detailed status for specific ASIN
 */
router.get('/asin/:asin', async (req, res) => {
  try {
    const { asin } = req.params;

    // Get monitoring config
    const { data: config, error: configError } = await supabase
      .from('price_monitoring_config')
      .select('*')
      .eq('asin', asin)
      .single();

    if (configError) throw configError;
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'ASIN not found in monitoring configuration'
      });
    }

    // Get recent alerts for this ASIN
    const { data: alerts, error: alertsError } = await supabase
      .from('price_monitoring_alerts')
      .select('*')
      .eq('asin', asin)
      .order('created_at', { ascending: false })
      .limit(10);

    if (alertsError) throw alertsError;

    // Get pricing history
    const { data: history, error: historyError } = await supabase
      .from('price_monitoring_history')
      .select('*')
      .eq('asin', asin)
      .order('created_at', { ascending: false })
      .limit(20);

    const latestAlert = alerts?.[0];
    const alertData = latestAlert?.alert_data || {};

    const result = {
      asin: config.asin,
      sku: config.sku,
      title: alertData.title || config.asin,
      monitoring_enabled: config.monitoring_enabled,
      priority: config.priority,
      user_email: config.user_email,
      current_status: {
        has_buy_box: alertData.yourBuyBox || false,
        buy_box_winner: alertData.buyBoxWinner || 'Unknown',
        current_price: alertData.buyBoxPrice || null,
        our_price: alertData.yourPrice || null,
        competitor_count: alertData.offerCount || 0,
        last_checked: config.last_checked,
        check_count: config.check_count || 0
      },
      recent_alerts: alerts || [],
      pricing_history: history || [],
      summary: {
        total_alerts: alerts?.length || 0,
        alerts_24h: alerts?.filter(a =>
          new Date(a.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
        ).length || 0,
        last_alert: latestAlert?.created_at || null
      }
    };

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error fetching ASIN details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/buybox-status/stats
 * Get buy box monitoring statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    // Get total ASINs being monitored
    const { count: totalAsins, error: asinError } = await supabase
      .from('price_monitoring_config')
      .select('*', { count: 'exact', head: true })
      .eq('monitoring_enabled', true);

    if (asinError) throw asinError;

    // Get alerts in the specified period
    const { data: alerts, error: alertsError } = await supabase
      .from('price_monitoring_alerts')
      .select('*')
      .gte('created_at', startDate.toISOString());

    if (alertsError) throw alertsError;

    // Calculate statistics
    const stats = {
      monitoring: {
        total_asins: totalAsins || 0,
        period_days: parseInt(days)
      },
      alerts: {
        total: alerts?.length || 0,
        by_type: {},
        by_severity: {},
        by_day: {}
      }
    };

    // Group alerts by type and severity
    alerts?.forEach(alert => {
      // By type
      stats.alerts.by_type[alert.type] = (stats.alerts.by_type[alert.type] || 0) + 1;

      // By severity
      stats.alerts.by_severity[alert.severity] = (stats.alerts.by_severity[alert.severity] || 0) + 1;

      // By day
      const day = alert.created_at.split('T')[0];
      stats.alerts.by_day[day] = (stats.alerts.by_day[day] || 0) + 1;
    });

    res.json({
      success: true,
      stats,
      period: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
        days: parseInt(days)
      }
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/buybox-status/mark-alert-read/:id
 * Mark a specific alert as read
 */
router.post('/mark-alert-read/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('price_monitoring_alerts')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Alert marked as read'
    });

  } catch (error) {
    console.error('Error marking alert as read:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;