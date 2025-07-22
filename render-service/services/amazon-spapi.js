/**
 * Amazon SP-API Integration for Buy Box Monitoring
 * 
 * This module handles real Amazon SP-API calls to get competitive pricing data
 * and transforms it into the format expected by our database schema.
 */

const axios = require('axios');
const crypto = require('crypto');
const CostCalculator = require('./cost-calculator');

class AmazonSPAPI {
  constructor(supabaseClient) {
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

    // Initialize cost calculator
    this.costCalculator = new CostCalculator(supabaseClient);
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
      const response = await axios.post('https://api.amazon.com/auth/o2/token', {
        grant_type: 'refresh_token',
        refresh_token: this.config.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      // Token expires in 1 hour, refresh 5 minutes early
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);

      return this.accessToken;
    } catch (error) {
      console.error('Failed to get Amazon access token:', error.response?.data || error.message);
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
      const response = await axios.get(url, {
        headers: signedHeaders,
        timeout: 30000 // 30 second timeout
      });

      return response.data;
    } catch (error) {
      console.error(`SP-API error for ASIN ${asin}:`, error.response?.data || error.message);

      // Check for specific error types
      if (error.response?.status === 429) {
        throw new Error('RATE_LIMITED');
      } else if (error.response?.status === 403) {
        throw new Error('ACCESS_DENIED');
      } else if (error.response?.status === 404) {
        throw new Error('ASIN_NOT_FOUND');
      } else if (error.response?.data?.errors?.[0]?.code === 'QuotaExceeded') {
        throw new Error('RATE_LIMITED');
      } else {
        throw new Error(`SP_API_ERROR: ${error.message}`);
      }
    }
  }

  /**
   * Transform SP-API pricing response into our database format
   */
  async transformPricingData(pricingData, asin, sku, runId, productTitle = null) {
    try {
      const offers = pricingData?.payload?.Offers || [];

      if (offers.length === 0) {
        throw new Error('No offers found for ASIN');
      }

      // Get your seller ID for comparison
      const yourSellerId = process.env.YOUR_SELLER_ID || process.env.AMAZON_SELLER_ID;

      // Find Buy Box winner
      const buyBoxOffer = offers.find(offer => offer.IsBuyBoxWinner === true);

      // Find YOUR current offer from competitive pricing
      const yourOfferFromApi = offers.find(offer => offer.SellerId === yourSellerId);

      // Get SKU-specific pricing from our listings data
      const { SupabaseService } = require('./supabase-client');
      const skuPricingData = await SupabaseService.getSkuPricing(sku);

      // Use SKU-specific pricing if available, otherwise fall back to API data
      let yourCurrentPrice;
      if (skuPricingData && skuPricingData.price > 0) {
        yourCurrentPrice = skuPricingData.price;
        console.log(`Using SKU-specific pricing for ${sku}: £${yourCurrentPrice}`);
      } else {
        yourCurrentPrice = yourOfferFromApi?.ListingPrice?.Amount || 0;
        console.log(`Using SP-API pricing for ${sku}: £${yourCurrentPrice}`);
      }

      // Get all competitor prices for analysis
      const competitorPrices = offers
        .filter(offer => !offer.IsBuyBoxWinner)
        .map(offer => ({
          sellerId: offer.SellerId,
          price: offer.ListingPrice?.Amount || 0,
          shipping: offer.Shipping?.Amount || 0,
          total: (offer.ListingPrice?.Amount || 0) + (offer.Shipping?.Amount || 0)
        }));

      // Calculate metrics
      const lowestCompetitorPrice = competitorPrices.length > 0
        ? Math.min(...competitorPrices.map(p => p.total))
        : null;

      // Buy Box pricing
      const buyBoxPrice = buyBoxOffer?.ListingPrice?.Amount || 0;
      const buyBoxShipping = buyBoxOffer?.Shipping?.Amount || 0;
      const buyBoxTotal = buyBoxPrice + buyBoxShipping;

      // Your current shipping (use API data for shipping costs)
      const yourCurrentShipping = yourOfferFromApi?.Shipping?.Amount || 0;
      const yourCurrentTotal = yourCurrentPrice + yourCurrentShipping;

      // Determine winner status and opportunity
      // Winner is determined by Amazon's Buy Box algorithm, not price matching
      const isWinner = buyBoxOffer?.SellerId === yourSellerId;
      const isOpportunity = lowestCompetitorPrice && buyBoxTotal > lowestCompetitorPrice * 0.95; // 5% margin

      // Calculate price gap (real gap between your SKU price and Buy Box price)
      const priceGap = yourCurrentPrice - buyBoxPrice;

      console.log(`Buy Box analysis for ${asin}: Your ID: ${yourSellerId}, Buy Box Owner: ${buyBoxOffer?.SellerId}, Winner: ${isWinner}`);
      console.log(`Price Gap Debug - Your: ${yourCurrentPrice} (${typeof yourCurrentPrice}), BuyBox: ${buyBoxPrice} (${typeof buyBoxPrice}), Gap: ${priceGap} (${typeof priceGap})`);
      console.log(`Pricing for ${asin}: Your Price: £${yourCurrentPrice}, Buy Box Price: £${buyBoxPrice}, Gap: £${priceGap.toFixed(2)}`);

      return {
        run_id: runId,
        asin: asin,
        sku: sku,
        // product_title: productTitle, // REMOVED - no longer saving to buybox_data to reduce response size

        // Essential pricing fields
        price: yourCurrentPrice || buyBoxPrice, // Fallback to buy box price if your offer not found
        is_winner: isWinner,
        competitor_id: buyBoxOffer?.SellerId || null,
        competitor_name: buyBoxOffer?.SellerName || 'Unknown',
        competitor_price: buyBoxPrice,
        opportunity_flag: isOpportunity,
        total_offers: offers.length,
        captured_at: new Date().toISOString(),
        merchant_token: yourSellerId,
        buybox_merchant_token: buyBoxOffer?.SellerId || null,

        // Enhanced pricing clarity fields
        your_current_price: yourCurrentPrice,
        your_current_shipping: yourCurrentShipping,
        your_current_total: yourCurrentTotal,
        buybox_price: buyBoxPrice,
        buybox_shipping: buyBoxShipping,
        buybox_total: buyBoxTotal,
        price_gap: parseFloat(priceGap.toFixed(2)),
        price_gap_percentage: yourCurrentPrice > 0 ? parseFloat(((priceGap / yourCurrentPrice) * 100).toFixed(2)) : 0,
        pricing_status: isWinner ? 'winning_buybox' : (priceGap > 0 ? 'priced_above_buybox' : 'priced_below_buybox'),
        your_offer_found: !!yourOfferFromApi,

        // REMOVED to reduce payload size (not used by frontend):
        // currency: buyBoxOffer?.ListingPrice?.CurrencyCode || 'GBP',
        // marketplace: 'UK',
        // min_profitable_price: buyBoxPrice * 0.8,
        // margin_at_buybox: buyBoxPrice * 0.3,
        // margin_percent_at_buybox: 0.3,
        // category: 'Unknown',
        // brand: 'Unknown',
        // fulfillment_channel: buyBoxOffer?.IsFulfilledByAmazon ? 'AMAZON' : 'DEFAULT',
        // merchant_shipping_group: 'UK Shipping',
        // source: 'sp-api'
      };
    } catch (error) {
      console.error('Error transforming pricing data:', error);
      throw new Error(`Failed to transform pricing data: ${error.message}`);
    }
  }

