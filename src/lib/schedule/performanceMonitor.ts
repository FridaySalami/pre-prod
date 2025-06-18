// Performance monitoring utilities for scheduling page

interface MemoryUsage {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export class SchedulePerformanceMonitor {
  private static metrics: Map<string, number> = new Map();

  static startTimer(operation: string): string {
    const timerId = `${operation}_${Date.now()}`;
    this.metrics.set(timerId, performance.now());
    return timerId;
  }

  static endTimer(timerId: string, operation: string): number {
    const startTime = this.metrics.get(timerId);
    if (!startTime) return 0;

    const duration = performance.now() - startTime;
    this.metrics.delete(timerId);

    // Log slow operations
    if (duration > 1000) { // More than 1 second
      console.warn(`Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  static measureFunction<T>(fn: () => Promise<T>, operationName: string): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const timerId = this.startTimer(operationName);
      try {
        const result = await fn();
        this.endTimer(timerId, operationName);
        resolve(result);
      } catch (error) {
        this.endTimer(timerId, operationName);
        reject(error);
      }
    });
  }

  static getMemoryUsage(): MemoryUsage | null {
    if ('memory' in performance) {
      return (performance as any).memory;
    }
    return null;
  }

  static logMetrics(): void {
    const memory = this.getMemoryUsage();
    if (memory) {
      console.log('Memory Usage:', {
        used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
      });
    }
  }
}
