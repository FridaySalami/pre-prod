// @ts-nocheck
/**
 * Amazon Listings API Service - Clean Implementation
 * Focused specifically on price updates for existing listings
 */

// Import environment variables using SvelteKit's dynamic private env
import { env } from '$env/dynamic/private';

const {
  AMAZON_CLIENT_ID,
  AMAZON_CLIENT_SECRET,
  AMAZON_REFRESH_TOKEN,
  AMAZON_AWS_ACCESS_KEY_ID,
  AMAZON_AWS_SECRET_ACCESS_KEY,
  AMAZON_REGION,
  AMAZON_MARKETPLACE_ID
} = env;

class AmazonListingsAPI {
  constructor(config = {}) {
    console.log('🏗️ Initializing AmazonListingsAPI with config:', {
      environment: config.environment || 'production',
      hasClientId: !!AMAZON_CLIENT_ID,
      hasRefreshToken: !!AMAZON_REFRESH_TOKEN,
      hasAwsCredentials: !!(AMAZON_AWS_ACCESS_KEY_ID && AMAZON_AWS_SECRET_ACCESS_KEY)
    });

    this.config = {
      endpoint: 'https://sellingpartnerapi-eu.amazon.com',
      clientId: config.clientId || AMAZON_CLIENT_ID,
      clientSecret: config.clientSecret || AMAZON_CLIENT_SECRET,
      refreshToken: config.refreshToken || AMAZON_REFRESH_TOKEN,
      awsAccessKeyId: config.awsAccessKeyId || AMAZON_AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: config.awsSecretAccessKey || AMAZON_AWS_SECRET_ACCESS_KEY,
      awsRegion: config.awsRegion || AMAZON_REGION || 'eu-west-1',
      marketplaceId: config.marketplaceId || AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
      environment: config.environment || 'production'
    };

    this.validateCredentials();
    this.accessToken = null;
    this.tokenExpiry = null;
    console.log('✅ AmazonListingsAPI initialized successfully');
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

    console.log('✅ Amazon API credentials validation passed');
  }

