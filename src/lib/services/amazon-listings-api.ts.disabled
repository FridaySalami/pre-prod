// @ts-nocheck
/**
 * Amazon Listings API Service
 * Handles price updates via Amazon SP-API Listings API v2021-08-01
 */

import aws4 from 'aws4';

interface AmazonAPIConfig {
  environment?: 'sandbox' | 'production';
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  marketplaceId?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRegion?: string;
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

interface APIResponse {
  success: boolean;
  status?: number;
  data?: any;
  error?: string;
  environment: string;
  asin?: string;
  newPrice?: number;
  message?: string;
}

class AmazonListingsAPI {
  private config: {
    endpoint: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    awsAccessKeyId: string;
    awsSecretAccessKey: string;
    awsRegion: string;
    marketplaceId: string;
    maxRetries: number;
    retryDelay: number;
    environment: string;
  };
  private accessToken: string | null;
  private tokenExpiry: number | null;

  /**
   * @param config - Configuration options
   */
  constructor(config: AmazonAPIConfig = {}) {
    this.config = {
      // Sandbox vs Production endpoints
      endpoint: config.environment === 'production'
        ? 'https://sellingpartnerapi-eu.amazon.com'
        : 'https://sandbox.sellingpartnerapi-na.amazon.com',

      // API credentials from environment
      clientId: config.clientId || process.env.AMAZON_CLIENT_ID || '',
      clientSecret: config.clientSecret || process.env.AMAZON_CLIENT_SECRET || '',
      refreshToken: config.refreshToken || process.env.AMAZON_REFRESH_TOKEN || '',

      // AWS credentials for SigV4
      awsAccessKeyId: config.awsAccessKeyId || process.env.AMAZON_AWS_ACCESS_KEY_ID || '',
      awsSecretAccessKey: config.awsSecretAccessKey || process.env.AMAZON_AWS_SECRET_ACCESS_KEY || '',
      awsRegion: config.awsRegion || process.env.AMAZON_AWS_REGION || 'eu-west-1',

      // Marketplace settings
      marketplaceId: config.marketplaceId || 'A1F83G8C2ARO7P', // UK marketplace

      // Rate limiting
      maxRetries: 3,
      retryDelay: 1000,

      environment: config.environment || 'sandbox'
    };

    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get access token using refresh token
   */
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
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
          refresh_token: this.config.refreshToken || '',
          client_id: this.config.clientId || '',
          client_secret: this.config.clientSecret || ''
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
      }

      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer

      return this.accessToken;
    } catch (error) {
      console.error('Failed to get access token:', error);
      throw error;
    }
  }

  /**
   * Make an authenticated request to SP-API with AWS SigV4
   */
  async makeRequest(path: string, options: RequestOptions = {}): Promise<Response> {
    const token = await this.getAccessToken();
    const url = new URL(path, this.config.endpoint);

    const requestOptions: any = {
      host: url.hostname,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'x-amz-access-token': token,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      service: 'execute-api',
      region: this.config.awsRegion
    };

    if (options.body) {
      requestOptions.body = options.body;
      requestOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
    }

    // Sign the request with AWS SigV4
    const signedRequest = aws4.sign(requestOptions, {
      accessKeyId: this.config.awsAccessKeyId,
      secretAccessKey: this.config.awsSecretAccessKey
    });

    // Convert headers to proper format for fetch
    const fetchHeaders: Record<string, string> = {};
    if (signedRequest.headers) {
      Object.keys(signedRequest.headers).forEach(key => {
        fetchHeaders[key] = String(signedRequest.headers![key]);
      });
    }

    // Make the actual HTTP request
    const response = await fetch(url.toString(), {
      method: signedRequest.method,
      headers: fetchHeaders,
      body: options.body || undefined
    });

    return response;
  }

  /**
   * Test API connectivity
   */
  async testConnection() {
    try {
      console.log('🔑 Getting access token...');
      const token = await this.getAccessToken();
      console.log('✅ Token obtained successfully');

      console.log('🔐 Testing SP-API with AWS SigV4 authentication...');

      // Test with Pricing API first (we know this works) - but use a simpler endpoint
      console.log('Testing basic API connectivity...');
      const basicResponse = await this.makeRequest('/sellers/v1/marketplaceParticipations');
      const basicResult = await basicResponse.json();

      console.log('📊 Basic API Status:', basicResponse.status);
      console.log('📊 Basic API Response:', JSON.stringify(basicResult, null, 2));

      if (basicResponse.status === 403) {
        console.log('❌ Still getting 403 - Product Listing permission may not be active yet');
        console.log('💡 This is normal - Amazon permissions can take time to propagate');

        return {
          success: false,
          status: basicResponse.status,
          data: basicResult,
          environment: this.config.environment,
          message: 'API credentials work but Product Listing permission may still be propagating'
        };
      } else if (basicResponse.ok) {
        console.log('✅ API access confirmed!');

        return {
          success: true,
          status: basicResponse.status,
          data: basicResult,
          environment: this.config.environment
        };
      } else {
        return {
          success: false,
          status: basicResponse.status,
          data: basicResult,
          environment: this.config.environment
        };
      }

    } catch (error) {
      console.error('🚨 Connection test error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
        environment: this.config.environment
      };
    }
  }

  /**
   * Update product price using Listings API
   */
  async updatePrice(asin: string, newPrice: number, sku: string | null = null): Promise<APIResponse> {
    try {
      const token = await this.getAccessToken();

      const requestBody = {
        productType: "PRODUCT", // This may need to be detected dynamically
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

      return {
        success: response.ok,
        status: response.status,
        data: result,
        asin,
        newPrice,
        environment: this.config.environment
      };
    } catch (error) {
      console.error('Price update failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
        asin,
        newPrice,
        environment: this.config.environment
      };
    }
  }

  /**
   * Get current listing information
   */
  async getListing(asin: string): Promise<APIResponse> {
    try {
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.config.endpoint}/listings/2021-08-01/items/${this.config.marketplaceId}/${asin}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-amz-access-token': token || '',
            'Content-Type': 'application/json'
          }
        }
      );

      const result = await response.json();

      return {
        success: response.ok,
        status: response.status,
        data: result,
        asin,
        environment: this.config.environment
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
        asin,
        environment: this.config.environment
      };
    }
  }
}

export default AmazonListingsAPI;

// Test configuration examples
export const testConfigs = {
  sandbox: {
    environment: 'sandbox',
    // Add your sandbox credentials here
  },
  production: {
    environment: 'production',
    // Add your production credentials here
  }
};
