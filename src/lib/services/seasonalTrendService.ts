/**
 * Seasonal Trend Analysis Service
 * Analyzes business data for seasonal patterns and trend decomposition
 */

export interface SeasonalTrendPoint {
  index: number;
  value: number;
  trend?: number;
  seasonal?: number;
  detrended?: number;
  periodComparison?: number;
}

export interface SeasonalAnalysis {
  // Trend component
  overallTrend: 'up' | 'down' | 'stable';
  trendStrength: number; // 0-1 scale
  trendSlope: number;

  // Seasonal component
  seasonalityDetected: boolean;
  seasonalStrength: number; // 0-1 scale
  cyclePeriod?: number; // detected cycle length in periods

  // Period-over-period comparison
  periodOverPeriod: {
    currentValue: number;
    previousPeriodValue: number;
    change: number;
    changePercent: number;
    direction: 'up' | 'down' | 'stable';
  };

  // Volatility and consistency
  volatility: number;
  consistency: number;

  // Summary insights
  summary: string;
  confidence: number; // 0-1 scale for analysis confidence
}

export class SeasonalTrendService {

  /**
   * Perform seasonal trend decomposition on weekly data
   * Uses a simplified STL-style decomposition adapted for business data
   */
  static analyzeSeasonalTrend(values: number[], periods: number = 4): SeasonalAnalysis {
    if (values.length < 4) {
      return this.getDefaultAnalysis(values);
    }

    // Step 1: Calculate overall trend using linear regression
    const trendAnalysis = this.calculateLinearTrend(values);

    // Step 2: Remove trend to get detrended series
    const detrended = this.detrendSeries(values, trendAnalysis.slope, trendAnalysis.intercept);

    // Step 3: Detect seasonality in the detrended series
    const seasonalAnalysis = this.detectSeasonality(detrended, periods);

    // Step 4: Calculate period-over-period comparison
    const periodComparison = this.calculatePeriodOverPeriod(values, periods);

    // Step 5: Calculate volatility and consistency metrics
    const volatility = this.calculateVolatility(values);
    const consistency = this.calculateConsistency(values);

    // Step 6: Generate insights summary
    const summary = this.generateInsights({
      trendAnalysis,
      seasonalAnalysis,
      periodComparison,
      volatility,
      consistency,
      dataLength: values.length
    });

    return {
      overallTrend: trendAnalysis.direction,
      trendStrength: Math.abs(trendAnalysis.slope) / (Math.max(...values) - Math.min(...values)),
      trendSlope: trendAnalysis.slope,

      seasonalityDetected: seasonalAnalysis.detected,
      seasonalStrength: seasonalAnalysis.strength,
      cyclePeriod: seasonalAnalysis.period,

      periodOverPeriod: periodComparison,

      volatility,
      consistency,

      summary,
      confidence: this.calculateConfidence(values.length, seasonalAnalysis.detected)
    };
  }

  /**
   * Calculate linear trend using least squares regression
   */
  private static calculateLinearTrend(values: number[]): {
    slope: number;
    intercept: number;
    r2: number;
    direction: 'up' | 'down' | 'stable';
  } {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);

    // Calculate means
    const xMean = x.reduce((sum, val) => sum + val, 0) / n;
    const yMean = values.reduce((sum, val) => sum + val, 0) / n;

    // Calculate slope and intercept
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (x[i] - xMean) * (values[i] - yMean);
      denominator += (x[i] - xMean) ** 2;
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;
    const intercept = yMean - slope * xMean;

    // Calculate R²
    let totalSumSquares = 0;
    let residualSumSquares = 0;

    for (let i = 0; i < n; i++) {
      const predicted = slope * x[i] + intercept;
      totalSumSquares += (values[i] - yMean) ** 2;
      residualSumSquares += (values[i] - predicted) ** 2;
    }

    const r2 = totalSumSquares === 0 ? 0 : 1 - (residualSumSquares / totalSumSquares);

    // Determine direction
    let direction: 'up' | 'down' | 'stable' = 'stable';
    const slopeThreshold = (Math.max(...values) - Math.min(...values)) * 0.02 / n; // 2% of range per period

    if (slope > slopeThreshold) {
      direction = 'up';
    } else if (slope < -slopeThreshold) {
      direction = 'down';
    }

