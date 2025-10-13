# SP-API Client - Quick Reference

## 🚀 Quick Start

```typescript
import { SPAPIClient, RateLimiters } from '$lib/amazon';

const client = SPAPIClient.fromEnv();
```

## 📋 Common Operations

### Get Product Catalog
```typescript
const response = await client.get(
  `/catalog/2022-04-01/items/${asin}`,
  {
    queryParams: {
      marketplaceIds: 'A1F83G8C2ARO7P',
      includedData: 'attributes,images,productTypes,salesRanks'
    },
    rateLimiter: RateLimiters.catalog
  }
);
```

### Request Sales Report
```typescript
const response = await client.post(
  '/reports/2021-06-30/reports',
  {
    reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
    marketplaceIds: ['A1F83G8C2ARO7P'],
    dataStartTime: '2025-10-01T00:00:00Z',
    dataEndTime: '2025-10-13T23:59:59Z'
  },
  { rateLimiter: RateLimiters.reports }
);
```

### Get FBA Fees
```typescript
const response = await client.post(
  `/products/fees/v0/listings/${sku}/feesEstimate`,
  {
    MarketplaceId: 'A1F83G8C2ARO7P',
    PriceToEstimateFees: {
      ListingPrice: { Amount: 25.99, CurrencyCode: 'GBP' }
    },
    Identifier: `fees-${sku}`,
    IsAmazonFulfilled: true
  },
  { rateLimiter: RateLimiters.fees }
);
```

### Check Report Status
```typescript
const response = await client.get(
  `/reports/2021-06-30/reports/${reportId}`,
  { rateLimiter: RateLimiters.reports }
);

if (response.data.processingStatus === 'DONE') {
  // Download report
}
```

## 🎯 Rate Limiters

| API | Rate Limiter | Requests/Second |
|-----|--------------|-----------------|
| Catalog Items | `RateLimiters.catalog` | 4 |
| Reports | `RateLimiters.reports` | 0.0167 (1/min) |
| Product Fees | `RateLimiters.fees` | 0.8 |
| Listings Items | `RateLimiters.listings` | 4 |
| Default | `RateLimiters.default` | 0.5 |

## ❌ Error Handling

```typescript
const response = await client.get('/some/endpoint');

if (!response.success) {
  console.error('Errors:', response.errors);
  
  // Check error codes
  if (response.errors?.[0]?.code === 'Unauthorized') {
    // Handle auth error
  }
  
  if (response.statusCode === 429) {
    // Rate limited
  }
}
```

## 🔄 Retry Logic

Built-in retry with exponential backoff:
- Automatic retry on transient errors
- Handles 429 rate limit errors
- Max 3 retries by default
- Backoff: 1s, 2s, 4s (max 10s)

## 📦 Response Format

```typescript
interface SPAPIResponse<T> {
  success: boolean;
  data?: T;
  errors?: SPAPIError[];
  headers?: Record<string, string>;
  statusCode?: number;
}
```

## 🔑 Environment Variables

```bash
AMAZON_CLIENT_ID=
AMAZON_CLIENT_SECRET=
AMAZON_REFRESH_TOKEN=
AMAZON_AWS_ACCESS_KEY_ID=
AMAZON_AWS_SECRET_ACCESS_KEY=
AMAZON_AWS_REGION=eu-west-1
AMAZON_MARKETPLACE_ID=A1F83G8C2ARO7P
```

## 📚 Full Documentation

- **Examples**: `/src/lib/amazon/examples.ts`
- **Types**: `/src/lib/amazon/types.ts`
- **Client**: `/src/lib/amazon/sp-api-client.ts`
- **Rate Limiter**: `/src/lib/amazon/rate-limiter.ts`
