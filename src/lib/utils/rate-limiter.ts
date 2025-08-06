/**
 * Simple rate limiter for Amazon SP-API calls
 * Prevents hitting rate limits by queuing requests
 */

interface QueuedRequest {
  requestFn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timestamp: number;
}

interface RateLimiterStatus {
  queueLength: number;
  processing: boolean;
  estimatedWaitTime: number;
  lastRequestTime: number;
  requestsPerSecond: number;
}

class RateLimiter {
  private requestsPerSecond: number;
  private minInterval: number;
  private queue: QueuedRequest[];
  private lastRequestTime: number;
  private processing: boolean;

  constructor(requestsPerSecond = 0.0167) { // Default: 1 request per minute for Feeds API
    this.requestsPerSecond = requestsPerSecond;
    this.minInterval = 1000 / requestsPerSecond; // Minimum time between requests
    this.queue = [];
    this.lastRequestTime = 0;
    this.processing = false;
  }

  /**
   * Add a request to the queue
   * @param requestFn - Function that returns a Promise
   * @returns Promise - Resolves with the result of the API call
   */
  async schedule(requestFn: () => Promise<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        requestFn,
        resolve,
        reject,
        timestamp: Date.now()
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const request = this.queue.shift();

    if (!request) {
      this.processing = false;
      return;
    }

    // Calculate how long to wait since last request
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const waitTime = Math.max(0, this.minInterval - timeSinceLastRequest);

    if (waitTime > 0) {
      console.log(`⏱️ Rate limiting: waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    try {
      console.log(`🚀 Processing queued request (${this.queue.length} remaining)`);
      const result = await request.requestFn();
      this.lastRequestTime = Date.now();
      request.resolve(result);
    } catch (error) {
      console.error('❌ Rate limited request failed:', error);
      request.reject(error);
    }

    // Process next request
    setTimeout(() => this.processQueue(), 100); // Small delay between queue processing
  }

  /**
   * Get the estimated wait time for a new request
   * @returns Wait time in milliseconds
   */
  getEstimatedWaitTime(): number {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const baseWaitTime = Math.max(0, this.minInterval - timeSinceLastRequest);

    // Add queue processing time
    const queueWaitTime = this.queue.length * this.minInterval;

    return baseWaitTime + queueWaitTime;
  }

  /**
   * Get queue status
   */
  getStatus(): RateLimiterStatus {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      estimatedWaitTime: this.getEstimatedWaitTime(),
      lastRequestTime: this.lastRequestTime,
      requestsPerSecond: this.requestsPerSecond
    };
  }
}

// Global rate limiter instance for Amazon Feeds API
// JSON_LISTINGS_FEED type: Limit of 5 feeds per account per 5 minutes
// Conservative: 1 feed per minute (60 seconds) - safer approach
export const amazonFeedsRateLimiter = new RateLimiter(1 / 60); // 1 request per 60 seconds

// More aggressive rate limiter that uses the full quota
// 5 feeds per 5 minutes = 1 feed per minute average, but allows burst
export const amazonFeedsRateLimiterAggressive = new RateLimiter(1 / 60); // Same rate, but we could optimize this

export default RateLimiter;
