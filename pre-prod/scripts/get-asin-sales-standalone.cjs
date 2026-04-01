/**
 * Get sales data for a specific ASIN for the last 7 days (Standalone Version)
 * This version doesn't require Supabase - just Amazon SP-API credentials
 * Usage: node get-asin-sales-standalone.cjs
 */

// Load environment variables from .env file
require('dotenv').config();

const axios = require('axios');
const crypto = require('crypto');

class StandaloneAmazonSPAPI {
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
        throw new Error(`Missing required Amazon SP-API configuration: ${key.toUpperCase()}`);
      }
    }

    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
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
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);

      return this.accessToken;
    } catch (error) {
      console.error('Failed to get Amazon access token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Amazon SP-API');
    }
  }

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

  async getOrders(startDate, endDate = null, maxResults = 50) {
    const accessToken = await this.getAccessToken();

    const method = 'GET';
    const path = '/orders/v0/orders';

    // Set date range
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    // Amazon requires CreatedBefore to be at least 2 minutes before current time
    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
    const end = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : twoMinutesAgo;

    // Ensure end date is at least 2 minutes before now
    const finalEndDate = end > twoMinutesAgo ? twoMinutesAgo : end;

    const queryParams = {
      MarketplaceIds: this.config.marketplace,
      CreatedAfter: start.toISOString(),
      CreatedBefore: finalEndDate.toISOString(),
      MaxResultsPerPage: Math.min(maxResults, 100)
    };

    const amzDate = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
    const headers = {
      'host': 'sellingpartnerapi-eu.amazon.com',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': crypto.createHash('sha256').update('').digest('hex')
    };

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

  async getSalesDataBySkuOrAsin(skuOrAsin, startDate, endDate = null, maxOrders = 100) {
    try {
      console.log(`📊 Getting sales data for ${skuOrAsin} from ${startDate} to ${endDate || 'now'}`);

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

      for (const order of orders) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting

          const orderItemsResponse = await this.getOrderItems(order.AmazonOrderId);
          const orderItems = orderItemsResponse?.payload?.OrderItems || [];

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

async function getAsinSalesData() {
  const asin = 'B07H1HW13V';

  try {
    console.log(`🔍 Looking up sales data for ASIN: ${asin}`);
    console.log(`📅 Date range: Last 7 days`);
    console.log('─'.repeat(60));

    // Initialize Amazon SP-API
    const amazonApi = new StandaloneAmazonSPAPI();

    // Calculate date range (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    console.log(`📊 Fetching sales data from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}...`);

    // Get sales data for the ASIN
    const salesData = await amazonApi.getSalesDataBySkuOrAsin(
      asin,
      startDate.toISOString(),
      endDate.toISOString(),
      200 // Max orders to check
    );

    // Display results
    console.log('\n📈 SALES SUMMARY');
    console.log('─'.repeat(60));
    console.log(`ASIN: ${salesData.sku_or_asin}`);
    console.log(`Period: ${salesData.date_range.start.split('T')[0]} to ${salesData.date_range.end}`);
    console.log(`Total Units Sold: ${salesData.total_quantity_sold}`);
    console.log(`Total Revenue: £${salesData.total_revenue}`);
    console.log(`Total Orders: ${salesData.total_orders}`);
    console.log(`Average Order Value: £${salesData.average_order_value}`);
    console.log(`\n${salesData.summary}`);

    if (salesData.orders.length > 0) {
      console.log('\n📋 ORDER DETAILS');
      console.log('─'.repeat(60));

      salesData.orders.forEach((order, index) => {
        console.log(`\n${index + 1}. Order ID: ${order.order_id}`);
        console.log(`   Date: ${order.order_date.split('T')[0]}`);
        console.log(`   SKU: ${order.sku}`);
        console.log(`   Product: ${order.product_name}`);
        console.log(`   Quantity: ${order.quantity}`);
        console.log(`   Unit Price: £${order.unit_price.toFixed(2)}`);
        console.log(`   Total: £${order.total_price.toFixed(2)}`);
      });
    } else {
      console.log('\n❌ No sales found for this ASIN in the last 7 days');
    }

    console.log('\n✅ Sales data lookup completed successfully!');

  } catch (error) {
    console.error('\n❌ Error fetching sales data:', error.message);

    if (error.message === 'RATE_LIMITED') {
      console.log('💡 Try again in a few minutes - Amazon has rate limits on API calls');
    } else if (error.message === 'ACCESS_DENIED') {
      console.log('💡 Check your Amazon SP-API credentials in environment variables');
    } else if (error.message.includes('Missing required Amazon SP-API configuration')) {
      console.log('💡 Make sure all required environment variables are set:');
      console.log('   - AMAZON_CLIENT_ID');
      console.log('   - AMAZON_CLIENT_SECRET');
      console.log('   - AMAZON_REFRESH_TOKEN');
      console.log('   - AMAZON_AWS_ACCESS_KEY_ID');
      console.log('   - AMAZON_AWS_SECRET_ACCESS_KEY');
    }

    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  getAsinSalesData();
}

module.exports = { getAsinSalesData, StandaloneAmazonSPAPI };
