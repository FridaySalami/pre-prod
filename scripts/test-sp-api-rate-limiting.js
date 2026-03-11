/**
 * test-sp-api-rate-limiting.js
 * 
 * A test script to demonstrate proper rate limiting and retry logic
 * for Amazon SP-API to avoid 429 errors.
 */

const axios = require('axios');

/**
 * SP-API Rate Limiter with jitter
 */
class SPAPIRateLimiter {
  constructor(options = {}) {
    this.requestsPerSecond = options.requestsPerSecond || 0.2; // Very conservative: 5 seconds between requests
    this.burstLimit = options.burstLimit || 1;
    this.jitterPercentage = options.jitterPercentage || 0.3; // 30% jitter
    this.queue = [];
    this.processing = false;
    this.tokens = this.burstLimit;
    this.lastRefillTime = Date.now();
    this.refillInterval = 1000 / this.requestsPerSecond;
  }

  async schedule(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        requestFn,
        resolve,
        reject
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  async processQueue() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    this.refillTokens();

    if (this.tokens >= 1) {
      // We have a token, process one request
      this.tokens -= 1;

      const request = this.queue.shift();
      try {
        const result = await request.requestFn();
        request.resolve(result);

        // Check response headers for rate limit info
        if (result && result.headers && result.headers['x-amzn-RateLimit-Limit']) {
          const apiLimit = parseFloat(result.headers['x-amzn-RateLimit-Limit']);
          if (apiLimit > 0) {
            // Adjust to 80% of the actual limit to be safe
            this.requestsPerSecond = apiLimit * 0.8;
            this.refillInterval = 1000 / this.requestsPerSecond;
            console.log(`Adjusted rate limit to ${this.requestsPerSecond} req/sec`);
          }
        }
      } catch (error) {
        request.reject(error);
      }

      // Add jitter
      const jitterMs = this.refillInterval * this.jitterPercentage * Math.random();
      setTimeout(() => this.processQueue(), this.refillInterval + jitterMs);
    } else {
      // No tokens available, wait for refill + jitter
      const waitTime = this.refillInterval + (this.refillInterval * this.jitterPercentage * Math.random());
      setTimeout(() => this.processQueue(), waitTime);
    }
  }

  refillTokens() {
    const now = Date.now();
    const elapsedMs = now - this.lastRefillTime;
    const newTokens = elapsedMs / this.refillInterval;

    if (newTokens >= 1) {
      this.tokens = Math.min(this.tokens + Math.floor(newTokens), this.burstLimit);
      this.lastRefillTime = now - (elapsedMs % this.refillInterval);
    }
  }
}

/**
 * Retry function with exponential backoff and jitter
 */
async function retryWithExponentialBackoff(fn, options = {}) {
  const maxRetries = options.maxRetries || 5;
  const baseDelayMs = options.baseDelayMs || 1000;
  const maxDelayMs = options.maxDelayMs || 60000; // 1 minute max delay
  const jitterFactor = options.jitterFactor || 0.3;

  let retries = 0;
  let lastError;

  while (retries <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (
        error.response?.status === 429 ||
        (error.response?.status >= 500 && error.response?.status < 600) ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT'
      ) {
        retries += 1;

        if (retries > maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const expDelay = Math.min(
          baseDelayMs * Math.pow(2, retries - 1),
          maxDelayMs
        );

        // Add jitter to avoid thundering herd problem
        const jitter = expDelay * jitterFactor * Math.random();
        const delay = expDelay + jitter;

        console.log(`Retry ${retries}/${maxRetries} after ${Math.round(delay)}ms due to ${error.response?.status || error.code}`);

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Don't retry other types of errors
        throw error;
      }
    }
  }

  // If we got here, we've exceeded max retries
  const error = new Error(`Max retries (${maxRetries}) exceeded`);
  error.originalError = lastError;
  throw error;
}

/**
 * Make a request to the SP-API with proper rate limiting and retry logic
 */
