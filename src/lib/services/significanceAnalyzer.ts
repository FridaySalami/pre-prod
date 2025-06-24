/**
 * Advanced Significance Analysis Service
 * Provides multiple methods to determine if changes in metrics are statistically or practically significant
 */

export interface SignificanceConfig {
  // Basic threshold settings
  percentageThreshold: number; // Default 5%
  absoluteThreshold?: number; // Optional absolute value threshold

  // Statistical significance settings
  useStatisticalSignificance: boolean;
  confidenceLevel: number; // 0.95 for 95% confidence
  minimumSampleSize: number; // Minimum data points needed for statistical analysis

  // Trend analysis settings
  trendWindowSize: number; // Number of periods to analyze for trend consistency
  volatilityThreshold: number; // Standard deviation multiplier for volatility detection

  // Business context settings
  metricType: 'sales' | 'orders' | 'efficiency' | 'other';
  seasonalityAware: boolean; // Consider seasonal patterns
  businessHours?: { start: number; end: number }; // For efficiency metrics
}

export interface SignificanceResult {
  isSignificant: boolean;
  significanceType: 'statistical' | 'practical' | 'trend' | 'volatility' | 'combined';
  confidence: number; // 0-1 confidence score
  reasons: string[]; // Human-readable reasons for significance
  metrics: {
    percentageChange: number;
    absoluteChange: number;
    zScore?: number;
    pValue?: number;
    trendStrength?: number;
    volatilityScore?: number;
    seasonalityAdjusted?: boolean;
  };
  recommendations: string[]; // Actionable insights
}

export class SignificanceAnalyzer {
  /**
   * Analyze significance using multiple criteria
   */
  static analyzeSignificance(
    values: number[],
    config: Partial<SignificanceConfig> = {}
  ): SignificanceResult {
    const defaultConfig: SignificanceConfig = {
      percentageThreshold: 5,
      useStatisticalSignificance: true,
      confidenceLevel: 0.95,
      minimumSampleSize: 4,
      trendWindowSize: 3,
      volatilityThreshold: 2,
      metricType: 'other',
      seasonalityAware: false
    };

    const finalConfig = { ...defaultConfig, ...config };

    if (values.length < 2) {
      return this.createEmptyResult('Insufficient data');
    }

    const latest = values[values.length - 1];
    const previous = values[values.length - 2];
    const percentageChange = previous !== 0 ? ((latest - previous) / previous) * 100 : 0;
    const absoluteChange = latest - previous;

    const result: SignificanceResult = {
      isSignificant: false,
      significanceType: 'practical',
      confidence: 0,
      reasons: [],
      metrics: {
        percentageChange: Math.abs(percentageChange),
        absoluteChange: Math.abs(absoluteChange)
      },
      recommendations: []
    };

    // 1. Basic threshold check
    const thresholdCheck = this.checkBasicThreshold(
      percentageChange,
      absoluteChange,
      finalConfig
    );
    if (thresholdCheck.isSignificant) {
      result.isSignificant = true;
      result.reasons.push(...thresholdCheck.reasons);
      result.confidence = Math.max(result.confidence, thresholdCheck.confidence);
    }

    // 2. Statistical significance (if enough data)
    if (finalConfig.useStatisticalSignificance && values.length >= finalConfig.minimumSampleSize) {
      const statisticalCheck = this.checkStatisticalSignificance(values, finalConfig);
      if (statisticalCheck.isSignificant) {
        result.isSignificant = true;
        result.significanceType = 'statistical';
        result.reasons.push(...statisticalCheck.reasons);
        result.confidence = Math.max(result.confidence, statisticalCheck.confidence);
        result.metrics.zScore = statisticalCheck.zScore;
        result.metrics.pValue = statisticalCheck.pValue;
      }
    }

    // 3. Trend consistency analysis
    if (values.length >= finalConfig.trendWindowSize) {
      const trendCheck = this.checkTrendConsistency(values, finalConfig);
      if (trendCheck.isSignificant) {
        result.isSignificant = true;
        result.significanceType = result.significanceType === 'statistical' ? 'combined' : 'trend';
        result.reasons.push(...trendCheck.reasons);
        result.confidence = Math.max(result.confidence, trendCheck.confidence);
        result.metrics.trendStrength = trendCheck.trendStrength;
      }
    }

    // 4. Volatility analysis
    const volatilityCheck = this.checkVolatilitySignificance(values, finalConfig);
    if (volatilityCheck.isSignificant) {
      result.isSignificant = true;
      result.reasons.push(...volatilityCheck.reasons);
      result.confidence = Math.max(result.confidence, volatilityCheck.confidence);
      result.metrics.volatilityScore = volatilityCheck.volatilityScore;
    }

    // 5. Business context recommendations
    result.recommendations = this.generateRecommendations(result, finalConfig);

    return result;
  }