  /**
   * Get Buy Box data for a single ASIN with intelligent retry
   */
  async getBuyBoxData(asin, sku, runId, rateLimiter = null) {
    const maxRetries = 3; // Maximum number of retries for rate limiting (3 total attempts)
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Fetching Buy Box data for ASIN: ${asin}, SKU: ${sku}${attempt > 0 ? ` (retry ${attempt}/${maxRetries})` : ''}`);

        // Get product title from sku_asin_mapping table
        let productTitle = null;
        try {
          const { SupabaseService } = require('./supabase-client');
          productTitle = await SupabaseService.getProductTitle(sku, asin);
          console.log(`Product title for ${sku}/${asin}: ${productTitle || 'Not found'}`);
        } catch (titleError) {
          console.warn(`Failed to fetch product title for ${sku}/${asin}:`, titleError.message);
          // Fallback to placeholder
          productTitle = `Product ${asin}`;
        }

        const pricingData = await this.getCompetitivePricing(asin);
        const transformedData = await this.transformPricingData(pricingData, asin, sku, runId, productTitle);

        // Enrich with cost calculator data for margin analysis
        const enrichedData = await this.costCalculator.enrichBuyBoxData(transformedData);

        // Notify rate limiter of success
        if (rateLimiter) {
          rateLimiter.onRequestSuccess();
        }

        console.log(`Successfully processed ASIN ${asin}: Buy Box owned by ${enrichedData.competitor_name || 'Unknown'}, margin: ${enrichedData.margin_percent_at_buybox_price || 0}%`);

        return enrichedData;

      } catch (error) {
        lastError = error;

        // If this is a rate limiting error and we have retries left
        if (error.message === 'RATE_LIMITED' && attempt < maxRetries) {
          if (rateLimiter) {
            rateLimiter.onRateLimited();
            await rateLimiter.sleepForRetry(); // Sleep for the retry delay
          } else {
            // Fallback sleep if no rate limiter
            console.log(`😴 Rate limited, sleeping 4s before retry ${attempt + 1}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, 4000));
          }
          continue; // Try again
        }

        // If not a rate limiting error, or we're out of retries, break
        break;
      }
    }

    // If we get here, all retries failed
    if (lastError?.message === 'RATE_LIMITED' && rateLimiter) {
      rateLimiter.onRateLimited(); // Record the final failure
    }

    console.error(`Failed to get Buy Box data for ASIN ${asin} after ${maxRetries + 1} attempts:`, lastError);
    throw lastError;
  }

  /**
   * Get orders data for sales analysis
   */
  async getOrders(startDate, endDate = null, maxResults = 50) {
    const accessToken = await this.getAccessToken();

    const method = 'GET';
    const path = '/orders/v0/orders';

    // Set date range (default to last 30 days if no endDate provided)
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : new Date();

    const queryParams = {
      MarketplaceIds: this.config.marketplace,
      CreatedAfter: start.toISOString(),
      CreatedBefore: end.toISOString(),
      MaxResultsPerPage: Math.min(maxResults, 100) // Amazon limit is 100
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
      const response = await axios.get(url, {
        headers: signedHeaders,
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      console.error(`Orders API error:`, error.response?.data || error.message);

      if (error.response?.status === 429) {
        throw new Error('RATE_LIMITED');
      } else if (error.response?.status === 403) {
        throw new Error('ACCESS_DENIED');
      } else {
        throw new Error(`ORDERS_API_ERROR: ${error.message}`);
      }
    }
  }

  /**
   * Get order items for a specific order (to get SKU sales data)
   */
  async getOrderItems(orderId) {
    const accessToken = await this.getAccessToken();

    const method = 'GET';
    const path = `/orders/v0/orders/${orderId}/orderItems`;
    const queryParams = {};

    const amzDate = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
    const headers = {
      'host': 'sellingpartnerapi-eu.amazon.com',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': crypto.createHash('sha256').update('').digest('hex')
    };

    // Create signed headers
    const signedHeaders = this.createSignature(method, path, queryParams, headers, '');

    const url = `${this.config.endpoint}${path}`;

    try {
      const response = await axios.get(url, {
        headers: signedHeaders,
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      console.error(`Order Items API error for order ${orderId}:`, error.response?.data || error.message);

      if (error.response?.status === 429) {
        throw new Error('RATE_LIMITED');
      } else if (error.response?.status === 403) {
        throw new Error('ACCESS_DENIED');
      } else {
        throw new Error(`ORDER_ITEMS_API_ERROR: ${error.message}`);
      }
    }
  }

  /**
   * Get sales data for a specific SKU or ASIN over a date range
   */
  async getSalesDataBySkuOrAsin(skuOrAsin, startDate, endDate = null, maxOrders = 100) {
    try {
      console.log(`📊 Getting sales data for ${skuOrAsin} from ${startDate} to ${endDate || 'now'}`);

      // Get orders in the date range
      const ordersResponse = await this.getOrders(startDate, endDate, maxOrders);
      const orders = ordersResponse?.payload?.Orders || [];

      if (orders.length === 0) {
        return {
          sku_or_asin: skuOrAsin,
          date_range: { start: startDate, end: endDate },
          total_quantity_sold: 0,
          total_revenue: 0,
          total_orders: 0,
          orders: [],
          summary: 'No orders found in date range'
        };
      }

      console.log(`Found ${orders.length} orders, checking for SKU/ASIN ${skuOrAsin}...`);

      let totalQuantity = 0;
      let totalRevenue = 0;
      let matchingOrders = [];

      // Check each order for our SKU/ASIN
      for (const order of orders) {
        try {
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));

          const orderItemsResponse = await this.getOrderItems(order.AmazonOrderId);
          const orderItems = orderItemsResponse?.payload?.OrderItems || [];

          // Find items matching our SKU/ASIN
          const matchingItems = orderItems.filter(item =>
            item.SellerSKU === skuOrAsin ||
            item.ASIN === skuOrAsin
          );

          if (matchingItems.length > 0) {
            for (const item of matchingItems) {
              const quantity = parseInt(item.QuantityOrdered) || 0;
              const itemPrice = parseFloat(item.ItemPrice?.Amount) || 0;

              totalQuantity += quantity;
              totalRevenue += itemPrice;

              matchingOrders.push({
                order_id: order.AmazonOrderId,
                order_date: order.PurchaseDate,
                sku: item.SellerSKU,
                asin: item.ASIN,
                product_name: item.Title,
                quantity: quantity,
                unit_price: itemPrice / quantity,
                total_price: itemPrice,
                currency: item.ItemPrice?.CurrencyCode || 'GBP'
              });
            }
          }
        } catch (error) {
          console.warn(`Failed to get order items for ${order.AmazonOrderId}:`, error.message);
          continue;
        }
      }

      const salesSummary = {
        sku_or_asin: skuOrAsin,
        date_range: {
          start: startDate,
          end: endDate || new Date().toISOString().split('T')[0]
        },
        total_quantity_sold: totalQuantity,
        total_revenue: parseFloat(totalRevenue.toFixed(2)),
        total_orders: matchingOrders.length,
        average_order_value: matchingOrders.length > 0 ? parseFloat((totalRevenue / matchingOrders.length).toFixed(2)) : 0,
        orders: matchingOrders,
        summary: `Found ${totalQuantity} units sold across ${matchingOrders.length} orders, total revenue: £${totalRevenue.toFixed(2)}`
      };

      console.log(`📈 Sales Summary for ${skuOrAsin}: ${totalQuantity} units, £${totalRevenue.toFixed(2)} revenue`);

      return salesSummary;

    } catch (error) {
      console.error('Error getting sales data:', error);
      throw new Error(`Failed to get sales data: ${error.message}`);
    }
  }
}

module.exports = { AmazonSPAPI };
