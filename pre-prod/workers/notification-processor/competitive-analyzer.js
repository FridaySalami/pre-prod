/**
 * Competitive Analyzer
 * Calculates severity and extracts competitive data from notifications
 * Based on logic from src/routes/buy-box-alerts/live/+page.svelte
 */

const logger = require('../shared/logger');

class CompetitiveAnalyzer {
  constructor() {
    this.yourSellerId = process.env.AMAZON_SELLER_ID || 'A2D8NG39VURSL3';
  }

  /**
   * Analyze notification and return competitive intelligence
   * @param {Object} notification - Parsed notification
   * @returns {Object} - Analysis results
   */
  analyze(notification) {
    const offerData = this.extractOfferData(notification);

    if (!offerData) {
      logger.debug('No offer data found in notification');
      return this.getDefaultAnalysis();
    }

    // Calculate severity using business logic
    const severity = this.calculateSeverity(offerData);

    return {
      severity,
      yourPrice: offerData.yourPrice,
      marketLow: offerData.marketLow,
      primeLow: offerData.primeLow,
      totalOffers: offerData.totalOffers,
      yourPosition: offerData.yourPosition,
      buyBoxWinner: offerData.buyBoxWinner
    };
  }

  /**
   * Extract offer data from notification
   * @param {Object} notification - Parsed notification
   * @returns {Object|null} - Offer data or null
   */
  extractOfferData(notification) {
    const payload = notification.payload || notification.Payload;

    if (!payload) {
      return null;
    }

    const offerChange = payload.anyOfferChangedNotification ||
      payload.AnyOfferChangedNotification;

    if (!offerChange) {
      return null;
    }

    // Get ASIN from OfferChangeTrigger
    const trigger = offerChange.offerChangeTrigger || offerChange.OfferChangeTrigger;
    const asin = trigger ? (trigger.asin || trigger.ASIN) : null;

    // Parse offers - they're directly in offerChange, not in summary
    const offers = offerChange.offers || offerChange.Offers || [];

    if (offers.length === 0) {
      return null;
    }

    // Find your offer
    const yourOffer = offers.find(o =>
      (o.sellerId || o.SellerId) === this.yourSellerId
    );

    // Find Prime offers
    const primeOffers = offers.filter(o =>
      o.isFulfilledByAmazon || o.IsFulfilledByAmazon
    );

    // Get prices
    const yourPrice = yourOffer ?
      parseFloat(yourOffer.listingPrice?.amount || yourOffer.ListingPrice?.Amount || 0) :
      null;

    const marketLow = offers[0] ?
      parseFloat(offers[0].listingPrice?.amount || offers[0].ListingPrice?.Amount || 0) :
      null;

    const primeLow = primeOffers[0] ?
      parseFloat(primeOffers[0].listingPrice?.amount || primeOffers[0].ListingPrice?.Amount || 0) :
      null;

    // Calculate position
    let yourPosition = null;
    if (yourOffer) {
      yourPosition = offers.findIndex(o =>
        (o.sellerId || o.SellerId) === this.yourSellerId
      ) + 1;
    }

    // Check Buy Box winner
    const buyBoxWinner = yourOffer ?
      (yourOffer.isBuyBoxWinner || yourOffer.IsBuyBoxWinner || false) :
      false;

    return {
      asin: asin,
      yourPrice,
      yourPosition,
      buyBoxWinner,
      marketLow,
      primeLow,
      totalOffers: offers.length
    };
  }

  /**
   * Calculate severity based on competitive situation
   * Based on getCompetitiveSeverity from dashboard
   * @param {Object} data - Offer data
   * @returns {string} - Severity level
   */
  calculateSeverity(data) {
    const { yourPrice, marketLow, yourPosition, totalOffers, buyBoxWinner } = data;

    // SUCCESS: You have the Buy Box or you're in top 3
    if (buyBoxWinner || (yourPosition && yourPosition <= 3)) {
      return 'success';
    }

    // INFO: No price data available
    if (!yourPrice || !marketLow) {
      return 'info';
    }

    // Calculate price gap percentage
    const gapPct = ((yourPrice - marketLow) / marketLow) * 100;

    // CRITICAL: Way off market + many competitors + poor position
    if (gapPct >= 50 && totalOffers >= 10 && yourPosition > 10) {
      logger.info('🚨 CRITICAL alert detected', {
        gapPct: gapPct.toFixed(2),
        totalOffers,
        yourPosition
      });
      return 'critical';
    }

    // HIGH: Significant gap with competition
    if (gapPct >= 20 && totalOffers >= 5) {
      logger.info('⚠️ HIGH severity detected', {
        gapPct: gapPct.toFixed(2),
        totalOffers
      });
      return 'high';
    }

    // WARNING: Minor issues
    if (gapPct >= 10 || totalOffers >= 3) {
      return 'warning';
    }

    // Default
    return 'info';
  }

  /**
   * Get default analysis when no data available
   * @returns {Object}
   */
  getDefaultAnalysis() {
    return {
      severity: 'info',
      yourPrice: null,
      marketLow: null,
      primeLow: null,
      totalOffers: 0,
      yourPosition: null,
      buyBoxWinner: false
    };
  }
}

module.exports = CompetitiveAnalyzer;
