
import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';
import { checkBuyBoxStatus } from '$lib/buyBoxChecker';
import type { TransformedBuyBoxData, OfferDetails } from '$lib/types/buybox';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

/**
 * Buy Box check endpoint for Buy Box Monitor
 * Uses my-buy-box-monitor.cjs to check Buy Box ownership on Amazon
 */
export async function GET({ url }) {
  try {
    const asin = url.searchParams.get('asin');
    const sku = url.searchParams.get('sku');

    // Either ASIN or SKU is required
    if (!asin && !sku) {
      return json({
        success: false,
        error: 'Either ASIN or SKU is required'
      }, { status: 400 });
    }

    let targetAsin = asin;

    // If SKU is provided but not ASIN, look up the ASIN from the database
    if (!asin && sku) {
      const { data: skuData, error: skuError } = await supabaseAdmin
        .from('sku_asin_mapping')
        .select('asin1')
        .eq('seller_sku', sku)
        .single();

      if (skuError || !skuData?.asin1) {
        return json({
          success: false,
          error: 'Could not find ASIN for the provided SKU'
        }, { status: 404 });
      }

      targetAsin = skuData.asin1;
    }

    // Get seller info from database to include in the response
    const { data: productData, error: productError } = await supabaseAdmin
      .from('sku_asin_mapping')
      .select('*')
      .eq('asin1', targetAsin)
      .single();

    if (productError && productError.code !== 'PGRST116') {
      console.error('Error fetching product data:', productError);
      // Continue with Buy Box check even if we couldn't find the product in our database
    }

    // Use the new Buy Box checker module instead of spawning child process
    if (!targetAsin) {
      return json({
        success: false,
        error: 'Missing ASIN for Buy Box check'
      }, { status: 400 });
    }

    // Import environment variables for the checker
    const {
      AMAZON_AWS_ACCESS_KEY_ID,
      AMAZON_AWS_SECRET_ACCESS_KEY,
      AMAZON_REFRESH_TOKEN,
      AMAZON_CLIENT_ID,
      AMAZON_CLIENT_SECRET,
      AMAZON_MARKETPLACE_ID
    } = process.env;

    const envVars = {
      AMAZON_AWS_ACCESS_KEY_ID: AMAZON_AWS_ACCESS_KEY_ID || '',
      AMAZON_AWS_SECRET_ACCESS_KEY: AMAZON_AWS_SECRET_ACCESS_KEY || '',
      AMAZON_REFRESH_TOKEN: AMAZON_REFRESH_TOKEN || '',
      AMAZON_CLIENT_ID: AMAZON_CLIENT_ID || '',
      AMAZON_CLIENT_SECRET: AMAZON_CLIENT_SECRET || '',
      AMAZON_MARKETPLACE_ID: AMAZON_MARKETPLACE_ID || ''
    };

    const buyBoxData = await checkBuyBoxStatus(targetAsin, envVars);

    // Calculate price difference if we have both prices
    let priceDifference = null;
    let priceDifferencePercent = null;

    if (productData?.price && buyBoxData && typeof buyBoxData.buyBoxPrice === 'number') {
      priceDifference = buyBoxData.buyBoxPrice - parseFloat(productData.price);
      priceDifferencePercent = (priceDifference / parseFloat(productData.price)) * 100;
    }

    // The new buyBoxChecker already returns data in the correct format
    return json({
      ...buyBoxData,
      success: true,
      asin: targetAsin,
      productData: productData || null,
      priceDifference,
      priceDifferencePercent,
      originalSku: sku || productData?.seller_sku || null
    });

  } catch (error) {
    console.error('Buy Box check error:', error);
    return json({
      success: false,
      error: (error as Error).message || 'Failed to check Buy Box status'
    }, { status: 500 });
  }
}

/**
 * Check Buy Box status using my-buy-box-monitor.cjs
 */
async function checkBuyBox(asin: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const buyBoxScript = path.join(process.cwd(), 'my-buy-box-monitor.cjs');

    // Check if script exists
    if (!fs.existsSync(buyBoxScript)) {
      // Fall back to simplified mock response for development
      console.warn('Buy Box checker script not found, returning mock data');
      return resolve(getMockBuyBoxData(asin));
    }

    const childProcess = spawn('node', [buyBoxScript, asin, '--json']);

    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    childProcess.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    childProcess.on('close', (code: number) => {
      if (code !== 0) {
        console.error(`Buy Box checker exited with code ${code}`);
        console.error(stderr);
        return reject(new Error('Buy Box check failed'));
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (error) {
        console.error('Failed to parse Buy Box checker output:', error);
        reject(new Error('Failed to parse Buy Box data'));
      }
    });
  });
}

