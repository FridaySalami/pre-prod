/**
 * Example integration of AIPredictionService with existing analytics
 * This shows how to integrate AI-powered predictions into your WeeklyLineChart component
 */

import { AIPredictionService, type AIPredictionResult } from '$lib/services/aiPredictionService';

// Example usage in a component
export class PredictionIntegration {

  /**
   * Generate AI predictions for weekly chart data
   */
  static async generateWeeklyAIPredictions(
    weeklyData: any, // Your existing weekly data structure
    config: any // Your existing config
  ): Promise<AIPredictionResult | null> {

    try {
      // Transform your existing data structure to match AI service requirements
      const currentData = weeklyData.data.map((week: any) => ({
        weekNumber: week.weekNumber,
        year: week.year,
        value: week.value,
        weekStartDate: week.weekStartDate,
        weekEndDate: week.weekEndDate
      }));

      const previousYearData = weeklyData.yearOverYearData?.map((week: any) => ({
        weekNumber: week.weekNumber,
        year: week.year,
        value: week.value,
        weekStartDate: week.weekStartDate,
        weekEndDate: week.weekEndDate
      })) || [];

      // Use your existing trend analysis
      const trendAnalysis = {
        direction: weeklyData.trend.direction,
        percentage: weeklyData.trend.percentage,
        r2: weeklyData.trend.r2,
        slope: weeklyData.trend.slope
      };

      // Use your existing seasonal analysis
      const seasonalAnalysis = {
        seasonalityDetected: weeklyData.seasonalAnalysis?.seasonalityDetected || false,
        seasonalStrength: weeklyData.seasonalAnalysis?.seasonalStrength || 0,
        cyclePeriod: weeklyData.seasonalAnalysis?.cyclePeriod,
        primaryCycle: weeklyData.seasonalAnalysis?.primaryCycle
      };

      // Add business context
      const businessContext = {
        metric: config.selectedMetric,
        industry: 'e-commerce',
        recentEvents: [], // Could be populated from your business events
        marketConditions: 'normal' // Could be dynamically determined
      };

      // Generate AI predictions
      const aiPredictions = await AIPredictionService.generateAIPredictions(
        currentData,
        previousYearData,
        trendAnalysis,
        seasonalAnalysis,
        businessContext,
        4 // 4 weeks ahead
      );

      return aiPredictions;

    } catch (error) {
      console.error('Failed to generate AI predictions:', error);
      return null;
    }
  }

  /**
   * Format AI predictions for chart display
   */
  static formatAIPredictionsForChart(aiPredictions: AIPredictionResult) {
    return {
      // Chart data points
      predictedData: aiPredictions.weeks.map(week => ({
        weekStartDate: week.weekStartDate,
        weekEndDate: week.weekEndDate,
        weekNumber: week.weekNumber,
        year: week.year,
        value: week.predictedValue,
        confidence: week.confidence,
        isPrediction: true,
        isAIPrediction: true,
        contributingFactors: week.contributingFactors
      })),

      // AI insights for display
      insights: {
        summary: AIPredictionService.generateAISummary(aiPredictions),
        patterns: aiPredictions.aiInsights.patterns,
        recommendations: aiPredictions.aiInsights.contextualFactors.recommendations,
        confidence: aiPredictions.aiInsights.confidenceScore,
        dominantFactor: aiPredictions.methodology.dominantFactor
      },

      // Comparison with baseline
      adjustments: aiPredictions.aiAdjustedPredictions?.map(adj => ({
        week: adj.weekNumber,
        originalValue: adj.originalValue,
        adjustedValue: adj.aiAdjustedValue,
        adjustmentFactor: adj.adjustmentFactor,
        reason: adj.adjustmentReason
      }))
    };
  }

  /**
   * Create prediction confidence bands for chart visualization
   */
  static createConfidenceBands(aiPredictions: AIPredictionResult) {
    return aiPredictions.weeks.map(week => {
      const baseValue = week.predictedValue;
      const confidence = week.confidence;

      // Calculate confidence interval (wider bands for lower confidence)
      const margin = baseValue * (1 - confidence) * 0.5;

      return {
        weekNumber: week.weekNumber,
        weekStartDate: week.weekStartDate,
        upper: baseValue + margin,
        lower: Math.max(0, baseValue - margin),
        confidence: confidence
      };
    });
  }
}

// Example of how to use in a Svelte component:
/*
<script lang="ts">
  import { PredictionIntegration } from '$lib/services/predictionIntegration';
  
  let aiPredictions = $state<any>(null);
  let showAIPredictions = $state(false);
  
  async function generateAIPredictions() {
    if (!weeklyData) return;
    
    const predictions = await PredictionIntegration.generateWeeklyAIPredictions(
      weeklyData, 
      weeklyConfig
    );
    
    if (predictions) {
      aiPredictions = PredictionIntegration.formatAIPredictionsForChart(predictions);
    }
  }
  
  // In your chart data derivation:
  const extendedChartData = $derived(() => {
    const baseData = chartData();
    
    if (showAIPredictions && aiPredictions) {
      return [...baseData, ...aiPredictions.predictedData];
    }
    
    return baseData;
  });
</script>

<!-- AI Predictions Toggle -->
<Button 
  onclick={() => {
    if (!aiPredictions) {
      generateAIPredictions();
    }
    showAIPredictions = !showAIPredictions;
  }}
  variant={showAIPredictions ? 'default' : 'outline'}
>
  🤖 AI Predictions
</Button>

<!-- AI Insights Display -->
{#if aiPredictions?.insights}
  <div class="ai-insights bg-blue-50 p-4 rounded-lg">
    <h4 class="font-semibold mb-2">AI Insights</h4>
    <p class="text-sm text-gray-600">{aiPredictions.insights.summary}</p>
    
    {#if aiPredictions.insights.recommendations.length > 0}
      <div class="mt-3">
        <h5 class="font-medium text-sm">Recommendations:</h5>
        <ul class="text-xs text-gray-600 mt-1">
          {#each aiPredictions.insights.recommendations as rec}
            <li>• {rec}</li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
{/if}
*/
