#!/usr/bin/env node

/**
 * Personal Buy Box Monitor
 * 
 * This script is customized for your seller ID: A2D8NG39VURSL3
 * It will automatically check if you own the Buy Box for any ASINs you provide.
 * 
 * Usage:
 *   node my-buy-box-monitor.cjs B0104R0FRG
 *   node my-buy-box-monitor.cjs ASIN1 ASIN2 ASIN3
 *   node my-buy-box-monitor.cjs ASIN --json  (for programmatic API usage)
 */

const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// Your seller ID
const YOUR_SELLER_ID = 'A2D8NG39VURSL3';

// Configuration
const config = {
  marketplace: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
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

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    timeStamp,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

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

// Get pricing data
async function getPricingData(accessToken, asin, jsonOutput = false) {
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
    // Enhanced error handling for better debugging
    const status = error.response?.status;
    const errorData = error.response?.data;
    const isRateLimit = status === 429 || (errorData && /rate|limit|throttl/i.test(JSON.stringify(errorData)));

    // Log detailed error information
    if (!jsonOutput) {
      console.error(`❌ Error getting pricing for ${asin}:`);
      console.error(`   Status: ${status || 'Unknown'}`);

      if (isRateLimit) {
        console.error('   ⚠️ RATE LIMIT DETECTED - Amazon SP API throttling');
      }

      if (errorData) {
        console.error('   Response data:', JSON.stringify(errorData, null, 2));
      }

      console.error(`   Error message: ${error.message}`);
    }

    // If this is JSON output mode, include error details in the return
    if (jsonOutput) {
      return {
        error: true,
        errorType: isRateLimit ? 'RATE_LIMIT' : 'API_ERROR',
        errorStatus: status,
        errorMessage: error.message,
        errorData: errorData
      };
    }

    return null;
  }
}

