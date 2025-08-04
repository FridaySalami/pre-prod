// @ts-nocheck
/**
 * Amazon Listings API Service - Server-side ES Module Version
 * Simplified version for SvelteKit server context
 * Handles price updates via Amazon SP-API Listings API v2021-08-01
 */

/**
 * @typedef {Object} AmazonAPIConfig
 * @property {string} [environment] - Environment (sandbox or production)
 * @property {string} [clientId] - Amazon client ID
 * @property {string} [clientSecret] - Amazon client secret
 * @property {string} [refreshToken] - Amazon refresh token
 * @property {string} [awsAccessKeyId] - AWS access key ID
 * @property {string} [awsSecretAccessKey] - AWS secret access key
 * @property {string} [awsRegion] - AWS region
 * @property {string} [marketplaceId] - Amazon marketplace ID
 */

/**
 * Amazon Listings API class for server-side use
 */
class AmazonListingsAPI {
  /**
   * @param {AmazonAPIConfig} config - Configuration options
   */
  constructor(config = {}) {
    console.log('🏗️ Initializing AmazonListingsAPI with config:', {
      environment: config.environment || 'production',
      hasClientId: !!config.clientId || !!process.env.AMAZON_CLIENT_ID,
      hasRefreshToken: !!config.refreshToken || !!process.env.AMAZON_REFRESH_TOKEN,
      hasAwsCredentials: !!(process.env.AMAZON_AWS_ACCESS_KEY_ID && process.env.AMAZON_AWS_SECRET_ACCESS_KEY)
    });

    this.config = {
      endpoint: config.environment === 'sandbox'
        ? 'https://sellingpartnerapi-eu.amazon.com'
        : 'https://sellingpartnerapi-eu.amazon.com',
      clientId: config.clientId || process.env.AMAZON_CLIENT_ID,
      clientSecret: config.clientSecret || process.env.AMAZON_CLIENT_SECRET,
      refreshToken: config.refreshToken || process.env.AMAZON_REFRESH_TOKEN,
      awsAccessKeyId: config.awsAccessKeyId || process.env.AMAZON_AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: config.awsSecretAccessKey || process.env.AMAZON_AWS_SECRET_ACCESS_KEY,
      awsRegion: config.awsRegion || 'eu-west-1',
      marketplaceId: config.marketplaceId || 'A1F83G8C2ARO7P', // UK marketplace
      maxRetries: 3,
      retryDelay: 1000,
      environment: config.environment || 'production'
    };

    this.accessToken = null;
    this.tokenExpiry = null;
    console.log('✅ AmazonListingsAPI initialized successfully');
  }

  /**
   * Update price for a product - PRODUCTION VERSION WITH REAL API CALLS
   * @param {string} asin - The ASIN to update
   * @param {number} newPrice - The new price
   * @returns {Promise<{success: boolean, status: number, data?: any, error?: string, environment: string, asin: string, newPrice: number, message: string, isSimulation?: boolean}>} Update result
   */
  async updatePrice(asin, newPrice) {
    console.log(`🎯 Starting price update for ASIN: ${asin} to £${newPrice}`);

    try {
      console.log('🎯 MATCH BUY BOX - Price Update Details:');
      console.log(`   🔸 ASIN: ${asin}`);
      console.log(`   🔸 Setting new price: £${newPrice.toFixed(2)}`);
      console.log(`   🔸 Environment: ${this.config.environment}`);

      // Check if we have the required API credentials
      if (!this.config.clientId || !this.config.clientSecret || !this.config.refreshToken) {
        console.log('⚠️ Missing Amazon API credentials - using simulation mode');
        console.log('🔄 Simulating Amazon SP-API call...');

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        const result = {
          success: true,
          status: 200,
          data: {
            sku: `SKU-${asin}`,
            asin: asin,
            submitFeedResult: {
              feedId: `FEED_${Date.now()}`,
              feedType: 'POST_PRODUCT_PRICING_DATA',
              submittedDate: new Date().toISOString(),
              feedProcessingStatus: 'SUBMITTED'
            }
          },
          environment: this.config.environment,
          asin: asin,
          newPrice: newPrice,
          message: `[SIMULATION] Price update submitted successfully for ASIN ${asin}. New price: £${newPrice}`,
          isSimulation: true
        };

        console.log('⚠️ SIMULATION MODE - Price update completed:', result);
        return result;
      }

      // REAL AMAZON API CALL
      console.log('🔄 Making REAL Amazon SP-API call...');

      // Get access token
      const token = await this.getAccessToken();

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
                    schedule: [
                      {
                        value_with_tax: String(newPrice)
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };

      const response = await fetch(
        `${this.config.endpoint}/listings/2021-08-01/items/${this.config.marketplaceId}/${asin}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-amz-access-token': token || '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );

      const result = await response.json();

      if (response.ok) {
        const successResult = {
          success: true,
          status: response.status,
          data: result,
          environment: this.config.environment,
          asin: asin,
          newPrice: newPrice,
          message: `Price update submitted successfully for ASIN ${asin}. New price: £${newPrice}`,
          isSimulation: false
        };

        console.log('✅ REAL API - Price update completed successfully:', successResult);
        return successResult;
      } else {
        throw new Error(`Amazon API error: ${response.status} - ${JSON.stringify(result)}`);
      }

    } catch (error) {
      console.error('❌ Price update failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        status: 500,
        error: errorMessage,
        environment: this.config.environment,
        asin: asin,
        newPrice: newPrice,
        message: `Failed to update price for ASIN ${asin}: ${errorMessage}`,
        isSimulation: false
      };
    }
  }

  /**
   * Get access token using refresh token - PRODUCTION VERSION
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    console.log('🔑 Getting access token...');

    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      console.log('✅ Using cached access token');
      return this.accessToken;
    }

    // Check if we have the required credentials
    if (!this.config.clientId || !this.config.clientSecret || !this.config.refreshToken) {
      console.log('⚠️ Missing Amazon OAuth credentials - using simulation token');
      this.accessToken = `SIMULATION_TOKEN_${Date.now()}`;
      this.tokenExpiry = Date.now() + (3600 * 1000); // 1 hour
      return this.accessToken;
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
      this.tokenExpiry = Date.now() + ((data.expires_in - 60) * 1000); // Subtract 60 seconds for safety

      console.log('✅ Real access token obtained successfully');
      return this.accessToken;

    } catch (error) {
      console.error('❌ Failed to get access token:', error);
      throw error;
    }
  }
}

// Export as ES module default
export default AmazonListingsAPI;

// Also export as named export for compatibility
export { AmazonListingsAPI };

console.log('📦 Amazon Listings API Server module loaded');
