/**
 * Test Brand Analytics and Selling Partner Insights API Access
 * This script tests various APIs that should be available with your new permissions
 * Usage: node test-brand-analytics-access.cjs
 */

// Load environment variables from .env file
require('dotenv').config();

const axios = require('axios');
const crypto = require('crypto');

class BrandAnalyticsChecker {
  constructor() {
    this.config = {
      clientId: process.env.AMAZON_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN,
      marketplace: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
      endpoint: 'https://sellingpartnerapi-eu.amazon.com',
      region: 'eu-west-1',
      accessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY
    };

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
      throw new Error('Failed to authenticate with Amazon SP-API');
    }
  }

  createSignature(method, path, queryParams, headers, body) {
    const service = 'execute-api';
    const host = 'sellingpartnerapi-eu.amazon.com';
    const region = this.config.region;

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

    const kDate = crypto.createHmac('sha256', `AWS4${this.config.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    const authorizationHeader = `${algorithm} Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      ...headers,
      'Authorization': authorizationHeader
    };
  }

  async testAPI(apiName, method, path, queryParams = {}, body = '') {
    const accessToken = await this.getAccessToken();

    const amzDate = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
    const headers = {
      'host': 'sellingpartnerapi-eu.amazon.com',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': crypto.createHash('sha256').update(body).digest('hex')
    };

    if (method === 'POST') {
      headers['content-type'] = 'application/json';
    }

    const signedHeaders = this.createSignature(method, path, queryParams, headers, body);

    let url = `${this.config.endpoint}${path}`;
    if (Object.keys(queryParams).length > 0) {
      url += '?' + Object.keys(queryParams)
        .map(key => `${key}=${encodeURIComponent(queryParams[key])}`)
        .join('&');
    }

    try {
      const config = {
        headers: signedHeaders,
        timeout: 30000
      };

      let response;
      if (method === 'POST') {
        response = await axios.post(url, JSON.parse(body || '{}'), config);
      } else {
        response = await axios.get(url, config);
      }

      return {
        success: true,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        status: error.response?.status || 0,
        error: error.response?.data || { message: error.message }
      };
    }
  }

  async runTests() {
    console.log('🧪 TESTING BRAND ANALYTICS & SELLING PARTNER INSIGHTS ACCESS');
    console.log('═'.repeat(80));
    console.log('Testing APIs that should be available with your new permissions...\n');

    const tests = [
      {
        name: 'Reports API - Get Report Types',
        description: 'Lists available report types (should include sales reports)',
        method: 'GET',
        path: '/reports/2021-06-30/reportTypes'
      },
      {
        name: 'Sales and Traffic Business Reports',
        description: 'Aggregated sales metrics by ASIN',
        method: 'POST',
        path: '/sales/v1/analytics/salesAndTraffic',
        body: JSON.stringify({
          reportSpecification: {
            reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
            dataStartTime: '2025-07-09',
            dataEndTime: '2025-07-16',
            granularity: { unit: 'DAILY' },
            groupBy: ['ASIN'],
            filters: { asins: ['B07H1HW13V'] },
            metrics: ['salesByAsin', 'sessionsPercentageByAsin']
          },
          marketplaceIds: [this.config.marketplace]
        })
      },
      {
        name: 'Brand Analytics - Search Terms',
        description: 'Top search terms performance',
        method: 'POST',
        path: '/brandAnalytics/v1/searchTerms',
        body: JSON.stringify({
          reportSpecification: {
            reportType: 'BRAND_ANALYTICS_SEARCH_TERMS_REPORT',
            dataStartTime: '2025-07-09',
            dataEndTime: '2025-07-16',
            granularity: { unit: 'WEEKLY' }
          },
          marketplaceIds: [this.config.marketplace]
        })
      },
      {
        name: 'Inventory Health Reports',
        description: 'Inventory health and sales velocity',
        method: 'GET',
        path: '/fba/inventory/v1/summaries',
        queryParams: {
          details: 'true',
          granularityType: 'Marketplace',
          granularityId: this.config.marketplace
        }
      },
      {
        name: 'Business Reports - Financial Events',
        description: 'Financial performance data',
        method: 'GET',
        path: '/finances/v0/financialEvents',
        queryParams: {
          PostedAfter: '2025-07-09T00:00:00Z',
          PostedBefore: '2025-07-16T23:59:59Z'
        }
      },
      {
        name: 'Catalog Items API',
        description: 'Product catalog with sales ranks',
        method: 'GET',
        path: '/catalog/2022-04-01/items/B07H1HW13V',
        queryParams: {
          marketplaceIds: this.config.marketplace,
          includedData: 'attributes,salesRanks,summaries'
        }
      }
    ];

    const results = [];

    for (const test of tests) {
      console.log(`🔍 Testing: ${test.name}`);
      console.log(`   ${test.description}`);

      const result = await this.testAPI(
        test.name,
        test.method,
        test.path,
        test.queryParams || {},
        test.body || ''
      );

      results.push({
        ...test,
        result
      });

      if (result.success) {
        console.log(`   ✅ SUCCESS (${result.status})`);
        if (result.data && Object.keys(result.data).length > 0) {
          console.log(`   📊 Data available: ${Object.keys(result.data).join(', ')}`);
        }
      } else {
        console.log(`   ❌ FAILED (${result.status}): ${result.error?.errors?.[0]?.message || result.error?.message || 'Unknown error'}`);
      }
      console.log('');

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary
    console.log('📊 SUMMARY OF API ACCESS');
    console.log('═'.repeat(80));

    const successful = results.filter(r => r.result.success);
    const failed = results.filter(r => !r.result.success);

    console.log(`✅ Successful APIs: ${successful.length}/${results.length}`);
    console.log(`❌ Failed APIs: ${failed.length}/${results.length}`);

    if (successful.length > 0) {
      console.log('\n🎉 AVAILABLE APIS:');
      successful.forEach(test => {
        console.log(`   ✅ ${test.name}`);
      });
    }

    if (failed.length > 0) {
      console.log('\n⚠️  UNAVAILABLE APIS:');
      failed.forEach(test => {
        const errorMsg = test.result.error?.errors?.[0]?.message || 'Access denied';
        console.log(`   ❌ ${test.name}: ${errorMsg}`);
      });
    }

    console.log('\n💡 NEXT STEPS:');
    if (successful.length === 0) {
      console.log('   🕐 Permissions may still be propagating (can take 24-48 hours)');
      console.log('   📞 Contact Amazon SP-API support if issues persist');
      console.log('   🔄 Try re-generating your refresh token');
    } else {
      console.log('   🚀 Use the successful APIs for your sales analytics!');
      console.log('   📊 Focus on the working APIs for now');
    }

    console.log('\n🔗 For manual sales data, use:');
    console.log('   📈 Seller Central → Reports → Business Reports');
    console.log('   💰 Seller Central → Reports → Payments');
    console.log('   📊 Seller Central → Brand Analytics (if available)');
  }
}

async function testBrandAnalyticsAccess() {
  try {
    const checker = new BrandAnalyticsChecker();
    await checker.runTests();
  } catch (error) {
    console.error('❌ Error testing API access:', error.message);
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  testBrandAnalyticsAccess();
}

module.exports = { testBrandAnalyticsAccess };
