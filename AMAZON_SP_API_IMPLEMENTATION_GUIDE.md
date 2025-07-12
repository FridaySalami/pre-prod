# Amazon SP-API Rate Limit Implementation Guide

This guide provides practical implementation examples for handling rate limits in your Amazon SP-API integration. These code samples can be used to enhance your Buy Box Monitoring System.

## 1. Implementing a Rate Limiter with Jitter

This example shows how to implement a rate limiter class that respects SP-API rate limits and adds jitter to prevent request collisions.

```javascript
/**
 * SP-API Rate Limiter with jitter
 * Manages API request pacing to avoid 429 errors
 */
class SPAPIRateLimiter {
  constructor(options = {}) {
    // Default values can be overridden
    this.requestsPerSecond = options.requestsPerSecond || 0.2; // Very conservative default
    this.burstLimit = options.burstLimit || 1;
    this.jitterPercentage = options.jitterPercentage || 0.3; // 30% jitter
    this.maxJitterMs = options.maxJitterMs || 2000; // Cap jitter at 2 seconds
    this.queue = [];
    this.processing = false;
    this.tokens = this.burstLimit; // Start with full bucket
    this.lastRefillTime = Date.now();
    
    // Rate at which tokens are added back (in ms)
    this.refillInterval = 1000 / this.requestsPerSecond;
  }

  /**
   * Add a request to the rate limiter queue
   * @param {Function} requestFn - Function that makes the SP-API call and returns a Promise
   * @returns {Promise} - Resolves with the result of the API call
   */
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

  /**
   * Process queued requests respecting rate limits
   */
  async processQueue() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }
    
    this.processing = true;
    
    // Refill tokens based on time elapsed
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
            // Adjust our rate limiter to 80% of the actual limit to be safe
            this.requestsPerSecond = apiLimit * 0.8;
            this.refillInterval = 1000 / this.requestsPerSecond;
            console.log(`Adjusted rate limit to ${this.requestsPerSecond} req/sec based on API response`);
          }
        }
      } catch (error) {
        request.reject(error);
      }
      
      // Add jitter to make request patterns less predictable
      const jitterMs = Math.min(
        this.refillInterval * this.jitterPercentage * Math.random(),
        this.maxJitterMs
      );
      
      setTimeout(() => this.processQueue(), this.refillInterval + jitterMs);
    } else {
      // No tokens available, wait for refill + jitter
      const waitTime = this.refillInterval + (this.refillInterval * this.jitterPercentage * Math.random());
      setTimeout(() => this.processQueue(), waitTime);
    }
  }

  /**
   * Refill tokens based on elapsed time
   */
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
```

## 2. Implementing Exponential Backoff with Jitter for Retry Logic

This function implements exponential backoff with jitter for handling 429 errors:

```javascript
/**
 * Retry function with exponential backoff and jitter
 * @param {Function} fn - The function to retry (should return a Promise)
 * @param {Object} options - Configuration options
 * @returns {Promise} - Resolves with the result of the function or rejects after max attempts
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
        // Retry on rate limit errors
        error.statusCode === 429 ||
        // Retry on server errors
        (error.statusCode >= 500 && error.statusCode < 600) ||
        // Retry on connection errors
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
        
        console.log(`Retry ${retries}/${maxRetries} after ${Math.round(delay)}ms due to ${error.statusCode || error.code}`);
        
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
```

## 3. Integration Example with SP-API Client

Here's how to use both the rate limiter and retry function with your SP-API client:

