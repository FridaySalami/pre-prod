// Standalone Amazon Listings API for Node.js scripts
// This version uses regular environment variables instead of SvelteKit's $env

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class AmazonListingsAPI {
  constructor(config = {}) {
    console.log('🏗️ Initializing AmazonListingsAPI with config:', {
      environment: config.environment || 'production',
      hasClientId: !!process.env.AMAZON_CLIENT_ID,
      hasRefreshToken: !!process.env.AMAZON_REFRESH_TOKEN,
      hasAwsCredentials: !!(process.env.AMAZON_AWS_ACCESS_KEY_ID && process.env.AMAZON_AWS_SECRET_ACCESS_KEY)
    });

    this.config = {
      endpoint: 'https://sellingpartnerapi-eu.amazon.com',
      clientId: config.clientId || process.env.AMAZON_CLIENT_ID,
      clientSecret: config.clientSecret || process.env.AMAZON_CLIENT_SECRET,
      refreshToken: config.refreshToken || process.env.AMAZON_REFRESH_TOKEN,
      awsAccessKeyId: config.awsAccessKeyId || process.env.AMAZON_AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: config.awsSecretAccessKey || process.env.AMAZON_AWS_SECRET_ACCESS_KEY,
      awsRegion: config.awsRegion || process.env.AMAZON_REGION || 'eu-west-1',
      marketplaceId: config.marketplaceId || process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
      environment: config.environment || 'production'
    };

    // Initialize Supabase client for logging
    this.supabase = createClient(
      process.env.PUBLIC_SUPABASE_URL,
      process.env.PRIVATE_SUPABASE_SERVICE_KEY
    );

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

      console.log(`📥 Method 1 Response: ${response.status} ${response.statusText}`);
      console.log(`📥 Method 1 Full Response:`, JSON.stringify(result, null, 2));

      if (response.ok) {
        return this.createSuccessResult(asin, formattedPrice, result, response.status);
      }

      // Log specific failure details
      console.log(`⚠️ Method 1 failed with status ${response.status}:`, {
        errors: result.errors || [],
        sku: result.sku || 'N/A',
        status: result.status || 'N/A',
        issues: result.issues || []
      });

      return null;
    } catch (error) {
      console.log(`❌ Method 1 failed:`, error.message);
      console.log(`❌ Method 1 error details:`, error);
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

      console.log(`📥 Method 2 Response: ${response.status} ${response.statusText}`);
      console.log(`📥 Method 2 Full Response:`, JSON.stringify(result, null, 2));

      if (response.ok) {
        return this.createSuccessResult(asin, formattedPrice, result, response.status);
      }

      // Log specific failure details
      console.log(`⚠️ Method 2 failed with status ${response.status}:`, {
        errors: result.errors || [],
        sku: result.sku || 'N/A',
        status: result.status || 'N/A',
        issues: result.issues || []
      });

      return null;
    } catch (error) {
      console.log(`❌ Method 2 failed:`, error.message);
      console.log(`❌ Method 2 error details:`, error);
      return null;
    }
  }

  async tryWithProductTypeDiscovery(asin, formattedPrice, token) {
    try {
      // First get the product type for this ASIN
      const productType = await this.getProductTypeForAsin(asin, token);
      console.log(`🔍 Discovered product type for ${asin}: ${productType}`);

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

      console.log(`📥 Method 3 Response: ${response.status} ${response.statusText}`);
      console.log(`📥 Method 3 Full Response:`, JSON.stringify(result, null, 2));

      if (response.ok) {
        return this.createSuccessResult(asin, formattedPrice, result, response.status);
      }

      // Log specific failure details
      console.log(`⚠️ Method 3 failed with status ${response.status}:`, {
        errors: result.errors || [],
        sku: result.sku || 'N/A',
        status: result.status || 'N/A',
        issues: result.issues || []
      });

      return null;
    } catch (error) {
      console.log(`❌ Method 3 failed:`, error.message);
      console.log(`❌ Method 3 error details:`, error);
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

    // Log the price update to the audit_log table (simplified for standalone)
    this.logPriceUpdate(asin, newPrice, result, status).catch(error => {
      console.warn('⚠️ Failed to log price update to database:', error);
    });

    return successResult;
  }

  async logPriceUpdate(asin, newPrice, amazonResponse, status) {
    try {
      console.log('💾 Logging price update to database...');

      // Since audit_log table structure was unclear, let's just log a simple entry
      const logEntry = {
        action: 'AMAZON_PRICE_UPDATE',
        asin: asin,
        new_price: parseFloat(newPrice),
        currency: 'GBP',
        status_code: status,
        timestamp: new Date().toISOString(),
        details: JSON.stringify({
          amazon_response: amazonResponse,
          environment: this.config.environment,
          marketplace_id: this.config.marketplaceId
        })
      };

      // Try to insert to audit_log - if it fails, we'll continue anyway
      const { data, error } = await this.supabase
        .from('audit_log')
        .insert([logEntry]);

      if (error) {
        console.warn('⚠️ Could not log to audit_log table:', error.message);
        console.log('💾 Price update completed without database logging');
      } else {
        console.log('✅ Price update logged to database successfully');
      }

      return data;
    } catch (error) {
      console.warn('❌ Database logging error:', error.message);
      // Don't throw - continue with the price update even if logging fails
      return null;
    }
  }

  async getProductTypeForAsin(asin, token) {
    try {
      console.log(`🔍 Getting product type for ASIN: ${asin}`);

      // Try to get the listing to discover product type
      const response = await fetch(
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

      if (response.ok) {
        const data = await response.json();
        const productType = data.productType || 'PRODUCT';
        console.log(`✅ Product type discovered: ${productType}`);
        return productType;
      } else {
        console.log(`⚠️ Could not determine product type, using default: PRODUCT`);
        return 'PRODUCT';
      }
    } catch (error) {
      console.log(`⚠️ Error getting product type, using default: ${error.message}`);
      return 'PRODUCT';
    }
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