  async updatePrice(asin, newPrice, currentPrice = null) {
    console.log(`🎯 Starting price update for ASIN: ${asin} to £${newPrice}`);

    try {
      console.log('🎯 MATCH BUY BOX - Price Update Details:');
      console.log(`   🔸 ASIN: ${asin}`);
      console.log(`   🔸 Current price: ${currentPrice !== null ? `£${currentPrice.toFixed(2)}` : 'Unknown'}`);
      console.log(`   🔸 Setting new price: £${newPrice.toFixed(2)}`);
      console.log(`   🔸 Price change: ${currentPrice !== null ? `£${(newPrice - currentPrice).toFixed(2)} (${newPrice > currentPrice ? '+' : ''}${(((newPrice - currentPrice) / currentPrice) * 100).toFixed(1)}%)` : 'N/A'}`);
      console.log(`   🔸 Environment: ${this.config.environment}`);

      // Get access token
      const token = await this.getAccessToken();
      const formattedPrice = newPrice.toFixed(2);

      // Try different approaches in sequence
      const methods = [
        () => this.tryMinimalPatch(asin, formattedPrice, token),
        () => this.tryStandardFormat(asin, formattedPrice, token),
        () => this.tryWithProductTypeDiscovery(asin, formattedPrice, token)
      ];

      for (let i = 0; i < methods.length; i++) {
        console.log(`🔄 Attempting Method ${i + 1}...`);
        const result = await methods[i]();
        if (result) {
          console.log(`✅ Method ${i + 1} succeeded!`);
          return result;
        }
      }

      throw new Error('All price update methods failed. This listing may require manual update in Amazon Seller Central.');

    } catch (error) {
      console.error('❌ Price update failed:', error);
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

  async tryMinimalPatch(asin, formattedPrice, token) {
    try {
      // Minimal approach - no product type
      const requestBody = {
        patches: [
          {
            op: "replace",
            path: "/attributes/purchasable_offer",
            value: [
              {
                marketplace_id: this.config.marketplaceId,
                currency: "GBP",
                our_price: [
                  {
                    schedule: [{ value_with_tax: formattedPrice }]
                  }
                ]
              }
            ]
          }
        ]
      };

      console.log(`📤 Method 1 (Minimal) Request:`, JSON.stringify(requestBody, null, 2));

      const response = await this.makePatchRequest(asin, requestBody, token);
      const result = await response.json();

      console.log(`📥 Method 1 Response: ${response.status}`, result);

      if (response.ok) {
        return this.createSuccessResult(asin, formattedPrice, result, response.status);
      }
      return null;
    } catch (error) {
      console.log(`❌ Method 1 failed:`, error.message);
      return null;
    }
  }

  async tryStandardFormat(asin, formattedPrice, token) {
    try {
      // Standard format with PRODUCT type
      const requestBody = {
        productType: "PRODUCT",
        patches: [
          {
            op: "replace",
            path: "/attributes/purchasable_offer",
            value: [
              {
                marketplace_id: this.config.marketplaceId,
                currency: "GBP",
                our_price: [
                  {
                    schedule: [{ value_with_tax: formattedPrice }]
                  }
                ]
              }
            ]
          }
        ]
      };

      console.log(`📤 Method 2 (Standard) Request:`, JSON.stringify(requestBody, null, 2));

      const response = await this.makePatchRequest(asin, requestBody, token);
      const result = await response.json();

      console.log(`📥 Method 2 Response: ${response.status}`, result);

      if (response.ok) {
        return this.createSuccessResult(asin, formattedPrice, result, response.status);
      }
      return null;
    } catch (error) {
      console.log(`❌ Method 2 failed:`, error.message);
      return null;
    }
  }

  async tryWithProductTypeDiscovery(asin, formattedPrice, token) {
    try {
      // First get the listing to understand its structure
      console.log(`🔍 Getting existing listing for ${asin}...`);

      const getResponse = await fetch(
        `${this.config.endpoint}/listings/2021-08-01/items/${this.config.marketplaceId}/${asin}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-amz-access-token': token,
            'Accept': 'application/json'
          }
        }
      );

      if (getResponse.ok) {
        const listingData = await getResponse.json();
        console.log(`📥 Existing listing data:`, JSON.stringify(listingData, null, 2));

        // Extract the actual product type if available
        const productType = listingData.productType || "PRODUCT";
        console.log(`🏷️ Using product type: ${productType}`);

        const requestBody = {
          productType: productType,
          patches: [
            {
              op: "replace",
              path: "/attributes/purchasable_offer",
              value: [
                {
                  marketplace_id: this.config.marketplaceId,
                  currency: "GBP",
                  our_price: [
                    {
                      schedule: [{ value_with_tax: formattedPrice }]
                    }
                  ]
                }
              ]
            }
          ]
        };

        console.log(`📤 Method 3 (Discovery) Request:`, JSON.stringify(requestBody, null, 2));

        const response = await this.makePatchRequest(asin, requestBody, token);
        const result = await response.json();

        console.log(`📥 Method 3 Response: ${response.status}`, result);

        if (response.ok) {
          return this.createSuccessResult(asin, formattedPrice, result, response.status);
        }
      } else {
        console.log(`❌ Could not retrieve listing data: ${getResponse.status}`);
      }

      return null;
    } catch (error) {
      console.log(`❌ Method 3 failed:`, error.message);
      return null;
    }
  }

  async makePatchRequest(asin, requestBody, token) {
    return fetch(
      `${this.config.endpoint}/listings/2021-08-01/items/${this.config.marketplaceId}/${asin}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-amz-access-token': token,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    );
  }

  createSuccessResult(asin, newPrice, result, status) {
    const successResult = {
      success: true,
      status: status,
      data: result,
      environment: this.config.environment,
      asin: asin,
      newPrice: parseFloat(newPrice),
      message: `Price update submitted successfully for ASIN ${asin}. New price: £${newPrice}`,
      isSimulation: false
    };

    console.log('✅ REAL API - Price update completed successfully:', successResult);
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

export default AmazonListingsAPI;
export { AmazonListingsAPI };

console.log('📦 Amazon Listings API Server module loaded (clean version)');
