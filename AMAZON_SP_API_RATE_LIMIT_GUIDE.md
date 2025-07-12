# Amazon SP-API Rate Limits and Best Practices Guide

This document provides a comprehensive overview of Amazon's Selling Partner API (SP-API) rate limits and best practices for optimizing API usage in your Buy Box Monitoring System.

## Rate Limiting Mechanism

Amazon SP-API uses the **token bucket algorithm** for rate limiting:

- Each API operation has its own "bucket" of tokens
- Tokens are automatically added to your bucket at a set rate per second
- Each API request consumes one token
- When your bucket is empty, requests are throttled (429 error)
- The bucket has a maximum capacity (burst limit)

## Rate Limit Factors

Rate limits depend on multiple factors:

1. **API operation**: Each operation has its own default rate and burst limits
2. **Selling partner and application pair**: Limits are per seller-app combination
3. **Regions and marketplaces**: Different rate limits can apply in different regions

## Usage Plan Types

SP-API has two types of usage plans:

1. **Standard usage plans**: Static values for all callers
2. **Dynamic usage plans**: Automatically adjusted based on selling partner business metrics (not based on API call frequency)

## Product Pricing API Rate Limits

Your Buy Box Monitoring System likely uses these endpoints with these limits:

### Product Pricing v0 (Older version)
| Operation | Rate (req/sec) | Burst |
|-----------|----------------|-------|
| getPricing | 0.5 | 1 |
| getCompetitivePricing | 0.5 | 1 |
| getListingOffers | 1 | 2 |
| getItemOffers | 0.5 | 1 |
| getItemOffersBatch | 0.1 | 1 |
| getListingOffersBatch | 0.5 | 1 |

### Product Pricing v2022-05-01 (Newer version)
| Operation | Rate (req/sec) | Burst |
|-----------|----------------|-------|
| getFeaturedOfferExpectedPriceBatch | 0.033 | 1 |
| getCompetitiveSummary | 0.033 | 1 |

Note: The v2022-05-01 operations fall under the dynamic usage plan, so your actual rate limits may vary.

## Finding Your Current Rate Limits

1. Check the API reference documentation for default limits
2. Check the `x-amzn-RateLimit-Limit` response header in successful API calls
   - Only available for HTTP status codes 20x, 400, and 404
   - Not available for unauthorized requests

## Handling 429 (Too Many Requests) Errors

When you receive a 429 error:

1. **Implement retry logic** with exponential backoff
2. Use the `x-amzn-RateLimit-Limit` header (when available) to adjust your calling rate
3. Add jitter (random delay) to your retry attempts to prevent request collisions

## Best Practices for Optimizing Rate Limits

### 1. Check and Adhere to Rate Limits

- Review the usage plan for each operation you use
- Set up error monitoring and alerting for 429 errors
- Track API response headers to understand your actual limits

### 2. Avoid Spiky Traffic

- Distribute API requests uniformly over time
- Implement a rate limiter to manage traffic
- Maintain consistent calling patterns

### 3. Implement Robust Retry and Backoff Techniques

- Automatic retry logic with appropriate delays
- Exponential backoff (progressively longer waits between retries)
- Add jitter (random delay variation) to prevent retry collisions
- Set maximum delay intervals and maximum retry attempts

### 4. Reduce API Request Volume

- **Batch operations**: Use batch endpoints where available
- **Bulk operations**: Use Reports API for downloading data in bulk
- **Event-based workflows**: Use Notifications API instead of polling

### 5. Other Optimization Strategies

- Cache frequently used data to reduce repeated API requests
- Optimize your code to eliminate unnecessary API calls
- Queue and stagger API requests with appropriate spacing
- Monitor your usage and scale accordingly

## Recommendations for Your Buy Box Monitoring System

Based on your current issues:

1. **Implement extremely conservative rate limits** (e.g., 0.1-0.2 req/sec) to stay well below the threshold
2. **Add significant jitter** (25-50% of your delay interval) to avoid request clusters
3. **Implement exponential backoff** for 429 errors with a maximum retry cap
4. **Consider batch operations** instead of individual ASIN checks where possible
5. **Add better logging** to track when rate limits are exceeded and when they reset
6. **Monitor the `x-amzn-RateLimit-Limit` header** to dynamically adjust your request rate
7. **Implement circuit breakers** to pause all requests if too many 429s occur consecutively

Remember: You cannot completely avoid throttling due to factors outside your control, but proper implementation can minimize disruption to your workflow.

## Recovery from Rate Limit Lockout

If you've been heavily rate limited:

1. **Pause all API calls** for a significant period (several hours or a day)
2. **Restart with extremely conservative settings** (well below documented limits)
3. **Gradually increase** request rate over time while monitoring for 429 responses
4. **Consider implementing a daily quota** system to spread requests over 24 hours

## References

- [Amazon SP-API Usage Plans and Rate Limits](https://developer-docs.amazon.com/sp-api/docs/usage-plans-and-rate-limits)
- [Optimize Rate Limits for Application Workloads](https://developer-docs.amazon.com/sp-api/docs/strategies-to-optimize-rate-limits-for-your-application-workloads)
- [Product Pricing API Rate Limits](https://developer-docs.amazon.com/sp-api/docs/product-pricing-api-rate-limits)
