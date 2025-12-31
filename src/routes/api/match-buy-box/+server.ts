import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import AmazonFeedsAPI from '$lib/services/amazon-feeds-api.js';
import { amazonFeedsRateLimiter } from '$lib/utils/rate-limiter.ts';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';

const { PRIVATE_SUPABASE_SERVICE_KEY } = env;

const supabase = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY);

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Get user session (authentication handled by hooks.server.ts)
    const user = locals?.user;
    if (!user) {
      throw error(401, 'Authentication required');
    }

    const { asin, sku, newPrice, recordId, confirmLowMargin = false } = await request.json();

    // Validate inputs
    if (!asin || !sku || !newPrice || !recordId) {
      throw error(400, 'Missing required fields: asin, sku, newPrice, recordId');
    }

    console.log(`🎯 Match Buy Box request: ${sku} (${asin}) → £${newPrice}`);

    // Get product type from database first
    let productType = await getProductTypeFromDB(sku);

    if (!productType) {
      console.log(`⚠️ Product type not found in DB for ${sku}, fetching from Amazon...`);
      productType = await fetchAndStoreProductType(sku, asin);
    }

    if (!productType) {
      throw error(400, `Could not determine product type for SKU: ${sku}`);
    }

    console.log(`✅ Using product type: ${productType} for SKU: ${sku}`);

    // Get current data for validation
    const { data: currentData, error: fetchError } = await supabase
      .from('buybox_data')
      .select('your_current_price, buybox_price, your_margin_percent_at_current_price, your_cost, total_operating_cost')
      .eq('id', recordId)
      .single();

    if (fetchError) {
      throw error(404, `Record not found: ${fetchError.message}`);
    }

    // Safety validation: Ensure 10% minimum margin (unless confirmed)
    if (!confirmLowMargin) {
      const marginValidation = await validateMarginSafety(newPrice, currentData);
      if (!marginValidation.safe) {
        return json({
          success: false,
          error: 'MARGIN_TOO_LOW',
          message: marginValidation.message,
          currentMargin: marginValidation.currentMargin,
          newMargin: marginValidation.newMargin,
          requiresConfirmation: true
        });
      }
    }

    // Execute price update via Amazon Feeds API with rate limiting
    console.log('📊 Rate limiter status:', amazonFeedsRateLimiter.getStatus());

    const result = await amazonFeedsRateLimiter.schedule(async () => {
      console.log('🚀 Executing rate-limited price update...');
      const amazonAPI = new AmazonFeedsAPI();
      return await amazonAPI.updatePrice(
        asin,
        newPrice,
        currentData?.your_current_price,
        sku
      );
    });

    if (result.success) {
      // Type guard: ensure result has feedId property
      const feedId = 'feedId' in result ? result.feedId : null;
      const feedStatus = 'feedStatus' in result ? result.feedStatus : 'SUBMITTED';

      // Log successful price update
      await logPriceUpdate({
        recordId,
        sku,
        asin,
        oldPrice: currentData?.your_current_price,
        newPrice,
        productType,
        feedId,
        userId: user.id,
        success: true
      });

      // Update the buybox_data record with new price and update tracking
      await supabase
        .from('buybox_data')
        .update({
          your_current_price: newPrice,
          last_price_update: new Date().toISOString(),
          update_source: 'match_buy_box'
        })
        .eq('id', recordId);

      return json({
        success: true,
        feedId,
        message: `Price updated successfully for ${sku}`,
        newPrice,
        productType,
        feedStatus
      });
    } else {
      // Log failed price update
      await logPriceUpdate({
        recordId,
        sku,
        asin,
        oldPrice: currentData?.your_current_price,
        newPrice,
        productType,
        feedId: null,
        userId: user.id,
        success: false,
        errorMessage: 'error' in result ? result.error : 'Unknown error'
      });

      throw error(500, ('error' in result ? result.error : null) || 'Price update failed');
    }

  } catch (err: any) {
    console.error('❌ Match Buy Box API error:', err);

    if (err.status) {
      throw err; // Re-throw SvelteKit errors
    }

    throw error(500, err.message || 'Internal server error');
  }
};

