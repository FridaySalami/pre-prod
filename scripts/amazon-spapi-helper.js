#!/usr/bin/env node

/**
 * Amazon SP-API Helper Functions
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
  async makeRequest(path, queryParams = {}, method = 'GET', body = null) {
    const accessToken = await this.getAccessToken();
    const querystring = new URLSearchParams(queryParams).toString();
    const payload = body ? JSON.stringify(body) : '';

    const headers = {
      'host': this.host,
      'x-amz-access-token': accessToken,
      'user-agent': 'MyApp/1.0',
      'content-type': 'application/json'
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
      if (payload) req.write(payload);
      req.end();
    });
  }

  /**
   * Get Listing Offers Batch (v0)
   */
  async getListingOffersBatch(skus) {
    const path = '/batches/products/pricing/v0/listingOffers';
    const body = {
      requests: skus.map(sku => ({
        uri: `/products/pricing/v0/listings/${encodeURIComponent(sku)}/offers`,
        method: 'GET',
        MarketplaceId: this.marketplaceId,
        ItemCondition: 'New',
        CustomerType: 'Consumer'
      }))
    };
    return this.makeRequest(path, {}, 'POST', body);
  }

  // Extract useful pricing info from Listing Batch response
  extractListingBatchPricing(itemResponse) {
    const body = itemResponse.body || {};
    const payload = body.payload || {};
    const identifier = payload.Identifier || {};
    const summary = payload.Summary || {};
    const offers = payload.Offers || [];
    
    // Normalize status from {statusCode: 200, reasonPhrase: 'OK'} or raw 200
    let status = itemResponse.status;
    if (status && typeof status === 'object') {
      status = status.statusCode;
    }

    const sku = identifier.SellerSKU;
    const asin = identifier.ASIN || summary.ASIN;

    if (status !== 200 && status !== "Success") {
      if (payload.errors) {
        return { 
          sku,
          asin,
          success: false, 
          error: `${status}: ${payload.errors.map(e => e.message).join(', ')}` 
        };
      }
      return { 
        sku,
        asin,
        success: false, 
        error: status 
      };
    }

    // Our Merchant ID / Seller ID
    const YOUR_SELLER_ID = this.sellerId;

    // Normalize Price Data (since LandingPrice might be missing if shipping not calculated)
    const getLanded = (o) => {
      const price = o.ListingPrice?.Amount ? parseFloat(o.ListingPrice.Amount) : 0;
      const shipping = o.Shipping?.Amount ? parseFloat(o.Shipping.Amount) : 0;
      return price + shipping;
    };

    // Check Buy Box Prices in Summary
    const bbPrices = summary.BuyBoxPrices || [];
    const mainBB = bbPrices[0]; // Usually just one for New condition
    
    // Find our offer if present. MyOffer: true isn't always reliable in batches
    const ourOffer = offers.find(o => o.MyOffer === true || o.SellerId === YOUR_SELLER_ID);
    const isWinner = !!(ourOffer && ourOffer.IsBuyBoxWinner);

    // Extract next best price (first offer that isn't the Buy Box winner AND isn't our own offer)
    const otherCompetitiveOffers = offers
      .filter(o => !o.IsBuyBoxWinner && o.SellerId !== YOUR_SELLER_ID)
      .sort((a, b) => getLanded(a) - getLanded(b));
    
    const nextBestPrice = otherCompetitiveOffers[0] ? getLanded(otherCompetitiveOffers[0]) : null;
    const lowestPrice = summary.LowestPrices?.[0] ? getLanded(summary.LowestPrices[0]) : null;

    return {
      sku,
      asin,
      success: true,
      buyBoxPrice: mainBB ? getLanded(mainBB) : null,
      lowestPrice: lowestPrice,
      nextBestPrice: nextBestPrice,
      ourPrice: ourOffer ? getLanded(ourOffer) : null,
      isWinner,
      currency: mainBB?.LandedPrice?.CurrencyCode || summary.LowestPrices?.[0]?.LandedPrice?.CurrencyCode || 'GBP',
      offerCount: summary.TotalOfferCount || offers.length,
      offers: offers 
    };
  }
}

module.exports = { AmazonSPAPI };
