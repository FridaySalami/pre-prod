/**
 * Monitor SP-API permissions propagation
 * Run this periodically to check when enhanced permissions become active
 * Usage: node monitor-spapi-permissions.cjs
 */

require('dotenv').config();

const axios = require('axios');
const crypto = require('crypto');

class SPAPIPermissionMonitor {
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

  async quickPermissionCheck() {
    console.log(`⏰ SP-API Permission Check - ${new Date().toISOString()}`);
    console.log('═'.repeat(60));

    // Test just the most important APIs quickly
    const quickTests = [
      {
        name: 'Reports API',
        emoji: '📊',
        method: 'GET',
        path: '/reports/2021-06-30/reportTypes'
      },
      {
        name: 'Sales Analytics',
        emoji: '📈',
        method: 'POST',
        path: '/sales/v1/analytics/salesAndTraffic',
        body: JSON.stringify({
          reportSpecification: {
            reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
            dataStartTime: '2025-07-15',
            dataEndTime: '2025-07-16',
            granularity: { unit: 'DAILY' }
          },
          marketplaceIds: [this.config.marketplace]
        })
      },
      {
        name: 'Catalog API',
        emoji: '📋',
        method: 'GET',
        path: '/catalog/2022-04-01/items/B07H1HW13V',
        queryParams: {
          marketplaceIds: this.config.marketplace,
          includedData: 'summaries'
        }
      }
    ];

    let successCount = 0;
    const results = [];

    for (const test of quickTests) {
      try {
        const accessToken = await this.getAccessToken();
        const amzDate = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
        const headers = {
          'host': 'sellingpartnerapi-eu.amazon.com',
          'x-amz-access-token': accessToken,
          'x-amz-date': amzDate,
          'x-amz-content-sha256': crypto.createHash('sha256').update(test.body || '').digest('hex')
        };

        if (test.method === 'POST') {
          headers['content-type'] = 'application/json';
        }

        const signedHeaders = this.createSignature(
          test.method,
          test.path,
          test.queryParams || {},
          headers,
          test.body || ''
        );

        let url = `${this.config.endpoint}${test.path}`;
        if (test.queryParams && Object.keys(test.queryParams).length > 0) {
          url += '?' + Object.keys(test.queryParams)
            .map(key => `${key}=${encodeURIComponent(test.queryParams[key])}`)
            .join('&');
        }

        const config = { headers: signedHeaders, timeout: 10000 };

        if (test.method === 'POST') {
          await axios.post(url, JSON.parse(test.body || '{}'), config);
        } else {
          await axios.get(url, config);
        }

        console.log(`${test.emoji} ${test.name}: ✅ WORKING!`);
        successCount++;
        results.push({ name: test.name, status: 'success' });

      } catch (error) {
        const status = error.response?.status || 0;
        const message = error.response?.data?.errors?.[0]?.message || 'Access denied';
        console.log(`${test.emoji} ${test.name}: ❌ ${status} - ${message}`);
        results.push({ name: test.name, status: 'failed', error: message });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('─'.repeat(60));
    console.log(`📊 Results: ${successCount}/${quickTests.length} APIs working`);

    if (successCount > 0) {
      console.log('🎉 SOME PERMISSIONS ARE ACTIVE!');
      console.log('🚀 You can now start using the working APIs for sales analytics!');

      if (successCount === quickTests.length) {
        console.log('🌟 ALL ENHANCED APIs ARE NOW WORKING!');
        console.log('💡 Run: node get-asin-sales-analytics.cjs');
      }
    } else {
      console.log('⏳ Still waiting for permissions to propagate...');
      console.log('💡 Typical wait time: 2-24 hours after adding IAM policies');
    }

    return { successCount, total: quickTests.length, results };
  }
}

async function monitorPermissions() {
  try {
    const monitor = new SPAPIPermissionMonitor();
    await monitor.quickPermissionCheck();

    console.log('\n⚡ QUICK TIP WHILE WAITING:');
    console.log('For immediate sales data for ASIN B07H1HW13V:');
    console.log('1. 🌐 Go to Amazon Seller Central');
    console.log('2. 📊 Reports → Business Reports');
    console.log('3. 📋 Select "Detail Page Sales and Traffic by ASIN"');
    console.log('4. 🎯 Filter by ASIN: B07H1HW13V');
    console.log('5. 📅 Set date range: Last 7 days');
    console.log('6. ⬇️  Download the report');

  } catch (error) {
    console.error('❌ Error monitoring permissions:', error.message);
  }
}

if (require.main === module) {
  monitorPermissions();
}

module.exports = { monitorPermissions };