async function getProductTypeFromDB(sku: string): Promise<string | null> {
  try {
    // First try the main buybox_data table
    const { data: buyboxData } = await supabase
      .from('buybox_data')
      .select('product_type')
      .eq('sku', sku)
      .not('product_type', 'is', null)
      .limit(1)
      .single();

    if (buyboxData?.product_type) {
      return buyboxData.product_type;
    }

    // Fallback to sku_product_types table
    const { data: skuTypeData } = await supabase
      .from('sku_product_types')
      .select('product_type')
      .eq('sku', sku)
      .limit(1)
      .single();

    return skuTypeData?.product_type || null;
  } catch (error) {
    console.error(`Error fetching product type for ${sku}:`, error);
    return null;
  }
}

async function fetchAndStoreProductType(sku: string, asin: string): Promise<string | null> {
  try {
    const amazonAPI = new AmazonFeedsAPI();
    const token = await amazonAPI.getAccessToken();
    const productType = await amazonAPI.getProductType(token, sku);

    if (productType) {
      // Store in both tables for future use
      await supabase
        .from('buybox_data')
        .update({ product_type: productType })
        .eq('sku', sku);

      await supabase
        .from('sku_product_types')
        .upsert({
          sku,
          asin,
          product_type: productType,
          source: 'amazon_api',
          verified_at: new Date().toISOString()
        });

      console.log(`✅ Stored product type ${productType} for SKU ${sku}`);
    }

    return productType;
  } catch (error) {
    console.error(`Failed to fetch product type for ${sku}:`, error);
    return null;
  }
}

async function validateMarginSafety(newPrice: number, currentData: any) {
  if (!currentData?.your_cost) {
    return {
      safe: true,
      message: 'No cost data available for validation',
      newMargin: null
    };
  }

  // Use the total_operating_cost as the fixed costs (this includes base + box + material + shipping)
  const fixedCosts = currentData.total_operating_cost || 0;

  // Calculate variable Amazon fees based on NEW price (15% fee rate to match UI)
  const amazonFeeRate = 0.15; // 15% Amazon fee to match UI calculation
  const amazonFees = newPrice * amazonFeeRate;

  // Total cost = Fixed costs + Variable fees calculated on new price
  const totalCost = fixedCosts + amazonFees;

  // Use ROI margin calculation to match frontend (investment-based)
  // ROI Margin = (Revenue - Investment) / Investment * 100
  const newMargin = ((newPrice - totalCost) / totalCost) * 100;
  const currentMargin = currentData.your_margin_percent_at_current_price;

  console.log('🔍 Margin validation (UI-matched calculation):', {
    newPrice,
    fixedCosts,
    amazonFees: amazonFees.toFixed(2),
    totalCost: totalCost.toFixed(2),
    yourCost: currentData.your_cost,
    operatingCost: currentData.total_operating_cost,
    calculatedNewMargin: newMargin.toFixed(2),
    currentMargin,
    safe: newMargin >= 10,
    breakdown: {
      'Fixed Costs (total_operating_cost)': fixedCosts,
      'Amazon Fee (15%)': amazonFees.toFixed(2),
      'Total Cost': totalCost.toFixed(2),
      'Revenue': newPrice,
      'Profit': (newPrice - totalCost).toFixed(2),
      'ROI Margin': newMargin.toFixed(2) + '%'
    }
  });

  if (newMargin < 10) {
    return {
      safe: false,
      message: `Price update would result in ${newMargin.toFixed(1)}% ROI margin, below 10% minimum (Fixed: £${fixedCosts.toFixed(2)}, Amazon Fee: £${amazonFees.toFixed(2)}, Total: £${totalCost.toFixed(2)})`,
      currentMargin: currentMargin,
      newMargin: newMargin
    };
  }

  return {
    safe: true,
    newMargin,
    currentMargin
  };
} async function logPriceUpdate(data: {
  recordId: string;
  sku: string;
  asin: string;
  oldPrice: number | null;
  newPrice: number;
  productType: string;
  feedId: string | null;
  userId: string;
  success: boolean;
  errorMessage?: string;
}) {
  try {
    await supabase
      .from('price_history')
      .insert({
        record_id: data.recordId,
        sku: data.sku,
        asin: data.asin,
        old_price: data.oldPrice,
        new_price: data.newPrice,
        change_reason: 'match_buy_box',
        updated_by: data.userId,
        success: data.success,
        feed_id: data.feedId,
        product_type: data.productType,
        error_message: data.errorMessage || null
      });
  } catch (error) {
    console.error('Failed to log price update:', error);
  }
}
