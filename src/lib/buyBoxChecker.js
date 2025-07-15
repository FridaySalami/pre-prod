// lib/buyBoxChecker.js
// Buy Box checking logic extracted for use in API routes

import axios from 'axios';
import crypto from 'crypto';

// Your seller ID
export const YOUR_SELLER_ID = 'A2D8NG39VURSL3';

/**
 * Main function to check Buy Box status for an ASIN
 * @param {string} asin - The ASIN to check
 * @param {object} envVars - Environment variables object
 * @returns {Promise<object>} Buy Box data
 */
export async function checkBuyBoxStatus(asin, envVars = process.env) {
  const config = {
    marketplace: envVars.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
    region: 'eu-west-1',
    endpoint: 'https://sellingpartnerapi-eu.amazon.com',
    accessKeyId: envVars.AMAZON_AWS_ACCESS_KEY_ID,
    secretAccessKey: envVars.AMAZON_AWS_SECRET_ACCESS_KEY,
    refreshToken: envVars.AMAZON_REFRESH_TOKEN,
    clientId: envVars.AMAZON_CLIENT_ID,
    clientSecret: envVars.AMAZON_CLIENT_SECRET,
  };

  // Validate configuration
  const requiredConfigs = ['accessKeyId', 'secretAccessKey', 'refreshToken', 'clientId', 'clientSecret'];
  const missingConfigs = requiredConfigs.filter(key => !config[key]);

  if (missingConfigs.length > 0) {
    throw new Error(`Missing configuration: ${missingConfigs.join(', ')}`);
  }

  try {
    // Get access token
    const accessToken = await getAccessToken(config);

    // Get competitive pricing
    const pricingData = await getCompetitivePricing(asin, config, accessToken);

    // Transform the data
    const result = transformPricingData(pricingData, asin);

    return result;
  } catch (error) {
    console.error('Buy Box check failed:', error);
    throw error;
  }
}

/**
 * Get access token from Amazon SP-API
 */
