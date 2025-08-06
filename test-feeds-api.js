// Test the POST_PRODUCT_PRICING_DATA feed for B08BPBWV1C
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Standalone Amazon Feeds API using environment variables
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

    // Initialize Supabase for logging
    this.supabase = createClient(
      process.env.PUBLIC_SUPABASE_URL,
      process.env.PRIVATE_SUPABASE_SERVICE_KEY
    );

    this.accessToken = null;
    this.tokenExpiry = null;
    console.log('✅ AmazonFeedsAPI initialized for testing');
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

      // Step 4: Log to database
      console.log('💾 Step 4: Logging to database...');
      await this.logPriceUpdate(asin, finalSku, newPrice, currentPrice, feed);

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
        contentType: 'text/tab-separated-values; charset=utf-8'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create feed document: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async uploadPricingData(uploadUrl, asin, sku, price) {
    // Create pricing feed data in TAB-DELIMITED format for POST_PRODUCT_PRICING_DATA
    const pricingData = [
      'sku\tprice\tcurrency\tminimum-seller-allowed-price\tmaximum-seller-allowed-price',
      `${sku}\t${price.toFixed(2)}\tGBP\t\t`
    ].join('\n');

    console.log('📋 Pricing feed data (tab-delimited):');
    console.log('---START FEED DATA---');
    console.log(pricingData);
    console.log('---END FEED DATA---');

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/tab-separated-values; charset=utf-8'
      },
      body: pricingData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload pricing data: ${response.status} ${response.statusText} - ${errorText}`);
    }

    console.log('✅ Pricing data uploaded to S3');
  }

  async submitFeed(token, feedDocumentId) {
    const feedPayload = {
      feedType: 'POST_PRODUCT_PRICING_DATA',
      marketplaceIds: [this.config.marketplaceId],
      inputFeedDocumentId: feedDocumentId
    };

    console.log('📋 Feed submission payload:', JSON.stringify(feedPayload, null, 2));

    const response = await fetch(`${this.config.endpoint}/feeds/2021-06-30/feeds`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-amz-access-token': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(feedPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to submit feed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async logPriceUpdate(asin, sku, newPrice, currentPrice, feedResult) {
    try {
      console.log('💾 Logging price update to database...');

      // Log to audit_log (if it exists)
      const auditLogEntry = {
        action: 'AMAZON_PRICE_UPDATE',
        details: JSON.stringify({
          asin: asin,
          sku: sku,
          old_price: currentPrice,
          new_price: parseFloat(newPrice.toFixed(2)),
          feed_id: feedResult.feedId,
          feed_type: 'POST_PRODUCT_PRICING_DATA',
          marketplace_id: this.config.marketplaceId,
          timestamp: new Date().toISOString()
        }),
        timestamp: new Date().toISOString()
      };

      const { data: auditData, error: auditError } = await this.supabase
        .from('audit_log')
        .insert([auditLogEntry]);

      if (auditError) {
        console.warn('⚠️ Could not log to audit_log:', auditError.message);
      } else {
        console.log('✅ Logged to audit_log');
      }

      // Update buybox_data table
      const { data: updateData, error: updateError } = await this.supabase
        .from('buybox_data')
        .update({
          your_current_price: parseFloat(newPrice.toFixed(2)),
          last_price_update: new Date().toISOString(),
          update_source: 'feeds_api',
          update_attempts: 1
        })
        .eq('asin', asin);

      if (updateError) {
        console.warn('⚠️ Could not update buybox_data:', updateError.message);
      } else {
        console.log('✅ Updated buybox_data table');
      }

    } catch (error) {
      console.warn('⚠️ Database logging failed:', error.message);
    }
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

    console.log('✅ FEEDS API - Price update feed submitted successfully');
    return successResult;
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
}

// Test the specific ASIN
async function testPriceUpdate() {
  try {
    console.log('🧪 Testing POST_PRODUCT_PRICING_DATA feed for B08BPBWV1C...\n');

    const api = new AmazonFeedsAPI();

    // Test with your specific ASIN and SKU
    const result = await api.updatePrice(
      'B08BPBWV1C',  // ASIN
      42.15,         // New price
      42.16,         // Current price
      'COL01A'       // SKU
    );

    console.log('\n🎉 Final Result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log(`\n✅ SUCCESS! Feed ID: ${result.feedId}`);
      console.log('⏰ Check feed status in 2-3 minutes using the feed status checker');
      console.log('📊 Price should appear on Amazon within 15-60 minutes');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPriceUpdate();
