/**
 * Get current ASIN competitive pricing and Buy Box data
 * This is what your SP-API access is best suited for!
 * Usage: node get-asin-buybox-analysis.cjs
 */

// Load environment variables from .env file
require('dotenv').config();

const axios = require('axios');
const crypto = require('crypto');

class AmazonPricingAPI {
  constructor() {
    this.config = {
      clientId: process.env.AMAZON_CLIENT_ID,
      clientSecret: process.env.AMAZON_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN,
      marketplace: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P', // UK marketplace
      endpoint: 'https://sellingpartnerapi-eu.amazon.com',
      region: 'eu-west-1',
      accessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY
    };

    this.accessToken = null;
    this.tokenExpiry = null;
  }

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
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);

      return this.accessToken;
    } catch (error) {
      console.error('Failed to get Amazon access token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Amazon SP-API');
    }
  }

  createSignature(method, path, queryParams, headers, body) {
    const service = 'execute-api';
    const host = 'sellingpartnerapi-eu.amazon.com';
    const region = this.config.region;

    const canonicalUri = path;
    const canonicalQueryString = Object.keys(queryParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');

    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map(key => `${key.toLowerCase()}:${headers[key]}`)
      .join('\n') + '\n';

    const signedHeaders = Object.keys(headers)
      .sort()
      .map(key => key.toLowerCase())
      .join(';');

    const payloadHash = crypto.createHash('sha256').update(body).digest('hex');

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    const algorithm = 'AWS4-HMAC-SHA256';
    const amzDate = headers['x-amz-date'];
    const dateStamp = amzDate.substr(0, 8);
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    const kDate = crypto.createHmac('sha256', `AWS4${this.config.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    const authorizationHeader = `${algorithm} Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      ...headers,
      'Authorization': authorizationHeader
    };
  }

  /**
   * Get competitive pricing data (THIS WORKS with basic SP-API!)
   */
  async getCompetitivePricing(asin) {
    const accessToken = await this.getAccessToken();

    const method = 'GET';
    const path = `/products/pricing/v0/items/${asin}/offers`;
    const queryParams = {
      MarketplaceId: this.config.marketplace,
      ItemCondition: 'New'
    };

    const amzDate = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
    const headers = {
      'host': 'sellingpartnerapi-eu.amazon.com',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': crypto.createHash('sha256').update('').digest('hex')
    };

    const signedHeaders = this.createSignature(method, path, queryParams, headers, '');

    const url = `${this.config.endpoint}${path}?${Object.keys(queryParams)
      .map(key => `${key}=${encodeURIComponent(queryParams[key])}`)
      .join('&')}`;

    try {
      const response = await axios.get(url, {
        headers: signedHeaders,
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      console.error(`Pricing API error:`, error.response?.data || error.message);

      if (error.response?.status === 429) {
        throw new Error('RATE_LIMITED');
      } else if (error.response?.status === 403) {
        throw new Error('ACCESS_DENIED');
      } else if (error.response?.status === 404) {
        throw new Error('ASIN_NOT_FOUND');
      } else {
        throw new Error(`PRICING_API_ERROR: ${error.message}`);
      }
    }
  }

  /**
   * Get catalog information for an ASIN
   */
  async getCatalogItem(asin) {
    const accessToken = await this.getAccessToken();

    const method = 'GET';
    const path = `/catalog/2022-04-01/items/${asin}`;
    const queryParams = {
      marketplaceIds: this.config.marketplace,
      includedData: 'attributes,images,productTypes,salesRanks,summaries'
    };

    const amzDate = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
    const headers = {
      'host': 'sellingpartnerapi-eu.amazon.com',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': crypto.createHash('sha256').update('').digest('hex')
    };

    const signedHeaders = this.createSignature(method, path, queryParams, headers, '');

    const url = `${this.config.endpoint}${path}?${Object.keys(queryParams)
      .map(key => `${key}=${encodeURIComponent(queryParams[key])}`)
      .join('&')}`;

    try {
      const response = await axios.get(url, {
        headers: signedHeaders,
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      console.error(`Catalog API error:`, error.response?.data || error.message);
      return null; // Non-critical, continue without catalog data
    }
  }

  /**
   * Analyze Buy Box and competitive landscape
   */
  analyzePricingData(pricingData, asin) {
    const offers = pricingData?.payload?.Offers || [];

    if (offers.length === 0) {
      return {
        asin,
        error: 'No offers found',
        timestamp: new Date().toISOString()
      };
    }

    const yourSellerId = process.env.AMAZON_SELLER_ID;
    const buyBoxOffer = offers.find(offer => offer.IsBuyBoxWinner === true);
    const yourOffer = offers.find(offer => offer.SellerId === yourSellerId);

    const allPrices = offers.map(offer => ({
      sellerId: offer.SellerId,
      sellerName: offer.SellerName || 'Unknown',
      price: parseFloat(offer.ListingPrice?.Amount || 0),
      shipping: parseFloat(offer.Shipping?.Amount || 0),
      total: parseFloat(offer.ListingPrice?.Amount || 0) + parseFloat(offer.Shipping?.Amount || 0),
      isBuyBox: offer.IsBuyBoxWinner,
      isYours: offer.SellerId === yourSellerId,
      condition: offer.SubCondition,
      fulfillment: offer.IsFulfilledByAmazon ? 'FBA' : 'FBM'
    })).sort((a, b) => a.total - b.total);

    const analysis = {
      asin,
      timestamp: new Date().toISOString(),
      total_offers: offers.length,

      // Buy Box Analysis
      buybox: {
        winner: buyBoxOffer ? {
          seller_id: buyBoxOffer.SellerId,
          seller_name: buyBoxOffer.SellerName || 'Unknown',
          price: parseFloat(buyBoxOffer.ListingPrice?.Amount || 0),
          shipping: parseFloat(buyBoxOffer.Shipping?.Amount || 0),
          total: parseFloat(buyBoxOffer.ListingPrice?.Amount || 0) + parseFloat(buyBoxOffer.Shipping?.Amount || 0),
          fulfillment: buyBoxOffer.IsFulfilledByAmazon ? 'FBA' : 'FBM'
        } : null,
        you_own_buybox: buyBoxOffer?.SellerId === yourSellerId
      },

      // Your Position
      your_offer: yourOffer ? {
        price: parseFloat(yourOffer.ListingPrice?.Amount || 0),
        shipping: parseFloat(yourOffer.Shipping?.Amount || 0),
        total: parseFloat(yourOffer.ListingPrice?.Amount || 0) + parseFloat(yourOffer.Shipping?.Amount || 0),
        fulfillment: yourOffer.IsFulfilledByAmazon ? 'FBA' : 'FBM',
        rank_by_price: allPrices.findIndex(p => p.isYours) + 1
      } : null,

      // Competitive Analysis
      pricing: {
        lowest_price: Math.min(...allPrices.map(p => p.total)),
        highest_price: Math.max(...allPrices.map(p => p.total)),
        average_price: parseFloat((allPrices.reduce((sum, p) => sum + p.total, 0) / allPrices.length).toFixed(2)),
        price_range: Math.max(...allPrices.map(p => p.total)) - Math.min(...allPrices.map(p => p.total))
      },

      // Opportunities
      opportunities: {
        can_win_buybox: yourOffer && buyBoxOffer && yourOffer.SellerId !== buyBoxOffer.SellerId,
        price_gap_to_buybox: yourOffer && buyBoxOffer ?
          parseFloat((parseFloat(yourOffer.ListingPrice?.Amount || 0) - parseFloat(buyBoxOffer.ListingPrice?.Amount || 0)).toFixed(2)) : null,
        price_gap_percentage: yourOffer && buyBoxOffer ?
          parseFloat((((parseFloat(yourOffer.ListingPrice?.Amount || 0) - parseFloat(buyBoxOffer.ListingPrice?.Amount || 0)) / parseFloat(buyBoxOffer.ListingPrice?.Amount || 1)) * 100).toFixed(2)) : null
      },

      // All Offers (sorted by price)
      all_offers: allPrices
    };

    return analysis;
  }
}

async function getAsinBuyBoxAnalysis() {
  const asin = 'B07H1HW13V';

  try {
    console.log(`🎯 ASIN Buy Box & Competitive Analysis: ${asin}`);
    console.log(`💡 This is what your SP-API access is perfect for!`);
    console.log('─'.repeat(70));

    const pricingApi = new AmazonPricingAPI();

    console.log('🔍 Fetching current competitive pricing data...');

    // Get competitive pricing (this works!)
    const pricingData = await pricingApi.getCompetitivePricing(asin);

    // Get catalog info (bonus data if available)
    console.log('📋 Fetching product catalog information...');
    const catalogData = await pricingApi.getCatalogItem(asin);

    // Analyze the data
    const analysis = pricingApi.analyzePricingData(pricingData, asin);

    // Display results
    console.log('\n🎯 BUY BOX ANALYSIS');
    console.log('─'.repeat(70));
    console.log(`ASIN: ${analysis.asin}`);
    console.log(`Total Offers: ${analysis.total_offers}`);
    console.log(`Timestamp: ${analysis.timestamp}`);

    if (catalogData?.summaries?.[0]) {
      const summary = catalogData.summaries[0];
      console.log(`Product Title: ${summary.itemName || 'N/A'}`);

      if (summary.salesRanks?.[0]) {
        console.log(`Sales Rank: #${summary.salesRanks[0].rank} in ${summary.salesRanks[0].displayGroupName || summary.salesRanks[0].classificationId}`);
      }
    }

    console.log('\n👑 BUY BOX STATUS');
    console.log('─'.repeat(70));
    if (analysis.buybox.winner) {
      const bb = analysis.buybox.winner;
      console.log(`Winner: ${bb.seller_name} (${bb.seller_id})`);
      console.log(`Price: £${bb.price} + £${bb.shipping} shipping = £${bb.total}`);
      console.log(`Fulfillment: ${bb.fulfillment}`);
      console.log(`You Own Buy Box: ${analysis.buybox.you_own_buybox ? '✅ YES' : '❌ NO'}`);
    } else {
      console.log('❌ No Buy Box winner found');
    }

    console.log('\n🏪 YOUR OFFER');
    console.log('─'.repeat(70));
    if (analysis.your_offer) {
      const yo = analysis.your_offer;
      console.log(`Your Price: £${yo.price} + £${yo.shipping} shipping = £${yo.total}`);
      console.log(`Your Rank: #${yo.rank_by_price} out of ${analysis.total_offers} offers`);
      console.log(`Fulfillment: ${yo.fulfillment}`);
    } else {
      console.log('❌ You don\'t have an active offer for this ASIN');
    }

    console.log('\n📊 MARKET ANALYSIS');
    console.log('─'.repeat(70));
    const p = analysis.pricing;
    console.log(`Price Range: £${p.lowest_price} - £${p.highest_price} (spread: £${p.price_range.toFixed(2)})`);
    console.log(`Average Price: £${p.average_price}`);

    console.log('\n🎯 OPPORTUNITIES');
    console.log('─'.repeat(70));
    const opp = analysis.opportunities;
    if (opp.can_win_buybox) {
      console.log(`💰 Buy Box Opportunity: YES`);
      console.log(`   Your price is £${Math.abs(opp.price_gap_to_buybox).toFixed(2)} ${opp.price_gap_to_buybox > 0 ? 'ABOVE' : 'BELOW'} Buy Box`);
      console.log(`   Percentage difference: ${Math.abs(opp.price_gap_percentage).toFixed(2)}%`);

      if (opp.price_gap_to_buybox > 0) {
        const newPrice = analysis.buybox.winner.price - 0.01;
        console.log(`   💡 Consider lowering to £${newPrice.toFixed(2)} to compete for Buy Box`);
      }
    } else if (analysis.buybox.you_own_buybox) {
      console.log(`🏆 You already own the Buy Box!`);
    } else {
      console.log(`ℹ️  No immediate Buy Box opportunity identified`);
    }

    console.log('\n🏪 ALL COMPETITORS (sorted by price)');
    console.log('─'.repeat(70));
    analysis.all_offers.forEach((offer, index) => {
      const indicator = offer.isBuyBox ? '👑' : offer.isYours ? '🏠' : '🏪';
      const status = offer.isBuyBox ? '[BUY BOX]' : offer.isYours ? '[YOU]' : '';
      console.log(`${indicator} #${index + 1}: £${offer.total.toFixed(2)} - ${offer.sellerName} ${status}`);
      console.log(`     Price: £${offer.price} + £${offer.shipping} shipping (${offer.fulfillment})`);
    });

    console.log('\n✅ Buy Box analysis completed!');
    console.log('\n💡 This real-time competitive intelligence is what SP-API excels at!');
    console.log('💡 For historical sales data, use Amazon Seller Central reports instead.');

  } catch (error) {
    console.error('\n❌ Error in Buy Box analysis:', error.message);

    if (error.message === 'ASIN_NOT_FOUND') {
      console.log('💡 This ASIN might not exist or not be available in your marketplace');
    } else if (error.message === 'ACCESS_DENIED') {
      console.log('💡 Check your SP-API credentials');
    } else if (error.message === 'RATE_LIMITED') {
      console.log('💡 Try again in a few minutes');
    }

    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  getAsinBuyBoxAnalysis();
}

module.exports = { getAsinBuyBoxAnalysis, AmazonPricingAPI };
