/**
 * Amazon Product Fees API Service
 * 
 * Calculates FBA fees, referral fees, and total cost breakdown
 * Uses Product Fees API v0
 * 
 * Caching Strategy:
 * - 24-hour TTL for fees data (fees update occasionally)
 * - Cache key: (asin, price, fulfillment_type, marketplace)
 * - Reduces API calls by ~90% for repeated price points
 */

import { SPAPIClient } from './sp-api-client';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';

const { PRIVATE_SUPABASE_SERVICE_KEY } = env;

export interface FeeBreakdown {
  fbaFee: number;
  referralFee: number;
  variableClosingFee: number;
  totalFees: number;
  estimatedProceeds: number; // What you get after fees
}

export interface ProfitAnalysis extends FeeBreakdown {
  listPrice: number;
  cogs?: number; // Cost of goods sold (if provided)
  grossProfit?: number;
  profitMargin?: number; // Percentage
  breakEvenPrice: number; // Minimum price to cover fees + COGS
}

export class FeesService {
  private client: SPAPIClient;
  private supabase: ReturnType<typeof createClient>;
  private cacheEnabled: boolean = true; // Toggle caching on/off
  private readonly CACHE_TTL_HOURS = 24;
  private readonly MARKETPLACE_ID = 'A1F83G8C2ARO7P'; // UK

