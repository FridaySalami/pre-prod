/**
 * Get ASIN sales data using Amazon Sales and Traffic API (Much more efficient!)
 * This uses the proper sales analytics API instead of parsing individual orders
 * Usage: node get-asin-sales-analytics.cjs
 */

// Load environment variables from .env file
require('dotenv').config();

const axios = require('axios');
const crypto = require('crypto');

class AmazonSalesAnalytics {
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

  /**
   * Get Sales and Traffic Analytics for ASINs (MUCH more efficient!)
   * This is the proper way to get sales data from Amazon
   */
  async getSalesAndTrafficByAsin(asins, startDate, endDate, granularity = 'DAILY') {
    const accessToken = await this.getAccessToken();

    const method = 'POST';
    const path = '/sales/v1/analytics/salesAndTraffic';

    // Ensure dates are properly formatted
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);

    const requestBody = {
      reportSpecification: {
        reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
        dataStartTime: start.toISOString().split('T')[0], // YYYY-MM-DD format
        dataEndTime: end.toISOString().split('T')[0],
        granularity: {
          unit: granularity // DAILY, WEEKLY, MONTHLY
        },
        groupBy: ['ASIN'], // Group by ASIN to get per-ASIN metrics
        filters: {
          asins: Array.isArray(asins) ? asins : [asins]
        },
        metrics: [
          'salesByAsin',
          'sessionsPercentageByAsin',
          'pageViewsByAsin',
          'sessionsByAsin',
          'buyBoxPercentageByAsin',
          'unitSessionPercentageByAsin'
        ]
      },
      marketplaceIds: [this.config.marketplace]
    };

    const amzDate = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
    const headers = {
      'host': 'sellingpartnerapi-eu.amazon.com',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate,
      'content-type': 'application/json',
      'x-amz-content-sha256': crypto.createHash('sha256').update(JSON.stringify(requestBody)).digest('hex')
    };

    const signedHeaders = this.createSignature(method, path, {}, headers, JSON.stringify(requestBody));

    const url = `${this.config.endpoint}${path}`;

    try {
      const response = await axios.post(url, requestBody, {
        headers: signedHeaders,
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      console.error(`Sales Analytics API error:`, error.response?.data || error.message);

      if (error.response?.status === 429) {
        throw new Error('RATE_LIMITED');
      } else if (error.response?.status === 403) {
        throw new Error('ACCESS_DENIED');
      } else if (error.response?.status === 400) {
        console.log('API Response:', error.response?.data);
        throw new Error(`INVALID_REQUEST: ${JSON.stringify(error.response?.data)}`);
      } else {
        throw new Error(`SALES_API_ERROR: ${error.message}`);
      }
    }
  }

  /**
   * Get Inventory Summary (shows recent sales velocity)
   */
  async getInventorySummary(asin) {
    const accessToken = await this.getAccessToken();

    const method = 'GET';
    const path = '/fba/inventory/v1/summaries';
    const queryParams = {
      details: true,
      granularityType: 'Marketplace',
      granularityId: this.config.marketplace,
      startDateTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
      sellerSkus: asin // Can also use ASIN here
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
      console.error(`Inventory API error:`, error.response?.data || error.message);

      if (error.response?.status === 429) {
        throw new Error('RATE_LIMITED');
      } else if (error.response?.status === 403) {
        throw new Error('ACCESS_DENIED');
      } else {
        throw new Error(`INVENTORY_API_ERROR: ${error.message}`);
      }
    }
  }
}

async function getAsinSalesAnalytics() {
  const asin = 'B07H1HW13V';

  try {
    console.log(`📊 Getting sales analytics for ASIN: ${asin}`);
    console.log(`📅 Using Amazon Sales & Traffic API (much more efficient!)`);
    console.log('─'.repeat(60));

    // Initialize Amazon Sales Analytics
    const salesApi = new AmazonSalesAnalytics();

    // Calculate date range (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    console.log(`📊 Fetching analytics from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}...`);

    // Try Sales and Traffic API first
    try {
      console.log('🔍 Trying Sales and Traffic API...');
      const salesData = await salesApi.getSalesAndTrafficByAsin(
        asin,
        startDate,
        endDate,
        'DAILY'
      );

      console.log('\n📈 SALES & TRAFFIC ANALYTICS');
      console.log('─'.repeat(60));
      console.log('Sales Data:', JSON.stringify(salesData, null, 2));

    } catch (salesError) {
      console.log(`⚠️  Sales API failed: ${salesError.message}`);

      // Fallback to Inventory API
      console.log('\n🔍 Trying Inventory Summary API as fallback...');
      try {
        const inventoryData = await salesApi.getInventorySummary(asin);

        console.log('\n📦 INVENTORY SUMMARY');
        console.log('─'.repeat(60));
        console.log('Inventory Data:', JSON.stringify(inventoryData, null, 2));

      } catch (inventoryError) {
        console.log(`⚠️  Inventory API also failed: ${inventoryError.message}`);
        throw new Error('Both sales analytics APIs failed');
      }
    }

    console.log('\n✅ Analytics lookup completed!');

  } catch (error) {
    console.error('\n❌ Error fetching sales analytics:', error.message);

    if (error.message === 'RATE_LIMITED') {
      console.log('💡 Try again in a few minutes - Amazon has rate limits on API calls');
    } else if (error.message === 'ACCESS_DENIED') {
      console.log('💡 Check your Amazon SP-API credentials and permissions');
      console.log('💡 Sales Analytics APIs may require additional permissions in your SP-API app');
    } else if (error.message.includes('Missing required Amazon SP-API configuration')) {
      console.log('💡 Make sure all required environment variables are set');
    } else if (error.message.includes('INVALID_REQUEST')) {
      console.log('💡 This API might not be available for your account or marketplace');
      console.log('💡 Sales Analytics requires Brand Registry or Vendor Central access');
    }

    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  getAsinSalesAnalytics();
}

module.exports = { getAsinSalesAnalytics, AmazonSalesAnalytics };