    return { slope, intercept, r2, direction };
  }

  /**
   * Remove trend from series
   */
  private static detrendSeries(values: number[], slope: number, intercept: number): number[] {
    return values.map((value, index) => {
      const trendValue = slope * index + intercept;
      return value - trendValue;
    });
  }

  /**
   * Detect seasonality in detrended series
   */
  private static detectSeasonality(detrended: number[], maxPeriod: number = 4): {
    detected: boolean;
    strength: number;
    period?: number;
  } {
    if (detrended.length < maxPeriod * 2) {
      return { detected: false, strength: 0 };
    }

    let bestPeriod = 0;
    let bestCorrelation = 0;

    // Test different periods (e.g., monthly cycle in weeks = 4, quarterly = 13)
    const periodsToTest = [4, 13]; // 4 weeks (monthly), 13 weeks (quarterly)

    for (const period of periodsToTest) {
      if (detrended.length < period * 2) continue;

      const correlation = this.calculateAutocorrelation(detrended, period);

      if (Math.abs(correlation) > Math.abs(bestCorrelation)) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }

    const detected = Math.abs(bestCorrelation) > 0.3; // Threshold for seasonal detection
    const strength = Math.abs(bestCorrelation);

    return {
      detected,
      strength,
      period: detected ? bestPeriod : undefined
    };
  }

  /**
   * Calculate autocorrelation at a specific lag
   */
  private static calculateAutocorrelation(series: number[], lag: number): number {
    if (series.length <= lag) return 0;

    const n = series.length - lag;
    const mean = series.reduce((sum, val) => sum + val, 0) / series.length;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (series[i] - mean) * (series[i + lag] - mean);
    }

    for (let i = 0; i < series.length; i++) {
      denominator += (series[i] - mean) ** 2;
    }

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate period-over-period comparison
   */
  private static calculatePeriodOverPeriod(values: number[], period: number = 4): {
    currentValue: number;
    previousPeriodValue: number;
    change: number;
    changePercent: number;
    direction: 'up' | 'down' | 'stable';
  } {
    const currentValue = values[values.length - 1];
    const previousPeriodIndex = Math.max(0, values.length - 1 - period);
    const previousPeriodValue = values[previousPeriodIndex];

    const change = currentValue - previousPeriodValue;
    const changePercent = previousPeriodValue === 0 ? 0 : (change / previousPeriodValue) * 100;

    let direction: 'up' | 'down' | 'stable' = 'stable';
    if (Math.abs(changePercent) > 5) { // 5% threshold
      direction = changePercent > 0 ? 'up' : 'down';
    }

    return {
      currentValue,
      previousPeriodValue,
      change,
      changePercent,
      direction
    };
  }

  /**
   * Calculate volatility (coefficient of variation)
   */
  private static calculateVolatility(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return mean === 0 ? 0 : stdDev / mean;
  }

  /**
   * Calculate consistency (inverse of volatility, normalized)
   */
  private static calculateConsistency(values: number[]): number {
    const volatility = this.calculateVolatility(values);
    return Math.max(0, 1 - Math.min(1, volatility));
  }

  /**
   * Generate insights summary based on analysis
   */
  private static generateInsights(params: {
    trendAnalysis: any;
    seasonalAnalysis: any;
    periodComparison: any;
    volatility: number;
    consistency: number;
    dataLength: number;
  }): string {
    const { trendAnalysis, seasonalAnalysis, periodComparison, volatility, consistency } = params;

    let insights: string[] = [];

    // Trend insights
    if (trendAnalysis.direction !== 'stable') {
      const strength = trendAnalysis.direction === 'up' ? 'increasing' : 'decreasing';
      insights.push(`Overall trend is ${strength}`);
    }

    // Seasonal insights
    if (seasonalAnalysis.detected) {
      const periodName = seasonalAnalysis.period === 4 ? 'monthly' :
        seasonalAnalysis.period === 13 ? 'quarterly' :
          `${seasonalAnalysis.period}-week`;
      insights.push(`${periodName} seasonal pattern detected`);
    }

    // Period comparison insights
    if (Math.abs(periodComparison.changePercent) > 10) {
      const direction = periodComparison.direction === 'up' ? 'higher' : 'lower';
      insights.push(`Current period is ${Math.abs(periodComparison.changePercent).toFixed(1)}% ${direction} than comparable period`);
    }

    // Consistency insights
    if (consistency > 0.8) {
      insights.push('Data shows high consistency');
    } else if (consistency < 0.5) {
      insights.push('Data shows high variability');
    }

    return insights.length > 0 ? insights.join('; ') : 'No significant patterns detected';
  }

  /**
   * Calculate confidence based on data quality
   */
  private static calculateConfidence(dataLength: number, seasonalityDetected: boolean): number {
    let confidence = 0.5; // Base confidence

    // More data = higher confidence
    if (dataLength >= 13) confidence += 0.3;
    else if (dataLength >= 8) confidence += 0.2;
    else if (dataLength >= 4) confidence += 0.1;

    // Detected patterns = higher confidence
    if (seasonalityDetected) confidence += 0.2;

    return Math.min(1, confidence);
  }

  /**
   * Default analysis for insufficient data
   */
  private static getDefaultAnalysis(values: number[]): SeasonalAnalysis {
    if (values.length === 0) {
      return {
        overallTrend: 'stable',
        trendStrength: 0,
        trendSlope: 0,
        seasonalityDetected: false,
        seasonalStrength: 0,
        periodOverPeriod: {
          currentValue: 0,
          previousPeriodValue: 0,
          change: 0,
          changePercent: 0,
          direction: 'stable'
        },
        volatility: 0,
        consistency: 0,
        summary: 'Insufficient data for analysis',
        confidence: 0
      };
    }

    const currentValue = values[values.length - 1];
    const previousValue = values.length > 1 ? values[values.length - 2] : currentValue;
    const change = currentValue - previousValue;
    const changePercent = previousValue === 0 ? 0 : (change / previousValue) * 100;

    return {
      overallTrend: 'stable',
      trendStrength: 0,
      trendSlope: 0,
      seasonalityDetected: false,
      seasonalStrength: 0,
      periodOverPeriod: {
        currentValue,
        previousPeriodValue: previousValue,
        change,
        changePercent,
        direction: Math.abs(changePercent) > 5 ? (changePercent > 0 ? 'up' : 'down') : 'stable'
      },
      volatility: this.calculateVolatility(values),
      consistency: this.calculateConsistency(values),
      summary: 'Limited data available for comprehensive analysis',
      confidence: 0.2
    };
  }
}
