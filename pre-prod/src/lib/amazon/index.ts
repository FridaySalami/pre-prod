/**
 * Amazon SP-API Client Library
 * 
 * Entry point for all Amazon SP-API integrations
 */

export { SPAPIClient } from './sp-api-client';
export { RateLimiter, RateLimiters } from './rate-limiter';
export type {
  SPAPICredentials,
  SPAPIConfig,
  SPAPIResponse,
  SPAPIError,
  CatalogItem,
  Report,
  ReportDocument,
  CreateReportRequest,
  FeesEstimateRequest,
  FeesEstimate,
  ListingItem,
  SalesAndTrafficByAsin,
  SalesAndTrafficReport,
  LWATokenResponse,
  RateLimitError
} from './types';

export type { RateLimiterConfig } from './rate-limiter';
