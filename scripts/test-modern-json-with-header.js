// Test the modern JSON_LISTINGS_FEED format with correct header structure
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Standalone Amazon Feeds API using modern JSON format with proper header
class AmazonFeedsAPI {
  constructor() {
    this.config = {
      endpoint: 'https://sellingpartnerapi-eu.amazon.com',
      clientId: process.env.AMAZON_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN,
      marketplaceId: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
      environment: 'production'
    };

    this.supabase = createClient(
      process.env.PUBLIC_SUPABASE_URL,
      process.env.PRIVATE_SUPABASE_SERVICE_KEY
    );

    this.accessToken = null;
    this.tokenExpiry = null;
    console.log('✅ AmazonFeedsAPI initialized for JSON testing with proper header');
  }

  async updatePrice(asin, newPrice, currentPrice = null, sku = null) {
    console.log(`🎯 Starting JSON Feeds API price update for ASIN: ${asin} to £${newPrice}`);

    try {
      console.log('🎯 JSON FEEDS API - Price Update Details:');
      console.log(`   🔸 ASIN: ${asin}`);
      console.log(`   🔸 SKU: ${sku || 'Will use ASIN as SKU'}`);
      console.log(`   🔸 Current price: ${currentPrice !== null ? `£${currentPrice.toFixed(2)}` : 'Unknown'}`);
      console.log(`   🔸 Setting new price: £${newPrice.toFixed(2)}`);
      console.log(`   🔸 Format: JSON with proper header structure for JSON_LISTINGS_FEED`);

      const token = await this.getAccessToken();
      const finalSku = sku || asin;

      // Step 1: Create feed document
      console.log('📄 Step 1: Creating JSON feed document...');
      const feedDocument = await this.createFeedDocument(token);
      console.log('✅ Feed document created:', feedDocument.feedDocumentId);

      // Step 2: Upload pricing data
      console.log('📤 Step 2: Uploading JSON pricing data with proper header...');
      await this.uploadPricingData(feedDocument.url, asin, finalSku, newPrice);
      console.log('✅ JSON pricing data uploaded successfully');

      // Step 3: Submit feed
      console.log('🚀 Step 3: Submitting modern JSON feed...');
      const feed = await this.submitFeed(token, feedDocument.feedDocumentId);
      console.log('✅ Modern JSON feed submitted:', feed.feedId);

      // Step 4: Log to database
      console.log('💾 Step 4: Logging to database...');
      await this.logToDatabase(asin, finalSku, newPrice, currentPrice, feed.feedId);

      return {
        success: true,
        status: 200,
        data: feed,
        environment: this.config.environment,
        asin: asin,
        sku: finalSku,
        newPrice: parseFloat(newPrice.toFixed(2)),
        currentPrice: currentPrice,
        feedId: feed.feedId,
        message: `JSON price update feed submitted successfully for ASIN ${asin} (SKU: ${finalSku}). New price: £${newPrice.toFixed(2)}`,
        isSimulation: false,
        feedStatus: 'SUBMITTED',
        feedType: 'JSON_LISTINGS_FEED'
      };

    } catch (error) {
      console.error('❌ JSON Feeds API price update failed:', error);
      throw error;
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
    // Create pricing feed data in JSON format with proper header structure
    // Based on Amazon's official schema v2.0
    const jsonData = {
      "header": {
        "sellerId": this.config.clientId, // Using client ID as seller identifier
        "version": "2.0"
      },
      "messages": [
        {
          "messageId": 1,
          "sku": sku,
          "operationType": "PARTIAL_UPDATE",
          "productType": "PRODUCT",
          "attributes": {
            "purchasable_offer": [
              {
                "marketplace_id": this.config.marketplaceId,
                "currency": "GBP",
                "our_price": [
                  {
                    "schedule": [
                      {
                        "value_with_tax": price.toFixed(2)
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

    console.log('📋 Pricing feed data (JSON format with proper header):');
    console.log('---START JSON FEED DATA---');
    console.log(JSON.stringify(jsonData, null, 2));
    console.log('---END JSON FEED DATA---');

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(jsonData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload pricing data: ${response.status} ${response.statusText} - ${errorText}`);
    }

    console.log('✅ JSON pricing data with proper header uploaded to S3');
  }

  async submitFeed(token, feedDocumentId) {
    const payload = {
      feedType: 'JSON_LISTINGS_FEED',
      marketplaceIds: [this.config.marketplaceId],
      inputFeedDocumentId: feedDocumentId
    };

    console.log('📋 Modern JSON feed submission payload:', payload);

    const response = await fetch(`${this.config.endpoint}/feeds/2021-06-30/feeds`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-amz-access-token': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to submit feed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async getAccessToken() {
    console.log('🔑 Getting access token...');

    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      console.log('✅ Using cached access token');
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

      console.log('✅ Access token obtained successfully');
      return this.accessToken;

    } catch (error) {
      console.error('❌ Failed to get access token:', error);
      throw error;
    }
  }

  async logToDatabase(asin, sku, newPrice, currentPrice, feedId) {
    try {
      const { data, error } = await this.supabase
        .from('buybox_data')
        .update({
          our_price: newPrice,
          last_updated: new Date().toISOString(),
          feed_id: feedId
        })
        .eq('asin', asin);

      if (error) {
        console.error('Database update error:', error);
      } else {
        console.log('✅ Updated buybox_data table');
      }
    } catch (error) {
      console.error('Database connection error:', error);
    }
  }
}

// Test the implementation
async function testModernJSONWithHeader() {
  console.log('🧪 Testing modern JSON_LISTINGS_FEED format with proper header...\n');

  const api = new AmazonFeedsAPI();

  try {
    const result = await api.updatePrice('B08BPBWV1C', 42.15, 42.16, 'COL01A');

    console.log('\n🎉 Final Result:');
    console.log(JSON.stringify(result, null, 2));

    console.log(`\n✅ SUCCESS! Modern JSON Feed ID: ${result.feedId}`);
    console.log('⏰ Check feed status in 2-3 minutes');
    console.log('📊 Proper header format should resolve the missing header error');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

testModernJSONWithHeader();
