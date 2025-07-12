#!/usr/bin/env node

import axios from 'axios';
import crypto from 'crypto';
import qs from 'querystring';
import dotenv from 'dotenv';

dotenv.config();

const MARKETPLACE_ID = 'ATVPDKIKX0DER'; // US marketplace
const REGION = 'us-east-1';
const HOST = 'sellingpartnerapi-na.amazon.com';

// LWA Token function
async function getLWAToken() {
  const tokenUrl = 'https://api.amazon.com/auth/o2/token';
  const params = {
    grant_type: 'refresh_token',
    refresh_token: process.env.AMAZON_REFRESH_TOKEN,
    client_id: process.env.AMAZON_CLIENT_ID,
    client_secret: process.env.AMAZON_CLIENT_SECRET
  };

  try {
    const response = await axios.post(tokenUrl, qs.stringify(params), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data.access_token;
  } catch (error) {
    console.error('❌ LWA Token Error:', error.response?.data || error.message);
    throw error;
  }
}

// AWS4 Signature function
function signRequest(method, path, queryParams, accessToken) {
  const service = 'execute-api';
  const region = REGION;
  const host = HOST;
  const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const date = timestamp.substr(0, 8);

  const canonicalQueryString = queryParams ? qs.stringify(queryParams) : '';
  const canonicalHeaders = `host:${host}\nx-amz-access-token:${accessToken}\nx-amz-date:${timestamp}\n`;
  const signedHeaders = 'host;x-amz-access-token;x-amz-date';

  const canonicalRequest = [
    method,
    path,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    crypto.createHash('sha256').update('').digest('hex')
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timestamp,
    `${date}/${region}/${service}/aws4_request`,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  const kDate = crypto.createHmac('sha256', `AWS4${process.env.AWS_SECRET_ACCESS_KEY}`).update(date).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();

  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  return {
    'Authorization': `AWS4-HMAC-SHA256 Credential=${process.env.AWS_ACCESS_KEY_ID}/${date}/${region}/${service}/aws4_request, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-date': timestamp,
    'x-amz-access-token': accessToken
  };
}

// Get competitive pricing for ASIN
async function getCompetitivePricing(asin) {
  try {
    const accessToken = await getLWAToken();
    const path = `/products/pricing/v0/price`;
    const queryParams = {
      MarketplaceId: MARKETPLACE_ID,
      Asins: asin,
      ItemType: 'Asin'
    };

    const headers = signRequest('GET', path, queryParams, accessToken);
    const url = `https://${HOST}${path}?${qs.stringify(queryParams)}`;

    const response = await axios.get(url, { headers });

    if (response.data?.payload) {
      return response.data.payload;
    } else {
      return { error: 'No pricing data found' };
    }
  } catch (error) {
    return {
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

// Get my price for ASIN
async function getMyPrice(asin) {
  try {
    const accessToken = await getLWAToken();
    const path = `/products/pricing/v0/price`;
    const queryParams = {
      MarketplaceId: MARKETPLACE_ID,
      Asins: asin,
      ItemType: 'Asin'
    };

    const headers = signRequest('GET', path, queryParams, accessToken);
    const url = `https://${HOST}${path}?${qs.stringify(queryParams)}`;

    const response = await axios.get(url, { headers });

    if (response.data?.payload) {
      return response.data.payload;
    } else {
      return { error: 'No pricing data found' };
    }
  } catch (error) {
    return {
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

// Format pricing data
function formatPricingData(pricingData) {
  if (!pricingData || pricingData.error) {
    return `❌ Error: ${pricingData.error}`;
  }

  let output = '';

  if (Array.isArray(pricingData)) {
    pricingData.forEach(item => {
      if (item.ASIN) {
        output += `\n📦 ASIN: ${item.ASIN}\n`;
        output += `   Status: ${item.status || 'Unknown'}\n`;

        if (item.Product) {
          const product = item.Product;

          // Competitive pricing
          if (product.CompetitivePricing && product.CompetitivePricing.CompetitivePrices) {
            output += `\n   🏷️  Competitive Prices:\n`;
            product.CompetitivePricing.CompetitivePrices.forEach((price, index) => {
              output += `   ${index + 1}. ${price.condition || 'New'}: $${price.Price?.ListingPrice?.Amount || 'N/A'}\n`;
            });
          }

          // Offers
          if (product.Offers) {
            output += `\n   💰 Your Offers:\n`;
            product.Offers.forEach((offer, index) => {
              output += `   ${index + 1}. Condition: ${offer.condition || 'New'}\n`;
              output += `      Price: $${offer.ListingPrice?.Amount || 'N/A'}\n`;
              output += `      Shipping: $${offer.Shipping?.Amount || '0.00'}\n`;
              output += `      Fulfillment: ${offer.fulfillmentChannel || 'Unknown'}\n`;
            });
          }

          // Summary
          if (product.Summary) {
            output += `\n   📊 Summary:\n`;
            output += `      Total Offers: ${product.Summary.TotalOfferCount || 0}\n`;
            output += `      Lowest Price: $${product.Summary.LowestPrices?.[0]?.ListingPrice?.Amount || 'N/A'}\n`;
            output += `      Buy Box Price: $${product.Summary.BuyBoxPrices?.[0]?.ListingPrice?.Amount || 'N/A'}\n`;
          }
        }
      }
    });
  }

  return output || '❌ No pricing data available';
}

// Main function
async function main() {
  const asin = process.argv[2];

  if (!asin) {
    console.log('💰 Amazon ASIN Pricing Lookup Tool');
    console.log('📅', new Date().toLocaleString());
    console.log('════════════════════════════════════════════════════════════');
    console.log('❌ Error: Please provide an ASIN');
    console.log('');
    console.log('Usage: node get-asin-pricing.js B08N5WRWNW');
    console.log('');
    console.log('💡 To find your ASIN:');
    console.log('1. Go to Amazon Seller Central');
    console.log('2. Navigate to Inventory > Manage Inventory');
    console.log('3. Find your SKU and look for the ASIN column');
    console.log('');
    process.exit(1);
  }

  console.log('💰 Amazon ASIN Pricing Lookup Tool');
  console.log('📅', new Date().toLocaleString());
  console.log('════════════════════════════════════════════════════════════');
  console.log(`🔍 Looking up current pricing for ASIN: ${asin}`);
  console.log('════════════════════════════════════════════════════════════');

  console.log('📊 Fetching competitive pricing data...');
  const pricingData = await getCompetitivePricing(asin);

  console.log(formatPricingData(pricingData));

  console.log('\n📋 Summary:');
  console.log('────────────────────────────────────────────────────────────');
  if (pricingData.error) {
    console.log('⚠️  Could not retrieve pricing data');
    console.log('');
    console.log('🔧 Troubleshooting tips:');
    console.log('1. Verify the ASIN is correct');
    console.log('2. Check that your product is active on Amazon');
    console.log('3. Ensure you have the correct marketplace permissions');
    console.log('4. Try again in a few minutes (API rate limits)');
  } else {
    console.log('✅ Successfully retrieved pricing data');
    console.log('');
    console.log('💡 This data shows:');
    console.log('• Current competitive prices for this ASIN');
    console.log('• Your own listing prices (if any)');
    console.log('• Buy Box information');
    console.log('• Market summary statistics');
  }
}

main().catch(console.error);
