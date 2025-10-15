// Server-side data loader for product analysis page
// Fetches historical alert data and product information

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createClient } from '@supabase/supabase-js';
import { SPAPIClient } from '$lib/amazon/sp-api-client';
import { CatalogService } from '$lib/amazon/catalog-service';
import { FeesService } from '$lib/amazon/fees-service';
import { calculateListingHealth, type CompetitorData, type BuyBoxData } from '$lib/amazon/listing-health';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import {
  AMAZON_CLIENT_ID,
  AMAZON_CLIENT_SECRET,
  AMAZON_REFRESH_TOKEN,
  AMAZON_AWS_ACCESS_KEY_ID,
  AMAZON_AWS_SECRET_ACCESS_KEY,
  AMAZON_SELLER_ID,
  AMAZON_ROLE_ARN,
  PRIVATE_SUPABASE_SERVICE_KEY
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

    // Fetch 30-day sales data from amazon_sales_data table
    let salesData = null;
    try {
      const supabase = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      const { data: salesRecords, error: salesError } = await supabase
        .from('amazon_sales_data')
        .select('*')
        .eq('asin', asin)
        .gte('report_date', thirtyDaysAgoStr)
        .order('report_date', { ascending: false });

      if (salesError) {
        console.error(`Failed to fetch sales data for ${asin}:`, salesError);
      } else if (salesRecords && salesRecords.length > 0) {
        // Calculate 30-day totals
        const totalRevenue = salesRecords.reduce((sum, record) => sum + (record.ordered_product_sales || 0), 0);
        const totalUnits = salesRecords.reduce((sum, record) => sum + (record.ordered_units || 0), 0);
        const totalSessions = salesRecords.reduce((sum, record) => sum + (record.sessions || 0), 0);
        const totalPageViews = salesRecords.reduce((sum, record) => sum + (record.page_views || 0), 0);

        // Calculate averages
        const avgBuyBoxPercentage = salesRecords.reduce((sum, record) =>
          sum + (record.buy_box_percentage || 0), 0) / salesRecords.length;
        const avgConversionRate = salesRecords.reduce((sum, record) =>
          sum + (record.unit_session_percentage || 0), 0) / salesRecords.length;

        salesData = {
          totalRevenue,
          totalUnits,
          totalSessions,
          totalPageViews,
          avgBuyBoxPercentage: Math.round(avgBuyBoxPercentage * 100) / 100,
          avgConversionRate: Math.round(avgConversionRate * 100) / 100,
          recordCount: salesRecords.length,
          dateRange: {
            start: salesRecords[salesRecords.length - 1].report_date,
            end: salesRecords[0].report_date
          }
        };

        console.log(`✅ Fetched sales data for ${asin}: £${totalRevenue.toFixed(2)} revenue, ${totalUnits} units over ${salesRecords.length} days`);
      } else {
        console.log(`No sales data found for ${asin} in the last 30 days`);
      }
    } catch (salesErr) {
      console.error(`Failed to fetch sales data for ${asin}:`, salesErr);
      // Continue without sales data
    }

    // Calculate listing health score
    let healthScore = null;
    if (catalogData) {
      try {
        // Prepare competitor data
        const competitorData: CompetitorData | undefined = alertData.currentState ? {
          yourRank: alertData.currentState.your_position,
          totalOffers: alertData.currentState.total_offers || 0,
          lowestPrice: alertData.currentState.market_low || 0,
          yourPrice: alertData.currentState.your_price || 0
        } : undefined;

        // Prepare buy box data
        const buyBoxData: BuyBoxData | undefined = alertData.currentState ? {
          currentlyHasBuyBox: alertData.currentState.has_buy_box || false,
          winRate: alertData.analytics?.buyBoxWinRate || 0, // Fixed: was buybox_win_rate, should be buyBoxWinRate
          totalChecks: alertData.history?.length || 0,
          isFBA: alertData.currentState.is_fba || false,
          isPrime: alertData.currentState.is_prime || false
        } : undefined;

        healthScore = calculateListingHealth(catalogData, competitorData, buyBoxData);
        console.log(`✅ Calculated health score for ${asin}: ${healthScore.overall}/10 (${healthScore.grade})`);
      } catch (healthErr) {
        console.error(`Failed to calculate health score for ${asin}:`, healthErr);
        // Continue without health score
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
      healthScore, // NEW: Listing health score
      salesData, // NEW: 30-day sales metrics from Amazon Reports API
      daysRequested: parseInt(days)
    };
  } catch (err) {
    console.error(`Error loading product analysis for ${asin}:`, err);
    throw error(500, `Failed to load product analysis: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
};
