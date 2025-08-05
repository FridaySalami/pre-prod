// @ts-nocheck
/**
 * Amazon Feeds API Service - Correct Implementation for Price Updates
 * Using the proper Feeds API for pricing operations
 */

// Import environment variables using SvelteKit's static private env
import {
  AMAZON_CLIENT_ID,
  AMAZON_CLIENT_SECRET,
  AMAZON_REFRESH_TOKEN,
  AMAZON_REGION,
  AMAZON_MARKETPLACE_ID
} from '$env/static/private';

class AmazonFeedsAPI {
  constructor(config = {}) {
    console.log('🏗️ Initializing AmazonFeedsAPI with config:', {
      environment: config.environment || 'production',
      hasClientId: !!AMAZON_CLIENT_ID,
      hasRefreshToken: !!AMAZON_REFRESH_TOKEN
    });

    this.config = {
      endpoint: 'https://sellingpartnerapi-eu.amazon.com',
      clientId: config.clientId || AMAZON_CLIENT_ID,
      clientSecret: config.clientSecret || AMAZON_CLIENT_SECRET,
      refreshToken: config.refreshToken || AMAZON_REFRESH_TOKEN,
      marketplaceId: config.marketplaceId || AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
      environment: config.environment || 'production'
    };

    this.validateCredentials();
    this.accessToken = null;
    this.tokenExpiry = null;
    console.log('✅ AmazonFeedsAPI initialized successfully');
  }

  validateCredentials() {
    const requiredCredentials = [
      { key: 'clientId', name: 'AMAZON_CLIENT_ID', value: this.config.clientId },
      { key: 'clientSecret', name: 'AMAZON_CLIENT_SECRET', value: this.config.clientSecret },
      { key: 'refreshToken', name: 'AMAZON_REFRESH_TOKEN', value: this.config.refreshToken }
    ];

    const missingCredentials = requiredCredentials.filter(cred => !cred.value).map(cred => cred.name);

    if (missingCredentials.length > 0) {
      const errorMessage = `Missing required Amazon API credentials: ${missingCredentials.join(', ')}`;
      console.error('❌ Amazon API Credentials Validation Failed:', errorMessage);
      throw new Error(errorMessage);
    }

    console.log('✅ Amazon Feeds API credentials validation passed');
  }

  async updatePrice(asin, newPrice, currentPrice = null, sku = null) {
    console.log(`🎯 Starting Feeds API price update for ASIN: ${asin} to £${newPrice}`);

    try {
      console.log('🎯 FEEDS API - Price Update Details:');
      console.log(`   🔸 ASIN: ${asin}`);
      console.log(`   🔸 SKU: ${sku || 'Will use ASIN as SKU'}`);
      console.log(`   🔸 Current price: ${currentPrice !== null ? `£${currentPrice.toFixed(2)}` : 'Unknown'}`);
      console.log(`   🔸 Setting new price: £${newPrice.toFixed(2)}`);
      console.log(`   🔸 Price change: ${currentPrice !== null ? `£${(newPrice - currentPrice).toFixed(2)} (${newPrice > currentPrice ? '+' : ''}${(((newPrice - currentPrice) / currentPrice) * 100).toFixed(1)}%)` : 'N/A'}`);
      console.log(`   🔸 Environment: ${this.config.environment}`);

      // Get access token
      const token = await this.getAccessToken();

      // Use provided SKU or fall back to ASIN
      const finalSku = sku || asin;
      const skuSource = sku ? 'provided' : 'ASIN fallback';
      console.log(`   🔸 Final SKU: ${finalSku} (${skuSource})`);

      // Step 1: Create feed document
      console.log('📄 Step 1: Creating feed document...');
      const feedDocument = await this.createFeedDocument(token);
      console.log('✅ Feed document created:', feedDocument.feedDocumentId);

      // Step 2: Upload pricing data
      console.log('📤 Step 2: Uploading pricing data...');
      await this.uploadPricingData(feedDocument.url, asin, finalSku, newPrice);
      console.log('✅ Pricing data uploaded successfully');

      // Step 3: Submit feed
      console.log('🚀 Step 3: Submitting feed...');
      const feed = await this.submitFeed(token, feedDocument.feedDocumentId);
      console.log('✅ Feed submitted:', feed.feedId);

      // Return success result
      return this.createSuccessResult(asin, newPrice, feed, currentPrice, finalSku);

    } catch (error) {
      console.error('❌ Feeds API price update failed:', error);
      return {
        success: false,
        status: 500,
        error: error.message,
        environment: this.config.environment,
        asin: asin,
        newPrice: newPrice,
        message: `Failed to update price for ASIN ${asin}: ${error.message}`,
        isSimulation: false
      };
    }
  }

