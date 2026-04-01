/**
 * Moving Average Service - Similar to Forex technical analysis
 * Provides Simple Moving Average (SMA) and Exponential Moving Average (EMA) calculations
 */

export interface MovingAveragePoint {
  index: number;
  value: number;
  shortSMA?: number;
  longSMA?: number;
  shortEMA?: number;
  longEMA?: number;
}

export interface MovingAverageConfig {
  shortPeriod: number;  // Short-term MA (e.g., 3-4 weeks)
  longPeriod: number;   // Long-term MA (e.g., 8-12 weeks)
  enableSMA: boolean;
  enableEMA: boolean;
}

export class MovingAverageService {

  /**
   * Calculate Simple Moving Average (SMA)
   * @param data Array of values
   * @param period Number of periods for the average
   * @returns Array with SMA values (null for periods without enough data)
   */
  static calculateSMA(data: number[], period: number): (number | null)[] {
    if (data.length < period) return data.map(() => null);

    const sma: (number | null)[] = [];

    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        sma.push(null);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
        sma.push(sum / period);
      }
    }

    return sma;
  }

  /**
   * Calculate Exponential Moving Average (EMA)
   * @param data Array of values
   * @param period Number of periods for the average
   * @returns Array with EMA values
   */
  static calculateEMA(data: number[], period: number): (number | null)[] {
    if (data.length === 0) return [];

    const ema: (number | null)[] = [];
    const multiplier = 2 / (period + 1);

    // First EMA value is the first data point
    ema[0] = data[0];

    for (let i = 1; i < data.length; i++) {
      ema[i] = (data[i] * multiplier) + (ema[i - 1]! * (1 - multiplier));
    }

    return ema;
  }

  /**
   * Calculate both SMA and EMA for chart display
   * @param values Array of metric values
   * @param config Moving average configuration
   * @returns Processed data with moving averages
   */
  static calculateMovingAverages(
    values: number[],
    config: MovingAverageConfig
  ): MovingAveragePoint[] {
    const shortSMA = config.enableSMA ? this.calculateSMA(values, config.shortPeriod) : null;
    const longSMA = config.enableSMA ? this.calculateSMA(values, config.longPeriod) : null;
    const shortEMA = config.enableEMA ? this.calculateEMA(values, config.shortPeriod) : null;
    const longEMA = config.enableEMA ? this.calculateEMA(values, config.longPeriod) : null;

    return values.map((value, index) => ({
      index,
      value,
      shortSMA: shortSMA?.[index] || undefined,
      longSMA: longSMA?.[index] || undefined,
      shortEMA: shortEMA?.[index] || undefined,
      longEMA: longEMA?.[index] || undefined,
    }));
  }

  /**
   * Determine trend based on moving average crossovers (like forex)
   * @param shortMA Short-term moving average values
   * @param longMA Long-term moving average values
   * @returns Trend analysis
   */
  static analyzeTrend(shortMA: (number | null)[], longMA: (number | null)[]) {
    const validPairs = shortMA
      .map((short, i) => ({ short, long: longMA[i], index: i }))
      .filter(p => p.short !== null && p.long !== null) as Array<{ short: number, long: number, index: number }>;

    if (validPairs.length < 2) {
      return {
        direction: 'stable' as const,
        strength: 0,
        crossover: null,
        momentum: 'neutral' as const
      };
    }

    const latest = validPairs[validPairs.length - 1];
    const previous = validPairs[validPairs.length - 2];

    // Determine crossover
    let crossover: 'bullish' | 'bearish' | null = null;
    if (previous.short <= previous.long && latest.short > latest.long) {
      crossover = 'bullish'; // Short MA crosses above Long MA
    } else if (previous.short >= previous.long && latest.short < latest.long) {
      crossover = 'bearish'; // Short MA crosses below Long MA
    }

    // Calculate trend strength based on MA separation
    const separation = Math.abs(latest.short - latest.long);
    const avgValue = (latest.short + latest.long) / 2;
    const strength = avgValue > 0 ? Math.min(separation / avgValue, 1) : 0;

    // Determine overall direction
    let direction: 'up' | 'down' | 'stable';
    if (latest.short > latest.long * 1.02) { // 2% threshold
      direction = 'up';
    } else if (latest.short < latest.long * 0.98) {
      direction = 'down';
    } else {
      direction = 'stable';
    }

    // Determine momentum
    const shortChange = latest.short - previous.short;
    const longChange = latest.long - previous.long;
    let momentum: 'accelerating' | 'decelerating' | 'neutral';

    if (direction === 'up') {
      momentum = shortChange > longChange ? 'accelerating' : 'decelerating';
    } else if (direction === 'down') {
      momentum = shortChange < longChange ? 'accelerating' : 'decelerating';
    } else {
      momentum = 'neutral';
    }

    return {
      direction,
      strength,
      crossover,
      momentum,
      currentSpread: latest.short - latest.long,
      currentShort: latest.short,
      currentLong: latest.long
    };
  }

  /**
   * Get default configuration for business metrics
   * @param dataLength Number of data points available
   * @returns Recommended configuration
   */
  static getDefaultConfig(dataLength: number): MovingAverageConfig {
    if (dataLength >= 12) {
      return {
        shortPeriod: 3,    // 3-week short-term trend
        longPeriod: 8,     // 8-week long-term trend
        enableSMA: true,
        enableEMA: true
      };
    } else if (dataLength >= 6) {
      return {
        shortPeriod: 2,
        longPeriod: 4,
        enableSMA: true,
        enableEMA: false   // Skip EMA for shorter datasets
      };
    } else {
      return {
        shortPeriod: 2,
        longPeriod: 3,
        enableSMA: true,
        enableEMA: false
      };
    }
  }
}
