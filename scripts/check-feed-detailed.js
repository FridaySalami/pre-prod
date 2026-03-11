// Simple feed status checker with result document download
import dotenv from 'dotenv';
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

dotenv.config();

class AmazonFeedsAPI {
  constructor() {
    this.config = {
      endpoint: 'https://sellingpartnerapi-eu.amazon.com',
      clientId: process.env.AMAZON_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN,
      marketplaceId: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P'
    };

    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async checkFeedStatus(feedId) {
    try {
      console.log(`🔍 Checking status for Feed ID: ${feedId}`);

      const token = await this.getAccessToken();

      // Step 1: Get feed status
      console.log('📊 Step 1: Getting feed status...');
      const feedStatus = await this.getFeedStatus(token, feedId);
      console.log('Feed Status:', JSON.stringify(feedStatus, null, 2));

      // Step 2: Check if processing is complete and get result document
      if (feedStatus.processingStatus === 'DONE' || feedStatus.processingStatus === 'FATAL') {
        console.log(`\n📄 Step 2: Feed processing is ${feedStatus.processingStatus}, checking for result document...`);

        // Show all available fields
        console.log('\n🔍 All available feed status fields:');
        Object.keys(feedStatus).forEach(key => {
          console.log(`   ${key}: ${feedStatus[key]}`);
        });

        if (feedStatus.resultFeedDocumentId) {
          const resultDoc = await this.getFeedResultDocument(token, feedStatus.resultFeedDocumentId);
          console.log('\n🎯 FEED RESULT DOCUMENT - This is where the truth lives:');
          console.log(JSON.stringify(resultDoc, null, 2));

          // Step 3: Download and parse the result content
          console.log('\n📥 Step 3: Downloading result content...');
          const resultContent = await this.downloadResultContent(resultDoc.url, resultDoc.compressionAlgorithm);
          console.log('\n📋 RESULT CONTENT:');
          console.log('---START RESULT---');
          console.log(resultContent);
          console.log('---END RESULT---');

        } else {
          console.log('\n⚠️ No result document ID found - this might mean:');
          console.log('   1. The feed format was invalid');
          console.log('   2. The feed type was incorrect');
          console.log('   3. Amazon rejected the feed before processing');
          console.log('\n🔧 FATAL status usually indicates a format or validation error');
        }
      } else {
        console.log(`⏳ Feed is still processing. Status: ${feedStatus.processingStatus}`);
        console.log('💡 Try again in a few minutes');
      }

    } catch (error) {
      console.error('❌ Error checking feed status:', error);
    }
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

  async getFeedResultDocument(token, resultFeedDocumentId) {
    const response = await fetch(`${this.config.endpoint}/feeds/2021-06-30/documents/${resultFeedDocumentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-amz-access-token': token,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get result document: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async downloadResultContent(downloadUrl, compressionAlgorithm = null) {
    const response = await fetch(downloadUrl, {
      method: 'GET'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to download result content: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Get the raw buffer
    const buffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    // Check if we need to decompress
    if (compressionAlgorithm === 'GZIP') {
      console.log('🗜️ Decompressing GZIP content...');
      try {
        const decompressed = await gunzip(uint8Array);
        return decompressed.toString('utf-8');
      } catch (error) {
        console.error('❌ Failed to decompress GZIP:', error);
        return uint8Array.toString();
      }
    }

    // Return as text if no compression
    return new TextDecoder().decode(uint8Array);
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
}

// Check the specific feed
async function checkFeed() {
  const api = new AmazonFeedsAPI();
  const feedId = process.argv[2] || '288274020305'; // Default to our recent feed

  console.log(`🔍 Checking Feed ID: ${feedId}\n`);
  await api.checkFeedStatus(feedId);
}

checkFeed();
