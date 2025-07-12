# Amazon SP-API Rate Limit Solution Guide

This document summarizes the tools and documentation we've created to help you address rate limiting issues in your Amazon Buy Box Monitoring System.

## Created Documentation

1. **AMAZON_SP_API_RATE_LIMIT_GUIDE.md**
   - Comprehensive overview of Amazon SP-API rate limits
   - Explanation of the token bucket algorithm
   - Rate limit factors and usage plan types
   - Product Pricing API rate limits
   - Best practices for handling rate limits

2. **AMAZON_SP_API_IMPLEMENTATION_GUIDE.md**
   - Code examples for implementing rate limiting
   - Implementation of rate limiters with jitter
   - Exponential backoff with jitter for retry logic
   - Circuit breaker pattern to prevent API abuse
   - Complete Buy Box Monitor implementation with robust error handling

## Created Tools

1. **test-sp-api-rate-limiting.js**
   - Tests rate limiting implementation with mock API calls
   - Demonstrates proper implementation of rate limiting and jitter
   - Simulates 429 errors and shows retry behavior
   - Useful for validating your rate limiting approach

2. **monitor-rate-limiting.js**
   - Real-time monitoring of rate limiting for running jobs
   - Tracks and visualizes 429 error frequency
   - Calculates optimal rate limits based on observed behavior
   - Provides recommendations for job configuration
   - Command: `node monitor-rate-limiting.js --job-id <job_id> [options]`

3. **restart-buybox-job.js**
   - Restarts stalled or failed jobs with more conservative settings
   - Can copy only unprocessed ASINs to avoid redundant work
   - Automatically calculates optimal rate limits
   - Command: `node restart-buybox-job.js --job-id <job_id> [options]`

## Key Recommendations

1. **Rate Limits**: Start with extremely conservative limits (0.1-0.2 req/sec) and increase only if no 429 errors occur

2. **Jitter**: Add significant jitter (30-50%) to prevent request clustering

3. **Backoff**: Implement exponential backoff for retries with maximum retry limits

4. **Circuit Breaker**: Add circuit breaker to pause all requests when rate limits are exceeded repeatedly

5. **Monitoring**: Use the monitoring tool to get insights into rate limiting patterns

6. **Dynamic Adjustment**: Read the `x-amzn-RateLimit-Limit` header to dynamically adjust your rate limits

7. **Daily Quotas**: Remember that Amazon may have daily quotas that are separate from per-second rate limits

## Next Steps

1. Test the system with the conservative rate limits (0.1-0.2 req/sec)

2. Monitor rate limiting behavior using the monitoring tool

3. If no 429 errors occur for 24+ hours, consider gradually increasing rates

4. Implement a circuit breaker in your main application code

5. Add notifications when rate limiting occurs consistently

Remember that Amazon SP-API rate limits can change and are applied at multiple levels (per operation, per seller-application pair, etc.). Always start conservatively and adjust based on observed behavior.
