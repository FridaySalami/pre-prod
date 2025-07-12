#!/usr/bin/env node

/**
 * Enhanced Buy Box Checker
 * 
 * This script analyzes pricing data to help identify Buy Box ownership
 * by examining offer patterns and pricing relationships.
 * 
 * Usage:
 *   node enhanced-buy-box-checker.cjs B0104R0FRG
 *   node enhanced-buy-box-checker.cjs ASIN1 ASIN2 ASIN3
 */

const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// Configuration
const config = {
  marketplace: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P', // UK marketplace
  region: 'eu-west-1',
  endpoint: 'https://sellingpartnerapi-eu.amazon.com',

  // AWS credentials
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,

  // SP-API credentials
  refreshToken: process.env.AMAZON_REFRESH_TOKEN,
  clientId: process.env.AMAZON_CLIENT_ID,
  clientSecret: process.env.AMAZON_CLIENT_SECRET,
};

// AWS Signature V4 implementation
function createSignature(method, path, queryParams, headers, body, region, service, accessKeyId, secretAccessKey) {
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStamp = now.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';

  // Canonical request
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

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  // String to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    timeStamp,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  // Calculate signature
  const kDate = crypto.createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  return {
    authorization: `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-date': timeStamp
  };
}

// Get access token
async function getAccessToken() {
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
    console.error('❌ Error getting access token:', error.response?.data || error.message);
    throw error;
  }
}

// Get detailed pricing data
async function getDetailedPricing(accessToken, asin) {
  try {
    const path = `/products/pricing/v0/items/${asin}/offers`;
    const queryParams = {
      MarketplaceId: config.marketplace,
      ItemCondition: 'New'
    };

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'x-amz-access-token': accessToken,
      'Content-Type': 'application/json',
      'Host': 'sellingpartnerapi-eu.amazon.com'
    };

    const signatureData = createSignature(
      'GET',
      path,
      queryParams,
      headers,
      '',
      config.region,
      'execute-api',
      config.accessKeyId,
      config.secretAccessKey
    );

    headers['Authorization'] = signatureData.authorization;
    headers['x-amz-date'] = signatureData['x-amz-date'];

    const queryString = Object.keys(queryParams)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');

    const response = await axios.get(`${config.endpoint}${path}?${queryString}`, {
      headers,
      timeout: 10000
    });

    return response.data;
  } catch (error) {
    console.error(`❌ Error getting pricing for ${asin}:`, error.response?.status, error.response?.data || error.message);
    return null;
  }
}

// Get your own listings (alternative method)
async function getMyListings(accessToken, asin) {
  try {
    const path = `/listings/2021-08-01/items/${config.marketplace}/${asin}`;

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'x-amz-access-token': accessToken,
      'Content-Type': 'application/json',
      'Host': 'sellingpartnerapi-eu.amazon.com'
    };

    const signatureData = createSignature(
      'GET',
      path,
      null,
      headers,
      '',
      config.region,
      'execute-api',
      config.accessKeyId,
      config.secretAccessKey
    );

    headers['Authorization'] = signatureData.authorization;
    headers['x-amz-date'] = signatureData['x-amz-date'];

    const response = await axios.get(`${config.endpoint}${path}`, {
      headers,
      timeout: 10000
    });

    return response.data;
  } catch (error) {
    // 404 means you don't have this listing
    if (error.response?.status === 404) {
      return null;
    }
    console.error(`❌ Error getting listings for ${asin}:`, error.response?.status, error.response?.data || error.message);
    return null;
  }
}

// Analyze Buy Box status
async function analyzeBuyBoxStatus(accessToken, asin) {
  console.log(`\n🔍 Analyzing Buy Box status for ASIN: ${asin}`);
  console.log('═'.repeat(60));

  try {
    // Get pricing data
    const pricingData = await getDetailedPricing(accessToken, asin);

    if (!pricingData || !pricingData.payload) {
      console.log('❌ No pricing data available for this ASIN');
      return null;
    }

    const offers = pricingData.payload.Offers || [];

    if (offers.length === 0) {
      console.log('❌ No offers found for this ASIN');
      return null;
    }

    console.log(`📊 Found ${offers.length} offer(s)`);

    // Check if you have a listing for this ASIN
    console.log('🔍 Checking if you have a listing for this ASIN...');
    const myListing = await getMyListings(accessToken, asin);
    const youHaveListing = myListing !== null;

    if (youHaveListing) {
      console.log('✅ You have a listing for this ASIN');
    } else {
      console.log('❌ You do not have a listing for this ASIN');
    }

    // Analyze offers
    let buyBoxWinner = null;
    let lowestPrice = null;
    let highestPrice = null;

    const formattedOffers = offers.map((offer, index) => {
      const listingPrice = offer.ListingPrice;
      const shipping = offer.Shipping;
      const totalPrice = listingPrice.Amount + (shipping ? shipping.Amount : 0);

      const offerInfo = {
        index: index + 1,
        sellerId: offer.SellerId || 'Unknown',
        price: listingPrice.Amount,
        currency: listingPrice.CurrencyCode,
        condition: offer.SubCondition,
        fulfillment: offer.IsFulfilledByAmazon ? 'FBA' : 'FBM',
        totalPrice: totalPrice,
        shippingPrice: shipping ? shipping.Amount : 0,
        isBuyBox: offer.IsBuyBoxWinner || false,
        primeEligible: offer.PrimeInformation?.IsOfferPrime || false,
        availabilityType: offer.AvailabilityType || 'NOW',
        sellerFeedbackCount: offer.SellerFeedbackCount || 0,
        sellerFeedbackRating: offer.SellerFeedbackRating || 0,
        shipsFromCountry: offer.ShipsFrom?.Country || 'Unknown'
      };

      if (offer.IsBuyBoxWinner) {
        buyBoxWinner = offerInfo;
      }

      if (lowestPrice === null || totalPrice < lowestPrice.totalPrice) {
        lowestPrice = offerInfo;
      }

      if (highestPrice === null || totalPrice > highestPrice.totalPrice) {
        highestPrice = offerInfo;
      }

      return offerInfo;
    });

    // Display Buy Box analysis
    console.log('\n🏆 BUY BOX ANALYSIS');
    console.log('─'.repeat(40));

    if (buyBoxWinner) {
      console.log(`Buy Box Winner Details:`);
      console.log(`💰 Price: ${buyBoxWinner.price} ${buyBoxWinner.currency}`);
      console.log(`🚚 Shipping: ${buyBoxWinner.shippingPrice} ${buyBoxWinner.currency}`);
      console.log(`💳 Total: ${buyBoxWinner.totalPrice} ${buyBoxWinner.currency}`);
      console.log(`📦 Fulfillment: ${buyBoxWinner.fulfillment}`);
      console.log(`⭐ Prime: ${buyBoxWinner.primeEligible ? 'Yes' : 'No'}`);
      console.log(`🌍 Ships from: ${buyBoxWinner.shipsFromCountry}`);
      console.log(`📊 Seller Rating: ${buyBoxWinner.sellerFeedbackRating}/5 (${buyBoxWinner.sellerFeedbackCount} reviews)`);
      console.log(`🆔 Seller ID: ${buyBoxWinner.sellerId}`);

      if (youHaveListing) {
        console.log(`\n❓ Is this your offer? You'll need to compare the seller ID with your own seller ID`);
        console.log(`💡 To get your seller ID, check your Amazon Seller Central account`);
      }
    } else {
      console.log('❌ No Buy Box winner found');
    }

    // Display price analysis
    console.log('\n💰 PRICE ANALYSIS');
    console.log('─'.repeat(40));

    if (lowestPrice) {
      console.log(`Lowest Price: ${lowestPrice.price} ${lowestPrice.currency} (Total: ${lowestPrice.totalPrice})`);
      console.log(`   📦 Fulfillment: ${lowestPrice.fulfillment}`);
      console.log(`   🆔 Seller: ${lowestPrice.sellerId.substring(0, 12)}...`);
    }

    if (highestPrice) {
      console.log(`Highest Price: ${highestPrice.price} ${highestPrice.currency} (Total: ${highestPrice.totalPrice})`);
      console.log(`   📦 Fulfillment: ${highestPrice.fulfillment}`);
      console.log(`   🆔 Seller: ${highestPrice.sellerId.substring(0, 12)}...`);
    }

    const priceRange = highestPrice && lowestPrice ?
      (highestPrice.totalPrice - lowestPrice.totalPrice).toFixed(2) : 0;
    console.log(`📊 Price Range: ${priceRange} ${lowestPrice?.currency || 'GBP'}`);

    // Display all offers
    console.log('\n📋 ALL OFFERS');
    console.log('─'.repeat(40));

    formattedOffers.forEach(offer => {
      const buyBoxStatus = offer.isBuyBox ? ' 🏆 BUY BOX' : '';
      const primeStatus = offer.primeEligible ? ' ⭐ PRIME' : '';

      console.log(`${offer.index}. ${offer.price} ${offer.currency} (${offer.condition}) - ${offer.fulfillment}${buyBoxStatus}${primeStatus}`);
      console.log(`   🚚 Shipping: ${offer.shippingPrice} ${offer.currency}`);
      console.log(`   💳 Total: ${offer.totalPrice} ${offer.currency}`);
      console.log(`   📊 Seller: ${offer.sellerFeedbackRating}/5 (${offer.sellerFeedbackCount} reviews)`);
      console.log(`   🆔 ID: ${offer.sellerId.substring(0, 12)}...`);
      console.log(`   🌍 Ships from: ${offer.shipsFromCountry}`);
      console.log('');
    });

    // Buy Box insights
    console.log('\n💡 BUY BOX INSIGHTS');
    console.log('─'.repeat(40));

    if (buyBoxWinner) {
      console.log('Key factors for Buy Box eligibility:');
      console.log(`✓ Competitive pricing (Buy Box: ${buyBoxWinner.totalPrice} vs Lowest: ${lowestPrice.totalPrice})`);
      console.log(`✓ Fulfillment method: ${buyBoxWinner.fulfillment}`);
      console.log(`✓ Prime eligibility: ${buyBoxWinner.primeEligible ? 'Yes' : 'No'}`);
      console.log(`✓ Seller performance: ${buyBoxWinner.sellerFeedbackRating}/5`);
      console.log(`✓ Availability: ${buyBoxWinner.availabilityType}`);

      if (youHaveListing) {
        console.log('\n🎯 TO WIN THE BUY BOX:');
        console.log('1. Compare your seller ID with the Buy Box winner above');
        console.log('2. If not yours, consider:');
        console.log('   • Matching or beating the Buy Box price');
        console.log('   • Using FBA if the winner uses FBA');
        console.log('   • Ensuring Prime eligibility');
        console.log('   • Maintaining excellent seller metrics');
      }
    }

    return {
      asin: asin,
      youHaveListing: youHaveListing,
      buyBoxWinner: buyBoxWinner,
      totalOffers: offers.length,
      priceRange: priceRange,
      lowestPrice: lowestPrice,
      highestPrice: highestPrice,
      offers: formattedOffers
    };

  } catch (error) {
    console.error('❌ Error analyzing Buy Box status:', error.message);
    return null;
  }
}

