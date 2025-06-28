/**
 * Smart Prediction Service
 * Adaptive weighted ensemble prediction for business metrics
 */

export interface PredictionWeights {
  trend: number;        // Based on R² and trend consistency
  seasonal: number;     // Based on detected cycle strength
  yearOverYear: number; // Based on YoY data availability and consistency
  momentum: number;     // Based on recent performance and volatility
}

export interface PredictionAccuracy {
  trend: number;
  seasonal: number;
  momentum: number;
  yoy: number;
}

export interface BacktestResult {
  accuracy: PredictionAccuracy;
  averageRMSE: number;
  averageMAPE: number;
  totalTests: number;
  methodRMSE: {
    trend: number;
    seasonal: number;
    momentum: number;
    yoy: number;
  };
  methodMAPE: {
    trend: number;
    seasonal: number;
    momentum: number;
    yoy: number;
  };
}

export interface PredictionContributingFactors {
  trend: number;
  seasonal: number;
  yoy: number;
  momentum: number;
}

export interface SmartPredictionWeek {
  weekNumber: number;
  year: number;
  predictedValue: number;
  confidence: number;
  contributingFactors: PredictionContributingFactors;
  weekStartDate: string;
  weekEndDate: string;
  isPrediction: true;
  anomalyLikely?: boolean; // Flag for potential outliers/anomalies
}

export interface SmartPrediction {
  weeks: SmartPredictionWeek[];
  methodology: {
    weights: PredictionWeights;
    dominantFactor: 'trend' | 'seasonal' | 'yearOverYear' | 'momentum';
    confidenceLevel: 'high' | 'medium' | 'low';
  };
  comparison: {
    predictedVsPrevious: number; // % difference vs previous year same weeks
    seasonalExpectation: number; // Expected seasonal performance
    trendProjection: number;     // Pure trend projection
  };
  backtestAccuracy?: PredictionAccuracy; // Historical accuracy per method
}

export class SmartPredictionService {

  /**
   * Generate smart predictions using adaptive weighted ensemble
   */
  static generatePredictions(
    currentData: Array<{
      weekNumber: number;
      year: number;
      value: number;
      weekStartDate: string;
      weekEndDate: string;
    }>,
    previousYearData: Array<{
      weekNumber: number;
      year: number;
      value: number;
      weekStartDate: string;
      weekEndDate: string;
    }>,
    trendAnalysis: {
      direction: 'up' | 'down' | 'stable';
      percentage: number;
      r2?: number;
      slope?: number;
    },
    seasonalAnalysis: {
      seasonalityDetected: boolean;
      seasonalStrength: number;
      cyclePeriod?: number;
      primaryCycle?: {
        period: number;
        strength: number;
        confidence: number;
      };
    },
    predictionHorizon: number = 4
  ): SmartPrediction {

    // Calculate dynamic weights
    const weights = this.calculateDynamicWeights(
      currentData,
      trendAnalysis,
      seasonalAnalysis,
      previousYearData.length > 0
    );

    // Generate predictions for each method
    const trendPredictions = this.generateTrendPredictions(currentData, trendAnalysis, predictionHorizon);
    const seasonalPredictions = this.generateSeasonalPredictions(currentData, seasonalAnalysis, predictionHorizon);
    const yoyPredictions = this.generateYoYPredictions(currentData, previousYearData, predictionHorizon);
    const momentumPredictions = this.generateMomentumPredictions(currentData, predictionHorizon);

    // Combine predictions using weighted ensemble
    const ensemblePredictions = this.combineEnsemblePredictions(
      trendPredictions,
      seasonalPredictions,
      yoyPredictions,
      momentumPredictions,
      weights,
      currentData
    );

    // Calculate comparison metrics
    const comparison = this.calculateComparisonMetrics(
      ensemblePredictions,
      previousYearData,
      trendPredictions,
      seasonalPredictions
    );

    // Determine dominant factor and confidence level
    const dominantFactor = this.getDominantFactor(weights);
    const confidenceLevel = this.calculateOverallConfidence(weights, currentData.length);

    // Run backtesting to get historical accuracy if sufficient data
    let backtestAccuracy: PredictionAccuracy | undefined;
    if (currentData.length >= 12) { // Need sufficient data for backtesting
      try {
        const backtestResult = this.backtestPredictions(currentData, previousYearData);
        backtestAccuracy = backtestResult.accuracy;
      } catch (error) {
        console.warn('Backtesting failed:', error);
      }
    }

    return {
      weeks: ensemblePredictions,
      methodology: {
        weights,
        dominantFactor,
        confidenceLevel
      },
      comparison,
      backtestAccuracy
    };
  }