  /**
   * Check basic percentage and absolute thresholds
   */
  private static checkBasicThreshold(
    percentageChange: number,
    absoluteChange: number,
    config: SignificanceConfig
  ) {
    const reasons: string[] = [];
    let confidence = 0;
    let isSignificant = false;

    // Percentage threshold
    if (Math.abs(percentageChange) > config.percentageThreshold) {
      isSignificant = true;
      reasons.push(`${Math.abs(percentageChange).toFixed(1)}% change exceeds ${config.percentageThreshold}% threshold`);
      confidence = Math.min(0.8, Math.abs(percentageChange) / 100);
    }

    // Absolute threshold (if configured)
    if (config.absoluteThreshold && Math.abs(absoluteChange) > config.absoluteThreshold) {
      isSignificant = true;
      reasons.push(`Absolute change of ${Math.abs(absoluteChange).toFixed(0)} exceeds threshold`);
      confidence = Math.max(confidence, 0.6);
    }

    return { isSignificant, reasons, confidence };
  }

  /**
   * Check statistical significance using z-score and confidence intervals
   */
  private static checkStatisticalSignificance(values: number[], config: SignificanceConfig) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
    const standardDeviation = Math.sqrt(variance);

    const latest = values[values.length - 1];
    const zScore = standardDeviation > 0 ? Math.abs((latest - mean) / standardDeviation) : 0;

    // Critical z-score for given confidence level
    const criticalZ = this.getCriticalZScore(config.confidenceLevel);

    const isSignificant = zScore > criticalZ;
    const pValue = this.calculatePValue(zScore);

    const reasons: string[] = [];
    if (isSignificant) {
      reasons.push(`Statistically significant (z-score: ${zScore.toFixed(2)}, p < ${(1 - config.confidenceLevel).toFixed(3)})`);
    }