  constructor(client: SPAPIClient) {
    this.client = client;

    // Initialize Supabase client for caching
    this.supabase = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY);
  }

  /**
   * Get fee estimate for a product at a specific price
   * Strategy: Check cache first (24-hour TTL), then API if stale/missing
   */
  async getFeeEstimate(
    asin: string,
    listPrice: number,
    isAmazonFulfilled: boolean = true,
    shipping: number = 0
  ): Promise<FeeBreakdown> {
    // 1. Try cache first
    if (this.cacheEnabled) {
      const cached = await this.getCachedFees(asin, listPrice, isAmazonFulfilled);
      if (cached) {
        console.log(`✅ Fees cache hit for ${asin} @ £${listPrice}`);
        return cached;
      }
      console.log(`⚠️ Fees cache miss for ${asin} @ £${listPrice}, fetching from API...`);
    }

    // 2. Fetch from API
    const result = await this.client.post(`/products/fees/v0/items/${asin}/feesEstimate`, {
      FeesEstimateRequest: {
        MarketplaceId: this.MARKETPLACE_ID,
        PriceToEstimateFees: {
          ListingPrice: {
            Amount: listPrice,
            CurrencyCode: 'GBP'
          },
          Shipping: shipping > 0 ? {
            Amount: shipping,
            CurrencyCode: 'GBP'
          } : undefined
        },
        Identifier: asin,
        IsAmazonFulfilled: isAmazonFulfilled
      }
    });

    if (!result.success || !result.data) {
      throw new Error(`Failed to get fee estimate: ${result.errors?.[0]?.message || 'Unknown error'}`);
    }

    const fees = this.parseFeeEstimate(result.data, listPrice);

    // 3. Cache the result
    if (this.cacheEnabled) {
      await this.setCachedFees(asin, listPrice, isAmazonFulfilled, fees, result.data);
    }

    return fees;
  }

  /**
   * Parse fee estimate response
   */
  private parseFeeEstimate(data: any, listPrice: number): FeeBreakdown {
    // Handle both direct and payload-wrapped responses
    const feesEstimateResult = data.payload?.FeesEstimateResult || data.FeesEstimateResult;

    if (!feesEstimateResult) {
      console.error('Fees API response:', JSON.stringify(data, null, 2));
      throw new Error('No FeesEstimateResult in response');
    }

    // Check for errors
    if (feesEstimateResult.Status !== 'Success' || feesEstimateResult.Error) {
      const errorMsg = feesEstimateResult.Error?.Message || 'Fee estimate failed';
      throw new Error(`Fee estimate error: ${errorMsg}`);
    }

    const feesEstimate = feesEstimateResult.FeesEstimate;

    if (!feesEstimate) {
      throw new Error('No FeesEstimate in FeesEstimateResult');
    }

    // Extract individual fees
    let fbaFee = 0;
    let referralFee = 0;
    let variableClosingFee = 0;

    feesEstimate.FeeDetailList?.forEach((fee: any) => {
      const amount = fee.FeeAmount?.Amount || 0;
      const type = fee.FeeType;

      switch (type) {
        case 'FBAFees':
        case 'FBAPerUnitFulfillmentFee':
        case 'FBAWeightBasedFee':
          fbaFee += amount;
          break;
        case 'ReferralFee':
          referralFee += amount;
          break;
        case 'VariableClosingFee':
          variableClosingFee += amount;
          break;
      }
    });

    const totalFees = feesEstimate.TotalFeesEstimate?.Amount || 0;
    const estimatedProceeds = listPrice - totalFees;

    return {
      fbaFee: Math.round(fbaFee * 100) / 100,
      referralFee: Math.round(referralFee * 100) / 100,
      variableClosingFee: Math.round(variableClosingFee * 100) / 100,
      totalFees: Math.round(totalFees * 100) / 100,
      estimatedProceeds: Math.round(estimatedProceeds * 100) / 100
    };
  }

  /**
   * Calculate profit analysis with COGS
   */
  async getProfitAnalysis(
    asin: string,
    listPrice: number,
    cogs?: number,
    isAmazonFulfilled: boolean = true
  ): Promise<ProfitAnalysis> {
    const fees = await this.getFeeEstimate(asin, listPrice, isAmazonFulfilled);

    let grossProfit: number | undefined;
    let profitMargin: number | undefined;
    let breakEvenPrice = fees.totalFees;

    if (cogs !== undefined) {
      grossProfit = fees.estimatedProceeds - cogs;
      profitMargin = listPrice > 0 ? (grossProfit / listPrice) * 100 : 0;
      breakEvenPrice = fees.totalFees + cogs;
    }

    return {
      ...fees,
      listPrice,
      cogs,
      grossProfit: grossProfit !== undefined ? Math.round(grossProfit * 100) / 100 : undefined,
      profitMargin: profitMargin !== undefined ? Math.round(profitMargin * 100) / 100 : undefined,
      breakEvenPrice: Math.round(breakEvenPrice * 100) / 100
    };
  }

  /**
   * Calculate fees for multiple price points (useful for pricing strategy)
   */
  async getFeeEstimatesForPriceRange(
    asin: string,
    minPrice: number,
    maxPrice: number,
    steps: number = 10,
    isAmazonFulfilled: boolean = true
  ): Promise<Array<{ price: number; fees: FeeBreakdown }>> {
    const priceStep = (maxPrice - minPrice) / (steps - 1);
    const estimates: Array<{ price: number; fees: FeeBreakdown }> = [];

    for (let i = 0; i < steps; i++) {
      const price = Math.round((minPrice + (priceStep * i)) * 100) / 100;

      try {
        const fees = await this.getFeeEstimate(asin, price, isAmazonFulfilled);
        estimates.push({ price, fees });

        // Rate limit: 1 request per second for fees API
        await new Promise(resolve => setTimeout(resolve, 1200));
      } catch (error) {
        console.error(`Failed to get fee estimate for price ${price}:`, error);
      }
    }

    return estimates;
  }

  /**
   * Find optimal price point based on margin target
   */
  async findOptimalPrice(
    asin: string,
    cogs: number,
    targetMarginPercent: number,
    minPrice: number,
    maxPrice: number,
    isAmazonFulfilled: boolean = true
  ): Promise<{ optimalPrice: number; analysis: ProfitAnalysis } | null> {
    const estimates = await this.getFeeEstimatesForPriceRange(
      asin,
      minPrice,
      maxPrice,
      20,
      isAmazonFulfilled
    );

    for (const estimate of estimates) {
      const grossProfit = estimate.fees.estimatedProceeds - cogs;
      const margin = (grossProfit / estimate.price) * 100;

      if (margin >= targetMarginPercent) {
        const analysis = await this.getProfitAnalysis(
          asin,
          estimate.price,
          cogs,
          isAmazonFulfilled
        );
        return { optimalPrice: estimate.price, analysis };
      }
    }

    return null; // No price in range achieves target margin
  }

  /**
   * Get cached fees from database
   * Returns null if not found or older than TTL (24 hours)
   */
  private async getCachedFees(
    asin: string,
    listingPrice: number,
    isAmazonFulfilled: boolean
  ): Promise<FeeBreakdown | null> {
    try {
      const { data, error } = await this.supabase
        .from('amazon_fees_cache')
        .select('*')
        .eq('asin', asin)
        .eq('listing_price', listingPrice)
        .eq('is_amazon_fulfilled', isAmazonFulfilled)
        .eq('marketplace_id', this.MARKETPLACE_ID)
        .gte('updated_at', new Date(Date.now() - this.CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString())
        .single();

      if (error || !data) {
        return null;
      }

      // Reconstruct FeeBreakdown from cached data
      return {
        fbaFee: (data.fba_fee as number) || 0,
        referralFee: data.referral_fee as number,
        variableClosingFee: data.variable_closing_fee as number,
        totalFees: data.total_fees as number,
        estimatedProceeds: data.estimated_proceeds as number
      };
    } catch (error) {
      console.error('Fees cache read error:', error);
      return null;
    }
  }

  /**
   * Cache fees data in database
   */
  private async setCachedFees(
    asin: string,
    listingPrice: number,
    isAmazonFulfilled: boolean,
    fees: FeeBreakdown,
    rawResponse: any
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('amazon_fees_cache')
        .upsert({
          asin,
          marketplace_id: this.MARKETPLACE_ID,
          listing_price: listingPrice,
          is_amazon_fulfilled: isAmazonFulfilled,
          fba_fee: fees.fbaFee,
          referral_fee: fees.referralFee,
          variable_closing_fee: fees.variableClosingFee,
          total_fees: fees.totalFees,
          estimated_proceeds: fees.estimatedProceeds,
          fee_details: rawResponse, // Store full API response for debugging
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'asin,listing_price,is_amazon_fulfilled,marketplace_id'
        });

      if (error) {
        console.error('Fees cache write error:', error);
      }
    } catch (error) {
      console.error('Fees cache write exception:', error);
      // Don't throw - caching is not critical
    }
  }
}