  /**
   * Calculate dynamic weights based on data quality and pattern strength
   */
  private static calculateDynamicWeights(
    currentData: any[],
    trendAnalysis: any,
    seasonalAnalysis: any,
    hasYoYData: boolean
  ): PredictionWeights {

    // Trend weight: Based on R² and trend consistency
    const trendR2 = trendAnalysis.r2 || 0;
    const trendConsistency = SmartPredictionService.calculateTrendConsistency(currentData);
    const trendWeight = Math.min(1.0, trendR2 * trendConsistency);

    // Seasonal weight: Based on detected cycle strength and confidence
    const seasonalStrength = seasonalAnalysis.seasonalStrength || 0;
    const cycleConfidence = seasonalAnalysis.primaryCycle?.confidence || 0;
    const seasonalWeight = Math.min(1.0, seasonalStrength * cycleConfidence);

    // YoY weight: Based on data availability and consistency
    const yoyWeight = hasYoYData ? SmartPredictionService.calculateYoYConsistency(currentData) : 0;

    // Momentum weight: Inverse of volatility (ensure minimum weight)
    const volatility = SmartPredictionService.calculateVolatility(currentData.map(d => d.value));
    const momentumWeight = Math.max(0.2, 1.0 - Math.min(1.0, volatility));

    // Normalize weights
    const totalWeight = trendWeight + seasonalWeight + yoyWeight + momentumWeight;

    return {
      trend: trendWeight / totalWeight,
      seasonal: seasonalWeight / totalWeight,
      yearOverYear: yoyWeight / totalWeight,
      momentum: momentumWeight / totalWeight
    };
  }

  /**
   * Generate trend-based predictions using linear regression
   */
  private static generateTrendPredictions(
    currentData: any[],
    trendAnalysis: any,
    horizon: number
  ): number[] {

    const lastValue = currentData[currentData.length - 1].value;
    const slope = trendAnalysis.slope || 0;

    // Apply exponential decay weighting to recent trends
    const recentWeight = 0.7; // Give more weight to recent trends
    const adjustedSlope = slope * recentWeight;

    const predictions: number[] = [];
    for (let i = 1; i <= horizon; i++) {
      const prediction = Math.max(0, lastValue + (adjustedSlope * i));
      predictions.push(prediction);
    }

    return predictions;
  }

  /**
   * Generate seasonal predictions based on detected cycles
   */
  private static generateSeasonalPredictions(
    currentData: any[],
    seasonalAnalysis: any,
    horizon: number
  ): number[] {

    if (!seasonalAnalysis.seasonalityDetected || !seasonalAnalysis.cyclePeriod) {
      // Fallback to simple moving average
      const recentValues = currentData.slice(-4).map(d => d.value);
      const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      return Array(horizon).fill(avg);
    }

    const cyclePeriod = seasonalAnalysis.cyclePeriod;
    const values = currentData.map(d => d.value);
    const predictions: number[] = [];

    for (let i = 1; i <= horizon; i++) {
      const futurePosition = (currentData.length + i - 1) % cyclePeriod;

      // Find historical values at same seasonal position
      const historicalValues = [];
      for (let j = futurePosition; j < values.length; j += cyclePeriod) {
        historicalValues.push(values[j]);
      }

      if (historicalValues.length > 0) {
        // Weight recent cycles more heavily
        const weightedSum = historicalValues.reduce((sum, val, idx) => {
          const weight = Math.pow(0.8, historicalValues.length - idx - 1);
          return sum + (val * weight);
        }, 0);
        const weightSum = historicalValues.reduce((sum, _, idx) => {
          return sum + Math.pow(0.8, historicalValues.length - idx - 1);
        }, 0);

        predictions.push(weightedSum / weightSum);
      } else {
        // Fallback to recent average
        const recentAvg = values.slice(-Math.min(4, values.length))
          .reduce((sum, val) => sum + val, 0) / Math.min(4, values.length);
        predictions.push(recentAvg);
      }
    }

    return predictions;
  }