// Check your Buy Box status
async function checkYourBuyBoxStatus(accessToken, asin, jsonOutput = false) {
  if (!jsonOutput) {
    console.log(`\n🔍 Checking Buy Box status for ASIN: ${asin}`);
    console.log('═'.repeat(60));
  }

  try {
    const pricingData = await getPricingData(accessToken, asin, jsonOutput);

    // Check if we got an error object from getPricingData
    if (pricingData && pricingData.error === true) {
      if (jsonOutput) {
        // For API/JSON mode, return structured error information
        return {
          asin: asin,
          error: true,
          errorType: pricingData.errorType,
          errorMessage: pricingData.errorMessage,
          errorStatus: pricingData.errorStatus
        };
      } else {
        // Already logged detailed error in getPricingData
        console.log(`❌ Failed to get pricing data for ${asin}`);
        return null;
      }
    }

    if (!pricingData || !pricingData.payload) {
      if (!jsonOutput) {
        console.log('❌ No pricing data available for this ASIN');
      }
      return null;
    }

    const offers = pricingData.payload.Offers || [];

    if (offers.length === 0) {
      if (!jsonOutput) {
        console.log('❌ No offers found for this ASIN');
      }
      return null;
    }

    // Find your offers and Buy Box winner
    let buyBoxWinner = null;
    let yourOffers = [];
    let competitorOffers = [];
    let recommendations = [];

    offers.forEach(offer => {
      const sellerId = offer.SellerId || 'Unknown';
      const listingPrice = offer.ListingPrice;
      const shipping = offer.Shipping;
      const totalPrice = listingPrice.Amount + (shipping ? shipping.Amount : 0);

      const offerInfo = {
        sellerId: sellerId,
        sellerName: sellerId === YOUR_SELLER_ID ? 'Your Store' : `Seller ${sellerId.substring(0, 8)}...`,
        price: listingPrice.Amount,
        currency: listingPrice.CurrencyCode,
        condition: offer.SubCondition,
        fulfillment: offer.IsFulfilledByAmazon ? 'FBA' : 'FBM',
        totalPrice: totalPrice,
        shippingPrice: shipping ? shipping.Amount : 0,
        isBuyBox: offer.IsBuyBoxWinner || false,
        primeEligible: offer.PrimeInformation?.IsOfferPrime || false
      };

      if (offer.IsBuyBoxWinner) {
        buyBoxWinner = offerInfo;
      }

      if (sellerId === YOUR_SELLER_ID) {
        yourOffers.push(offerInfo);
      } else {
        competitorOffers.push(offerInfo);
      }
    });

    // Check if you own the Buy Box
    const youOwnBuyBox = buyBoxWinner && buyBoxWinner.sellerId === YOUR_SELLER_ID;

    // Console output (only when not in JSON mode)
    if (!jsonOutput) {
      console.log('🏆 BUY BOX STATUS');
      console.log('─'.repeat(40));

      if (youOwnBuyBox) {
        console.log('🎉 ✅ YOU OWN THE BUY BOX! 🏆');
        console.log(`💰 Your Buy Box Price: ${buyBoxWinner.price} ${buyBoxWinner.currency}`);
        console.log(`🚚 Shipping: ${buyBoxWinner.shippingPrice} ${buyBoxWinner.currency}`);
        console.log(`💳 Total: ${buyBoxWinner.totalPrice} ${buyBoxWinner.currency}`);
        console.log(`📦 Fulfillment: ${buyBoxWinner.fulfillment}`);
        console.log(`⭐ Prime: ${buyBoxWinner.primeEligible ? 'Yes' : 'No'}`);
      } else if (yourOffers.length === 0) {
        console.log('❌ You have no offers for this ASIN');
      } else {
        console.log('❌ You do NOT own the Buy Box');
        if (buyBoxWinner) {
          console.log(`🏆 Buy Box Winner: ${buyBoxWinner.sellerId}`);
          console.log(`💰 Buy Box Price: ${buyBoxWinner.price} ${buyBoxWinner.currency}`);
          console.log(`📦 Fulfillment: ${buyBoxWinner.fulfillment}`);
          console.log(`⭐ Prime: ${buyBoxWinner.primeEligible ? 'Yes' : 'No'}`);
        }
      }

      // Show your offers
      if (yourOffers.length > 0) {
        console.log('\n🏪 YOUR OFFERS');
        console.log('─'.repeat(40));
        yourOffers.forEach((offer, index) => {
          const buyBoxStatus = offer.isBuyBox ? ' 🏆 BUY BOX' : '';
          console.log(`${index + 1}. ${offer.price} ${offer.currency} (${offer.condition}) - ${offer.fulfillment}${buyBoxStatus}`);
          console.log(`   🚚 Shipping: ${offer.shippingPrice} ${offer.currency}`);
          console.log(`   💳 Total: ${offer.totalPrice} ${offer.currency}`);
          console.log(`   ⭐ Prime: ${offer.primeEligible ? 'Yes' : 'No'}`);
        });
      }

      // Show competition
      if (competitorOffers.length > 0) {
        console.log('\n🏬 COMPETITION');
        console.log('─'.repeat(40));

        // Sort by price
        competitorOffers.sort((a, b) => a.totalPrice - b.totalPrice);

        competitorOffers.forEach((offer, index) => {
          const buyBoxStatus = offer.isBuyBox ? ' 🏆 BUY BOX' : '';
          console.log(`${index + 1}. ${offer.price} ${offer.currency} (${offer.condition}) - ${offer.fulfillment}${buyBoxStatus}`);
          console.log(`   🚚 Shipping: ${offer.shippingPrice} ${offer.currency}`);
          console.log(`   💳 Total: ${offer.totalPrice} ${offer.currency}`);
          console.log(`   ⭐ Prime: ${offer.primeEligible ? 'Yes' : 'No'}`);
          console.log(`   🆔 Seller: ${offer.sellerId.substring(0, 12)}...`);
        });
      }
    }

    // Generate recommendations
    recommendations = [];

    if (youOwnBuyBox) {
      recommendations.push('✅ Great! You own the Buy Box. Keep monitoring competitors.');
      recommendations.push('📊 Monitor your pricing to maintain Buy Box position.');
    } else if (yourOffers.length === 0) {
      recommendations.push('❌ You have no offers for this ASIN.');
      recommendations.push('💡 Consider adding this product to your inventory.');
    } else {
      recommendations.push('❌ You need to optimize to win the Buy Box.');
      if (buyBoxWinner) {
        const yourPrice = yourOffers[0].totalPrice;
        const buyBoxPrice = buyBoxWinner.totalPrice;
        const priceDiff = yourPrice - buyBoxPrice;

        if (priceDiff > 0) {
          recommendations.push(`💰 Lower your price by ${priceDiff.toFixed(2)} ${buyBoxWinner.currency} to match Buy Box`);
        }

        if (buyBoxWinner.fulfillment === 'FBA' && yourOffers[0].fulfillment === 'FBM') {
          recommendations.push('📦 Consider using FBA for better Buy Box chances');
        }

        if (buyBoxWinner.primeEligible && !yourOffers[0].primeEligible) {
          recommendations.push('⭐ Enable Prime eligibility to improve Buy Box chances');
        }
      }
    }

    // Console display for recommendations (only when not in JSON mode)
    if (!jsonOutput) {
      console.log('\n💡 RECOMMENDATIONS');
      console.log('─'.repeat(40));
      recommendations.forEach(rec => console.log(rec));
    }

    return {
      asin: asin,
      youOwnBuyBox: youOwnBuyBox,
      yourOffers: yourOffers,
      buyBoxWinner: buyBoxWinner,
      competitorOffers: competitorOffers,
      totalOffers: offers.length,
      recommendations: recommendations
    };

  } catch (error) {
    if (!jsonOutput) {
      console.error('❌ Error checking Buy Box status:', error.message);
    }
    return null;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('❌ Please provide at least one ASIN');
    console.log('\nUsage:');
    console.log('  node my-buy-box-monitor.cjs B0104R0FRG');
    console.log('  node my-buy-box-monitor.cjs ASIN1 ASIN2 ASIN3');
    console.log('  node my-buy-box-monitor.cjs ASIN --json  (for programmatic API usage)');
    process.exit(1);
  }

  // Check if JSON output is requested (for programmatic use)
  const jsonOutput = args.includes('--json');

  const asins = args.filter(arg => !arg.startsWith('--'));

  // If not JSON output, print normal console messages
  if (!jsonOutput) {
    console.log('🏆 Personal Buy Box Monitor');
    console.log(`👤 Your Seller ID: ${YOUR_SELLER_ID}`);
    console.log('═'.repeat(60));
    console.log(`🌍 Marketplace: ${config.marketplace}`);
    console.log(`📦 Checking ${asins.length} ASIN(s): ${asins.join(', ')}`);
  }

  try {
    const accessToken = await getAccessToken();
    const results = [];

    for (const asin of asins) {
      const result = await checkYourBuyBoxStatus(accessToken, asin, jsonOutput);
      if (result) {
        results.push(result);
      }

      // Rate limiting
      if (asins.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    // For API calls, just output the first result as JSON
    if (jsonOutput && results.length > 0) {
      console.log(JSON.stringify(results[0]));
      process.exit(0);
    }

    // Final summary (only in console mode)
    if (!jsonOutput) {
      console.log('\n📊 FINAL SUMMARY');
      console.log('═'.repeat(60));

      if (results.length === 0) {
        console.log('❌ No results obtained');
      } else {
        const buyBoxWins = results.filter(r => r.youOwnBuyBox).length;
        const totalASINs = results.length;

        console.log(`🏆 Buy Box Wins: ${buyBoxWins}/${totalASINs} ASINs`);
        console.log(`📊 Success Rate: ${((buyBoxWins / totalASINs) * 100).toFixed(1)}%`);

        console.log('\n📋 Detailed Results:');
        results.forEach(result => {
          const status = result.youOwnBuyBox ? '🏆 YOU WIN' : '❌ COMPETITOR WINS';
          console.log(`   ${result.asin}: ${status} (${result.totalOffers} offers)`);
        });
      }

      console.log('\n🎉 Buy Box monitoring completed!');
    }

  } catch (error) {
    if (jsonOutput) {
      // Output error in JSON format for API calls
      console.log(JSON.stringify({ error: error.message }));
      process.exit(1);
    } else {
      console.error('❌ Error during execution:', error.message);
      process.exit(1);
    }
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkYourBuyBoxStatus };