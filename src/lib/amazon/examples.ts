/**
 * Example usage of SP-API Client
 * 
 * This file demonstrates how to use the SP-API client for different operations
 */

import { SPAPIClient, RateLimiters } from './index';

// Example 1: Create client from environment variables
export function createDefaultClient() {
  return SPAPIClient.fromEnv();
}

// Example 2: Get product catalog information
export async function getCatalogItem(asin: string) {
  const client = SPAPIClient.fromEnv();

  const response = await client.get(
    `/catalog/2022-04-01/items/${asin}`,
    {
      queryParams: {
        marketplaceIds: 'A1F83G8C2ARO7P', // UK
        includedData: 'attributes,images,productTypes,salesRanks'
      },
      rateLimiter: RateLimiters.catalog
    }
  );

  if (!response.success) {
    console.error('Failed to get catalog item:', response.errors);
    return null;
  }

  return response.data;
}

// Example 3: Request a sales report
export async function requestSalesReport(startDate: string, endDate: string) {
  const client = SPAPIClient.fromEnv();

  const response = await client.post(
    '/reports/2021-06-30/reports',
    {
      reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
      marketplaceIds: ['A1F83G8C2ARO7P'],
      dataStartTime: startDate,
      dataEndTime: endDate
    },
    {
      rateLimiter: RateLimiters.reports
    }
  );

  if (!response.success) {
    console.error('Failed to request report:', response.errors);
    return null;
  }

  return response.data;
}

// Example 4: Get fees estimate for a product
export async function getFeesEstimate(sku: string, price: number) {
  const client = SPAPIClient.fromEnv();

  const response = await client.post(
    `/products/fees/v0/listings/${sku}/feesEstimate`,
    {
      MarketplaceId: 'A1F83G8C2ARO7P',
      PriceToEstimateFees: {
        ListingPrice: {
          Amount: price,
          CurrencyCode: 'GBP'
        }
      },
      Identifier: `fees-${sku}-${Date.now()}`,
      IsAmazonFulfilled: true
    },
    {
      rateLimiter: RateLimiters.fees
    }
  );

  if (!response.success) {
    console.error('Failed to get fees estimate:', response.errors);
    return null;
  }

  return response.data;
}

// Example 5: Check report status
export async function getReportStatus(reportId: string) {
  const client = SPAPIClient.fromEnv();

  const response = await client.get(
    `/reports/2021-06-30/reports/${reportId}`,
    {
      rateLimiter: RateLimiters.reports
    }
  );

  if (!response.success) {
    console.error('Failed to get report status:', response.errors);
    return null;
  }

  return response.data;
}

// Example 6: Download report document
export async function downloadReport(reportDocumentId: string) {
  const client = SPAPIClient.fromEnv();

  // First get the document info with download URL
  const response = await client.get(
    `/reports/2021-06-30/documents/${reportDocumentId}`,
    {
      rateLimiter: RateLimiters.reports
    }
  );

  if (!response.success) {
    console.error('Failed to get report document:', response.errors);
    return null;
  }

  // Download from the URL (URL expires in 5 minutes)
  const downloadUrl = response.data.url;
  const downloadResponse = await fetch(downloadUrl);

  if (!downloadResponse.ok) {
    console.error('Failed to download report');
    return null;
  }

  const reportData = await downloadResponse.text();

  // If compressed, decompress here
  if (response.data.compressionAlgorithm === 'GZIP') {
    // Use zlib to decompress
    const { gunzipSync } = await import('zlib');
    const buffer = Buffer.from(reportData, 'base64');
    const decompressed = gunzipSync(buffer);
    return decompressed.toString('utf-8');
  }

  return reportData;
}

// Example 7: Get listing item details
export async function getListingItem(sellerId: string, sku: string) {
  const client = SPAPIClient.fromEnv();

  const response = await client.get(
    `/listings/2021-08-01/items/${sellerId}/${sku}`,
    {
      queryParams: {
        marketplaceIds: 'A1F83G8C2ARO7P',
        includedData: 'summaries,issues'
      },
      rateLimiter: RateLimiters.listings
    }
  );

  if (!response.success) {
    console.error('Failed to get listing item:', response.errors);
    return null;
  }

  return response.data;
}

// Example 8: Error handling pattern
export async function safeApiCall<T>(
  apiCall: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    console.error('API call failed:', error);
    return fallback;
  }
}

// Example 9: Batch operations with rate limiting
export async function getCatalogItemsBatch(asins: string[]) {
  const client = SPAPIClient.fromEnv();
  const results: any[] = [];

  for (const asin of asins) {
    const result = await safeApiCall(
      () => getCatalogItem(asin),
      null
    );

    if (result) {
      results.push(result);
    }

    // Rate limiter handles the pacing automatically
  }

  return results;
}

// Example 10: Using custom rate limiter
export async function customRateLimitedCall() {
  const client = SPAPIClient.fromEnv();

  // Create a custom rate limiter for specific needs
  const { RateLimiter } = await import('./rate-limiter');
  const customLimiter = new RateLimiter({
    requestsPerSecond: 2,
    burstLimit: 5,
    jitterPercentage: 0.2
  });

  const response = await client.get(
    '/some/endpoint',
    {
      rateLimiter: customLimiter
    }
  );

  return response;
}
