/**
 * Simple rate limiter for Amazon Feeds API
 * 
 * Strategy:
 * - 1 request per 60 seconds (conservative baseline)
 * - Persisted state in-memory to survive hot reloads (singleton)
 */

interface RateLimiterState {
  lastRequestTime: number;
  queue: Array<() => void>;
  isProcessing: boolean;
}

// Global state to survive potential SvelteKit dev reloads
const globalStateKey = '__AMAZON_FEEDS_RATE_LIMITER_STATE__';
const globalState: RateLimiterState = (global as any)[globalStateKey] || {
  lastRequestTime: 0,
  queue: [],
  isProcessing: false
};
(global as any)[globalStateKey] = globalState;

class AmazonFeedsRateLimiter {
  private readonly REQUEST_INTERVAL_MS = 60000; // 60 seconds base interval

  async schedule<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      globalState.queue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (globalState.isProcessing) return;
    globalState.isProcessing = true;

    while (globalState.queue.length > 0) {
      const now = Date.now();
      const timeSinceLast = now - globalState.lastRequestTime;
      const waitTime = Math.max(0, this.REQUEST_INTERVAL_MS - timeSinceLast);

      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      const nextFn = globalState.queue.shift();
      if (nextFn) {
        globalState.lastRequestTime = Date.now();
        await nextFn();
      }
    }

    globalState.isProcessing = false;
  }

  getStatus() {
    const now = Date.now();
    const timeSinceLast = now - globalState.lastRequestTime;
    const estimatedWaitTime = Math.max(0, this.REQUEST_INTERVAL_MS - timeSinceLast) +
      ((globalState.queue.length > 0 ? globalState.queue.length - 1 : 0) * this.REQUEST_INTERVAL_MS);

    return {
      queueLength: globalState.queue.length,
      lastRequestTime: globalState.lastRequestTime,
      isProcessing: globalState.isProcessing,
      estimatedWaitTime,
      requestsPerSecond: 1 / 60
    };
  }
}

export const amazonFeedsRateLimiter = new AmazonFeedsRateLimiter();