async function getAccessToken(config) {
  try {
    const response = await axios.post('https://api.amazon.com/auth/o2/token', {
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Failed to get access token:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with Amazon SP-API');
  }
}

/**
 * Get competitive pricing data from Amazon SP-API
 */
async function getCompetitivePricing(asin, config, accessToken) {
  const method = 'GET';
  const path = `/products/pricing/v0/items/${asin}/offers`;
  const queryParams = {
    MarketplaceId: config.marketplace,
    ItemCondition: 'New'
  };

  const headers = {
    'host': 'sellingpartnerapi-eu.amazon.com',
    'x-amz-access-token': accessToken,
    'x-amz-date': new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z'
  };

  // Create AWS signature
  const signedHeaders = createSignature(method, path, queryParams, headers, '', config);

  const url = `${config.endpoint}${path}?${Object.keys(queryParams)
    .map(key => `${key}=${encodeURIComponent(queryParams[key])}`)
    .join('&')}`;

  try {
    const response = await axios.get(url, { headers: signedHeaders });
    return response.data;
  } catch (error) {
    console.error('Pricing API error:', error.response?.data || error.message);
    throw new Error('Failed to get pricing data from Amazon');
  }
}

/**
 * AWS Signature V4 implementation
 */
function createSignature(method, path, queryParams, headers, body, config) {
  const { region, accessKeyId, secretAccessKey } = config;
  const service = 'execute-api';

  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStamp = now.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';

  // Create canonical request
  const canonicalUri = path;
  const canonicalQuerystring = queryParams ? Object.keys(queryParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
    .join('&') : '';

  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map(key => `${key.toLowerCase()}:${headers[key]}\n`)
    .join('');

  const signedHeaders = Object.keys(headers)
    .sort()
    .map(key => key.toLowerCase())
    .join(';');

  const payloadHash = crypto.createHash('sha256').update(body || '').digest('hex');

  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `${algorithm}\n${timeStamp}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

  // Calculate signature
  const kDate = crypto.createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  // Add authorization header
  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...headers,
    'Authorization': authorization
  };
}

/**
 * Transform pricing data into Buy Box format
 */
function transformPricingData(pricingData, asin) {
  const offers = pricingData?.payload?.Offers || [];

  // Find Buy Box winner
  const buyBoxOffer = offers.find(offer => offer.IsBuyBoxWinner === true);

  // Find your offers
  const yourOffers = offers.filter(offer =>
    offer.SellerId === YOUR_SELLER_ID ||
    offer.SellerName?.includes('Your Store')
  );

  const hasBuyBox = yourOffers.some(offer => offer.IsBuyBoxWinner === true);

  // Get competitor info
  const competitorInfo = offers
    .filter(offer => offer.SellerId !== YOUR_SELLER_ID)
    .map(offer => ({
      sellerId: offer.SellerId,
      sellerName: offer.SellerName || 'Unknown',
      price: offer.ListingPrice?.Amount || 0,
      shipping: offer.Shipping?.Amount || 0,
      totalPrice: (offer.ListingPrice?.Amount || 0) + (offer.Shipping?.Amount || 0),
      condition: offer.SubCondition || 'new',
      fulfillmentType: offer.IsFulfilledByAmazon ? 'FBA' : 'FBM',
      hasBuyBox: offer.IsBuyBoxWinner === true,
      isPrime: offer.IsFulfilledByAmazon || false
    }));

  return {
    success: true,
    asin: asin,
    buyBoxOwner: buyBoxOffer?.SellerName || buyBoxOffer?.SellerId || 'Unknown',
    buyBoxSellerName: buyBoxOffer?.SellerName || 'Unknown',
    hasBuyBox: hasBuyBox,
    buyBoxPrice: buyBoxOffer?.ListingPrice?.Amount || null,
    buyBoxCurrency: buyBoxOffer?.ListingPrice?.CurrencyCode || 'GBP',
    lastChecked: new Date().toISOString(),
    competitorInfo: competitorInfo,
    yourOffers: yourOffers.map(offer => ({
      sellerId: offer.SellerId,
      sellerName: offer.SellerName || 'Your Store',
      price: offer.ListingPrice?.Amount || 0,
      shipping: offer.Shipping?.Amount || 0,
      totalPrice: (offer.ListingPrice?.Amount || 0) + (offer.Shipping?.Amount || 0),
      condition: offer.SubCondition || 'new',
      fulfillmentType: offer.IsFulfilledByAmazon ? 'FBA' : 'FBM',
      hasBuyBox: offer.IsBuyBoxWinner === true,
      isPrime: offer.IsFulfilledByAmazon || false
    })),
    recommendations: generateRecommendations(hasBuyBox, buyBoxOffer, yourOffers, competitorInfo)
  };
}

/**
 * Generate recommendations based on Buy Box status
 */
function generateRecommendations(hasBuyBox, buyBoxOffer, yourOffers, competitorInfo) {
  const recommendations = [];

  if (hasBuyBox) {
    recommendations.push('✅ Great! You own the Buy Box. Keep monitoring competitors.');
    recommendations.push('📊 Monitor your pricing to maintain Buy Box position.');
  } else {
    if (buyBoxOffer && yourOffers.length > 0) {
      const yourPrice = yourOffers[0].totalPrice;
      const buyBoxPrice = (buyBoxOffer.ListingPrice?.Amount || 0) + (buyBoxOffer.Shipping?.Amount || 0);

      if (yourPrice > buyBoxPrice) {
        const difference = yourPrice - buyBoxPrice;
        recommendations.push(`💰 Consider lowering your price by £${difference.toFixed(2)} to compete for Buy Box.`);
      }
    }

    recommendations.push('⚠️ You don\'t currently own the Buy Box.');
    recommendations.push('🔍 Review your pricing strategy and fulfillment method.');
  }

  return recommendations;
}
