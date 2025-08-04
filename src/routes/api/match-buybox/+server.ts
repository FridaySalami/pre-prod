import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Check authentication
    if (!locals.session?.user) {
      return json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { asin, targetPrice, marginPercent, userId, projectedMargin } = await request.json();

    console.log(`🎯 Production Match Buy Box request:`, {
      asin,
      targetPrice,
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

    // Validate target price
    if (typeof targetPrice !== 'number' || targetPrice <= 0) {
      return json(
        {
          success: false,
          error: 'Target price must be a positive number'
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

    // Import Amazon API service dynamically with fallback
    let amazonAPI;
    try {
      console.log('🔧 Attempting to import Amazon API service...');

      // Try server-optimized JavaScript version first (most reliable)
      // Import the server-optimized ES module version
      const module = await import('$lib/services/amazon-listings-api-server.js');
      console.log('📦 Server module imported successfully');
      const AmazonListingsAPI = module.default;

      console.log('🔍 Final AmazonListingsAPI validation:', {
        type: typeof AmazonListingsAPI,
        isFunction: typeof AmazonListingsAPI === 'function',
        hasPrototype: AmazonListingsAPI && 'prototype' in AmazonListingsAPI,
        constructorName: AmazonListingsAPI?.name,
        canConstruct: true
      });

      if (!AmazonListingsAPI || typeof AmazonListingsAPI !== 'function') {
        throw new Error(`AmazonListingsAPI is not a constructor. Type: ${typeof AmazonListingsAPI}, Value: ${AmazonListingsAPI}`);
      }

      amazonAPI = new AmazonListingsAPI({
        environment: 'production' // Production environment
      });
      console.log('✅ Amazon API instance created successfully');
    } catch (importError) {
      console.error('❌ Failed to import Amazon API service:', importError);
      console.error('❌ Error details:', (importError as Error).stack);
      return json(
        {
          success: false,
          error: 'Service initialization failed',
          details: `Amazon API service could not be loaded: ${(importError as Error).message}`
        },
        { status: 500 }
      );
    }

    console.log('🔧 Initialized Amazon API in production mode');

    // Execute the price update
    console.log(`🎯 Starting Match Buy Box operation:`);
    console.log(`   📊 ASIN: ${asin}`);
    console.log(`   💰 Target Buy Box Price: £${targetPrice.toFixed(2)}`);
    console.log(`   📈 Projected Margin: ${projectedMargin ? `${projectedMargin.toFixed(2)}%` : 'Unknown'}`);
    console.log(`   ✅ Margin Check: ${projectedMargin >= 10 ? 'PASSED (≥10%)' : 'FAILED (<10%)'}`);

    const updateResult = await amazonAPI.updatePrice(asin, finalPrice) as any;

    console.log('📊 Amazon API update result:', updateResult);

    // Log to audit trail (using Supabase)
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.PUBLIC_SUPABASE_URL!,
        process.env.PRIVATE_SUPABASE_SERVICE_KEY!
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
      // Price update failed
      return json({
        success: false,
        message: 'Match Buy Box failed - Amazon API error',
        asin,
        originalTarget: targetPrice,
        finalPrice,
        error: updateResult.error || 'Amazon API returned unsuccessful response',
        amazonResponse: updateResult,
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
