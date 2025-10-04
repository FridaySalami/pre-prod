/**
 * Amazon SP-API Notifications Management Service
 * 
 * Handles creating destinations and managing notification subscriptions
 * for real-time buy box and pricing alerts
 */

const axios = require('axios');
const crypto = require('crypto');

class SPAPINotificationsService {
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

  /**
   * Get access token for SP-API calls
   */
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
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));

      console.log('✅ SP-API access token refreshed');
      return this.accessToken;
    } catch (error) {
      console.error('❌ Failed to get SP-API access token:', error.response?.data);
      throw error;
    }
  }

  /**
   * Create AWS signature for SP-API requests
   */
  createSignature(method, path, queryParams, headers, body) {
    const amzDate = headers['x-amz-date'];
    const date = amzDate.substr(0, 8);

    // Create canonical request
    const canonicalUri = path;
    const canonicalQueryString = Object.keys(queryParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');

    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map(key => `${key.toLowerCase()}:${headers[key]}\n`)
      .join('');

    const signedHeaders = Object.keys(headers)
      .sort()
      .map(key => key.toLowerCase())
      .join(';');

    const payloadHash = headers['x-amz-content-sha256'];

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${date}/${this.config.region}/execute-api/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    // Calculate signature
    const kDate = crypto.createHmac('sha256', `AWS4${this.config.secretAccessKey}`).update(date).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(this.config.region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update('execute-api').digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    // Add authorization header
    const authorizationHeader = `${algorithm} Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      ...headers,
      'Authorization': authorizationHeader
    };
  }

  /**
   * Create a notification destination (SQS queue)
   */
  async createDestination(queueArn) {
    const accessToken = await this.getAccessToken();

    const method = 'POST';
    const path = '/notifications/v1/destinations';

    const requestBody = {
      resourceSpecification: {
        sqs: {
          arn: queueArn
        }
      },
      name: `buybox-notifications-${Date.now()}`
    };

    const bodyString = JSON.stringify(requestBody);
    const amzDate = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';

    const headers = {
      'host': 'sellingpartnerapi-eu.amazon.com',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': crypto.createHash('sha256').update(bodyString).digest('hex'),
      'content-type': 'application/json'
    };

    const signedHeaders = this.createSignature(method, path, {}, headers, bodyString);
    const url = `${this.config.endpoint}${path}`;

    try {
      console.log('🎯 Creating SP-API notification destination...');

      const response = await axios.post(url, requestBody, {
        headers: signedHeaders,
        timeout: 30000
      });

      console.log('✅ Notification destination created:', response.data.destinationId);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to create destination:', error.response?.data);
      throw error;
    }
  }

  /**
   * Subscribe to a notification type
   */
  async createSubscription(destinationId, notificationType) {
    const accessToken = await this.getAccessToken();

    const method = 'POST';
    const path = '/notifications/v1/subscriptions/' + notificationType;

    const requestBody = {
      payloadVersion: '1.0',
      destinationId: destinationId
    };

    const bodyString = JSON.stringify(requestBody);
    const amzDate = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';

    const headers = {
      'host': 'sellingpartnerapi-eu.amazon.com',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': crypto.createHash('sha256').update(bodyString).digest('hex'),
      'content-type': 'application/json'
    };

    const signedHeaders = this.createSignature(method, path, {}, headers, bodyString);
    const url = `${this.config.endpoint}${path}`;

    try {
      console.log(`🔔 Creating subscription for ${notificationType}...`);

      const response = await axios.post(url, requestBody, {
        headers: signedHeaders,
        timeout: 30000
      });

      console.log(`✅ Subscribed to ${notificationType}:`, response.data.subscriptionId);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to subscribe to ${notificationType}:`, error.response?.data);
      throw error;
    }
  }

  /**
   * Get all destinations
   */
  async getDestinations() {
    const accessToken = await this.getAccessToken();

    const method = 'GET';
    const path = '/notifications/v1/destinations';

    const amzDate = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';

    const headers = {
      'host': 'sellingpartnerapi-eu.amazon.com',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': crypto.createHash('sha256').update('').digest('hex')
    };

    const signedHeaders = this.createSignature(method, path, {}, headers, '');
    const url = `${this.config.endpoint}${path}`;

    try {
      const response = await axios.get(url, {
        headers: signedHeaders,
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      console.error('❌ Failed to get destinations:', error.response?.data);
      throw error;
    }
  }

  /**
   * Get subscriptions for a notification type
   */
  async getSubscription(notificationType) {
    const accessToken = await this.getAccessToken();

    const method = 'GET';
    const path = '/notifications/v1/subscriptions/' + notificationType;

    const amzDate = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';

    const headers = {
      'host': 'sellingpartnerapi-eu.amazon.com',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': crypto.createHash('sha256').update('').digest('hex')
    };

    const signedHeaders = this.createSignature(method, path, {}, headers, '');
    const url = `${this.config.endpoint}${path}`;

    try {
      const response = await axios.get(url, {
        headers: signedHeaders,
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      console.error(`❌ Failed to get subscription for ${notificationType}:`, error.response?.data);
      throw error;
    }
  }

  /**
   * Delete a subscription
   */
  async deleteSubscription(subscriptionId, notificationType) {
    const accessToken = await this.getAccessToken();

    const method = 'DELETE';
    const path = `/notifications/v1/subscriptions/${notificationType}/${subscriptionId}`;

    const amzDate = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';

    const headers = {
      'host': 'sellingpartnerapi-eu.amazon.com',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': crypto.createHash('sha256').update('').digest('hex')
    };

    const signedHeaders = this.createSignature(method, path, {}, headers, '');
    const url = `${this.config.endpoint}${path}`;

    try {
      console.log(`🗑️ Deleting subscription ${subscriptionId} for ${notificationType}...`);

      const response = await axios.delete(url, {
        headers: signedHeaders,
        timeout: 30000
      });

      console.log(`✅ Deleted subscription for ${notificationType}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to delete subscription:`, error.response?.data);
      throw error;
    }
  }
}

module.exports = { SPAPINotificationsService };