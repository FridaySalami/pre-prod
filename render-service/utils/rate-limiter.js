/**
 * Rate Limiter for Amazon SP-API
 * 
 * Ensures we respect Amazon's rate limits to avoid throttling
 */

class RateLimiter {
  constructor() {
    // Amazon SP-API rate limits - Smart retry approach
    this.limits = {
      // Product Pricing API: 0.5 requests per second (Amazon official)
      // Use normal Amazon rate + intelligent retry when rate limited
      productPricing: {
        requestsPerSecond: 0.48, // Close to Amazon's 0.5 req/sec
        minDelay: 2100, // 2.1 seconds between requests (Amazon's official rate)
        retryDelay: 4000, // 4 seconds sleep when rate limited
        adaptiveDelay: 2100, // Current adaptive delay (starts at minimum)
        maxDelay: 8000 // Maximum delay cap (8 seconds for persistent issues)
      },
      // Competitive Pricing API: 1 request per second  
      competitivePricing: {
        requestsPerSecond: 0.9, // Close to Amazon's 1.0 req/sec
        minDelay: 1200, // 1.2 seconds between requests
        retryDelay: 3000, // 3 seconds sleep when rate limited
        adaptiveDelay: 1200,
        maxDelay: 6000
      }
    };

    this.lastRequestTime = 0;
    this.requestCount = 0;
    this.consecutiveRateLimits = 0;
    this.dailyQuotaCount = 0;
    this.quotaResetTime = this.getNextQuotaReset();

    // Statistics tracking
    this.stats = {
      totalRequests: 0,
      rateLimitedRequests: 0,
      successfulRequests: 0,
      retriedRequests: 0,
      averageDelay: 0
    };
  }

  /**
   * Wait for the appropriate delay before making a request
   * Now includes adaptive backoff when rate limited
   */
  async waitForNextRequest(apiType = 'productPricing') {
    const now = Date.now();
    const config = this.limits[apiType];
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Use adaptive delay if we've been rate limited recently
    const effectiveDelay = config.adaptiveDelay;

    if (timeSinceLastRequest < effectiveDelay) {
      const delayNeeded = effectiveDelay - timeSinceLastRequest;
      console.log(`⏳ Rate limiting: waiting ${delayNeeded}ms before next request (adaptive: ${config.adaptiveDelay}ms)`);
      await this.sleep(delayNeeded);
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
    this.stats.totalRequests++;
    this.dailyQuotaCount++;

    // Reset daily quota if needed
    if (Date.now() > this.quotaResetTime) {
      this.resetDailyQuota();
    }
  }  /**
   * Call this when a rate limit error occurs to adapt delays
   */
  onRateLimited(apiType = 'productPricing') {
    const config = this.limits[apiType];
    this.consecutiveRateLimits++;
    this.stats.rateLimitedRequests++;

    // For persistent rate limiting, increase adaptive delay but cap it
    if (this.consecutiveRateLimits > 2) {
      const newDelay = Math.min(config.adaptiveDelay * 1.5, config.maxDelay);
      config.adaptiveDelay = newDelay;
      console.log(`🚫 Persistent rate limiting! Increasing adaptive delay to ${newDelay}ms (consecutive: ${this.consecutiveRateLimits})`);
    } else {
      console.log(`🚫 Rate limited! Will retry after ${config.retryDelay}ms sleep (consecutive: ${this.consecutiveRateLimits})`);
    }

    // If we get rate limited too many times, suggest manual intervention
    if (this.consecutiveRateLimits >= 5) {
      console.log(`⚠️  WARNING: ${this.consecutiveRateLimits} consecutive rate limits. Consider pausing the job.`);
    }
  }

  /**
   * Sleep for rate limit retry - use this when immediately retrying a rate limited request
   */
  async sleepForRetry(apiType = 'productPricing') {
    const config = this.limits[apiType];
    this.stats.retriedRequests++;

    console.log(`😴 Sleeping ${config.retryDelay}ms before retry...`);
    await this.sleep(config.retryDelay);
  }  /**
   * Call this when a request succeeds to gradually reduce delays
   */
  onRequestSuccess(apiType = 'productPricing') {
    const config = this.limits[apiType];
    this.consecutiveRateLimits = 0; // Reset consecutive counter
    this.stats.successfulRequests++;

    // Gradually reduce adaptive delay back towards minimum (but slowly)
    if (config.adaptiveDelay > config.minDelay) {
      // Reduce by 10% but don't go below minimum
      const newDelay = Math.max(config.adaptiveDelay * 0.9, config.minDelay);
      config.adaptiveDelay = newDelay;

      if (newDelay === config.minDelay) {
        console.log(`✅ Delay normalized back to minimum: ${config.minDelay}ms`);
      }
    }
  }

  /**
   * Get next quota reset time (Amazon resets daily at midnight UTC)
   */
  getNextQuotaReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }

