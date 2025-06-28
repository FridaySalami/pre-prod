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

export interface DetectedCycle {
  period: number;
  strength: number;
  confidence: number;
  type: 'monthly' | 'quarterly' | 'bi-annual' | 'annual';
  correlation: number;
}

export interface YearOverYearAnalysis {
  currentValue: number;
  previousYearValue: number;
  yoyGrowth: number;
  yoyDirection: 'up' | 'down' | 'stable';
  hasMultiYearData: boolean;
  weeksToSamePeriodLastYear?: number;
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

export interface EnhancedSeasonalAnalysis extends SeasonalAnalysis {
  // Multi-period analysis
  detectedCycles: DetectedCycle[];
  primaryCycle: DetectedCycle | null;

  // Year-over-year (when available)
  yearOverYear?: YearOverYearAnalysis;

  // Seasonal context
  seasonalIndex: number;  // 1.0 = normal, >1.0 = above seasonal average
  seasonalContext: 'peak' | 'valley' | 'rising' | 'falling' | 'normal';
  peakDistance: number;   // weeks to/from seasonal peak

  // Enhanced insights
  contextualFactors: string[];
  seasonalRecommendations: string[];
}

export class SeasonalTrendService {

  /**
   * Enhanced seasonal analysis with multi-period detection and YoY analysis
   * This is the new main entry point for Phase 1 enhanced analysis
   */
  static analyzeEnhancedSeasonalTrend(
    values: number[],
    dataPoints: Array<{ weekNumber: number, year: number, value: number }>
  ): EnhancedSeasonalAnalysis {

    // Get base analysis first
    const baseAnalysis = this.analyzeSeasonalTrend(values, 4);

    // Multi-period cycle detection
    const detectedCycles = this.detectMultipleCycles(values);
    const primaryCycle = detectedCycles.length > 0 ? detectedCycles[0] : null;

    // Year-over-year analysis (if we have multi-year data)
    const yearOverYear = this.calculateYearOverYear(dataPoints);

    // Seasonal context analysis
    const seasonalContext = this.calculateSeasonalContext(values, primaryCycle);

    // Enhanced contextual factors and recommendations
    const contextualFactors = this.generateContextualFactors(dataPoints, primaryCycle, yearOverYear);
    const seasonalRecommendations = this.generateSeasonalRecommendations(
      baseAnalysis,
      primaryCycle,
      yearOverYear,
      seasonalContext
    );

    return {
      ...baseAnalysis,
      detectedCycles,
      primaryCycle,
      yearOverYear,
      seasonalIndex: seasonalContext.seasonalIndex,
      seasonalContext: seasonalContext.context,
      peakDistance: seasonalContext.peakDistance,
      contextualFactors,
      seasonalRecommendations
    };
  }

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

