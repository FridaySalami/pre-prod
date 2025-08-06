/**
 * Standalone Amazon Feeds API for Backfill Script
 * Without SvelteKit dependencies
 */

export default class AmazonFeedsAPIStandalone {
  constructor() {
    this.config = {
      endpoint: 'https://sellingpartnerapi-eu.amazon.com',
      clientId: process.env.AMAZON_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN,
      marketplaceId: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
      sellerId: 'A2D8NG39VURSL3'
    };

    this.validateCredentials();
    this.accessToken = null;
    this.tokenExpiry = null;
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
  }

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

      return this.accessToken;

    } catch (error) {
      console.error('❌ Failed to get access token:', error);
      throw error;
    }
  }

  async getProductType(token, sku) {
    try {
      const response = await fetch(`${this.config.endpoint}/listings/2021-08-01/items/${encodeURIComponent(this.config.sellerId)}/${encodeURIComponent(sku)}?marketplaceIds=${this.config.marketplaceId}&includedData=summaries`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-amz-access-token': token,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`⚠️ Could not fetch product type for SKU ${sku}: ${response.status}`);

        // Return fallback for known SKUs
        if (sku === 'COL01A') {
          return 'CONDIMENT';
        }
        return 'PRODUCT'; // Generic fallback
      }

      const data = await response.json();
      if (data.summaries && data.summaries.length > 0) {
        const productType = data.summaries[0].productType;
        return productType;
      }

      // Fallback for known SKUs
      if (sku === 'COL01A') {
        return 'CONDIMENT';
      }
      return 'PRODUCT';

    } catch (error) {
      console.error(`❌ Error fetching product type for SKU ${sku}:`, error);

      // Fallback for known SKUs
      if (sku === 'COL01A') {
        return 'CONDIMENT';
      }
      return 'PRODUCT';
    }
  }
}
