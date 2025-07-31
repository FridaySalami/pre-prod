import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/supabaseAdmin';
import {
  AMAZON_CLIENT_ID,
  AMAZON_CLIENT_SECRET,
  AMAZON_REFRESH_TOKEN,
  AMAZON_AWS_ACCESS_KEY_ID,
  AMAZON_AWS_SECRET_ACCESS_KEY,
  AMAZON_MARKETPLACE_ID,
  AMAZON_SELLER_ID
} from '$env/static/private';
import crypto from 'crypto';

/**
 * Serverless Live Pricing Update API
 * 
 * Updates a single SKU's pricing data by fetching fresh Amazon SP-API data
 * Runs completely serverless without dependency on render-service
 */

// Rate limiting storage (in-memory for serverless)
const rateLimitMap = new Map<string, number>();
const MIN_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface AmazonSPAPIConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  marketplace: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

class ServerlessAmazonSPAPI {
  private config: AmazonSPAPIConfig;

  constructor() {
    this.config = {
      clientId: AMAZON_CLIENT_ID,
      clientSecret: AMAZON_CLIENT_SECRET,
      refreshToken: AMAZON_REFRESH_TOKEN,
      marketplace: AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
      endpoint: 'https://sellingpartnerapi-eu.amazon.com',
      region: 'eu-west-1',
      accessKeyId: AMAZON_AWS_ACCESS_KEY_ID,
      secretAccessKey: AMAZON_AWS_SECRET_ACCESS_KEY
    };

    // Validate config
    const required = ['clientId', 'clientSecret', 'refreshToken', 'accessKeyId', 'secretAccessKey'];
    for (const key of required) {
      if (!this.config[key as keyof AmazonSPAPIConfig]) {
        throw new Error(`Missing Amazon SP-API configuration: ${key}`);
      }
    }
  }