    return {
      isSignificant,
      reasons,
      confidence: isSignificant ? config.confidenceLevel : 0,
      zScore,
      pValue
    };
  }

  /**
   * Check trend consistency over multiple periods
   */
  private static checkTrendConsistency(values: number[], config: SignificanceConfig) {
    const windowSize = Math.min(config.trendWindowSize, values.length);
    const recentValues = values.slice(-windowSize);

    // Calculate trend direction consistency
    let positiveChanges = 0;
    let negativeChanges = 0;

    for (let i = 1; i < recentValues.length; i++) {
      const change = recentValues[i] - recentValues[i - 1];
      if (change > 0) positiveChanges++;
      else if (change < 0) negativeChanges++;
    }

    const totalChanges = positiveChanges + negativeChanges;
    const trendStrength = totalChanges > 0 ? Math.max(positiveChanges, negativeChanges) / totalChanges : 0;

    // Consider it significant if trend is consistent (>75% in same direction)
    const isSignificant = trendStrength > 0.75 && totalChanges >= 2;

    const reasons: string[] = [];
    if (isSignificant) {
      const direction = positiveChanges > negativeChanges ? 'upward' : 'downward';
      reasons.push(`Consistent ${direction} trend over ${windowSize} periods (${(trendStrength * 100).toFixed(0)}% consistency)`);
    }

    return {
      isSignificant,
      reasons,
      confidence: trendStrength,
      trendStrength
    };
  }

  /**
   * Check volatility-based significance
   */
  private static checkVolatilitySignificance(values: number[], config: SignificanceConfig) {
    if (values.length < 3) {
      return { isSignificant: false, reasons: [], confidence: 0, volatilityScore: 0 };
    }

    // Calculate rolling volatility (standard deviation of changes)
    const changes = [];
    for (let i = 1; i < values.length; i++) {
      changes.push(values[i] - values[i - 1]);
    }

    const mean = changes.reduce((sum, val) => sum + val, 0) / changes.length;
    const variance = changes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / changes.length;
    const standardDeviation = Math.sqrt(variance);

    const latestChange = changes[changes.length - 1];
    const volatilityScore = standardDeviation > 0 ? Math.abs(latestChange / standardDeviation) : 0;

    const isSignificant = volatilityScore > config.volatilityThreshold;

    const reasons: string[] = [];
    if (isSignificant) {
      reasons.push(`High volatility detected (${volatilityScore.toFixed(1)}σ from normal variation)`);
    }

    return {
      isSignificant,
      reasons,
      confidence: Math.min(0.9, volatilityScore / 5),
      volatilityScore
    };
  }

  /**
   * Generate actionable recommendations based on significance analysis
   */
  private static generateRecommendations(result: SignificanceResult, config: SignificanceConfig): string[] {
    const recommendations: string[] = [];

    if (!result.isSignificant) {
      recommendations.push('Change appears to be within normal variation');
      return recommendations;
    }

    // Based on metric type
    switch (config.metricType) {
      case 'sales':
        if (result.metrics.percentageChange > 10) {
          recommendations.push('Investigate sales drivers - may indicate campaign success or market changes');
        }
        if (result.significanceType === 'trend') {
          recommendations.push('Monitor trend continuation - consider adjusting sales strategies');
        }
        break;

      case 'orders':
        if (result.metrics.percentageChange > 15) {
          recommendations.push('Significant order volume change - check inventory and capacity planning');
        }
        break;

      case 'efficiency':
        if (result.metrics.percentageChange > 8) {
          recommendations.push('Labor efficiency change detected - review process changes or workload distribution');
        }
        break;
    }

    // Based on significance type
    if (result.significanceType === 'volatility') {
      recommendations.push('High volatility detected - consider investigating underlying causes');
    }

    if (result.significanceType === 'statistical') {
      recommendations.push('Statistically significant change - high confidence in pattern');
    }

    if (result.confidence > 0.8) {
      recommendations.push('High confidence result - prioritize for management attention');
    }

    return recommendations;
  }

  /**
   * Get critical z-score for confidence level
   */
  private static getCriticalZScore(confidenceLevel: number): number {
    // Common critical values
    const criticalValues: { [key: number]: number } = {
      0.90: 1.645,
      0.95: 1.960,
      0.99: 2.576
    };

    return criticalValues[confidenceLevel] || 1.960; // Default to 95%
  }

  /**
   * Calculate approximate p-value from z-score
   */
  private static calculatePValue(zScore: number): number {
    // Simplified p-value calculation (for display purposes)
    if (zScore > 2.576) return 0.01;
    if (zScore > 1.960) return 0.05;
    if (zScore > 1.645) return 0.10;
    return 0.20;
  }

  /**
   * Create empty result for insufficient data
   */
  private static createEmptyResult(reason: string): SignificanceResult {
    return {
      isSignificant: false,
      significanceType: 'practical',
      confidence: 0,
      reasons: [reason],
      metrics: {
        percentageChange: 0,
        absoluteChange: 0
      },
      recommendations: ['Collect more data for meaningful analysis']
    };
  }

  /**
   * Get metric-specific configuration presets
   */
  static getMetricConfig(metricType: 'sales' | 'orders' | 'efficiency'): Partial<SignificanceConfig> {
    const configs = {
      sales: {
        percentageThreshold: 5,
        absoluteThreshold: 1000, // £1000
        metricType: 'sales' as const,
        useStatisticalSignificance: true,
        volatilityThreshold: 2.5
      },
      orders: {
        percentageThreshold: 8,
        absoluteThreshold: 10, // 10 orders
        metricType: 'orders' as const,
        useStatisticalSignificance: true,
        volatilityThreshold: 2.0
      },
      efficiency: {
        percentageThreshold: 6,
        absoluteThreshold: 0.5, // 0.5 shipments/hour
        metricType: 'efficiency' as const,
        useStatisticalSignificance: true,
        volatilityThreshold: 1.8
      }
    };

    return configs[metricType];
  }
}
