/**
 * AI-Powered Prediction Service
 * Combines statistical analysis with AI pattern recognition for enhanced forecasting
 * Built on top of SmartPredictionService for robust baseline predictions
 */

import { SmartPredictionService, type SmartPrediction, type PredictionWeights } from './smartPredictionService';

export interface AIPredictionInsight {
  pattern: string;
  confidence: number;
  reasoning: string;
  impact: 'positive' | 'negative' | 'neutral';
  magnitude: 'low' | 'medium' | 'high';
}

export interface AIContextualFactors {
  marketConditions: string;
  seasonalNotes: string;
  businessEvents: string[];
  anomalies: string[];
  recommendations: string[];
}

export interface AIPredictionResult extends SmartPrediction {
  aiInsights: {
    patterns: AIPredictionInsight[];
    contextualFactors: AIContextualFactors;
    adjustmentReasoning: string;
    confidenceScore: number;
  };
  aiAdjustedPredictions?: Array<{
    weekNumber: number;
    year: number;
    originalValue: number;
    aiAdjustedValue: number;
    adjustmentFactor: number;
    adjustmentReason: string;
  }>;
}

export class AIPredictionService {

  /**
   * Generate AI-enhanced predictions by combining statistical analysis with AI insights
   */
  static async generateAIPredictions(
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
    businessContext?: {
      metric: string;
      industry: string;
      recentEvents?: string[];
      marketConditions?: string;
    },
    predictionHorizon: number = 4
  ): Promise<AIPredictionResult> {

    // Step 1: Generate baseline statistical predictions
    const baselinePrediction = SmartPredictionService.generatePredictions(
      currentData,
      previousYearData,
      trendAnalysis,
      seasonalAnalysis,
      predictionHorizon
    );

    // Step 2: Analyze data patterns with AI
    const aiInsights = await this.analyzeDataPatternsWithAI(
      currentData,
      previousYearData,
      trendAnalysis,
      seasonalAnalysis,
      baselinePrediction,
      businessContext
    );

    // Step 3: Apply AI adjustments to baseline predictions
    const aiAdjustedPredictions = await this.applyAIAdjustments(
      baselinePrediction,
      aiInsights,
      currentData
    );

    // Step 4: Combine results
    return {
      ...baselinePrediction,
      aiInsights,
      aiAdjustedPredictions,
      // Update the weeks with AI-adjusted values if available
      weeks: aiAdjustedPredictions?.map((adj, index) => ({
        ...baselinePrediction.weeks[index],
        predictedValue: adj.aiAdjustedValue,
        confidence: Math.min(baselinePrediction.weeks[index].confidence, aiInsights.confidenceScore)
      })) || baselinePrediction.weeks
    };
  }