  /**
   * Generate YoY-based predictions
   */
  private static generateYoYPredictions(
    currentData: any[],
    previousYearData: any[],
    horizon: number
  ): number[] {

    if (previousYearData.length === 0) {
      // Fallback to current trend
      const recentValues = currentData.slice(-4).map(d => d.value);
      const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      return Array(horizon).fill(avg);
    }

    const predictions: number[] = [];
    const lastCurrentWeek = currentData[currentData.length - 1];

    // Calculate YoY growth rate for context
    const yoyGrowthRates: number[] = [];
    for (const currentPoint of currentData) {
      const prevYearPoint = previousYearData.find(d => d.weekNumber === currentPoint.weekNumber);
      if (prevYearPoint && prevYearPoint.value > 0) {
        const growthRate = (currentPoint.value - prevYearPoint.value) / prevYearPoint.value;
        yoyGrowthRates.push(growthRate);
      }
    }

    // Use weighted average of recent YoY growth rates
    const recentGrowthRates = yoyGrowthRates.slice(-6); // Last 6 weeks
    const avgGrowthRate = recentGrowthRates.length > 0
      ? recentGrowthRates.reduce((sum, rate) => sum + rate, 0) / recentGrowthRates.length
      : 0;

    for (let i = 1; i <= horizon; i++) {
      const futureWeekNumber = lastCurrentWeek.weekNumber + i;
      const adjustedWeekNumber = futureWeekNumber > 52 ? futureWeekNumber - 52 : futureWeekNumber;

      // Find corresponding previous year week
      const prevYearWeek = previousYearData.find(d => d.weekNumber === adjustedWeekNumber);

      if (prevYearWeek) {
        // Apply average YoY growth rate to previous year data
        const prediction = prevYearWeek.value * (1 + avgGrowthRate);
        predictions.push(Math.max(0, prediction));
      } else {
        // Fallback to trend from current data
        const recentAvg = currentData.slice(-4).map(d => d.value)
          .reduce((sum, val) => sum + val, 0) / 4;
        predictions.push(recentAvg);
      }
    }

    return predictions;
  }

  /**
   * Generate momentum-based predictions using exponentially weighted moving average
   */
  private static generateMomentumPredictions(
    currentData: any[],
    horizon: number
  ): number[] {

    const values = currentData.map(d => d.value);
    const alpha = 0.3; // Exponential smoothing parameter

    // Calculate EWMA
    let ewma = values[0];
    for (let i = 1; i < values.length; i++) {
      ewma = alpha * values[i] + (1 - alpha) * ewma;
    }

    // Calculate momentum (rate of change in EWMA)
    const recentValues = values.slice(-4);
    const recentEwma: number[] = [];
    let tempEwma = recentValues[0];
    recentEwma.push(tempEwma);

    for (let i = 1; i < recentValues.length; i++) {
      tempEwma = alpha * recentValues[i] + (1 - alpha) * tempEwma;
      recentEwma.push(tempEwma);
    }

    // Calculate momentum as slope of recent EWMA
    const momentum = recentEwma.length > 1
      ? (recentEwma[recentEwma.length - 1] - recentEwma[0]) / (recentEwma.length - 1)
      : 0;

    // Generate predictions
    const predictions: number[] = [];
    for (let i = 1; i <= horizon; i++) {
      const prediction = Math.max(0, ewma + (momentum * i));
      predictions.push(prediction);
    }

    return predictions;
  }