```javascript
const { ProductPricingClient } = require('@sp-api/product-pricing');
const { SPAPIRateLimiter, retryWithExponentialBackoff } = require('./api-rate-utils');

// Create a rate limiter instance - very conservative settings
const rateLimiter = new SPAPIRateLimiter({
  requestsPerSecond: 0.2, // 1 request per 5 seconds
  burstLimit: 1,
  jitterPercentage: 0.4, // 40% jitter for unpredictability
  maxJitterMs: 3000
});

/**
 * Get item offers with proper rate limiting and retry logic
 * @param {Object} spApiClient - Initialized SP-API client
 * @param {String} asin - The ASIN to check
 * @param {String} condition - Item condition
 * @returns {Promise<Object>} - Offer data
 */
async function getItemOffersWithRateLimiting(spApiClient, asin, condition = 'New') {
  return rateLimiter.schedule(() => {
    return retryWithExponentialBackoff(
      async () => {
        const params = {
          Asin: asin,
          ItemCondition: condition
        };
        
        const result = await spApiClient.getItemOffers(params);
        return result;
      },
      {
        maxRetries: 5,
        baseDelayMs: 2000,
        maxDelayMs: 60000,
        jitterFactor: 0.3
      }
    );
  });
}

/**
 * Process multiple ASINs with rate limiting
 * @param {Array<String>} asins - List of ASINs to process
 */
async function processBuyBoxBatch(spApiClient, asins) {
  const results = [];
  const errors = [];
  
  // Process sequentially to maintain rate limits
  for (const asin of asins) {
    try {
      console.log(`Processing ASIN: ${asin}`);
      const result = await getItemOffersWithRateLimiting(spApiClient, asin);
      
      results.push({
        asin,
        timestamp: new Date().toISOString(),
        data: result
      });
      
      console.log(`Successfully processed ${results.length}/${asins.length}`);
    } catch (error) {
      console.error(`Error processing ${asin}: ${error.message}`);
      errors.push({
        asin,
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  }
  
  return { results, errors };
}

// Example usage
async function main() {
  const spApiClient = new ProductPricingClient({
    region: 'na', // North America region
    options: {
      // Your client configuration
    }
  });
  
  const asinsToCheck = ['B01EXAMPLE1', 'B01EXAMPLE2', 'B01EXAMPLE3'];
  
  try {
    const { results, errors } = await processBuyBoxBatch(spApiClient, asinsToCheck);
    console.log(`Processed ${results.length} ASINs successfully`);
    console.log(`Failed to process ${errors.length} ASINs`);
    
    // Store results to database
    // await storeResultsToDatabase(results);
    
    // Log errors for later investigation
    if (errors.length > 0) {
      // await logErrorsToDatabase(errors);
    }
  } catch (error) {
    console.error('Batch processing failed:', error);
  }
}
```

## 4. Circuit Breaker Implementation

To prevent continued API calls when experiencing high rate limiting, implement a circuit breaker pattern:

```javascript
/**
 * Circuit breaker for SP-API calls
 * Prevents making calls when the system is in a failure state
 */
class SPAPICircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;  // Number of failures before opening
    this.resetTimeout = options.resetTimeout || 60000;      // Time before trying again (1 minute)
    this.failureCount = 0;
    this.state = 'CLOSED'; // CLOSED (normal), OPEN (not allowing calls), HALF_OPEN (testing)
    this.lastFailureTime = null;
    this.onStateChange = options.onStateChange || (() => {});
  }
  
  /**
   * Executes a function with circuit breaker protection
   * @param {Function} fn - Function to execute
   * @returns {Promise} - Result of the function or error
   */
  async execute(fn) {
    if (this.state === 'OPEN') {
      // Check if we've waited long enough to try again
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.onStateChange('HALF_OPEN');
        console.log('Circuit half-open, testing with a single request');
      } else {
        throw new Error(`Circuit breaker is OPEN. Retry after ${Math.ceil((this.lastFailureTime + this.resetTimeout - Date.now()) / 1000)} seconds`);
      }
    }
    
    try {
      const result = await fn();
      
      // Success - reset if we were testing
      if (this.state === 'HALF_OPEN') {
        this.reset();
        console.log('Circuit closed after successful test request');
      }
      
      return result;
    } catch (error) {
      // Check if this is a rate limit or server error
      if (error.statusCode === 429 || (error.statusCode >= 500 && error.statusCode < 600)) {
        this.recordFailure();
        throw error;
      }
      
      // Other errors don't count toward circuit breaker
      throw error;
    }
  }
  
  /**
   * Record a failure and potentially open the circuit
   */
  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.onStateChange('OPEN', {
        failureCount: this.failureCount,
        resetTimeout: this.resetTimeout,
        estimatedResetTime: new Date(this.lastFailureTime + this.resetTimeout)
      });
      console.log(`Circuit OPEN after ${this.failureCount} failures. Will try again in ${this.resetTimeout / 1000} seconds`);
    }
  }
  
  /**
   * Reset the circuit breaker to closed state
   */
  reset() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.onStateChange('CLOSED');
  }
}
```

## 5. Advanced Implementation for Your Buy Box Scanner

Combine everything to create a robust solution:

```javascript
class BuyBoxMonitor {
  constructor(options = {}) {
    // Set up rate limiter
    this.rateLimiter = new SPAPIRateLimiter({
      requestsPerSecond: options.requestsPerSecond || 0.2,
      burstLimit: options.burstLimit || 1,
      jitterPercentage: options.jitterPercentage || 0.4,
      maxJitterMs: options.maxJitterMs || 3000
    });
    
    // Set up circuit breaker
    this.circuitBreaker = new SPAPICircuitBreaker({
      failureThreshold: options.circuitBreakerThreshold || 3,
      resetTimeout: options.circuitBreakerResetTimeout || 300000, // 5 minutes
      onStateChange: (state, details) => {
        console.log(`Circuit breaker state changed to: ${state}`);
        
        // Log to database or send notification
        if (state === 'OPEN') {
          this.notifyCircuitBreakerOpen(details);
        }
      }
    });
    
    // Set up SP-API client
    this.spApiClient = options.spApiClient;
    
    // Job tracking
    this.currentJobId = null;
    this.isJobCancelled = false;
    this.processingStats = {
      totalItems: 0,
      processedItems: 0,
      successfulItems: 0,
      failedItems: 0,
      startTime: null,
      endTime: null
    };
  }
  
  /**
   * Start a new Buy Box monitoring job
   * @param {Object} jobConfig - Job configuration
   * @returns {Promise<Object>} - Job results
   */
  async startJob(jobConfig) {
    try {
      // Initialize job
      this.currentJobId = jobConfig.jobId;
      this.isJobCancelled = false;
      this.processingStats = {
        totalItems: jobConfig.asins.length,
        processedItems: 0,
        successfulItems: 0,
        failedItems: 0,
        startTime: new Date(),
        endTime: null
      };
      
      await this.updateJobStatus('RUNNING');
      
      const results = [];
      const errors = [];
      
      // Process each ASIN
      for (const asin of jobConfig.asins) {
        // Check if job has been cancelled
        if (this.isJobCancelled) {
          console.log(`Job ${this.currentJobId} cancelled, stopping processing`);
          await this.updateJobStatus('CANCELLED');
          break;
        }
        
        try {
          // Use circuit breaker and rate limiter together
          const result = await this.circuitBreaker.execute(() => {
            return this.rateLimiter.schedule(() => {
              return retryWithExponentialBackoff(
                async () => {
                  console.log(`Processing ASIN: ${asin}`);
                  const params = {
                    Asin: asin,
                    ItemCondition: jobConfig.condition || 'New'
                  };
                  
                  return this.spApiClient.getItemOffers(params);
                },
                {
                  maxRetries: jobConfig.maxRetries || 3,
                  baseDelayMs: jobConfig.baseDelayMs || 2000,
                  maxDelayMs: jobConfig.maxDelayMs || 30000,
                  jitterFactor: jobConfig.jitterFactor || 0.3
                }
              );
            });
          });
          
          // Process successful response
          const buyBoxInfo = this.extractBuyBoxInfo(result, asin);
          results.push(buyBoxInfo);
          
          this.processingStats.successfulItems++;
          await this.saveResultToDatabase(buyBoxInfo);
          
        } catch (error) {
          console.error(`Error processing ${asin}: ${error.message}`);
          
          const errorInfo = {
            asin,
            timestamp: new Date().toISOString(),
            error: error.message,
            statusCode: error.statusCode || null,
            jobId: this.currentJobId
          };
          
          errors.push(errorInfo);
          this.processingStats.failedItems++;
          await this.saveErrorToDatabase(errorInfo);
          
          // If circuit breaker is open, pause job processing
          if (this.circuitBreaker.state === 'OPEN') {
            console.log(`Circuit breaker open, pausing job ${this.currentJobId} for ${this.circuitBreaker.resetTimeout / 1000} seconds`);
            await this.updateJobStatus('PAUSED', {
              reason: 'RATE_LIMIT_CIRCUIT_BREAKER',
              resumeTime: new Date(Date.now() + this.circuitBreaker.resetTimeout)
            });
            
            // Wait for circuit breaker timeout
            await new Promise(resolve => setTimeout(resolve, this.circuitBreaker.resetTimeout));
            
            // If job wasn't cancelled during pause, resume it
            if (!this.isJobCancelled) {
              await this.updateJobStatus('RUNNING');
            } else {
              break;
            }
          }
        }
        
        // Update progress
        this.processingStats.processedItems++;
        await this.updateJobProgress();
      }
      
      // Finalize job
      this.processingStats.endTime = new Date();
      await this.updateJobStatus(
        this.isJobCancelled ? 'CANCELLED' : 'COMPLETED',
        { stats: this.processingStats }
      );
      
      return {
        jobId: this.currentJobId,
        results,
        errors,
        stats: this.processingStats
      };
      
    } catch (error) {
      console.error(`Job ${this.currentJobId} failed with error:`, error);
      await this.updateJobStatus('FAILED', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Cancel the current job
   */
  cancelJob() {
    if (this.currentJobId && !this.isJobCancelled) {
      this.isJobCancelled = true;
      console.log(`Job ${this.currentJobId} cancellation requested`);
      return true;
    }
    return false;
  }
  
  /**
   * Extract Buy Box information from API response
   * @param {Object} response - SP-API response
   * @param {String} asin - ASIN being processed
   * @returns {Object} - Structured Buy Box info
   */
  extractBuyBoxInfo(response, asin) {
    // Implementation depends on your data structure needs
    const offers = response.payload?.Offers || [];
    const buyBoxOffer = offers.find(offer => offer.IsBuyBoxWinner === true);
    
    return {
      asin,
      jobId: this.currentJobId,
      timestamp: new Date().toISOString(),
      hasBuyBox: !!buyBoxOffer,
      buyBoxWinnerId: buyBoxOffer?.SellerId || null,
      buyBoxPrice: buyBoxOffer?.ListingPrice?.Amount || null,
      totalOffers: offers.length,
      offers: offers.map(offer => ({
        sellerId: offer.SellerId,
        price: offer.ListingPrice?.Amount,
        condition: offer.SubCondition,
        isBuyBoxWinner: !!offer.IsBuyBoxWinner,
        isFeaturedOffer: !!offer.IsFeaturedOffer
      }))
    };
  }
  
  /**
   * Update job status in database
   * @param {String} status - New status
   * @param {Object} details - Additional details
   */
  async updateJobStatus(status, details = {}) {
    // Implementation depends on your database structure
    console.log(`Job ${this.currentJobId} status updated to ${status}`);
    
    // Example database update
    // await db.collection('buybox_jobs').updateOne(
    //   { jobId: this.currentJobId },
    //   { 
    //     $set: { 
    //       status,
    //       updatedAt: new Date(),
    //       ...details
    //     } 
    //   }
    // );
  }
  
  /**
   * Update job progress in database
   */
  async updateJobProgress() {
    // Implementation depends on your database structure
    console.log(`Job ${this.currentJobId} progress: ${this.processingStats.processedItems}/${this.processingStats.totalItems}`);
    
    // Example database update
    // await db.collection('buybox_jobs').updateOne(
    //   { jobId: this.currentJobId },
    //   { 
    //     $set: { 
    //       progress: {
    //         processedItems: this.processingStats.processedItems,
    //         successfulItems: this.processingStats.successfulItems,
    //         failedItems: this.processingStats.failedItems,
    //         totalItems: this.processingStats.totalItems,
    //         percentComplete: (this.processingStats.processedItems / this.processingStats.totalItems) * 100
    //       },
    //       updatedAt: new Date()
    //     } 
    //   }
    // );
  }
  
  /**
   * Save result to database
   * @param {Object} result - Buy Box check result
   */
  async saveResultToDatabase(result) {
    // Implementation depends on your database structure
    console.log(`Saving result for ASIN: ${result.asin}`);
    
    // Example database insert
    // await db.collection('buybox_data').insertOne(result);
  }
  
  /**
   * Save error to database
   * @param {Object} error - Error information
   */
  async saveErrorToDatabase(error) {
    // Implementation depends on your database structure
    console.log(`Saving error for ASIN: ${error.asin}`);
    
    // Example database insert
    // await db.collection('buybox_failures').insertOne(error);
  }
  
  /**
   * Notify about circuit breaker opening
   * @param {Object} details - Circuit breaker details
   */
  async notifyCircuitBreakerOpen(details) {
    // Implementation depends on your notification system
    console.log('Circuit breaker opened:', details);
    
    // Example notification
    // await sendEmail({
    //   subject: `Buy Box Monitor: Rate Limit Circuit Breaker Triggered`,
    //   body: `
    //     The Buy Box Monitor has triggered the circuit breaker after ${details.failureCount} failures.
    //     Job ${this.currentJobId} has been paused and will resume at approximately ${details.estimatedResetTime}.
    //     
    //     This typically indicates Amazon SP-API rate limits have been exceeded.
    //   `
    // });
  }
}
```

## Conclusion

Implementing these rate limiting and retry patterns will significantly improve the stability and reliability of your Buy Box Monitoring System. Key points to remember:

1. Use very conservative rate limits, especially after experiencing 429 errors
2. Implement exponential backoff with jitter for retries
3. Use a circuit breaker to pause all API activity during severe rate limiting
4. Monitor the `x-amzn-RateLimit-Limit` header to dynamically adjust your request rates
5. Track and log all rate limiting events to better understand patterns

Remember that Amazon's rate limits can change and can have both short-term (per second/minute) and long-term (daily) quotas. Your system should be prepared to handle both types of limits.
