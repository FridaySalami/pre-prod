/**
 * Rate Limiter for Amazon SP-API
 * 
 * Implements token bucket algorithm with jitter to prevent rate limit errors
 * and ensure smooth API request pacing across different endpoints.
 */

export interface RateLimiterConfig {
  requestsPerSecond: number;
  burstLimit: number;
  jitterPercentage?: number;
  maxJitterMs?: number;
}

interface QueuedRequest {
  requestFn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  priority?: number;
}

export class RateLimiter {
  private requestsPerSecond: number;
  private burstLimit: number;
  private jitterPercentage: number;
  private maxJitterMs: number;
  private queue: QueuedRequest[] = [];
  private processing = false;
  private tokens: number;
  private lastRefillTime: number;
  private refillInterval: number;

  constructor(config: RateLimiterConfig) {
    this.requestsPerSecond = config.requestsPerSecond;
    this.burstLimit = config.burstLimit;
    this.jitterPercentage = config.jitterPercentage ?? 0.3; // 30% default
    this.maxJitterMs = config.maxJitterMs ?? 2000; // 2 seconds max
    this.tokens = this.burstLimit; // Start with full bucket
    this.lastRefillTime = Date.now();
    this.refillInterval = 1000 / this.requestsPerSecond;
  }

  /**
   * Schedule a request to be executed respecting rate limits
   */
  async schedule<T>(requestFn: () => Promise<T>, priority = 0): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        requestFn,
        resolve,
        reject,
        priority
      });

      // Sort queue by priority (higher priority first)
      this.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued requests with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;

    // Refill tokens based on elapsed time
    this.refillTokens();

    if (this.tokens >= 1) {
      // We have a token, process one request
      this.tokens -= 1;

      const request = this.queue.shift()!;

      try {
        const result = await request.requestFn();
        request.resolve(result);

        // Check if response has rate limit headers to adjust our limits
        if (result && typeof result === 'object' && 'headers' in result) {
          this.adjustFromHeaders(result.headers);
        }
      } catch (error) {
        request.reject(error);
      }

      // Add jitter to prevent thundering herd
      const jitterMs = Math.min(
        this.refillInterval * this.jitterPercentage * Math.random(),
        this.maxJitterMs
      );

      setTimeout(() => this.processQueue(), this.refillInterval + jitterMs);
    } else {
      // No tokens available, wait for refill
      const waitTime = this.refillInterval +
        (this.refillInterval * this.jitterPercentage * Math.random());

      setTimeout(() => this.processQueue(), waitTime);
    }
  }

  /**
   * Refill tokens based on elapsed time since last refill
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefillTime;
    const tokensToAdd = (elapsedMs / this.refillInterval);

    if (tokensToAdd >= 1) {
      this.tokens = Math.min(this.tokens + Math.floor(tokensToAdd), this.burstLimit);
      this.lastRefillTime = now;
    }
  }

  /**
   * Adjust rate limits based on API response headers
   */
  private adjustFromHeaders(headers: any): void {
    const rateLimitHeader = headers?.['x-amzn-ratelimit-limit'];

    if (rateLimitHeader) {
      const apiLimit = parseFloat(rateLimitHeader);

      if (apiLimit > 0 && apiLimit !== this.requestsPerSecond) {
        // Adjust to 80% of the actual limit to be safe
        const newLimit = apiLimit * 0.8;
        console.log(`Rate limiter adjusted: ${this.requestsPerSecond.toFixed(3)} → ${newLimit.toFixed(3)} req/sec`);

        this.requestsPerSecond = newLimit;
        this.refillInterval = 1000 / this.requestsPerSecond;
      }
    }
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      availableTokens: this.tokens,
      requestsPerSecond: this.requestsPerSecond,
      isProcessing: this.processing
    };
  }

  /**
   * Clear the queue (useful for testing or emergencies)
   */
  clearQueue(): void {
    this.queue = [];
    this.processing = false;
  }
}

/**
 * Pre-configured rate limiters for different SP-API endpoints
 */
export const RateLimiters = {
  // Catalog Items API: 5 requests per second
  catalog: new RateLimiter({
    requestsPerSecond: 4, // 80% of 5 to be safe
    burstLimit: 5
  }),

  // Reports API: Very restrictive
  reports: new RateLimiter({
    requestsPerSecond: 0.0167, // 1 request per 60 seconds
    burstLimit: 1
  }),

  // Product Fees API: 1 request per second
  fees: new RateLimiter({
    requestsPerSecond: 0.8, // 80% of 1
    burstLimit: 1
  }),

  // Listings Items API: 5 requests per second
  listings: new RateLimiter({
    requestsPerSecond: 4, // 80% of 5
    burstLimit: 5
  }),

  // Default for unknown endpoints: Conservative
  default: new RateLimiter({
    requestsPerSecond: 0.5,
    burstLimit: 2
  })
};
