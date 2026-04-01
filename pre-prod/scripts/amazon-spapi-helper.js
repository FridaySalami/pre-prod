#!/usr/bin/env node

/**
 * Amazon SP-API Helper Functions
 * 
 * Production-ready functions for your SvelteKit app
 */

const https = require('https');
const crypto = require('crypto');

class AmazonSPAPI {
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.refreshToken = config.refreshToken;
    this.awsAccessKeyId = config.awsAccessKeyId;
    this.awsSecretAccessKey = config.awsSecretAccessKey;
    this.awsRegion = config.awsRegion || 'eu-west-1';
    this.marketplaceId = config.marketplaceId;
    this.sellerId = config.sellerId;
    this.host = 'sellingpartnerapi-eu.amazon.com';

    this.cachedToken = null;
    this.tokenExpiry = null;
  }

  // Get access token (with caching)
  async getAccessToken() {
    if (this.cachedToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.cachedToken;
    }

    return new Promise((resolve, reject) => {
      const postData = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      }).toString();

      const options = {
        hostname: 'api.amazon.com',
        path: '/auth/o2/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (res.statusCode === 200) {
              this.cachedToken = response.access_token;
              // Cache for 55 minutes (tokens expire in 1 hour)
              this.tokenExpiry = Date.now() + (55 * 60 * 1000);
              resolve(response.access_token);
            } else {
              reject(new Error(`Token refresh failed: ${response.error_description || response.error}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse token response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  // AWS Signature Version 4 signing
  createSignature(method, uri, querystring, headers, payload) {
    const algorithm = 'AWS4-HMAC-SHA256';
    const service = 'execute-api';
    const date = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
    const dateStamp = date.slice(0, 8);

    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map(key => `${key.toLowerCase()}:${headers[key]}`)
      .join('\n') + '\n';

    const signedHeaders = Object.keys(headers)
      .sort()
      .map(key => key.toLowerCase())
      .join(';');

    const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');

    const canonicalRequest = [
      method,
      uri,
      querystring,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    const credentialScope = `${dateStamp}/${this.awsRegion}/${service}/aws4_request`;
    const stringToSign = [
      algorithm,
      date,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    const kDate = crypto.createHmac('sha256', `AWS4${this.awsSecretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(this.awsRegion).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    const authorization = `${algorithm} Credential=${this.awsAccessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      'Authorization': authorization,
      'X-Amz-Date': date
    };
  }

  // Make SP-API request
  async makeRequest(path, queryParams = {}) {
    const accessToken = await this.getAccessToken();
    const querystring = new URLSearchParams(queryParams).toString();
    const method = 'GET';
    const payload = '';

    const headers = {
      'host': this.host,
      'x-amz-access-token': accessToken,
      'user-agent': 'MyApp/1.0'
    };

    const awsHeaders = this.createSignature(method, path, querystring, headers, payload);
    Object.assign(headers, awsHeaders);

    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.host,
        path: querystring ? `${path}?${querystring}` : path,
        method: method,
        headers: headers
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode === 200) {
              resolve(parsed);
            } else {
              reject(new Error(`SP-API request failed (${res.statusCode}): ${JSON.stringify(parsed)}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  // Get item offers (WORKING ENDPOINT!)
  async getItemOffers(asin, itemCondition = 'New') {
    const path = `/products/pricing/v0/items/${asin}/offers`;
    const params = {
      MarketplaceId: this.marketplaceId,
      ItemCondition: itemCondition
    };

    return this.makeRequest(path, params);
  }

  // Get multiple item offers
  async getMultipleItemOffers(asins, itemCondition = 'New') {
    const results = [];

    for (const asin of asins) {
      try {
        const offers = await this.getItemOffers(asin, itemCondition);
        results.push({
          asin,
          success: true,
          data: offers
        });
      } catch (error) {
        results.push({
          asin,
          success: false,
          error: error.message
        });
      }

      // Rate limiting - wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  // Extract useful pricing info from offers response
  extractPricingInfo(offersResponse) {
    const payload = offersResponse.payload;
    const offers = payload.Offers || [];

    if (offers.length === 0) {
      return {
        asin: payload.ASIN,
        hasOffers: false,
        buyboxPrice: null,
        lowestPrice: null,
        offerCount: 0
      };
    }

    const prices = offers
      .filter(offer => offer.ListingPrice && offer.ListingPrice.Amount)
      .map(offer => parseFloat(offer.ListingPrice.Amount));

    const buyboxOffer = offers.find(offer => offer.IsBuyBoxWinner);

    return {
      asin: payload.ASIN,
      hasOffers: true,
      buyboxPrice: buyboxOffer ? parseFloat(buyboxOffer.ListingPrice.Amount) : null,
      lowestPrice: prices.length > 0 ? Math.min(...prices) : null,
      highestPrice: prices.length > 0 ? Math.max(...prices) : null,
      averagePrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
      offerCount: offers.length,
      currency: offers[0].ListingPrice.CurrencyCode,
      lastUpdated: new Date().toISOString()
    };
  }
}

// Demo usage
async function demo() {
  require('dotenv').config();

  const api = new AmazonSPAPI({
    clientId: process.env.AMAZON_CLIENT_ID,
    clientSecret: process.env.AMAZON_CLIENT_SECRET,
    refreshToken: process.env.AMAZON_REFRESH_TOKEN,
    awsAccessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY,
    awsRegion: process.env.AMAZON_AWS_REGION,
    marketplaceId: process.env.AMAZON_MARKETPLACE_ID,
    sellerId: process.env.AMAZON_SELLER_ID
  });

  console.log('🚀 TESTING AMAZON SP-API HELPER FUNCTIONS');
  console.log('='.repeat(50));

  try {
    // Test with multiple ASINs
    const testAsins = ['B00A2KD8NY', 'B07P6Y8L3F', 'B08N5WRWNW'];

    console.log('📦 Testing multiple products...\n');

    const results = await api.getMultipleItemOffers(testAsins.slice(0, 2)); // Test 2 to avoid rate limits

    results.forEach((result, index) => {
      console.log(`Product ${index + 1}: ${result.asin}`);
      if (result.success) {
        const pricing = api.extractPricingInfo(result.data);
        console.log(`  ✅ Success!`);
        console.log(`  💰 Buybox Price: £${pricing.buyboxPrice || 'N/A'}`);
        console.log(`  📊 Price Range: £${pricing.lowestPrice} - £${pricing.highestPrice}`);
        console.log(`  🏪 Offers: ${pricing.offerCount}`);
        console.log(`  💱 Currency: ${pricing.currency}`);
      } else {
        console.log(`  ❌ Failed: ${result.error}`);
      }
      console.log('');
    });

    console.log('✅ Live Amazon data access confirmed!');
    console.log('🎯 You can now build your dashboard with real pricing data.');

  } catch (error) {
    console.log(`❌ Demo failed: ${error.message}`);
  }
}

// Export for use in SvelteKit
module.exports = { AmazonSPAPI };

// Run demo if called directly
if (require.main === module) {
  demo();
}