  async createFeedDocument(token) {
    const response = await fetch(`${this.config.endpoint}/feeds/2021-06-30/documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-amz-access-token': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        contentType: 'application/json; charset=utf-8'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create feed document: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async uploadPricingData(uploadUrl, asin, sku, price) {
    // Create pricing feed data in JSON format for Listings Feed
    const pricingData = {
      header: {
        sellerId: 'SELLER_ID', // Will be automatically filled by Amazon
        version: '2.0',
        issueLocale: 'en_GB'
      },
      messages: [
        {
          messageId: 1,
          sku: sku,
          operationType: 'UPDATE',
          productType: 'PRODUCT',
          attributes: {
            // Link to existing listing via ASIN
            external_product_id: [
              {
                external_product_id_type: 'ASIN',
                external_product_id: asin,
                marketplace_id: this.config.marketplaceId
              }
            ],
            condition_type: [
              {
                value: 'new_new',
                marketplace_id: this.config.marketplaceId
              }
            ],
            purchasable_offer: [
              {
                marketplace_id: this.config.marketplaceId,
                currency: 'GBP',
                our_price: [
                  {
                    schedule: [
                      {
                        value_with_tax: price.toFixed(2)
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      ]
    };

    console.log('📋 Pricing feed data:', JSON.stringify(pricingData, null, 2));

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(pricingData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload pricing data: ${response.status} ${response.statusText} - ${errorText}`);
    }

    console.log('✅ Pricing data uploaded to S3');
  }

  async submitFeed(token, feedDocumentId) {
    const response = await fetch(`${this.config.endpoint}/feeds/2021-06-30/feeds`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-amz-access-token': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        feedType: 'JSON_LISTINGS_FEED',
        marketplaceIds: [this.config.marketplaceId],
        inputFeedDocumentId: feedDocumentId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to submit feed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async getFeedStatus(token, feedId) {
    const response = await fetch(`${this.config.endpoint}/feeds/2021-06-30/feeds/${feedId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-amz-access-token': token,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get feed status: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  createSuccessResult(asin, newPrice, feed, currentPrice, sku) {
    const successResult = {
      success: true,
      status: 200,
      data: feed,
      environment: this.config.environment,
      asin: asin,
      sku: sku,
      newPrice: parseFloat(newPrice.toFixed(2)),
      currentPrice: currentPrice,
      feedId: feed.feedId,
      message: `Price update feed submitted successfully for ASIN ${asin} (SKU: ${sku}). New price: £${newPrice.toFixed(2)}`,
      isSimulation: false,
      feedStatus: 'SUBMITTED',
      nextSteps: 'Feed is being processed by Amazon. Check status in a few minutes using the Feed Status API.'
    };

    console.log('✅ FEEDS API - Price update feed submitted successfully:', successResult);
    return successResult;
  }

  async getAccessToken() {
    console.log('🔑 Getting access token...');

    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      console.log('✅ Using cached access token');
      return this.accessToken;
    }

    if (!this.config.clientId || !this.config.clientSecret || !this.config.refreshToken) {
      const missingCredentials = [];
      if (!this.config.clientId) missingCredentials.push('AMAZON_CLIENT_ID');
      if (!this.config.clientSecret) missingCredentials.push('AMAZON_CLIENT_SECRET');
      if (!this.config.refreshToken) missingCredentials.push('AMAZON_REFRESH_TOKEN');

      const errorMessage = `Cannot obtain access token: Missing required credentials: ${missingCredentials.join(', ')}`;
      console.error('❌ Amazon OAuth Error:', errorMessage);
      throw new Error(errorMessage);
    }

    try {
      const response = await fetch('https://api.amazon.com/auth/o2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.config.refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret
        })
      });

      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + ((data.expires_in - 60) * 1000);

      console.log('✅ Real access token obtained successfully');
      return this.accessToken;

    } catch (error) {
      console.error('❌ Failed to get access token:', error);
      throw error;
    }
  }
}

export default AmazonFeedsAPI;
export { AmazonFeedsAPI };

console.log('📦 Amazon Feeds API Server module loaded');
