import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_SERVICE_KEY } from '$env/static/private';

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Check authentication
    if (!locals.session?.user) {
      return json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    let requestData;
    try {
      requestData = await request.json();
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    console.log('📊 Raw request data received:', JSON.stringify(requestData, null, 2));

    const { asin, targetPrice, currentPrice, marginPercent, userId, projectedMargin } = requestData;

    console.log(`🎯 Production Match Buy Box request:`, {
      asin,
      targetPrice,
      currentPrice,
      marginPercent,
      projectedMargin,
      userId: locals.session.user.id
    });

    // Validate required fields
    if (!asin || !targetPrice) {
      return json(
        {
          success: false,
          error: 'Missing required fields: asin, targetPrice'
        },
        { status: 400 }
      );
    }

    // Validate ASIN format (should be 10 characters, alphanumeric)
    if (typeof asin !== 'string' || !/^[A-Z0-9]{10}$/.test(asin)) {
      return json(
        {
          success: false,
          error: 'Invalid ASIN format. ASIN must be 10 alphanumeric characters.'
        },
        { status: 400 }
      );
    }

    // Validate target price
    if (typeof targetPrice !== 'number' || targetPrice <= 0 || targetPrice > 10000) {
      return json(
        {
          success: false,
          error: 'Target price must be a positive number between £0.01 and £10,000'
        },
        { status: 400 }
      );
    }

    // Validate target price precision (max 2 decimal places)
    // Use string-based validation to avoid floating-point precision issues
    const priceString = targetPrice.toString();
    const decimalIndex = priceString.indexOf('.');
    if (decimalIndex !== -1 && priceString.length - decimalIndex - 1 > 2) {
      return json(
        {
          success: false,
          error: 'Target price must have at most 2 decimal places'
        },
        { status: 400 }
      );
    }

    // Server-side safety check: Validate 10% minimum margin
    if (projectedMargin !== null && projectedMargin !== undefined && projectedMargin < 10) {
      console.log(`⚠️ Server-side safety check failed: Projected margin ${projectedMargin.toFixed(2)}% is below 10% minimum`);

      return json(
        {
          success: false,
          safetyRejected: true,
          error: `Margin safety check failed: ${projectedMargin.toFixed(2)}% margin is below 10% minimum threshold`,
          projectedMargin,
          minimumMargin: 10,
          guidance: 'Please update this price manually in Amazon Seller Central if you wish to proceed with a lower margin.',
          sellerCentralUrl: `https://sellercentral.amazon.co.uk/inventory/ref=xx_invmgr_dnav_xx?tbla_myitable=sort:%7B%22sortOrder%22%3A%22DESCENDING%22%2C%22sortedColumnId%22%3A%22date%22%7D;search:${asin};pagination:1;`
        },
        { status: 400 }
      );
    }

    // CORRECTED: Use target price directly (this IS the buy box price we want to match)
    const finalPrice = targetPrice;

    console.log(`💰 Match Buy Box Price Calculation:`, {
      buyBoxPriceToMatch: targetPrice,
      projectedMarginAtThisPrice: projectedMargin ? `${projectedMargin.toFixed(2)}%` : 'Unknown',
      marginSafetyCheck: projectedMargin >= 10 ? 'PASSED ✅' : 'FAILED ❌',
      finalPriceToSet: finalPrice.toFixed(2)
    });

    // Import Amazon Feeds API service (correct approach for price updates)
    let amazonAPI;
    try {
      console.log('🔧 Attempting to import Amazon Feeds API service...');

      // Import the new Feeds API service
      const module = await import('$lib/services/amazon-feeds-api.js');
      console.log('📦 Feeds API module imported successfully');
      const AmazonFeedsAPI = module.default;

      console.log('🔍 Final AmazonFeedsAPI validation:', {
        type: typeof AmazonFeedsAPI,
        isFunction: typeof AmazonFeedsAPI === 'function',
        hasPrototype: AmazonFeedsAPI && 'prototype' in AmazonFeedsAPI,
        constructorName: AmazonFeedsAPI?.name,
        canConstruct: true
      });

      if (!AmazonFeedsAPI || typeof AmazonFeedsAPI !== 'function') {
        throw new Error(`AmazonFeedsAPI is not a constructor. Type: ${typeof AmazonFeedsAPI}, Value: ${AmazonFeedsAPI}`);
      }

      amazonAPI = new AmazonFeedsAPI({
        environment: 'production' // Production environment
      });
      console.log('✅ Amazon Feeds API instance created successfully');
    } catch (importError) {
      console.error('❌ Failed to import Amazon API service:', importError);
      console.error('❌ Error details:', (importError as Error).stack);

      // Provide more specific error message
      const errorMessage = (importError as Error).message;
      let userFriendlyError = 'Amazon Feeds API service initialization failed';

      if (errorMessage.includes('Missing required Amazon API credentials')) {
        userFriendlyError = 'Amazon API credentials not configured. Please contact your administrator.';
      } else if (errorMessage.includes('MODULE_NOT_FOUND')) {
        userFriendlyError = 'Amazon Feeds API service module not found. Please contact support.';
      }

      return json(
        {
          success: false,
          error: userFriendlyError,
          details: `Amazon Feeds API service could not be loaded: ${errorMessage}`,
          requiresManualUpdate: true,
          sellerCentralUrl: `https://sellercentral.amazon.co.uk/inventory/ref=xx_invmgr_dnav_xx?tbla_myitable=sort:%7B%22sortOrder%22%3A%22DESCENDING%22%2C%22sortedColumnId%22%3A%22date%22%7D;search:${asin};pagination:1;`
        },
        { status: 500 }
      );
    }

    console.log('🔧 Initialized Amazon Feeds API in production mode');

    // Look up the correct SKU for this ASIN
    let actualSku = null;
    try {
      console.log(`🔍 Looking up SKU for ASIN: ${asin}`);
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        PUBLIC_SUPABASE_URL,
        PRIVATE_SUPABASE_SERVICE_KEY
      );

      const { data: skuData, error: skuError } = await supabase
        .from('sku_asin_mapping')
        .select('seller_sku')
        .eq('asin1', asin)
        .limit(1)
        .single();

      if (skuError) {
        console.log(`⚠️ Could not find SKU for ASIN ${asin}:`, skuError.message);
        console.log(`🔄 Will use ASIN as SKU fallback`);
      } else {
        actualSku = skuData.seller_sku;
        console.log(`✅ Found SKU for ASIN ${asin}: ${actualSku}`);
      }
    } catch (skuLookupError) {
      console.log(`⚠️ SKU lookup failed for ASIN ${asin}:`, skuLookupError);
      console.log(`🔄 Will use ASIN as SKU fallback`);
    }

    // Execute the price update using Feeds API with correct SKU
    console.log(`🎯 Starting Feeds API Match Buy Box operation:`);
    console.log(`   📊 ASIN: ${asin}`);
    console.log(`   📊 SKU: ${actualSku || asin} (${actualSku ? 'from database' : 'ASIN fallback'})`);
    console.log(`   💰 Current Price: ${currentPrice !== null && currentPrice !== undefined ? `£${currentPrice.toFixed(2)}` : 'Unknown'}`);
    console.log(`   💰 Target Buy Box Price: £${targetPrice.toFixed(2)}`);
    console.log(`   📈 Price Change: ${currentPrice !== null && currentPrice !== undefined ? `£${(targetPrice - currentPrice).toFixed(2)} (${targetPrice > currentPrice ? '+' : ''}${(((targetPrice - currentPrice) / currentPrice) * 100).toFixed(1)}%)` : 'N/A'}`);
    console.log(`   📈 Projected Margin: ${projectedMargin ? `${projectedMargin.toFixed(2)}%` : 'Unknown'}`);
    console.log(`   ✅ Margin Check: ${projectedMargin >= 10 ? 'PASSED (≥10%)' : 'FAILED (<10%)'}`);

    const updateResult = await amazonAPI.updatePrice(asin, finalPrice, currentPrice, actualSku) as any;

    console.log('📊 Amazon Feeds API update result:', updateResult);

    // Log to audit trail (using Supabase)
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        PUBLIC_SUPABASE_URL,
        PRIVATE_SUPABASE_SERVICE_KEY
      );

      await supabase
        .from('security_audit_log')
        .insert({
          user_id: locals.session.user.id,
          action: 'MATCH_BUY_BOX',
          resource_type: 'AMAZON_LISTING',
          resource_id: asin,
          details: {
            buybox_price_to_match: targetPrice,
            projected_margin_percent: projectedMargin,
            final_price: finalPrice,
            amazon_response: updateResult,
            ip_address: request.headers.get('x-forwarded-for') || 'unknown'
          },
          timestamp: new Date().toISOString()
        });

      console.log('📝 Audit log entry created');
    } catch (auditError) {
      console.error('⚠️ Failed to create audit log:', auditError);
      // Don't fail the request for audit issues
    }

    if (updateResult.success) {
      // Successful price update
      return json({
        success: true,
        message: '🎯 Match Buy Box completed successfully',
        asin,
        buyBoxPriceMatched: targetPrice,
        projectedMargin: projectedMargin ? `${projectedMargin.toFixed(2)}%` : 'Unknown',
        finalPrice,
        amazonResponse: updateResult,
        timestamp: new Date().toISOString()
      });
    } else {
      // Price update failed - categorize the error
      let errorCategory = 'AMAZON_API_ERROR';
      let userFriendlyMessage = 'Price update failed';
      let requiresManualUpdate = true;

      if (updateResult.error?.includes('Missing required Amazon API credentials')) {
        errorCategory = 'MISSING_CREDENTIALS';
        userFriendlyMessage = 'Amazon API credentials not configured';
      } else if (updateResult.error?.includes('access token')) {
        errorCategory = 'AUTHENTICATION_ERROR';
        userFriendlyMessage = 'Amazon API authentication failed';
      } else if (updateResult.error?.includes('rate limit') || updateResult.status === 429) {
        errorCategory = 'RATE_LIMITED';
        userFriendlyMessage = 'Too many requests - please try again later';
        requiresManualUpdate = false;
      } else if (updateResult.status === 400) {
        errorCategory = 'INVALID_REQUEST';
        userFriendlyMessage = 'Invalid price update request';
      }

      // Price update failed
      return json({
        success: false,
        message: userFriendlyMessage,
        errorCategory,
        asin,
        originalTarget: targetPrice,
        finalPrice,
        error: updateResult.error || 'Amazon API returned unsuccessful response',
        amazonResponse: updateResult,
        requiresManualUpdate,
        sellerCentralUrl: requiresManualUpdate ? `https://sellercentral.amazon.co.uk/inventory/ref=xx_invmgr_dnav_xx?tbla_myitable=sort:%7B%22sortOrder%22%3A%22DESCENDING%22%2C%22sortedColumnId%22%3A%22date%22%7D;search:${asin};pagination:1;` : undefined,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

  } catch (error) {
    console.error('🚨 Match Buy Box error:', error);

    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
};
