/**
 * Rate Limiter for Amazon SP-API
 * 
 * Ensures we respect Amazon's rate limits to avoid throttling
 */

class RateLimiter {
  constructor() {
    // Amazon SP-API rate limits
    this.limits = {
      // Product Pricing API: 0.5 requests per second
      productPricing: {
        requestsPerSecond: 0.5,
        minDelay: 2100 // 2.1 seconds between requests (safer than 2.0)
      },
      // Competitive Pricing API: 1 request per second  
      competitivePricing: {
        requestsPerSecond: 1.0,
        minDelay: 1100 // 1.1 seconds between requests
      }
    };

    this.lastRequestTime = 0;
    this.requestCount = 0;
  }

  /**
   * Wait for the appropriate delay before making a request
   */
  async waitForNextRequest(apiType = 'productPricing') {
    const now = Date.now();
    const config = this.limits[apiType];
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < config.minDelay) {
      const delayNeeded = config.minDelay - timeSinceLastRequest;
      console.log(`⏳ Rate limiting: waiting ${delayNeeded}ms before next request`);
      await this.sleep(delayNeeded);
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
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
    return {
      totalRequests: this.requestCount,
      lastRequestTime: new Date(this.lastRequestTime).toISOString(),
      timeSinceLastRequest: Date.now() - this.lastRequestTime
    };
  }

  /**
   * Reset rate limiter stats
   */
  reset() {
    this.lastRequestTime = 0;
    this.requestCount = 0;
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