// Main execution
async function main() {
  console.log('🏆 Enhanced Buy Box Analysis Tool');
  console.log('═'.repeat(60));

  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('❌ Please provide at least one ASIN');
    console.log('\nUsage:');
    console.log('  node enhanced-buy-box-checker.cjs B0104R0FRG');
    console.log('  node enhanced-buy-box-checker.cjs ASIN1 ASIN2 ASIN3');
    console.log('\nNote: To determine if you own the Buy Box, compare your seller ID');
    console.log('      (found in Seller Central) with the Buy Box winner\'s seller ID.');
    process.exit(1);
  }

  // Validate configuration
  const requiredEnvVars = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AMAZON_REFRESH_TOKEN',
    'AMAZON_CLIENT_ID',
    'AMAZON_CLIENT_SECRET'
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }

  const asins = args.filter(arg => !arg.startsWith('--'));

  console.log(`🌍 Marketplace: ${config.marketplace}`);
  console.log(`📦 Analyzing ${asins.length} ASIN(s): ${asins.join(', ')}`);

  try {
    const accessToken = await getAccessToken();
    const results = [];

    // Analyze each ASIN
    for (const asin of asins) {
      const result = await analyzeBuyBoxStatus(accessToken, asin);
      if (result) {
        results.push(result);
      }

      // Rate limiting between requests
      if (asins.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    // Final summary
    console.log('\n📊 FINAL SUMMARY');
    console.log('═'.repeat(60));

    if (results.length === 0) {
      console.log('❌ No results obtained');
    } else {
      console.log(`📋 Analyzed ${results.length} ASIN(s):`);

      results.forEach(result => {
        const listingStatus = result.youHaveListing ? '✅ Listed' : '❌ Not Listed';
        const buyBoxPrice = result.buyBoxWinner ?
          `${result.buyBoxWinner.totalPrice} ${result.buyBoxWinner.currency}` : 'No Buy Box';

        console.log(`   ${result.asin}: ${listingStatus} | Buy Box: ${buyBoxPrice} | ${result.totalOffers} offers`);
      });

      console.log('\n💡 Remember: To determine Buy Box ownership, compare your seller ID');
      console.log('   (from Seller Central) with the Buy Box winner\'s seller ID shown above.');
    }

    console.log('\n🎉 Buy Box analysis completed!');

  } catch (error) {
    console.error('❌ Error during execution:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { analyzeBuyBoxStatus };