  /**
   * Combine ensemble predictions using weighted average
   */
  private static combineEnsemblePredictions(
    trendPredictions: number[],
    seasonalPredictions: number[],
    yoyPredictions: number[],
    momentumPredictions: number[],
    weights: PredictionWeights,
    currentData: any[]
  ): SmartPredictionWeek[] {

    const lastWeek = currentData[currentData.length - 1];
    const predictions: SmartPredictionWeek[] = [];

    for (let i = 0; i < trendPredictions.length; i++) {
      const trendValue = trendPredictions[i];
      const seasonalValue = seasonalPredictions[i];
      const yoyValue = yoyPredictions[i];
      const momentumValue = momentumPredictions[i];

      // Ensure positive values for geometric mean (add small epsilon to avoid log(0))
      const safeTrendValue = Math.max(0.1, trendValue);
      const safeSeasonalValue = Math.max(0.1, seasonalValue);
      const safeYoyValue = Math.max(0.1, yoyValue);
      const safeMomentumValue = Math.max(0.1, momentumValue);

      // Nonlinear ensemble prediction using geometric mean
      // This approach reduces the impact of outlier predictions and provides
      // more balanced weighting when predictions vary significantly
      const predictedValue = Math.pow(
        (Math.pow(safeTrendValue, weights.trend) *
          Math.pow(safeSeasonalValue, weights.seasonal) *
          Math.pow(safeYoyValue, weights.yearOverYear) *
          Math.pow(safeMomentumValue, weights.momentum)),
        1 / (weights.trend + weights.seasonal + weights.yearOverYear + weights.momentum)
      );

      // Calculate confidence based on prediction agreement
      const predictions_array = [trendValue, seasonalValue, yoyValue, momentumValue];
      const mean = predictions_array.reduce((sum, val) => sum + val, 0) / predictions_array.length;
      const variance = predictions_array.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / predictions_array.length;
      const stdDev = Math.sqrt(variance);
      const confidence = Math.max(0.1, Math.min(1.0, 1 - (stdDev / mean)));

      // Outlier Detection
      const anomalyLikely = this.detectPredictionAnomaly(
        predictedValue,
        [safeTrendValue, safeSeasonalValue, safeYoyValue, safeMomentumValue],
        confidence,
        mean,
        stdDev
      );

      // Calculate future week details
      const futureWeekNumber = lastWeek.weekNumber + i + 1;
      const futureYear = futureWeekNumber > 52 ? lastWeek.year + 1 : lastWeek.year;
      const adjustedWeekNumber = futureWeekNumber > 52 ? futureWeekNumber - 52 : futureWeekNumber;

      // Calculate future dates
      const lastDate = new Date(lastWeek.weekStartDate);
      const futureStartDate = new Date(lastDate.getTime() + (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const futureEndDate = new Date(futureStartDate.getTime() + 6 * 24 * 60 * 60 * 1000);

      predictions.push({
        weekNumber: adjustedWeekNumber,
        year: futureYear,
        predictedValue: Math.max(0, predictedValue),
        confidence,
        contributingFactors: {
          // For geometric mean, show the weighted logarithmic contribution
          // This represents each method's proportional influence in log space
          trend: weights.trend * Math.log(safeTrendValue),
          seasonal: weights.seasonal * Math.log(safeSeasonalValue),
          yoy: weights.yearOverYear * Math.log(safeYoyValue),
          momentum: weights.momentum * Math.log(safeMomentumValue)
        },
        weekStartDate: futureStartDate.toISOString().split('T')[0],
        weekEndDate: futureEndDate.toISOString().split('T')[0],
        isPrediction: true,
        anomalyLikely
      });
    }

    return predictions;
  }

  /**
   * Calculate comparison metrics
   */
  private static calculateComparisonMetrics(
    predictions: SmartPredictionWeek[],
    previousYearData: any[],
    trendPredictions: number[],
    seasonalPredictions: number[]
  ): { predictedVsPrevious: number; seasonalExpectation: number; trendProjection: number } {

    // Calculate average predicted vs previous year same weeks
    let predictedVsPrevious = 0;
    let matchingWeeks = 0;

    for (const prediction of predictions) {
      const prevYearWeek = previousYearData.find(d => d.weekNumber === prediction.weekNumber);
      if (prevYearWeek && prevYearWeek.value > 0) {
        predictedVsPrevious += (prediction.predictedValue - prevYearWeek.value) / prevYearWeek.value;
        matchingWeeks++;
      }
    }

    predictedVsPrevious = matchingWeeks > 0 ? (predictedVsPrevious / matchingWeeks) * 100 : 0;

    // Calculate seasonal expectation (average of seasonal predictions)
    const seasonalExpectation = seasonalPredictions.reduce((sum, val) => sum + val, 0) / seasonalPredictions.length;

    // Calculate trend projection (average of trend predictions)
    const trendProjection = trendPredictions.reduce((sum, val) => sum + val, 0) / trendPredictions.length;

    return {
      predictedVsPrevious,
      seasonalExpectation,
      trendProjection
    };
  }

  /**
   * Determine the dominant prediction factor
   */
  private static getDominantFactor(weights: PredictionWeights): 'trend' | 'seasonal' | 'yearOverYear' | 'momentum' {
    const weightEntries = Object.entries(weights) as [keyof PredictionWeights, number][];
    const maxWeight = weightEntries.reduce((max, [key, value]) => value > max.value ? { key, value } : max, { key: 'trend' as keyof PredictionWeights, value: 0 });

    return maxWeight.key === 'yearOverYear' ? 'yearOverYear' : maxWeight.key;
  }

  /**
   * Calculate overall confidence level
   */
  private static calculateOverallConfidence(weights: PredictionWeights, dataLength: number): 'high' | 'medium' | 'low' {
    // Weight by strength of each component
    const weightedConfidence =
      (weights.trend * 0.8) +      // Trend is generally reliable
      (weights.seasonal * 0.9) +   // Seasonal patterns are strong when detected
      (weights.yearOverYear * 0.7) + // YoY can be noisy
      (weights.momentum * 0.6);    // Momentum is shorter-term

    // Adjust for data length
    const dataLengthFactor = Math.min(1.0, dataLength / 12); // More data = higher confidence
    const finalConfidence = weightedConfidence * dataLengthFactor;

    if (finalConfidence > 0.75) return 'high';
    if (finalConfidence > 0.5) return 'medium';
    return 'low';
  }

  /**
   * Backtest predictions by running forecasts on historical data
   * This helps evaluate and improve prediction accuracy over time
   */
  /**
   * Backtest predictions by rewinding 4 weeks and comparing forecast vs actual
   * Tracks RMSE and MAPE for each prediction method
   */
  static backtestPredictions(
    allData: Array<{
      weekNumber: number;
      year: number;
      value: number;
      weekStartDate: string;
      weekEndDate: string;
    }>,
    previousYearData: Array<{
      weekNumber: number;
      year: number;
      value: number;
      weekStartDate: string;
      weekEndDate: string;
    }>,
    backtestWeeks: number = 8 // Test last 8 weeks
  ): BacktestResult {

    const methodErrors = {
      trend: [] as number[],
      seasonal: [] as number[],
      momentum: [] as number[],
      yoy: [] as number[]
    };

    const ensembleErrors: number[] = [];
    let totalTests = 0;

    // Rewind 4 weeks at a time to generate predictions and compare
    for (let rewindWeeks = 4; rewindWeeks <= Math.min(backtestWeeks, allData.length - 8); rewindWeeks += 4) {
      // Split data at the rewind point
      const trainingData = allData.slice(0, allData.length - rewindWeeks);
      const testData = allData.slice(allData.length - rewindWeeks, allData.length - rewindWeeks + 4);

      if (trainingData.length < 8 || testData.length === 0) continue;

      try {
        // Generate predictions using only training data
        const trendAnalysis = this.calculateBasicTrend(trainingData);
        const seasonalAnalysis = this.calculateBasicSeasonal(trainingData);

        const weights = this.calculateDynamicWeights(
          trainingData,
          trendAnalysis,
          seasonalAnalysis,
          previousYearData.length > 0
        );

        // Generate individual method predictions
        const trendPreds = this.generateTrendPredictions(trainingData, trendAnalysis, 4);
        const seasonalPreds = this.generateSeasonalPredictions(trainingData, seasonalAnalysis, 4);
        const yoyPreds = this.generateYoYPredictions(trainingData, previousYearData, 4);
        const momentumPreds = this.generateMomentumPredictions(trainingData, 4);

        // Calculate ensemble predictions
        const ensemblePreds = this.combineEnsemblePredictions(
          trendPreds, seasonalPreds, yoyPreds, momentumPreds, weights, trainingData
        );

        // Compare against actual values for available test data
        for (let i = 0; i < Math.min(testData.length, 4); i++) {
          const actual = testData[i].value;
          if (actual > 0) { // Valid actual value
            // Calculate MAPE for each method
            if (trendPreds[i] > 0) {
              methodErrors.trend.push(Math.abs((actual - trendPreds[i]) / actual) * 100);
            }
            if (seasonalPreds[i] > 0) {
              methodErrors.seasonal.push(Math.abs((actual - seasonalPreds[i]) / actual) * 100);
            }
            if (yoyPreds[i] > 0) {
              methodErrors.yoy.push(Math.abs((actual - yoyPreds[i]) / actual) * 100);
            }
            if (momentumPreds[i] > 0) {
              methodErrors.momentum.push(Math.abs((actual - momentumPreds[i]) / actual) * 100);
            }

            // Ensemble MAPE
            const ensembleValue = ensemblePreds[i]?.predictedValue || 0;
            if (ensembleValue > 0) {
              ensembleErrors.push(Math.abs((actual - ensembleValue) / actual) * 100);
            }

            totalTests++;
          }
        }
      } catch (error) {
        console.warn('Backtest error for rewind week', rewindWeeks, error);
      }
    }

    // Calculate accuracy metrics (1 - MAPE/100)
    const calculateAccuracy = (errors: number[]): number => {
      if (errors.length === 0) return 0.5; // Default moderate accuracy
      const avgMAPE = errors.reduce((sum, err) => sum + err, 0) / errors.length;
      return Math.max(0, Math.min(1, 1 - (avgMAPE / 100)));
    };

    const calculateRMSE = (errors: number[]): number => {
      if (errors.length === 0) return 0;
      const mse = errors.reduce((sum, err) => sum + err * err, 0) / errors.length;
      return Math.sqrt(mse);
    };

    const calculateMAPE = (errors: number[]): number => {
      if (errors.length === 0) return 0;
      return errors.reduce((sum, err) => sum + err, 0) / errors.length;
    };

    return {
      accuracy: {
        trend: calculateAccuracy(methodErrors.trend),
        seasonal: calculateAccuracy(methodErrors.seasonal),
        momentum: calculateAccuracy(methodErrors.momentum),
        yoy: calculateAccuracy(methodErrors.yoy)
      },
      averageRMSE: calculateRMSE(ensembleErrors),
      averageMAPE: calculateMAPE(ensembleErrors),
      totalTests,
      methodRMSE: {
        trend: calculateRMSE(methodErrors.trend),
        seasonal: calculateRMSE(methodErrors.seasonal),
        momentum: calculateRMSE(methodErrors.momentum),
        yoy: calculateRMSE(methodErrors.yoy)
      },
      methodMAPE: {
        trend: calculateMAPE(methodErrors.trend),
        seasonal: calculateMAPE(methodErrors.seasonal),
        momentum: calculateMAPE(methodErrors.momentum),
        yoy: calculateMAPE(methodErrors.yoy)
      }
    };
  }

  /**
   * Helper method for basic trend calculation (for backtesting)
   */
  private static calculateBasicTrend(data: any[]): any {
    if (data.length < 3) return { direction: 'stable', percentage: 0, r2: 0, slope: 0 };

    const values = data.map(d => d.value);
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);

    // Simple linear regression
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * values[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R²
    const yMean = sumY / n;
    const totalSumSquares = values.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const residualSumSquares = values.reduce((sum, val, i) => {
      const predicted = slope * i + intercept;
      return sum + Math.pow(val - predicted, 2);
    }, 0);

    const r2 = totalSumSquares > 0 ? 1 - (residualSumSquares / totalSumSquares) : 0;

    const direction = slope > 0.1 ? 'up' : slope < -0.1 ? 'down' : 'stable';
    const percentage = Math.abs(slope / yMean) * 100;

    return { direction, percentage, r2: Math.max(0, r2), slope };
  }

  /**
   * Helper method for basic seasonal calculation (for backtesting)
   */
  private static calculateBasicSeasonal(data: any[]): any {
    if (data.length < 8) {
      return { seasonalityDetected: false, seasonalStrength: 0 };
    }

    // Simple seasonality check
    const values = data.map(d => d.value);
    let cyclePeriod = 4; // Default 4-week cycle
    let maxCorrelation = 0;

    // Test different cycle periods
    for (let period = 3; period <= Math.min(12, Math.floor(values.length / 2)); period++) {
      let correlation = 0;
      let count = 0;

      for (let i = period; i < values.length; i++) {
        if (values[i] > 0 && values[i - period] > 0) {
          correlation += Math.abs(values[i] - values[i - period]) / values[i];
          count++;
        }
      }

      const avgCorrelation = count > 0 ? 1 - (correlation / count) : 0;
      if (avgCorrelation > maxCorrelation) {
        maxCorrelation = avgCorrelation;
        cyclePeriod = period;
      }
    }

    return {
      seasonalityDetected: maxCorrelation > 0.3,
      seasonalStrength: maxCorrelation,
      cyclePeriod: cyclePeriod,
      primaryCycle: {
        period: cyclePeriod,
        strength: maxCorrelation,
        confidence: maxCorrelation
      }
    };
  }

  /**
   * Detect potential prediction anomalies/outliers
   * Flags predictions that may be unreliable due to:
   * - High standard deviation between prediction methods
   * - Extreme values relative to historical data
   * - Low confidence scores
   */
  private static detectPredictionAnomaly(
    predictedValue: number,
    methodPredictions: number[], // [trend, seasonal, yoy, momentum]
    confidence: number,
    methodMean: number,
    methodStdDev: number
  ): boolean {

    // Flag 1: High disagreement between methods (high standard deviation)
    const cvThreshold = 0.3; // Coefficient of variation threshold
    const coefficientOfVariation = methodMean > 0 ? methodStdDev / methodMean : 0;
    const highDisagreement = coefficientOfVariation > cvThreshold;

    // Flag 2: Low confidence score
    const lowConfidence = confidence < 0.4;

    // Flag 3: Extreme prediction relative to method spread
    const zScore = methodMean > 0 ? Math.abs(predictedValue - methodMean) / methodStdDev : 0;
    const extremePrediction = zScore > 2.0; // More than 2 standard deviations

    // Flag 4: Individual method predictions with extreme outliers
    const methodMedian = this.calculateMedian(methodPredictions);
    const hasOutlierMethod = methodPredictions.some(pred => {
      if (methodMedian <= 0) return false;
      const methodZScore = Math.abs(pred - methodMedian) / (methodStdDev || 1);
      return methodZScore > 2.5;
    });

    // Flag 5: Zero or negative predictions when positive expected
    const invalidPrediction = predictedValue <= 0 && methodPredictions.some(p => p > 0);

    // Combine flags - anomaly if multiple conditions are met
    const anomalyFlags = [
      highDisagreement,
      lowConfidence,
      extremePrediction,
      hasOutlierMethod,
      invalidPrediction
    ];

    const flagCount = anomalyFlags.filter(flag => flag).length;

    // Flag as anomaly if 2 or more conditions are met
    return flagCount >= 2;
  }

  /**
   * Helper method to calculate median of an array
   */
  private static calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }

  // Helper methods
  private static calculateTrendConsistency(data: any[]): number {
    if (data.length < 3) return 0.5;

    const values = data.map(d => d.value);
    const changes = [];
    for (let i = 1; i < values.length; i++) {
      const change = values[i] - values[i - 1];
      changes.push(change > 0 ? 1 : change < 0 ? -1 : 0);
    }

    const positiveChanges = changes.filter(c => c > 0).length;
    const negativeChanges = changes.filter(c => c < 0).length;
    const totalChanges = positiveChanges + negativeChanges;

    if (totalChanges === 0) return 0.5;

    const consistency = Math.max(positiveChanges, negativeChanges) / totalChanges;
    return consistency;
  }

  private static calculateYoYConsistency(data: any[]): number {
    // Simplified YoY consistency - could be enhanced based on actual YoY data
    return Math.min(1.0, data.length / 12); // More data points = higher YoY reliability
  }

  private static calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return mean === 0 ? 0 : stdDev / mean;
  }
}
