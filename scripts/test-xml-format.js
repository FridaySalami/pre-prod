// Test the XML format with legacy _POST_PRODUCT_PRICING_DATA_ feed type
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Standalone Amazon Feeds API for XML testing
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
    console.log('✅ AmazonFeedsAPI initialized for XML testing');
  }

  async updatePrice(asin, newPrice, currentPrice = null, sku = null) {
    console.log(`🎯 Starting XML Feeds API price update for ASIN: ${asin} to £${newPrice}`);

    try {
      console.log('🎯 FEEDS API - XML Format Price Update:');
      console.log(`   🔸 ASIN: ${asin}`);
      console.log(`   🔸 SKU: ${sku || 'Will use ASIN as SKU'}`);
      console.log(`   🔸 Current price: ${currentPrice !== null ? `£${currentPrice.toFixed(2)}` : 'Unknown'}`);
      console.log(`   🔸 Setting new price: £${newPrice.toFixed(2)}`);
      console.log(`   🔸 Format: XML with legacy _POST_PRODUCT_PRICING_DATA_ feed type`);

      const token = await this.getAccessToken();
      const finalSku = sku || asin;

      // Step 1: Create feed document
      console.log('📄 Step 1: Creating XML feed document...');
      const feedDocument = await this.createFeedDocument(token);
      console.log('✅ Feed document created:', feedDocument.feedDocumentId);

      // Step 2: Upload XML pricing data
      console.log('📤 Step 2: Uploading XML pricing data...');
      await this.uploadPricingData(feedDocument.url, asin, finalSku, newPrice);
      console.log('✅ XML pricing data uploaded successfully');

      // Step 3: Submit feed
      console.log('🚀 Step 3: Submitting XML feed...');
      const feed = await this.submitFeed(token, feedDocument.feedDocumentId);
      console.log('✅ XML Feed submitted:', feed.feedId);

      // Step 4: Log to database
      console.log('💾 Step 4: Logging to database...');
      await this.logPriceUpdate(asin, finalSku, newPrice, currentPrice, feed);

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
        message: `XML price update feed submitted successfully for ASIN ${asin} (SKU: ${finalSku}). New price: £${newPrice.toFixed(2)}`,
        isSimulation: false,
        feedStatus: 'SUBMITTED',
        format: 'XML'
      };

    } catch (error) {
      console.error('❌ XML Feeds API price update failed:', error);
      return {
        success: false,
        status: 500,
        error: error.message,
        asin: asin,
        newPrice: newPrice
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
        contentType: 'text/xml; charset=utf-8'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create feed document: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async uploadPricingData(uploadUrl, asin, sku, price) {
    // Create pricing feed data in XML format for legacy _POST_PRODUCT_PRICING_DATA_
    const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<AmazonEnvelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="amzn-envelope.xsd">
  <Header>
    <DocumentVersion>1.01</DocumentVersion>
    <MerchantIdentifier>${this.config.marketplaceId}</MerchantIdentifier>
  </Header>
  <MessageType>Price</MessageType>
  <Message>
    <MessageID>1</MessageID>
    <Price>
      <SKU>${sku}</SKU>
      <StandardPrice currency="GBP">${price.toFixed(2)}</StandardPrice>
    </Price>
  </Message>
</AmazonEnvelope>`;

    console.log('📋 Pricing feed data (XML format):');
    console.log('---START XML FEED DATA---');
    console.log(xmlData);
    console.log('---END XML FEED DATA---');

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8'
      },
      body: xmlData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload XML pricing data: ${response.status} ${response.statusText} - ${errorText}`);
    }

    console.log('✅ XML pricing data uploaded to S3');
  }

  async submitFeed(token, feedDocumentId) {
    const feedPayload = {
      feedType: '_POST_PRODUCT_PRICING_DATA_',
      marketplaceIds: [this.config.marketplaceId],
      inputFeedDocumentId: feedDocumentId
    };

    console.log('📋 XML Feed submission payload:', JSON.stringify(feedPayload, null, 2));

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
      throw new Error(`Failed to submit XML feed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async logPriceUpdate(asin, sku, newPrice, currentPrice, feedResult) {
    try {
      const { data: updateData, error: updateError } = await this.supabase
        .from('buybox_data')
        .update({
          your_current_price: parseFloat(newPrice.toFixed(2)),
          last_price_update: new Date().toISOString(),
          update_source: 'feeds_api_xml',
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

// Test the XML format
async function testXMLFormat() {
  try {
    console.log('🧪 Testing XML _POST_PRODUCT_PRICING_DATA_ feed format...\n');

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
      console.log(`\n✅ SUCCESS! XML Feed ID: ${result.feedId}`);
      console.log('⏰ Check feed status in 2-3 minutes');
      console.log('📊 XML format may be what Amazon expects for your account');
    }

  } catch (error) {
    console.error('❌ XML Test failed:', error);
  }
}

testXMLFormat();