  /**
   * Use AI to analyze data patterns and provide contextual insights
   */
  private static async analyzeDataPatternsWithAI(
    currentData: any[],
    previousYearData: any[],
    trendAnalysis: any,
    seasonalAnalysis: any,
    baselinePrediction: SmartPrediction,
    businessContext?: any
  ): Promise<{
    patterns: AIPredictionInsight[];
    contextualFactors: AIContextualFactors;
    adjustmentReasoning: string;
    confidenceScore: number;
  }> {

    try {
      // Prepare data summary for AI analysis
      const dataSummary = this.prepareDataSummary(
        currentData,
        previousYearData,
        trendAnalysis,
        seasonalAnalysis,
        baselinePrediction
      );

      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Analyze this business data and provide forecasting insights. Focus on:
1. Hidden patterns not captured by statistical methods
2. Business context and market factors
3. Potential risks or opportunities
4. Recommended adjustments to baseline predictions
5. Confidence level in the analysis

Be specific and actionable. The business is closed on Sundays.`,
          analyticsData: {
            ...dataSummary,
            businessContext,
            requestType: 'forecasting_analysis'
          },
          toolsToUse: ['analyze_statistical_significance', 'generate_performance_insight']
        })
      });

      if (!response.ok) {
        throw new Error(`AI analysis failed: ${response.status}`);
      }

      const aiResponse = await response.json();

      // Parse AI response into structured insights
      return this.parseAIResponse(aiResponse.response, baselinePrediction);

    } catch (error) {
      console.error('AI pattern analysis failed:', error);

      // Fallback to basic analysis
      return {
        patterns: [{
          pattern: 'Statistical baseline',
          confidence: 0.7,
          reasoning: 'Using statistical methods only due to AI analysis unavailability',
          impact: 'neutral',
          magnitude: 'medium'
        }],
        contextualFactors: {
          marketConditions: 'Unknown - AI analysis unavailable',
          seasonalNotes: seasonalAnalysis.seasonalityDetected ? 'Seasonal patterns detected' : 'No clear seasonality',
          businessEvents: [],
          anomalies: [],
          recommendations: ['Monitor performance closely', 'Review predictions weekly']
        },
        adjustmentReasoning: 'No AI adjustments applied - using baseline statistical predictions',
        confidenceScore: 0.7
      };
    }
  }

  /**
   * Apply AI-recommended adjustments to baseline predictions
   */
  private static async applyAIAdjustments(
    baselinePrediction: SmartPrediction,
    aiInsights: any,
    currentData: any[]
  ): Promise<Array<{
    weekNumber: number;
    year: number;
    originalValue: number;
    aiAdjustedValue: number;
    adjustmentFactor: number;
    adjustmentReason: string;
  }> | undefined> {

    // Only apply adjustments if AI confidence is reasonable
    if (aiInsights.confidenceScore < 0.6) {
      return undefined;
    }

    const adjustedPredictions = baselinePrediction.weeks.map((week, index) => {
      let adjustmentFactor = 1.0;
      let adjustmentReason = 'No AI adjustment needed';

      // Apply pattern-based adjustments
      for (const pattern of aiInsights.patterns) {
        if (pattern.impact === 'positive' && pattern.magnitude === 'high') {
          adjustmentFactor *= 1.15; // 15% boost for high positive impact
          adjustmentReason = `Positive adjustment: ${pattern.reasoning}`;
        } else if (pattern.impact === 'negative' && pattern.magnitude === 'high') {
          adjustmentFactor *= 0.85; // 15% reduction for high negative impact
          adjustmentReason = `Negative adjustment: ${pattern.reasoning}`;
        } else if (pattern.impact === 'positive' && pattern.magnitude === 'medium') {
          adjustmentFactor *= 1.08; // 8% boost for medium positive impact
          adjustmentReason = `Moderate positive adjustment: ${pattern.reasoning}`;
        } else if (pattern.impact === 'negative' && pattern.magnitude === 'medium') {
          adjustmentFactor *= 0.92; // 8% reduction for medium negative impact
          adjustmentReason = `Moderate negative adjustment: ${pattern.reasoning}`;
        }
      }

      // Cap adjustments to reasonable bounds (±25%)
      adjustmentFactor = Math.max(0.75, Math.min(1.25, adjustmentFactor));

      const originalValue = week.predictedValue;
      const aiAdjustedValue = originalValue * adjustmentFactor;

      return {
        weekNumber: week.weekNumber,
        year: week.year,
        originalValue,
        aiAdjustedValue,
        adjustmentFactor,
        adjustmentReason
      };
    });

    return adjustedPredictions;
  }

  /**
   * Prepare data summary for AI analysis
   */
  private static prepareDataSummary(
    currentData: any[],
    previousYearData: any[],
    trendAnalysis: any,
    seasonalAnalysis: any,
    baselinePrediction: SmartPrediction
  ) {
    // Calculate key statistics
    const currentValues = currentData.map(d => d.value);
    const recentValues = currentValues.slice(-4);
    const previousValues = previousYearData.map(d => d.value);

    const currentAvg = currentValues.reduce((sum, val) => sum + val, 0) / currentValues.length;
    const recentAvg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const previousAvg = previousValues.length > 0
      ? previousValues.reduce((sum, val) => sum + val, 0) / previousValues.length
      : 0;

    // Calculate volatility
    const volatility = this.calculateVolatility(currentValues);

    // Identify potential anomalies
    const anomalies = this.identifyAnomalies(currentData);

    return {
      dataPoints: currentData.length,
      currentPeriodAverage: currentAvg,
      recentTrendAverage: recentAvg,
      previousYearAverage: previousAvg,
      yearOverYearGrowth: previousAvg > 0 ? ((currentAvg - previousAvg) / previousAvg) * 100 : 0,
      volatility,
      trendAnalysis,
      seasonalAnalysis,
      baselinePredictions: baselinePrediction.weeks.map(w => ({
        week: w.weekNumber,
        value: w.predictedValue,
        confidence: w.confidence
      })),
      predictionWeights: baselinePrediction.methodology.weights,
      dominantFactor: baselinePrediction.methodology.dominantFactor,
      anomalies,
      recentPerformance: recentValues,
      dataQuality: {
        completeness: currentData.length / 52, // Assuming weekly data
        consistency: this.calculateConsistency(currentValues),
        recency: this.calculateRecency(currentData)
      }
    };
  }

  /**
   * Parse AI response into structured insights
   */
  private static parseAIResponse(aiResponse: string, baselinePrediction: SmartPrediction): {
    patterns: AIPredictionInsight[];
    contextualFactors: AIContextualFactors;
    adjustmentReasoning: string;
    confidenceScore: number;
  } {
    // This is a simplified parser - in production, you might want more sophisticated NLP
    const patterns: AIPredictionInsight[] = [];

    // Extract patterns from AI response (basic keyword matching)
    if (aiResponse.toLowerCase().includes('growth') || aiResponse.toLowerCase().includes('increase')) {
      patterns.push({
        pattern: 'Growth trend identified',
        confidence: 0.8,
        reasoning: 'AI detected positive growth indicators in the data',
        impact: 'positive',
        magnitude: 'medium'
      });
    }

    if (aiResponse.toLowerCase().includes('decline') || aiResponse.toLowerCase().includes('decrease')) {
      patterns.push({
        pattern: 'Decline trend identified',
        confidence: 0.8,
        reasoning: 'AI detected negative trend indicators in the data',
        impact: 'negative',
        magnitude: 'medium'
      });
    }

    if (aiResponse.toLowerCase().includes('volatile') || aiResponse.toLowerCase().includes('unstable')) {
      patterns.push({
        pattern: 'High volatility detected',
        confidence: 0.7,
        reasoning: 'AI identified high volatility which may affect prediction accuracy',
        impact: 'negative',
        magnitude: 'low'
      });
    }

    // Extract recommendations
    const recommendations: string[] = [];
    if (aiResponse.toLowerCase().includes('monitor')) {
      recommendations.push('Monitor performance closely');
    }
    if (aiResponse.toLowerCase().includes('seasonal')) {
      recommendations.push('Consider seasonal adjustments');
    }

    // Determine confidence score based on baseline prediction confidence
    const avgBaselineConfidence = baselinePrediction.weeks.reduce((sum, w) => sum + w.confidence, 0) / baselinePrediction.weeks.length;
    const confidenceScore = Math.min(0.9, avgBaselineConfidence + 0.1); // Slight boost from AI analysis

    return {
      patterns,
      contextualFactors: {
        marketConditions: 'Analyzed by AI - see patterns for details',
        seasonalNotes: baselinePrediction.methodology.dominantFactor === 'seasonal'
          ? 'Strong seasonal patterns detected'
          : 'Limited seasonal influence',
        businessEvents: [],
        anomalies: patterns.filter(p => p.pattern.includes('volatility')).map(p => p.reasoning),
        recommendations
      },
      adjustmentReasoning: patterns.length > 0
        ? `AI identified ${patterns.length} significant patterns requiring adjustment`
        : 'No significant adjustments needed based on AI analysis',
      confidenceScore
    };
  }

  // Helper methods
  private static calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return mean === 0 ? 0 : stdDev / mean;
  }

  private static identifyAnomalies(data: any[]): Array<{ week: number; value: number; reason: string }> {
    const values = data.map(d => d.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);

    const anomalies: Array<{ week: number; value: number; reason: string }> = [];

    data.forEach((point, index) => {
      const zScore = Math.abs(point.value - mean) / stdDev;
      if (zScore > 2.5) {
        anomalies.push({
          week: point.weekNumber,
          value: point.value,
          reason: point.value > mean ? 'Unusually high value' : 'Unusually low value'
        });
      }
    });

    return anomalies;
  }

  private static calculateConsistency(values: number[]): number {
    if (values.length < 2) return 1;

    const volatility = this.calculateVolatility(values);
    return Math.max(0, 1 - volatility);
  }

  private static calculateRecency(data: any[]): number {
    if (data.length === 0) return 0;

    // Calculate how recent the data is (simple implementation)
    const lastDate = new Date(data[data.length - 1].weekStartDate);
    const now = new Date();
    const daysSinceLastData = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

    // Fresh data (within 7 days) = 1.0, older data gets lower score
    return Math.max(0, Math.min(1, 1 - (daysSinceLastData / 30)));
  }

  /**
   * Generate a human-readable summary of AI predictions
   */
  static generateAISummary(aiPrediction: AIPredictionResult): string {
    const { aiInsights, methodology, weeks } = aiPrediction;

    const avgPrediction = weeks.reduce((sum, w) => sum + w.predictedValue, 0) / weeks.length;
    const avgConfidence = weeks.reduce((sum, w) => sum + w.confidence, 0) / weeks.length;

    let summary = `AI-Enhanced Forecast Summary:\n\n`;
    summary += `📊 Predicted average: ${avgPrediction.toFixed(0)} (${(avgConfidence * 100).toFixed(0)}% confidence)\n`;
    summary += `🎯 Primary factor: ${methodology.dominantFactor}\n`;
    summary += `🤖 AI confidence: ${(aiInsights.confidenceScore * 100).toFixed(0)}%\n\n`;

    if (aiInsights.patterns.length > 0) {
      summary += `Key AI Insights:\n`;
      aiInsights.patterns.forEach(pattern => {
        summary += `• ${pattern.pattern}: ${pattern.reasoning}\n`;
      });
    }

    if (aiInsights.contextualFactors.recommendations.length > 0) {
      summary += `\nRecommendations:\n`;
      aiInsights.contextualFactors.recommendations.forEach(rec => {
        summary += `• ${rec}\n`;
      });
    }

    return summary;
  }
}