/**
 * Provide mock Buy Box data for development/testing
 */
function getMockBuyBoxData(asin: string): any {
  // Randomly determine if we have the Buy Box
  const hasBuyBox = Math.random() > 0.5;

  return {
    asin: asin,
    buyBoxOwner: hasBuyBox ? 'Your Store' : 'Competitor Store',
    hasBuyBox: hasBuyBox,
    buyBoxPrice: (15.99 + Math.random() * 10).toFixed(2),
    lastChecked: new Date().toISOString(),
    competitorInfo: [
      {
        sellerName: 'Your Store',
        price: 19.99,
        condition: 'New',
        fulfillmentType: 'FBA',
        hasBuyBox: hasBuyBox
      },
      {
        sellerName: 'Competitor Store',
        price: 18.49,
        condition: 'New',
        fulfillmentType: 'FBA',
        hasBuyBox: !hasBuyBox
      },
      {
        sellerName: 'Another Seller',
        price: 22.99,
        condition: 'New',
        fulfillmentType: 'Merchant',
        hasBuyBox: false
      }
    ]
  };
}

/**
 * Transform raw buy box data into a standardized format for the frontend
 */
function transformBuyBoxData(buyBoxData: any, asin: string): TransformedBuyBoxData {
  // Define default response structure
  const defaultResponse: TransformedBuyBoxData = {
    buyBoxOwner: 'Unknown',
    hasBuyBox: false,
    buyBoxPrice: null,
    lastChecked: new Date().toISOString(),
    competitorInfo: [],
    yourOffers: []
  };

  // Handle mock or empty data
  if (!buyBoxData) return defaultResponse;

  // Get buy box winner details
  const buyBoxWinner = buyBoxData.buyBoxWinner || null;

  // Parse your seller ID from environment variable or hardcode if known
  const yourSellerId = process.env.YOUR_SELLER_ID || 'A2D8NG39VURSL3'; // Fallback to hardcoded ID

  // Check if you own the Buy Box
  const hasBuyBox = buyBoxData.youOwnBuyBox === true;

  // Format competitor info
  const competitorInfo = Array.isArray(buyBoxData.competitorOffers)
    ? buyBoxData.competitorOffers.map((offer: any) => ({
      sellerId: offer.sellerId || 'unknown',
      sellerName: offer.sellerName || 'Unknown Seller',
      price: typeof offer.price === 'number' ? offer.price : 0,
      shipping: typeof offer.shippingPrice === 'number' ? offer.shippingPrice : 0,
      totalPrice: typeof offer.totalPrice === 'number' ? offer.totalPrice : 0,
      condition: offer.condition || 'Unknown',
      fulfillmentType: offer.fulfillment || 'Unknown',
      hasBuyBox: offer.isBuyBox === true,
      isPrime: offer.primeEligible === true
    }))
    : [];

  // Format your offers
  const yourOffers = Array.isArray(buyBoxData.yourOffers)
    ? buyBoxData.yourOffers.map((offer: any) => ({
      sellerId: offer.sellerId || 'YOUR_SELLER_ID',
      sellerName: 'Your Store',
      price: typeof offer.price === 'number' ? offer.price : 0,
      shipping: typeof offer.shippingPrice === 'number' ? offer.shippingPrice : 0,
      totalPrice: typeof offer.totalPrice === 'number' ? offer.totalPrice : 0,
      condition: offer.condition || 'Unknown',
      fulfillmentType: offer.fulfillment || 'Unknown',
      hasBuyBox: offer.isBuyBox === true,
      isPrime: offer.primeEligible === true
    }))
    : [];

  // Add your offers to the competitor list for comparison
  if (yourOffers.length > 0) {
    competitorInfo.push(...yourOffers);

    // Sort by price for consistent display (lowest price first)
    competitorInfo.sort((a: OfferDetails, b: OfferDetails) => a.totalPrice - b.totalPrice);
  }

  // Get recommendations from the buy box data
  const recommendations = Array.isArray(buyBoxData.recommendations)
    ? buyBoxData.recommendations
    : [];

  return {
    buyBoxOwner: hasBuyBox ? 'Your Store' : (buyBoxWinner?.sellerName || 'Competitor'),
    buyBoxSellerName: buyBoxWinner?.sellerName,
    hasBuyBox,
    buyBoxPrice: buyBoxWinner?.price || null,
    buyBoxCurrency: buyBoxWinner?.currency || 'GBP',
    lastChecked: new Date().toISOString(),
    competitorInfo,
    yourOffers,
    recommendations
  };
}
