// @ts-nocheck
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import crypto from 'crypto';

/**
 * Amazon SP-API Batch Listing Offers Price Checker
 * 
 * Returns the lowest priced offers for a batch of listings by SKU.
 * Rate Limit: 0.5 requests per second (Burst: 1)
 */

interface AmazonConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  marketplace: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

async function getAccessToken(config: AmazonConfig): Promise<string> {
  const response = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get Amazon access token: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.access_token;
}

function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string) {
  const kDate = crypto.createHmac('sha256', "AWS4" + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  const kSigning = crypto.createHmac('sha256', kService).update("aws4_request").digest();
  return kSigning;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { skus } = await request.json();

    if (!skus || !Array.isArray(skus) || skus.length === 0) {
      return json({ success: false, error: 'Skus array is required' }, { status: 400 });
    }

    if (skus.length > 20) {
      return json({ success: false, error: 'Maximum 20 SKUs allowed per batch' }, { status: 400 });
    }

    const config: AmazonConfig = {
      clientId: env.AMAZON_CLIENT_ID,
      clientSecret: env.AMAZON_CLIENT_SECRET,
      refreshToken: env.AMAZON_REFRESH_TOKEN,
      marketplace: env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
      endpoint: 'sellingpartnerapi-eu.amazon.com',
      region: 'eu-west-1',
      accessKeyId: env.AMAZON_AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AMAZON_AWS_SECRET_ACCESS_KEY
    };

    const accessToken = await getAccessToken(config);
    const method = 'POST';
    const path = '/batches/products/pricing/v0/listingOffers';
    
    const batchRequests = skus.map(sku => ({
      uri: `/products/pricing/v0/listings/${encodeURIComponent(sku)}/offers`,
      method: 'GET',
      queryParams: {
        'MarketplaceId': config.marketplace,
        'ItemCondition': 'New',
        'CustomerType': 'Consumer'
      }
    }));

    const body = JSON.stringify({ requests: batchRequests });
    const amzDate = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    
    const headers = {
      'host': config.endpoint,
      'x-amz-date': amzDate,
      'x-amz-access-token': accessToken,
      'content-type': 'application/json'
    };

    const canonicalUri = path;
    const canonicalQueryString = '';
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map(key => `${key.toLowerCase()}:${headers[key]}`)
      .join('\n') + '\n';

    const signedHeaders = Object.keys(headers)
      .sort()
      .map(key => key.toLowerCase())
      .join(';');

    const payloadHash = crypto.createHash('sha256').update(body).digest('hex');

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${config.region}/execute-api/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    const signingKey = getSignatureKey(config.secretAccessKey, dateStamp, config.region, 'execute-api');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const authorizationHeader = `${algorithm} Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(`https://${config.endpoint}${path}`, {
      method: 'POST',
      headers: {
        ...headers,
        'Authorization': authorizationHeader
      },
      body
    });

    if (!response.ok) {
      const errorText = await response.text();
      return json({ success: false, error: `Amazon API error: ${response.status} ${errorText}` }, { status: response.status });
    }

    const data = await response.json();

    // Our Merchant ID / Seller ID
    const YOUR_SELLER_ID = 'A2D8NG39VURSL3';

    // Map responses back to SKUs
    const results = data.responses.map((resp, index) => {
      const sku = skus[index];
      const status = resp.status?.statusCode === 200 ? 'success' : 'error';
      const payload = resp.body?.payload;
      
      const buyBoxPrice = payload?.Summary?.BuyBoxPrices?.[0];
      const lowestPrice = payload?.Summary?.LowestPrices?.[0];
      const offers = resp.body?.payload?.Offers || [];
      
      // Check if we are winning
      const ourOffer = offers.find((o: any) => o.SellerId === YOUR_SELLER_ID);
      const isWinner = ourOffer?.IsBuyBoxWinner === true;

      // Extract next best price (first offer that isn't the Buy Box winner AND isn't our own offer)
      const otherOffers = offers
        .filter((o: any) => !o.IsBuyBoxWinner && o.SellerId !== YOUR_SELLER_ID)
        .sort((a: any, b: any) => (a.ListingPrice?.Amount || 0) - (b.ListingPrice?.Amount || 0));
      
      const nextBestPrice = otherOffers[0]?.ListingPrice?.Amount;

      return {
        sku,
        status,
        error: status === 'error' ? (resp.body?.errors?.[0]?.message || 'Unknown error') : null,
        data: status === 'success' ? {
          asin: payload?.Summary?.ASIN || payload?.Identifier?.Asin,
          buyBoxPrice: buyBoxPrice?.LandedPrice?.Amount,
          lowestPrice: lowestPrice?.LandedPrice?.Amount,
          nextBestPrice: nextBestPrice,
          currency: buyBoxPrice?.LandedPrice?.CurrencyCode || lowestPrice?.LandedPrice?.CurrencyCode,
          offerCount: payload?.Summary?.TotalOfferCount,
          isWinner,
          ourPrice: ourOffer?.ListingPrice?.Amount,
          rawOffers: offers
        } : null
      };
    });

    return json({
      success: true,
      results
    });

  } catch (error: any) {
    console.error('Error in batch buy box route:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};
