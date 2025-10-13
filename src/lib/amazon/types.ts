/**
 * TypeScript types for Amazon SP-API
 */

export interface SPAPICredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRegion?: string;
  marketplaceId?: string;
}

export interface SPAPIConfig extends SPAPICredentials {
  endpoint?: string;
  roleArn?: string;
  sellerId?: string; // Seller Partner ID - required for STS AssumeRole External ID
}

export interface LWATokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

export interface SPAPIError {
  code: string;
  message: string;
  details?: string;
}

export interface SPAPIResponse<T = any> {
  success: boolean;
  data?: T;
  errors?: SPAPIError[];
  headers?: Record<string, string>;
  statusCode?: number;
}

// Catalog Items API Types
export interface CatalogItem {
  asin: string;
  attributes?: {
    item_name?: Array<{ value: string }>;
    brand?: Array<{ value: string }>;
    manufacturer?: Array<{ value: string }>;
    bullet_point?: Array<{ value: string }>;
    product_description?: Array<{ value: string }>;
  };
  images?: Array<{
    variant: string;
    link: string;
    height: number;
    width: number;
  }>;
  productTypes?: Array<{
    productType: string;
  }>;
  salesRanks?: Array<{
    title: string;
    link?: string;
    rank: number;
    displayGroupRanks?: Array<{
      title: string;
      rank: number;
    }>;
  }>;
  dimensions?: {
    length?: { value: number; unit: string };
    width?: { value: number; unit: string };
    height?: { value: number; unit: string };
    weight?: { value: number; unit: string };
  };
}

// Reports API Types
export interface ReportDocument {
  reportDocumentId: string;
  url: string;
  compressionAlgorithm?: string;
}

export interface Report {
  reportId: string;
  reportType: string;
  dataStartTime?: string;
  dataEndTime?: string;
  reportScheduleId?: string;
  createdTime: string;
  processingStatus: 'IN_QUEUE' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' | 'FATAL';
  processingStartTime?: string;
  processingEndTime?: string;
  reportDocumentId?: string;
}

export interface CreateReportRequest {
  reportType: string;
  marketplaceIds: string[];
  dataStartTime?: string;
  dataEndTime?: string;
  reportOptions?: Record<string, string>;
}

// Fees API Types
export interface FeesEstimateRequest {
  MarketplaceId: string;
  PriceToEstimateFees: {
    ListingPrice: {
      Amount: number;
      CurrencyCode: string;
    };
    Shipping?: {
      Amount: number;
      CurrencyCode: string;
    };
    Points?: {
      PointsNumber: number;
    };
  };
  Identifier: string;
  IsAmazonFulfilled: boolean;
  OptionalFulfillmentProgram?: string;
}

export interface FeesEstimate {
  TotalFeesEstimate?: {
    Amount: number;
    CurrencyCode: string;
  };
  FeeDetailList?: Array<{
    FeeType: string;
    FeeAmount: {
      Amount: number;
      CurrencyCode: string;
    };
    FeePromotion?: {
      Amount: number;
      CurrencyCode: string;
    };
    TaxAmount?: {
      Amount: number;
      CurrencyCode: string;
    };
    FinalFee: {
      Amount: number;
      CurrencyCode: string;
    };
  }>;
}

// Listings Items API Types
export interface ListingItem {
  sku: string;
  summaries?: Array<{
    marketplaceId: string;
    asin?: string;
    productType?: string;
    itemName?: string;
    status?: string[];
  }>;
  issues?: Array<{
    code: string;
    message: string;
    severity: 'ERROR' | 'WARNING' | 'INFO';
    attributeName?: string;
  }>;
}

// Sales & Traffic Report Types
export interface SalesAndTrafficByAsin {
  parentAsin?: string;
  childAsin: string;
  sku?: string;
  // Sales metrics
  orderedProductSales?: {
    amount: number;
    currencyCode: string;
  };
  orderedProductSalesB2B?: {
    amount: number;
    currencyCode: string;
  };
  unitsOrdered: number;
  unitsOrderedB2B?: number;
  totalOrderItems: number;
  totalOrderItemsB2B?: number;
  // Traffic metrics
  browserSessions?: number;
  browserSessionsB2B?: number;
  mobileAppSessions?: number;
  mobileAppSessionsB2B?: number;
  sessions: number;
  sessionsB2B?: number;
  browserSessionPercentage?: number;
  browserSessionPercentageB2B?: number;
  mobileAppSessionPercentage?: number;
  mobileAppSessionPercentageB2B?: number;
  sessionPercentage?: number;
  sessionPercentageB2B?: number;
  browserPageViews?: number;
  browserPageViewsB2B?: number;
  mobileAppPageViews?: number;
  mobileAppPageViewsB2B?: number;
  pageViews: number;
  pageViewsB2B?: number;
  browserPageViewsPercentage?: number;
  browserPageViewsPercentageB2B?: number;
  mobileAppPageViewsPercentage?: number;
  mobileAppPageViewsPercentageB2B?: number;
  pageViewsPercentage?: number;
  pageViewsPercentageB2B?: number;
  buyBoxPercentage?: number;
  buyBoxPercentageB2B?: number;
  unitSessionPercentage?: number;
  unitSessionPercentageB2B?: number;
}

export interface SalesAndTrafficReport {
  reportSpecification: {
    reportType: string;
    reportOptions?: Record<string, string>;
    dataStartTime: string;
    dataEndTime: string;
    marketplaceIds: string[];
  };
  salesAndTrafficByAsin?: SalesAndTrafficByAsin[];
  salesAndTrafficByDate?: Array<{
    date: string;
    [key: string]: any;
  }>;
}

// Common error types
export type SPAPIErrorCode =
  | 'Unauthorized'
  | 'InvalidInput'
  | 'RateLimitExceeded'
  | 'QuotaExceeded'
  | 'ResourceNotFound'
  | 'InternalFailure'
  | 'ServiceUnavailable'
  | 'RequestThrottled';

export interface RateLimitError extends Error {
  retryAfter?: number;
  headers?: Record<string, string>;
}
