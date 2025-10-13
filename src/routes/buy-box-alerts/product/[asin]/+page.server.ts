// Server-side data loader for product analysis page
// Fetches historical alert data and product information

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { SPAPIClient } from '$lib/amazon/sp-api-client';
import { CatalogService } from '$lib/amazon/catalog-service';
import { FeesService } from '$lib/amazon/fees-service';
import {
  AMAZON_CLIENT_ID,
  AMAZON_CLIENT_SECRET,
  AMAZON_REFRESH_TOKEN,
  AMAZON_AWS_ACCESS_KEY_ID,
  AMAZON_AWS_SECRET_ACCESS_KEY,
  AMAZON_SELLER_ID,
  AMAZON_ROLE_ARN
} from '$env/static/private';

export const load: PageServerLoad = async ({ params, fetch, url }) => {
  const { asin } = params;

  if (!asin || asin === 'undefined') {
    throw error(400, 'Invalid ASIN parameter');
  }

  try {
    // Get query parameters
    const days = url.searchParams.get('days') || '30';

    // Fetch historical alert data
    const alertResponse = await fetch(
      `/api/buy-box-alerts/product/${asin}?days=${days}`
    );

    if (!alertResponse.ok) {
      throw new Error(`Failed to fetch alert history: ${alertResponse.statusText}`);
    }

    const alertData = await alertResponse.json();

    // Fetch product information from buybox_data (optional - may not exist)
    let productInfo = null;
    try {
      const productResponse = await fetch('/api/buybox-lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ asin })
      });

      if (productResponse.ok) {
        const productResult = await productResponse.json();
        productInfo = productResult.success ? productResult.data : null;
      }
    } catch (productErr) {
      // Product info not found in Supabase - that's OK, we'll use ASIN only
      console.log(`Product info not found for ${asin}, using ASIN as fallback`);
    }

    // Initialize Amazon SP-API services
    const spApiClient = new SPAPIClient({
      clientId: AMAZON_CLIENT_ID,
      clientSecret: AMAZON_CLIENT_SECRET,
      refreshToken: AMAZON_REFRESH_TOKEN,
      awsAccessKeyId: AMAZON_AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: AMAZON_AWS_SECRET_ACCESS_KEY,
      awsRegion: 'eu-west-1',
      marketplaceId: 'A1F83G8C2ARO7P',
      sellerId: AMAZON_SELLER_ID, // CRITICAL: For External ID in STS AssumeRole
      roleArn: AMAZON_ROLE_ARN // IAM Role ARN for STS AssumeRole
    });

    const catalogService = new CatalogService(spApiClient);
    const feesService = new FeesService(spApiClient);

    // Fetch catalog data from Amazon
    let catalogData = null;
    try {
      catalogData = await catalogService.getProduct(asin);
      console.log(`✅ Fetched catalog data for ${asin}:`, catalogData.title);
    } catch (catalogErr) {
      console.error(`Failed to fetch catalog data for ${asin}:`, catalogErr);
      // Continue without catalog data
    }

    // Fetch fees data (if we have current pricing)
    let feesData = null;
    const rawPrice = alertData.currentState?.your_price || alertData.currentState?.market_low;
    const currentPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(rawPrice) || 0;
    if (currentPrice && currentPrice > 0) {
      try {
        // FBM (Fulfilled by Merchant) - no FBA fees
        feesData = await feesService.getFeeEstimate(asin, currentPrice, false);
        console.log(`✅ Fetched FBM fees data for ${asin} at £${currentPrice}`);
      } catch (feesErr) {
        console.error(`Failed to fetch fees data for ${asin}:`, feesErr);
        // Continue without fees data
      }
    }

    return {
      asin,
      currentState: alertData.currentState,
      history: alertData.history || [],
      analytics: alertData.analytics || {},
      competitors: alertData.competitors || [],
      currentBuyBoxWinner: alertData.currentBuyBoxWinner || null,
      offerMetrics: alertData.offerMetrics || {},
      meta: alertData.meta || {},
      productInfo,
      catalogData, // NEW: Catalog API data
      feesData, // NEW: Fees API data
      daysRequested: parseInt(days)
    };
  } catch (err) {
    console.error(`Error loading product analysis for ${asin}:`, err);
    throw error(500, `Failed to load product analysis: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
};
