/**
 * Get ASIN sales data using Amazon Reports API
 * This generates and downloads sales reports - much more efficient than parsing orders
 * Usage: node get-asin-sales-reports.cjs
 */

// Load environment variables from .env file
require('dotenv').config();

const axios = require('axios');
const crypto = require('crypto');

class AmazonReportsAPI {
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
   * Request a sales report (much more efficient than parsing orders)
   */
  async createSalesReport(startDate, endDate, reportType = 'GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL') {
    const accessToken = await this.getAccessToken();

    const method = 'POST';
    const path = '/reports/2021-06-30/reports';

    // Format dates
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);

    const requestBody = {
      reportType: reportType,
      marketplaceIds: [this.config.marketplace],
      dataStartTime: start.toISOString(),
      dataEndTime: end.toISOString()
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
      console.error(`Reports API error:`, error.response?.data || error.message);

      if (error.response?.status === 429) {
        throw new Error('RATE_LIMITED');
      } else if (error.response?.status === 403) {
        throw new Error('ACCESS_DENIED');
      } else {
        throw new Error(`REPORTS_API_ERROR: ${error.message}`);
      }
    }
  }

  /**
   * Check report status
   */
  async getReportStatus(reportId) {
    const accessToken = await this.getAccessToken();

    const method = 'GET';
    const path = `/reports/2021-06-30/reports/${reportId}`;
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
      console.error(`Report Status API error:`, error.response?.data || error.message);
      throw new Error(`REPORT_STATUS_ERROR: ${error.message}`);
    }
  }

  /**
   * Get list of available report types
   */
  async getReportTypes() {
    const accessToken = await this.getAccessToken();

    const method = 'GET';
    const path = '/reports/2021-06-30/reportTypes';
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
      console.error(`Report Types API error:`, error.response?.data || error.message);
      throw new Error(`REPORT_TYPES_ERROR: ${error.message}`);
    }
  }
}

async function getAsinSalesReports() {
  const asin = 'B07H1HW13V';

  try {
    console.log(`📊 Getting sales data via Reports API for ASIN: ${asin}`);
    console.log(`📋 This approach generates sales reports (more efficient than parsing orders)`);
    console.log('─'.repeat(70));

    // Initialize Amazon Reports API
    const reportsApi = new AmazonReportsAPI();

    // Calculate date range (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    console.log(`📊 Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    // First, let's see what report types are available
    console.log('\n🔍 Checking available report types...');
    try {
      const reportTypes = await reportsApi.getReportTypes();

      console.log('\n📋 AVAILABLE REPORT TYPES');
      console.log('─'.repeat(70));

      // Filter for sales/order related reports
      const salesReports = reportTypes.reportTypes?.filter(report =>
        report.name.toLowerCase().includes('order') ||
        report.name.toLowerCase().includes('sales') ||
        report.name.toLowerCase().includes('flat_file')
      ) || [];

      if (salesReports.length > 0) {
        salesReports.forEach(report => {
          console.log(`📊 ${report.name}`);
          console.log(`   Description: ${report.description || 'No description'}`);
          console.log(`   Processing Time: ${report.processingTime || 'Unknown'}`);
          console.log('');
        });
      } else {
        console.log('No sales-related reports found');
      }

      // Try to create a sales report
      console.log('\n🚀 Requesting sales report...');
      const reportRequest = await reportsApi.createSalesReport(
        startDate,
        endDate,
        'GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL'
      );

      console.log('\n📋 REPORT REQUEST SUBMITTED');
      console.log('─'.repeat(70));
      console.log(`Report ID: ${reportRequest.reportId}`);
      console.log(`Report Type: ${reportRequest.reportType}`);
      console.log(`Processing Status: ${reportRequest.processingStatus}`);
      console.log(`Created: ${reportRequest.createdTime}`);

      if (reportRequest.reportId) {
        console.log('\n⏳ Checking report status...');

        // Wait a bit and check status
        await new Promise(resolve => setTimeout(resolve, 2000));

        const status = await reportsApi.getReportStatus(reportRequest.reportId);
        console.log(`Status: ${status.processingStatus}`);

        if (status.processingStatus === 'DONE') {
          console.log(`✅ Report completed! Document ID: ${status.reportDocumentId}`);
          console.log('💡 You can now download this report to analyze ASIN sales');
        } else {
          console.log('⏳ Report is still processing. Check back later with the Report ID');
          console.log(`💡 Use the Report ID (${reportRequest.reportId}) to check status later`);
        }
      }

    } catch (error) {
      throw error;
    }

    console.log('\n✅ Reports API exploration completed!');
    console.log('\n💡 Benefits of Reports API:');
    console.log('   ✅ Much more efficient than parsing individual orders');
    console.log('   ✅ Can filter by date range');
    console.log('   ✅ Provides comprehensive sales data');
    console.log('   ✅ Less likely to hit rate limits');

  } catch (error) {
    console.error('\n❌ Error with Reports API:', error.message);

    if (error.message === 'RATE_LIMITED') {
      console.log('💡 Try again in a few minutes - Amazon has rate limits on API calls');
    } else if (error.message === 'ACCESS_DENIED') {
      console.log('💡 Check your Amazon SP-API credentials and permissions');
      console.log('💡 Reports API may require specific permissions in your SP-API app');
    } else {
      console.log('💡 This might indicate the Reports API is not available for your account');
    }

    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  getAsinSalesReports();
}

module.exports = { getAsinSalesReports, AmazonReportsAPI };
