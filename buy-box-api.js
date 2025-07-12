/**
 * Buy Box Monitor - API Integration Helper
 * 
 * This script is a simplified version of the enhanced-buy-box-checker.cjs
 * designed to be used with the Buy Box Monitor API.
 * 
 * Usage:
 *   node buy-box-api.js ASIN
 */

const fs = require('fs');
const path = require('path');
const { analyzeBuyBoxStatus } = require('./enhanced-buy-box-checker.cjs');
require('dotenv').config();

// Check if we have the necessary environment variables
const requiredEnvVars = [
  'AMAZON_REFRESH_TOKEN',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AMAZON_CLIENT_ID',
  'AMAZON_CLIENT_SECRET'
];

const missing = requiredEnvVars.filter(varName => !process.env[varName]);
if (missing.length > 0) {
  console.error(JSON.stringify({
    error: `Missing required environment variables: ${missing.join(', ')}`
  }));
  process.exit(1);
}

// Get ASIN from command line
const asin = process.argv[2];
if (!asin) {
  console.error(JSON.stringify({
    error: 'No ASIN provided'
  }));
  process.exit(1);
}

// Check if we know our seller ID
const sellerId = process.env.AMAZON_SELLER_ID;
if (!sellerId) {
  console.warn('AMAZON_SELLER_ID not found in environment variables. Buy Box ownership detection may be limited.');
}

async function main() {
  try {
    // Analyze Buy Box status using the enhanced checker
    const result = await analyzeBuyBoxStatus(null, asin);

    if (!result) {
      throw new Error('No result returned from analyzeBuyBoxStatus');
    }

    // Transform the result into a format suitable for the API
    const transformedResult = {
      asin: result.asin,
      buyBoxOwner: result.buyBoxWinner ? result.buyBoxWinner.sellerId : null,
      buyBoxSellerName: result.buyBoxWinner ? result.buyBoxWinner.sellerName : null,
      hasBuyBox: result.buyBoxWinner && result.buyBoxWinner.sellerId === sellerId,
      buyBoxPrice: result.buyBoxWinner ? result.buyBoxWinner.listingPrice : null,
      totalOffers: result.totalOffers,
      competitorInfo: result.offers ? result.offers.map(offer => ({
        sellerId: offer.sellerId,
        sellerName: offer.sellerName || 'Unknown',
        price: offer.listingPrice,
        shipping: offer.shippingPrice,
        totalPrice: offer.totalPrice,
        condition: offer.condition || 'New',
        fulfillmentType: offer.fulfillmentChannel,
        hasBuyBox: offer.sellerId === result.buyBoxWinner?.sellerId
      })) : []
    };

    // Return the result as JSON
    console.log(JSON.stringify(transformedResult, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      error: error.message || 'Unknown error occurred'
    }));
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error(JSON.stringify({
    error: error.message || 'Unknown error occurred'
  }));
  process.exit(1);
});