  /**
   * Reset daily quota counter
   */
  resetDailyQuota() {
    console.log(`📊 Daily quota reset. Previous day: ${this.dailyQuotaCount} requests`);
    this.dailyQuotaCount = 0;
    this.quotaResetTime = this.getNextQuotaReset();
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limiting stats
   */
  getStats() {
    const successRate = this.stats.totalRequests > 0
      ? (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(1)
      : 0;

    const rateLimitRate = this.stats.totalRequests > 0
      ? (this.stats.rateLimitedRequests / this.stats.totalRequests * 100).toFixed(1)
      : 0;

    return {
      totalRequests: this.stats.totalRequests,
      successfulRequests: this.stats.successfulRequests,
      rateLimitedRequests: this.stats.rateLimitedRequests,
      retriedRequests: this.stats.retriedRequests,
      successRate: `${successRate}%`,
      rateLimitRate: `${rateLimitRate}%`,
      retryRate: this.stats.totalRequests > 0 ? `${(this.stats.retriedRequests / this.stats.totalRequests * 100).toFixed(1)}%` : '0%',
      dailyQuotaUsed: this.dailyQuotaCount,
      consecutiveRateLimits: this.consecutiveRateLimits,
      currentAdaptiveDelay: this.limits.productPricing.adaptiveDelay,
      normalDelay: this.limits.productPricing.minDelay,
      retryDelay: this.limits.productPricing.retryDelay,
      lastRequestTime: new Date(this.lastRequestTime).toISOString(),
      timeSinceLastRequest: Date.now() - this.lastRequestTime,
      quotaResetTime: new Date(this.quotaResetTime).toISOString()
    };
  }

  /**
   * Reset rate limiter stats
   */
  reset() {
    this.lastRequestTime = 0;
    this.requestCount = 0;
    this.consecutiveRateLimits = 0;
    this.stats = {
      totalRequests: 0,
      rateLimitedRequests: 0,
      successfulRequests: 0,
      retriedRequests: 0,
      averageDelay: 0
    };
  }

  /**
   * Print detailed rate limiting report
   */
  printReport() {
    const stats = this.getStats();
    console.log('\n📊 RATE LIMITING PERFORMANCE REPORT');
    console.log('====================================');
    console.log(`📈 Success Rate: ${stats.successRate}`);
    console.log(`🚫 Rate Limit Rate: ${stats.rateLimitRate}`);
    console.log(`📊 Total Requests: ${stats.totalRequests}`);
    console.log(`✅ Successful: ${stats.successfulRequests}`);
    console.log(`❌ Rate Limited: ${stats.rateLimitedRequests}`);
    console.log(`🔄 Consecutive Rate Limits: ${stats.consecutiveRateLimits}`);
    console.log(`⏰ Current Adaptive Delay: ${stats.currentAdaptiveDelay}ms`);
    console.log(`📅 Daily Quota Used: ${stats.dailyQuotaUsed}`);
    console.log(`🕐 Last Request: ${stats.lastRequestTime}`);
    console.log(`⏳ Time Since Last: ${stats.timeSinceLastRequest}ms`);
    console.log(`🔄 Quota Resets: ${stats.quotaResetTime}`);
    console.log('====================================\n');
  }
}

/**
 * Batch Processing Utilities
 */
class BatchProcessor {
  constructor(batchSize = 50, batchDelay = 30000) {
    this.batchSize = batchSize;
    this.batchDelay = batchDelay; // 30 seconds between batches
    this.rateLimiter = new RateLimiter();
  }

  /**
   * Split array into batches
   */
  createBatches(items, batchSize = this.batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process items in batches with rate limiting
   */
  async processBatches(items, processor, onProgress = null) {
    const batches = this.createBatches(items);
    let processedCount = 0;
    let successCount = 0;
    let failureCount = 0;

    console.log(`📦 Processing ${items.length} items in ${batches.length} batches of ${this.batchSize}`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchNumber = batchIndex + 1;

      console.log(`\n🔄 Processing batch ${batchNumber}/${batches.length} (${batch.length} items)`);

      for (let itemIndex = 0; itemIndex < batch.length; itemIndex++) {
        const item = batch[itemIndex];

        try {
          // Apply rate limiting
          await this.rateLimiter.waitForNextRequest();

          // Process the item
          const result = await processor(item, processedCount + 1, items.length);

          if (result.success) {
            successCount++;
          } else {
            failureCount++;
          }

          processedCount++;

          // Call progress callback if provided
          if (onProgress) {
            await onProgress({
              processedCount,
              successCount,
              failureCount,
              totalCount: items.length,
              currentBatch: batchNumber,
              totalBatches: batches.length,
              item: item,
              result: result
            });
          }

          // Log progress every 10 items
          if (processedCount % 10 === 0) {
            const percentage = ((processedCount / items.length) * 100).toFixed(1);
            console.log(`📊 Progress: ${processedCount}/${items.length} (${percentage}%) - ✅ ${successCount} ❌ ${failureCount}`);
          }

        } catch (error) {
          console.error(`❌ Error processing item ${processedCount + 1}:`, error.message);
          failureCount++;
          processedCount++;

          // Call progress callback for failures too
          if (onProgress) {
            await onProgress({
              processedCount,
              successCount,
              failureCount,
              totalCount: items.length,
              currentBatch: batchNumber,
              totalBatches: batches.length,
              item: item,
              result: { success: false, error: error.message }
            });
          }
        }
      }

      // Wait between batches (except for the last batch)
      if (batchIndex < batches.length - 1) {
        console.log(`⏸️  Batch ${batchNumber} completed. Waiting ${this.batchDelay / 1000}s before next batch...`);
        await this.rateLimiter.sleep(this.batchDelay);
      }
    }

    console.log(`\n✅ Batch processing completed:`);
    console.log(`   Total processed: ${processedCount}`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Failed: ${failureCount}`);
    console.log(`   Success rate: ${((successCount / processedCount) * 100).toFixed(1)}%`);

    return {
      processedCount,
      successCount,
      failureCount,
      successRate: (successCount / processedCount) * 100
    };
  }
}

module.exports = {
  RateLimiter,
  BatchProcessor
};