async function makeSPAPIRequest(apiClient, endpoint, params) {
  return retryWithExponentialBackoff(
    async () => {
      console.log(`Making request to: ${endpoint}`);

      try {
        const response = await apiClient(endpoint, params);

        // Log rate limit headers if available
        if (response.headers['x-amzn-RateLimit-Limit']) {
          console.log('Rate limit:', response.headers['x-amzn-RateLimit-Limit']);
        }

        return response;
      } catch (error) {
        // Enhance error with status code for easier retry logic
        if (error.response) {
          error.statusCode = error.response.status;

          // Log the error response from Amazon
          console.error('Error response:', {
            status: error.response.status,
            statusText: error.response.statusText,
            headers: error.response.headers,
            data: error.response.data
          });
        }

        throw error;
      }
    },
    {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 30000,
      jitterFactor: 0.3
    }
  );
}

// Mock SP-API client for testing
function createMockSPAPIClient() {
  return async (endpoint, params) => {
    // Simulate API call
    console.log(`[MOCK] Making request to ${endpoint} with params:`, params);

    // Randomly simulate rate limit exceeded (for testing)
    if (Math.random() < 0.3) {
      const error = new Error('Rate limit exceeded');
      error.response = {
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          'x-amzn-RateLimit-Limit': '0.5'
        },
        data: {
          errors: [{
            code: 'QuotaExceeded',
            message: 'You exceeded your quota'
          }]
        }
      };
      throw error;
    }

    // Simulate successful response
    return {
      headers: {
        'x-amzn-RateLimit-Limit': '0.5'
      },
      data: {
        // Mock response data
        payload: {
          Offers: [
            {
              SellerId: 'A1EXAMPLE',
              IsBuyBoxWinner: true,
              ListingPrice: {
                Amount: 29.99,
                CurrencyCode: 'USD'
              }
            },
            {
              SellerId: 'A2EXAMPLE',
              IsBuyBoxWinner: false,
              ListingPrice: {
                Amount: 32.99,
                CurrencyCode: 'USD'
              }
            }
          ]
        }
      }
    };
  };
}

/**
 * Main function to test rate limiting and retries
 */
async function main() {
  // Create rate limiter
  const rateLimiter = new SPAPIRateLimiter({
    requestsPerSecond: 0.2,  // Very conservative rate limit
    jitterPercentage: 0.4    // 40% jitter
  });

  // Create mock API client
  const mockClient = createMockSPAPIClient();

  // Test ASINs
  const asins = ['B01EXAMPLE1', 'B01EXAMPLE2', 'B01EXAMPLE3', 'B01EXAMPLE4', 'B01EXAMPLE5'];

  console.log('Starting test of SP-API rate limiting with', asins.length, 'ASINs');
  console.log('Using rate limit of', rateLimiter.requestsPerSecond, 'req/sec');

  const results = [];
  const errors = [];
  const startTime = Date.now();

  // Process each ASIN with rate limiting
  for (const asin of asins) {
    try {
      // Schedule the API call with the rate limiter
      const result = await rateLimiter.schedule(async () => {
        return makeSPAPIRequest(mockClient, '/products/pricing/v0/items/offers', {
          Asin: asin,
          ItemCondition: 'New'
        });
      });

      console.log(`Successfully processed ASIN ${asin}`);
      results.push({
        asin,
        success: true,
        offers: result.data.payload.Offers
      });
    } catch (error) {
      console.error(`Failed to process ASIN ${asin}:`, error.message);
      errors.push({
        asin,
        success: false,
        error: error.message
      });
    }
  }

  const endTime = Date.now();
  const totalTimeSeconds = (endTime - startTime) / 1000;

  // Print summary
  console.log('\n--- Test Summary ---');
  console.log(`Total time: ${totalTimeSeconds.toFixed(2)} seconds`);
  console.log(`Successful requests: ${results.length}`);
  console.log(`Failed requests: ${errors.length}`);
  console.log(`Effective rate: ${(results.length / totalTimeSeconds).toFixed(2)} req/sec`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(err => {
      console.log(`- ASIN ${err.asin}: ${err.error}`);
    });
  }
}

// Run the test
main().catch(error => {
  console.error('Test failed with error:', error);
});
