/**
 * Amazon SP-API Integration for Buy Box Monitoring
 * 
 * This module handles real Amazon SP-API calls to get competitive pricing data
 * and transforms it into the format expected by our database schema.
 */

const crypto = require('crypto');

class AmazonSPAPI {
  constructor() {
    this.config = {
      clientId: process.env.AMAZON_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN,
      marketplace: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P', // UK marketplace
      endpoint: 'https://sellingpartnerapi-eu.amazon.com',
      region: 'eu-west-1',
      accessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY
    };

    // Validate required config
    const required = ['clientId', 'clientSecret', 'refreshToken', 'accessKeyId', 'secretAccessKey'];
    for (const key of required) {
      if (!this.config[key]) {
        throw new Error(`Missing required Amazon SP-API configuration: ${key}`);
      }
    }

    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get access token for SP-API calls
   */
  async getAccessToken() {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.config.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      });

      const response = await fetch('https://api.amazon.com/auth/o2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      this.accessToken = data.access_token;
      // Token expires in 1 hour, refresh 5 minutes early
      this.tokenExpiry = new Date(Date.now() + (data.expires_in - 300) * 1000);

      return this.accessToken;
    } catch (error) {
      console.error('Failed to get Amazon access token:', error.message);
      throw new Error('Failed to authenticate with Amazon SP-API');
    }
  }

  /**
   * Create AWS signature for SP-API request
   */
  createSignature(method, path, queryParams, headers, body) {
    const service = 'execute-api';
    const host = 'sellingpartnerapi-eu.amazon.com';
    const region = this.config.region;

    // Create canonical request
    const canonicalUri = path;
    const canonicalQueryString = Object.keys(queryParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');

    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map(key => `${key.toLowerCase()}:${headers[key]}`)
      .join('\n') + '\n';

    const signedHeaders = Object.keys(headers)
      .sort()
      .map(key => key.toLowerCase())
      .join(';');

    const payloadHash = crypto.createHash('sha256').update(body).digest('hex');

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const amzDate = headers['x-amz-date'];
    const dateStamp = amzDate.substr(0, 8);
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    // Calculate signature
    const kDate = crypto.createHmac('sha256', `AWS4${this.config.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    // Create authorization header
    const authorizationHeader = `${algorithm} Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      ...headers,
      'Authorization': authorizationHeader
    };
  }

  /**
   * Get competitive pricing data for an ASIN
   */
  async getCompetitivePricing(asin) {
    const accessToken = await this.getAccessToken();

    const method = 'GET';
    const path = `/products/pricing/v0/items/${asin}/offers`;
    const queryParams = {
      MarketplaceId: this.config.marketplace,
      ItemCondition: 'New'
    };

    const amzDate = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
    const headers = {
      'host': 'sellingpartnerapi-eu.amazon.com',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': crypto.createHash('sha256').update('').digest('hex')
    };

    // Create signed headers
    const signedHeaders = this.createSignature(method, path, queryParams, headers, '');

    const url = `${this.config.endpoint}${path}?${Object.keys(queryParams)
      .map(key => `${key}=${encodeURIComponent(queryParams[key])}`)
      .join('&')}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: signedHeaders,
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!response.ok) {
        // Check for specific error types
        if (response.status === 429) {
          throw new Error('RATE_LIMITED');
        } else if (response.status === 403) {
          throw new Error('ACCESS_DENIED');
        } else if (response.status === 404) {
          throw new Error('ASIN_NOT_FOUND');
        } else {
          const errorText = await response.text();
          throw new Error(`SP_API_ERROR: HTTP ${response.status}: ${errorText}`);
        }
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`SP-API error for ASIN ${asin}:`, error.message);

      // Re-throw known error types
      if (error.message.includes('RATE_LIMITED') ||
        error.message.includes('ACCESS_DENIED') ||
        error.message.includes('ASIN_NOT_FOUND')) {
        throw error;
      } else {
        throw new Error(`SP_API_ERROR: ${error.message}`);
      }
    }
  }

  /**
   * Transform SP-API pricing response into our database format
   */
  transformPricingData(pricingData, asin, sku, runId) {
    try {
      const offers = pricingData?.payload?.Offers || [];

      if (offers.length === 0) {
        throw new Error('No offers found for ASIN');
      }

      // Find Buy Box winner
      const buyBoxOffer = offers.find(offer => offer.IsBuyBoxWinner === true);

      // Check if YOU are the Buy Box winner
      const yourSellerId = process.env.YOUR_SELLER_ID || process.env.AMAZON_SELLER_ID;
      const isWinner = buyBoxOffer?.SellerId === yourSellerId;

      console.log(`ASIN ${asin}: Buy Box owned by ${buyBoxOffer?.SellerId}, Your ID: ${yourSellerId}, Winner: ${isWinner}`);

      // Get all competitor prices for analysis (excluding your offers)
      const competitorOffers = offers.filter(offer => offer.SellerId !== yourSellerId);
      const competitorPrices = competitorOffers.map(offer => ({
        price: offer.ListingPrice?.Amount || 0,
        shipping: offer.Shipping?.Amount || 0,
        total: (offer.ListingPrice?.Amount || 0) + (offer.Shipping?.Amount || 0)
      }));

      // Calculate metrics
      const lowestCompetitorPrice = competitorPrices.length > 0
        ? Math.min(...competitorPrices.map(p => p.total))
        : null;

      const buyBoxPrice = buyBoxOffer?.ListingPrice?.Amount || 0;
      const buyBoxShipping = buyBoxOffer?.Shipping?.Amount || 0;
      const buyBoxTotal = buyBoxPrice + buyBoxShipping;

      // Determine opportunity and winner status
      const isOpportunity = lowestCompetitorPrice && buyBoxTotal > lowestCompetitorPrice * 0.95; // 5% margin

      // Transform to match actual database schema
      return {
        run_id: runId,
        asin: asin,
        sku: sku,
        price: buyBoxPrice, // Database expects 'price', not 'buy_box_price'
        currency: buyBoxOffer?.ListingPrice?.CurrencyCode || 'GBP', // Database expects 'currency', not 'buy_box_currency'
        is_winner: isWinner,
        competitor_id: buyBoxOffer?.SellerId || null,
        competitor_name: buyBoxOffer?.SellerName || buyBoxOffer?.SellerId || 'Unknown',
        competitor_price: buyBoxPrice,
        marketplace: 'UK', // Default marketplace
        opportunity_flag: isOpportunity,
        min_profitable_price: 0.00, // Default value
        margin_at_buybox: 0.00, // Default value - would need cost data to calculate
        margin_percent_at_buybox: 0.00, // Default value - would need cost data to calculate  
        total_offers: offers.length,
        category: null, // Would need product API to get this
        brand: null, // Would need product API to get this
        captured_at: new Date().toISOString(),
        fulfillment_channel: buyBoxOffer?.IsFulfilledByAmazon ? 'AMAZON' : 'DEFAULT',
        merchant_shipping_group: 'UK Shipping', // Default value
        source: 'spapi', // Indicate this came from SP-API
        merchant_token: process.env.YOUR_SELLER_ID || 'unknown',
        buybox_merchant_token: buyBoxOffer?.SellerId || null
      };
    } catch (error) {
      console.error('Error transforming pricing data:', error);
      throw new Error(`Failed to transform pricing data: ${error.message}`);
    }
  }

  /**
   * Get Buy Box data for a single ASIN
   */
  async getBuyBoxData(asin, sku, runId) {
    try {
      console.log(`Fetching Buy Box data for ASIN: ${asin}, SKU: ${sku}`);

      const pricingData = await this.getCompetitivePricing(asin);
      const transformedData = this.transformPricingData(pricingData, asin, sku, runId);

      console.log(`Successfully processed ASIN ${asin}: Buy Box owned by ${transformedData.competitor_name}`);

      return transformedData;
    } catch (error) {
      console.error(`Failed to get Buy Box data for ASIN ${asin}:`, error);
      throw error;
    }
  }
}

module.exports = { AmazonSPAPI };