  /**
   * Detect multiple seasonal cycles in the data
   */
  private static detectMultipleCycles(values: number[]): DetectedCycle[] {
    if (values.length < 8) return [];

    const cycles: DetectedCycle[] = [];

    // Test different period lengths
    const periodsToTest = [
      { period: 4, type: 'monthly' as const },
      { period: 13, type: 'quarterly' as const },
      { period: 26, type: 'bi-annual' as const },
      { period: 52, type: 'annual' as const }
    ];

    for (const { period, type } of periodsToTest) {
      if (values.length < period * 2) continue;

      const correlation = this.calculateAutocorrelation(values, period);
      const strength = Math.abs(correlation);

      if (strength > 0.2) { // Lower threshold for detection
        cycles.push({
          period,
          strength,
          confidence: this.calculateCycleConfidence(values.length, period, strength),
          type,
          correlation
        });
      }
    }

    // Sort by strength (descending)
    return cycles.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Calculate year-over-year analysis when multi-year data is available
   */
  private static calculateYearOverYear(
    dataPoints: Array<{ weekNumber: number, year: number, value: number }>
  ): YearOverYearAnalysis | undefined {

    if (dataPoints.length === 0) return undefined;

    // Check if we have data spanning multiple years
    const years = [...new Set(dataPoints.map(d => d.year))].sort();
    if (years.length < 2) return undefined;

    const currentPoint = dataPoints[dataPoints.length - 1];
    const currentYear = currentPoint.year;
    const currentWeek = currentPoint.weekNumber;
    const currentValue = currentPoint.value;

    // Find same week in previous year
    const previousYearPoint = dataPoints.find(
      d => d.year === currentYear - 1 && d.weekNumber === currentWeek
    );

    if (!previousYearPoint) {
      // Try to find closest week in previous year
      const closestWeek = dataPoints
        .filter(d => d.year === currentYear - 1)
        .reduce((closest, point) => {
          const currentDiff = Math.abs(point.weekNumber - currentWeek);
          const closestDiff = Math.abs(closest.weekNumber - currentWeek);
          return currentDiff < closestDiff ? point : closest;
        }, dataPoints.filter(d => d.year === currentYear - 1)[0]);

      if (!closestWeek) return undefined;

      const yoyGrowth = ((currentValue - closestWeek.value) / closestWeek.value) * 100;

      return {
        currentValue,
        previousYearValue: closestWeek.value,
        yoyGrowth,
        yoyDirection: Math.abs(yoyGrowth) > 5 ? (yoyGrowth > 0 ? 'up' : 'down') : 'stable',
        hasMultiYearData: true,
        weeksToSamePeriodLastYear: Math.abs(closestWeek.weekNumber - currentWeek)
      };
    }

    const yoyGrowth = ((currentValue - previousYearPoint.value) / previousYearPoint.value) * 100;

    return {
      currentValue,
      previousYearValue: previousYearPoint.value,
      yoyGrowth,
      yoyDirection: Math.abs(yoyGrowth) > 5 ? (yoyGrowth > 0 ? 'up' : 'down') : 'stable',
      hasMultiYearData: true
    };
  }

  /**
   * Calculate seasonal context and positioning
   */
  private static calculateSeasonalContext(
    values: number[],
    primaryCycle: DetectedCycle | null
  ): {
    seasonalIndex: number;
    context: 'peak' | 'valley' | 'rising' | 'falling' | 'normal';
    peakDistance: number;
  } {

    if (!primaryCycle || values.length < primaryCycle.period) {
      return {
        seasonalIndex: 1.0,
        context: 'normal',
        peakDistance: 0
      };
    }

    // Calculate seasonal average for the cycle period
    const period = primaryCycle.period;
    const currentValue = values[values.length - 1];
    const position = (values.length - 1) % period;

    // Get values at same position in cycle
    const samePositionValues = [];
    for (let i = position; i < values.length; i += period) {
      samePositionValues.push(values[i]);
    }

    const seasonalAverage = samePositionValues.length > 0
      ? samePositionValues.reduce((sum, val) => sum + val, 0) / samePositionValues.length
      : currentValue;

    const seasonalIndex = seasonalAverage > 0 ? currentValue / seasonalAverage : 1.0;

    // Determine context by looking at recent trend within cycle
    const recentValues = values.slice(-Math.min(4, period));
    const isRising = recentValues.length >= 2 &&
      recentValues[recentValues.length - 1] > recentValues[0];
    const isFalling = recentValues.length >= 2 &&
      recentValues[recentValues.length - 1] < recentValues[0];

    // Find approximate peak/valley distance
    const cycleValues = values.slice(-period);
    const maxIndex = cycleValues.indexOf(Math.max(...cycleValues));
    const minIndex = cycleValues.indexOf(Math.min(...cycleValues));
    const currentIndex = cycleValues.length - 1;

    const distanceToMax = Math.min(
      Math.abs(currentIndex - maxIndex),
      period - Math.abs(currentIndex - maxIndex)
    );
    const distanceToMin = Math.min(
      Math.abs(currentIndex - minIndex),
      period - Math.abs(currentIndex - minIndex)
    );

    let context: 'peak' | 'valley' | 'rising' | 'falling' | 'normal';
    if (distanceToMax <= 1) context = 'peak';
    else if (distanceToMin <= 1) context = 'valley';
    else if (isRising) context = 'rising';
    else if (isFalling) context = 'falling';
    else context = 'normal';

    return {
      seasonalIndex,
      context,
      peakDistance: distanceToMax < distanceToMin ? -distanceToMax : distanceToMin
    };
  }

  /**
   * Generate contextual factors based on analysis
   */
  private static generateContextualFactors(
    dataPoints: Array<{ weekNumber: number, year: number, value: number }>,
    primaryCycle: DetectedCycle | null,
    yearOverYear?: YearOverYearAnalysis
  ): string[] {

    const factors: string[] = [];

    // Seasonal factors
    if (primaryCycle) {
      switch (primaryCycle.type) {
        case 'annual':
          factors.push('Annual Seasonality');
          // Add holiday/seasonal context based on current week
          const currentWeek = dataPoints[dataPoints.length - 1]?.weekNumber;
          if (currentWeek >= 47 && currentWeek <= 52) {
            factors.push('Holiday Shopping Period');
          } else if (currentWeek >= 6 && currentWeek <= 12) {
            factors.push('Post-Holiday Period');
          } else if (currentWeek >= 20 && currentWeek <= 35) {
            factors.push('Summer Period');
          }
          break;
        case 'quarterly':
          factors.push('Quarterly Business Cycles');
          break;
        case 'monthly':
          factors.push('Monthly Patterns');
          break;
      }
    }

    // Year-over-year factors
    if (yearOverYear?.hasMultiYearData) {
      if (Math.abs(yearOverYear.yoyGrowth) > 10) {
        factors.push('Significant Year-over-Year Change');
      }
      factors.push('Historical Comparison Available');
    }

    // Data quality factors
    if (dataPoints.length >= 52) {
      factors.push('Full Annual Data Available');
    } else if (dataPoints.length >= 26) {
      factors.push('Multi-Season Data Available');
    }

    return factors;
  }

  /**
   * Generate seasonal recommendations
   */
  private static generateSeasonalRecommendations(
    baseAnalysis: SeasonalAnalysis,
    primaryCycle: DetectedCycle | null,
    yearOverYear?: YearOverYearAnalysis,
    seasonalContext?: { context: string; seasonalIndex: number; peakDistance: number }
  ): string[] {

    const recommendations: string[] = [];

    // Seasonal context recommendations
    if (seasonalContext) {
      switch (seasonalContext.context) {
        case 'peak':
          recommendations.push('Monitor for potential seasonal peak - prepare for possible decline');
          break;
        case 'valley':
          recommendations.push('Currently at seasonal low - expect potential recovery');
          break;
        case 'rising':
          recommendations.push('Trending toward seasonal peak - optimize for increased activity');
          break;
        case 'falling':
          recommendations.push('Declining toward seasonal low - prepare contingency plans');
          break;
      }

      if (seasonalContext.seasonalIndex > 1.2) {
        recommendations.push('Performance significantly above seasonal average');
      } else if (seasonalContext.seasonalIndex < 0.8) {
        recommendations.push('Performance below seasonal average - investigate causes');
      }
    }

    // Year-over-year recommendations
    if (yearOverYear?.hasMultiYearData) {
      if (yearOverYear.yoyDirection === 'up') {
        recommendations.push('Year-over-year improvement - analyze success factors');
      } else if (yearOverYear.yoyDirection === 'down') {
        recommendations.push('Year-over-year decline - review previous year strategies');
      }
    }

    // Cycle-based recommendations
    if (primaryCycle) {
      if (primaryCycle.type === 'annual' && primaryCycle.strength > 0.5) {
        recommendations.push('Strong annual pattern detected - use for seasonal planning');
      }
    }

    return recommendations;
  }

  /**
   * Calculate confidence for a detected cycle
   */
  private static calculateCycleConfidence(
    dataLength: number,
    period: number,
    strength: number
  ): number {
    let confidence = 0.5;

    // More complete cycles = higher confidence
    const completeCycles = Math.floor(dataLength / period);
    if (completeCycles >= 3) confidence += 0.3;
    else if (completeCycles >= 2) confidence += 0.2;
    else if (completeCycles >= 1) confidence += 0.1;

    // Stronger correlation = higher confidence
    confidence += strength * 0.4;

    return Math.min(1, confidence);
  }
}