  /**
   * Get access token from Amazon LWA
   */
  async getAccessToken(): Promise<string> {
    const tokenEndpoint = 'https://api.amazon.com/auth/o2/token';

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.config.refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: body.toString()
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to get access token: ${response.status} ${errorData}`);
    }

    const tokenData = await response.json();
    return tokenData.access_token;
  }

  /**
   * Create AWS Signature V4 for SP-API requests
   */
  createSignature(method: string, path: string, queryParams: Record<string, string>, headers: Record<string, string>, body: string): Record<string, string> {
    const amzDate = headers['x-amz-date'];
    const dateStamp = amzDate.substr(0, 8);

    // Create canonical request
    const canonicalUri = path;
    const canonicalQuerystring = Object.keys(queryParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');

    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map(key => `${key.toLowerCase()}:${headers[key]}\n`)
      .join('');

    const signedHeaders = Object.keys(headers)
      .sort()
      .map(key => key.toLowerCase())
      .join(';');

    const payloadHash = crypto.createHash('sha256').update(body).digest('hex');

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuerystring,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${this.config.region}/execute-api/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    // Calculate signature
    const kDate = crypto.createHmac('sha256', `AWS4${this.config.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(this.config.region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update('execute-api').digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    return {
      ...headers,
      'Authorization': `${algorithm} Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    };
  }

  /**
   * Get competitive pricing data for an ASIN
   */
  async getCompetitivePricing(asin: string): Promise<any> {
    const accessToken = await this.getAccessToken();

    const method = 'GET';
    const path = `/products/pricing/v0/items/${asin}/offers`;
    const queryParams = {
      MarketplaceId: this.config.marketplace,
      ItemCondition: 'New'
    };

    const amzDate = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
    const headers = {
      'host': 'sellingpartnerapi-eu.amazon.com',
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': crypto.createHash('sha256').update('').digest('hex')
    };

    const signedHeaders = this.createSignature(method, path, queryParams, headers, '');

    const queryString = Object.entries(queryParams)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');

    const url = `${this.config.endpoint}${path}?${queryString}`;

    const response = await fetch(url, {
      method,
      headers: signedHeaders,
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    if (!response.ok) {
      const errorData = await response.text();

      if (response.status === 429) {
        throw new Error('RATE_LIMITED');
      } else if (response.status === 403) {
        throw new Error('ACCESS_DENIED');
      } else if (response.status === 404) {
        throw new Error('ASIN_NOT_FOUND');
      } else {
        throw new Error(`SP_API_ERROR: ${response.status} ${errorData}`);
      }
    }

    return await response.json();
  }

  /**
   * Transform SP-API response to buybox_data format
   */
  transformPricingData(pricingData: any, asin: string, sku: string, runId: string, productTitle?: string): any {
    const offers = pricingData?.payload?.Offers || [];

    if (offers.length === 0) {
      throw new Error('No offers found for ASIN');
    }

    const yourSellerId = AMAZON_SELLER_ID;
    const buyBoxOffer = offers.find((offer: any) => offer.IsBuyBoxWinner === true);
    const yourOfferFromApi = offers.find((offer: any) => offer.SellerId === yourSellerId);

    // Price calculations
    const buyBoxPrice = buyBoxOffer?.ListingPrice?.Amount || null;
    const yourCurrentPrice = yourOfferFromApi?.ListingPrice?.Amount || 0;
    const yourCurrentShipping = yourOfferFromApi?.Shipping?.Amount || 0;
    const buyBoxShipping = buyBoxOffer?.Shipping?.Amount || 0;

    const isWinner = buyBoxOffer?.SellerId === yourSellerId;
    const priceGap = buyBoxPrice ? yourCurrentPrice - buyBoxPrice : 0;

    return {
      run_id: runId,
      asin,
      sku,
      item_name: productTitle || `Product ${asin}`,
      price: yourCurrentPrice,
      your_current_price: yourCurrentPrice,
      your_current_shipping: yourCurrentShipping,
      your_current_total: yourCurrentPrice + yourCurrentShipping,
      buybox_price: buyBoxPrice,
      buybox_shipping: buyBoxShipping,
      buybox_total: buyBoxPrice ? buyBoxPrice + buyBoxShipping : null,
      competitor_price: buyBoxPrice,
      is_winner: isWinner,
      opportunity_flag: false, // Simplified for serverless
      price_gap: parseFloat(priceGap.toFixed(2)),
      price_gap_percentage: yourCurrentPrice > 0 ? parseFloat(((priceGap / yourCurrentPrice) * 100).toFixed(2)) : 0,
      pricing_status: isWinner ? 'winning_buybox' : (priceGap > 0 ? 'priced_above_buybox' : 'priced_below_buybox'),
      your_offer_found: !!yourOfferFromApi,
      captured_at: new Date().toISOString(),
      merchant_token: yourSellerId,
      buybox_merchant_token: buyBoxOffer?.SellerId || null,
      total_offers: offers.length
    };
  }
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { sku, recordId, userId } = await request.json();

    // Validate request
    if (!sku || !recordId) {
      return json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'SKU and recordId are required'
      }, { status: 400 });
    }

    console.log(`🔄 Serverless live pricing update for SKU: ${sku}, Record: ${recordId}`);

    // Rate limiting check
    const rateLimitKey = `${sku}_${recordId}`;
    const lastUpdate = rateLimitMap.get(rateLimitKey);
    const now = Date.now();

    if (lastUpdate && (now - lastUpdate) < MIN_UPDATE_INTERVAL) {
      const timeRemaining = Math.ceil((MIN_UPDATE_INTERVAL - (now - lastUpdate)) / 1000);
      return json({
        success: false,
        error: 'RECENTLY_UPDATED',
        message: `Please wait ${timeRemaining} seconds before updating again`
      }, { status: 429 });
    }

    // Validate record exists
    const { data: existingRecord, error: fetchError } = await supabaseAdmin
      .from('buybox_data')
      .select('id, sku, asin, captured_at, run_id')
      .eq('id', recordId)
      .eq('sku', sku)
      .single();

    if (fetchError || !existingRecord) {
      return json({
        success: false,
        error: 'RECORD_NOT_FOUND',
        message: `Record not found for SKU ${sku} with ID ${recordId}`
      }, { status: 404 });
    }

    // Get product title from sku_asin_mapping
    const { data: mappingData } = await supabaseAdmin
      .from('sku_asin_mapping')
      .select('product_title')
      .eq('seller_sku', sku)
      .eq('asin', existingRecord.asin)
      .single();

    const productTitle = mappingData?.product_title || null;

    // Initialize Amazon SP-API client
    const amazonAPI = new ServerlessAmazonSPAPI();

    // Fetch live pricing data
    console.log(`📡 Fetching live pricing for ASIN: ${existingRecord.asin}`);
    const pricingData = await amazonAPI.getCompetitivePricing(existingRecord.asin);

    // Transform data
    console.log(`🔄 Transforming pricing data for SKU: ${sku}`);
    const transformedData = amazonAPI.transformPricingData(
      pricingData,
      existingRecord.asin,
      sku,
      existingRecord.run_id,
      productTitle
    );

    // Update database record
    const { data: updatedRecord, error: updateError } = await supabaseAdmin
      .from('buybox_data')
      .update({
        ...transformedData,
        captured_at: new Date().toISOString()
      })
      .eq('id', recordId)
      .select()
      .single();

    if (updateError) {
      console.error('Database update error:', updateError);
      return json({
        success: false,
        error: 'DATABASE_ERROR',
        message: 'Failed to update record'
      }, { status: 500 });
    }

    // Update rate limit
    rateLimitMap.set(rateLimitKey, now);

    console.log(`✅ Successfully updated live pricing for SKU: ${sku}`);

    return json({
      success: true,
      updatedData: updatedRecord,
      timestamp: new Date().toISOString(),
      source: 'serverless_live_update'
    });

  } catch (error: any) {
    console.error('❌ Serverless live pricing update failed:', error);

    // Handle specific error types
    let statusCode = 500;
    let errorCode = 'UPDATE_FAILED';
    let message = error.message || 'Unknown error';

    if (error.message === 'RATE_LIMITED') {
      statusCode = 429;
      errorCode = 'RATE_LIMITED';
      message = 'Amazon API rate limit exceeded. Please try again later.';
    } else if (error.message === 'ACCESS_DENIED') {
      statusCode = 403;
      errorCode = 'ACCESS_DENIED';
      message = 'Amazon API access denied. Check credentials.';
    } else if (error.message === 'ASIN_NOT_FOUND') {
      statusCode = 404;
      errorCode = 'ASIN_NOT_FOUND';
      message = 'Product not found on Amazon.';
    } else if (error.message.includes('Missing Amazon SP-API configuration')) {
      statusCode = 500;
      errorCode = 'CONFIGURATION_ERROR';
      message = 'Amazon SP-API configuration is incomplete.';
    }

    return json({
      success: false,
      error: errorCode,
      message
    }, { status: statusCode });
  }
};

/**
 * GET endpoint for health check
 */
export const GET: RequestHandler = async () => {
  return json({
    success: true,
    message: 'Serverless Live Pricing API is operational',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
};
