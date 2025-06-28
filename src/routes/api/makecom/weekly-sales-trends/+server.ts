import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { HistoricalDataService } from '$lib/services/historicalDataService';
import type { WeeklyDataRequest, WeeklyDataResponse } from '$lib/types/historicalData';

/**
 * Make.com Weekly Sales Trends Endpoint
 * 
 * Provides comprehensive weekly data for all metrics used by WeeklyLineChart component
 * Returns JSON structure optimized for Make.com automation consumption
 * 
 * Query Parameters:
 * - metric: 'total_sales' | 'amazon_sales' | 'ebay_sales' | 'shopify_sales' | 'linnworks_total_orders' | 'labor_efficiency'
 * - weeks: number of weeks to analyze (default: 13, minimum: 13 for significance analysis, maximum: 52)
 * - endDate: optional end date in YYYY-MM-DD format (defaults to current date)
 */

/**
 * Helper Functions
 */

function getMetricDisplayName(metric: string): string {
  const metricDisplayNames: Record<string, string> = {
    total_sales: 'Total Sales',
    amazon_sales: 'Amazon Sales',
    ebay_sales: 'eBay Sales',
    shopify_sales: 'Shopify Sales',
    linnworks_total_orders: 'Total Orders',
    labor_efficiency: 'Labor Efficiency'
  };
  return metricDisplayNames[metric] || metric;
}

function getMetricUnit(metric: string): string {
  if (metric.includes('sales')) return 'GBP';
  if (metric.includes('orders')) return 'orders';
  if (metric.includes('efficiency')) return 'per hour';
  return 'units';
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    // Parse query parameters
    const metric = url.searchParams.get('metric') || 'total_sales';
    const weeksParam = url.searchParams.get('weeks');
    const endDate = url.searchParams.get('endDate');

    // Validate metric
    const validMetrics = ['total_sales', 'amazon_sales', 'ebay_sales', 'shopify_sales', 'linnworks_total_orders', 'labor_efficiency'];
    if (!validMetrics.includes(metric)) {
      return json({
        success: false,
        error: `Invalid metric. Must be one of: ${validMetrics.join(', ')}`,
        data: null
      }, { status: 400 });
    }

    // Validate weeks parameter
    let weeks = 13; // Default minimum for significance analysis
    if (weeksParam) {
      weeks = parseInt(weeksParam, 10);
      if (isNaN(weeks) || weeks < 13 || weeks > 52) {
        return json({
          success: false,
          error: 'Weeks parameter must be a number between 13 and 52 (minimum 13 weeks required for statistical significance analysis)',
          data: null
        }, { status: 400 });
      }
    }

    // Validate endDate parameter
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return json({
        success: false,
        error: 'End date must be in YYYY-MM-DD format',
        data: null
      }, { status: 400 });
    }

    // Prepare request for HistoricalDataService
    const request: WeeklyDataRequest = {
      metric: metric as any,
      count: weeks,
      ...(endDate && { endDate })
    };

    // Fetch weekly data
    const weeklyData = await HistoricalDataService.fetchWeeklyData(request);

    // Debug logging
    console.log('🔍 Debug weeklyData:', {
      hasData: !!weeklyData,
      dataLength: weeklyData?.data?.length || 0,
      firstDataPoint: weeklyData?.data?.[0] || null,
      metric: weeklyData?.metric,
      trend: weeklyData?.trend
    });

    if (!weeklyData) {
      return json({
        success: false,
        error: 'Failed to fetch weekly data - service returned null',
        data: null
      }, { status: 500 });
    }

    // Check if we have any data points
    if (!weeklyData.data || weeklyData.data.length === 0) {
      return json({
        success: true,
        error: null,
        data: {
          metric: {
            key: metric,
            displayName: getMetricDisplayName(metric),
            unit: getMetricUnit(metric)
          },
          timeSeries: {
            dataPoints: [],
            totalWeeks: 0,
            dateRange: null
          },
          statistics: weeklyData.statistics,
          trend: weeklyData.trend,
          businessInsights: {
            performanceRating: 'insufficient-data',
            keyFindings: ['Insufficient data for analysis'],
            recommendedActions: ['Collect more historical data'],
            riskLevel: 'unknown',
            quarterlyComparison: null
          },
          automation: {
            shouldTriggerAlert: false,
            alertLevel: 'low',
            webhookSummary: {
              metric: getMetricDisplayName(metric),
              latestValue: 'No data',
              trendDirection: 'stable',
              trendPercentage: '0%',
              isSignificant: false,
              weekCount: 0
            },
            conditions: {
              isTrendingUp: false,
              isTrendingDown: false,
              isStable: true,
              isHighVolatility: false,
              isSignificantChange: false,
              hasEnoughData: false,
              latestWeekValue: 0,
              weeklyGrowthRate: 0
            }
          }
        },
        meta: {
          generatedAt: new Date().toISOString(),
          requestedMetric: metric,
          requestedWeeks: weeks,
          actualDataPoints: 0,
          endDate: endDate || 'current',
          hasSignificantTrend: false
        }
      });
    }

    // Debug log to see the actual data structure
    console.log('🔍 Debug weeklyData:', {
      hasData: !!weeklyData,
      dataLength: weeklyData?.data?.length || 0,
      firstDataPoint: weeklyData?.data?.[0] || null,
      metric: weeklyData?.metric,
      trend: weeklyData?.trend
    });

    // Transform data for Make.com consumption
    const makecomData = transformWeeklyDataForMakecom(weeklyData);

    return json({
      success: true,
      error: null,
      data: makecomData,
      meta: {
        generatedAt: new Date().toISOString(),
        requestedMetric: metric,
        requestedWeeks: weeks,
        actualDataPoints: weeklyData.data.length,
        endDate: endDate || 'current',
        hasSignificantTrend: weeklyData.trend.isSignificant
      }
    });

  } catch (error) {
    console.error('Make.com weekly trends endpoint error:', error);
    return json({
      success: false,
      error: 'Internal server error',
      data: null
    }, { status: 500 });
  }
};

/**
 * Transform WeeklyDataResponse into Make.com optimized format
 */
function transformWeeklyDataForMakecom(weeklyData: WeeklyDataResponse) {
  // Format metric name for display
  const metricDisplayNames: Record<string, string> = {
    total_sales: 'Total Sales',
    amazon_sales: 'Amazon Sales',
    ebay_sales: 'eBay Sales',
    shopify_sales: 'Shopify Sales',
    linnworks_total_orders: 'Total Orders',
    labor_efficiency: 'Labor Efficiency'
  };

  // Calculate additional insights
  const dataPoints = weeklyData.data || [];

  // Early return if no data
  if (dataPoints.length === 0) {
    return {
      metric: {
        key: weeklyData.metric,
        displayName: metricDisplayNames[weeklyData.metric] || weeklyData.metric,
        unit: getMetricUnit(weeklyData.metric)
      },
      timeSeries: {
        dataPoints: [],
        totalWeeks: 0,
        dateRange: null
      },
      statistics: weeklyData.statistics || {},
      trend: weeklyData.trend || {},
      businessInsights: {
        performanceRating: 'insufficient-data',
        keyFindings: ['Insufficient data for analysis'],
        recommendedActions: ['Collect more historical data'],
        riskLevel: 'unknown'
      },
      automation: {
        shouldTriggerAlert: false,
        alertLevel: 'low',
        webhookSummary: {
          metric: metricDisplayNames[weeklyData.metric] || weeklyData.metric,
          latestValue: 'No data',
          trendDirection: 'stable',
          trendPercentage: '0%',
          isSignificant: false,
          weekCount: 0
        },
        conditions: {
          isTrendingUp: false,
          isTrendingDown: false,
          isStable: true,
          isHighVolatility: false,
          isSignificantChange: false,
          hasEnoughData: false,
          latestWeekValue: 0,
          weeklyGrowthRate: 0
        }
      }
    };
  }

  const values = dataPoints.map(d => d.value);

  // Find best and worst performing weeks (only if we have data)
  let bestWeek = null;
  let worstWeek = null;

  if (dataPoints.length > 0) {
    const sortedByValue = [...dataPoints].sort((a, b) => b.value - a.value);
    bestWeek = sortedByValue[0];
    worstWeek = sortedByValue[sortedByValue.length - 1];
  }

  // Calculate volatility (coefficient of variation)
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const standardDeviation = Math.sqrt(variance);
  const volatility = mean > 0 ? (standardDeviation / mean) * 100 : 0;

  // Calculate week-over-week changes
  const weeklyChanges = dataPoints.slice(1).map((current, index) => {
    const previous = dataPoints[index];
    const change = current.value - previous.value;
    const changePercent = previous.value > 0 ? (change / previous.value) * 100 : 0;

    return {
      fromWeek: `${previous.year}-W${previous.weekNumber.toString().padStart(2, '0')}`,
      toWeek: `${current.year}-W${current.weekNumber.toString().padStart(2, '0')}`,
      fromWeekStartDate: previous.weekStartDate,
      toWeekStartDate: current.weekStartDate,
      fromValue: previous.value,
      toValue: current.value,
      absoluteChange: change,
      percentageChange: changePercent,
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
    };
  });

  // Check for trend consistency (what percentage of changes go in the same direction)
  const upChanges = weeklyChanges.filter(c => c.direction === 'up').length;
  const downChanges = weeklyChanges.filter(c => c.direction === 'down').length;
  const totalDirectionalChanges = upChanges + downChanges;
  const trendConsistency = totalDirectionalChanges > 0
    ? Math.max(upChanges, downChanges) / totalDirectionalChanges
    : 0;

  // Calculate quarterly comparison (if enough data)
  let quarterlyComparison = null;
  if (dataPoints.length >= 24) { // Need at least 24 weeks for quarterly comparison
    const latestQuarter = dataPoints.slice(-12);
    const previousQuarter = dataPoints.slice(-24, -12);

    const latestQuarterTotal = latestQuarter.reduce((sum, week) => sum + week.value, 0);
    const previousQuarterTotal = previousQuarter.reduce((sum, week) => sum + week.value, 0);

    quarterlyComparison = {
      latestQuarterTotal,
      previousQuarterTotal,
      quarterlyChange: latestQuarterTotal - previousQuarterTotal,
      quarterlyChangePercent: previousQuarterTotal > 0
        ? ((latestQuarterTotal - previousQuarterTotal) / previousQuarterTotal) * 100
        : 0
    };
  }

  return {
    // Basic Information
    metric: {
      key: weeklyData.metric,
      displayName: metricDisplayNames[weeklyData.metric] || weeklyData.metric,
      unit: getMetricUnit(weeklyData.metric)
    },

    // Time Series Data - Weekly breakdown
    timeSeries: {
      dataPoints: dataPoints.map(point => ({
        weekIdentifier: `${point.year}-W${point.weekNumber.toString().padStart(2, '0')}`,
        weekNumber: point.weekNumber,
        year: point.year,
        weekStartDate: point.weekStartDate,
        weekEndDate: point.weekEndDate,
        value: point.value,
        formattedValue: formatValue(point.value, weeklyData.metric),
        dailyAverage: point.dailyAverage,
        workingDays: point.workingDays,
        isCurrentWeek: point.isCurrentWeek,
        // Position in dataset
        weekIndex: dataPoints.indexOf(point) + 1,
        isFirstWeek: dataPoints.indexOf(point) === 0,
        isLastWeek: dataPoints.indexOf(point) === dataPoints.length - 1
      })),
      totalWeeks: dataPoints.length,
      dateRange: {
        startDate: dataPoints[0]?.weekStartDate,
        endDate: dataPoints[dataPoints.length - 1]?.weekEndDate,
        durationDays: dataPoints.length * 7
      }
    },

    // Statistical Summary
    statistics: {
      // Core statistics
      latest: weeklyData.statistics.latest,
      average: weeklyData.statistics.average,
      minimum: weeklyData.statistics.min,
      maximum: weeklyData.statistics.max,

      // Formatted versions
      latestFormatted: formatValue(weeklyData.statistics.latest, weeklyData.metric),
      averageFormatted: formatValue(weeklyData.statistics.average, weeklyData.metric),
      minimumFormatted: formatValue(weeklyData.statistics.min, weeklyData.metric),
      maximumFormatted: formatValue(weeklyData.statistics.max, weeklyData.metric),

      // Growth rates
      weeklyGrowthRate: weeklyData.statistics.weeklyGrowthRate,
      monthlyGrowthRate: weeklyData.statistics.monthlyGrowthRate,
      averageGrowthRate: weeklyData.statistics.averageGrowthRate,

      // Distribution metrics
      range: weeklyData.statistics.max - weeklyData.statistics.min,
      volatilityPercent: volatility,
      consistencyScore: weeklyData.statistics.consistencyScore,

      // Performance identification
      bestWeek: bestWeek ? {
        weekIdentifier: `${bestWeek.year}-W${bestWeek.weekNumber.toString().padStart(2, '0')}`,
        value: bestWeek.value,
        formattedValue: formatValue(bestWeek.value, weeklyData.metric),
        weekStartDate: bestWeek.weekStartDate
      } : null,
      worstWeek: worstWeek ? {
        weekIdentifier: `${worstWeek.year}-W${worstWeek.weekNumber.toString().padStart(2, '0')}`,
        value: worstWeek.value,
        formattedValue: formatValue(worstWeek.value, weeklyData.metric),
        weekStartDate: worstWeek.weekStartDate
      } : null
    },

    // Trend Analysis
    trend: {
      // Overall trend
      direction: weeklyData.trend.direction,
      percentage: weeklyData.trend.percentage,
      isStatisticallySignificant: weeklyData.trend.isSignificant,

      // Trend strength metrics
      trendStrength: weeklyData.trend.trendStrength || 0,
      r2Score: weeklyData.trend.r2 || 0,
      consistencyPercent: trendConsistency * 100,

      // Week-by-week changes
      weeklyChanges,

      // Change summary
      changeSummary: {
        totalUpWeeks: upChanges,
        totalDownWeeks: downChanges,
        totalStableWeeks: weeklyChanges.filter(c => c.direction === 'stable').length,
        dominantDirection: upChanges > downChanges ? 'up' :
          downChanges > upChanges ? 'down' : 'mixed'
      },

      // Significance details (if available)
      significance: weeklyData.trend.significanceDetails ? {
        confidence: weeklyData.trend.significanceDetails.confidence,
        significanceType: weeklyData.trend.significanceDetails.significanceType,
        reasons: weeklyData.trend.significanceDetails.reasons,
        recommendations: weeklyData.trend.significanceDetails.recommendations,
        statisticalMetrics: weeklyData.trend.significanceDetails.metrics
      } : null
    },

    // Business Intelligence
    businessInsights: {
      // Performance categorization
      performanceRating: categorizePerformance(weeklyData.trend.direction, weeklyData.trend.percentage),

      // Key findings
      keyFindings: generateKeyFindings(weeklyData, trendConsistency, volatility),

      // Action items
      recommendedActions: generateActionItems(weeklyData),

      // Risk assessment
      riskLevel: assessRiskLevel(weeklyData.trend.direction, weeklyData.trend.percentage, volatility),

      // Quarterly comparison (if available)
      quarterlyComparison
    },

    // Make.com Specific Features
    automation: {
      // Trigger conditions
      shouldTriggerAlert: weeklyData.trend.isSignificant && Math.abs(weeklyData.trend.percentage) > 10,
      alertLevel: Math.abs(weeklyData.trend.percentage) > 20 ? 'high' :
        Math.abs(weeklyData.trend.percentage) > 10 ? 'medium' : 'low',

      // Webhook ready data
      webhookSummary: {
        metric: metricDisplayNames[weeklyData.metric],
        latestValue: formatValue(weeklyData.statistics.latest, weeklyData.metric),
        trendDirection: weeklyData.trend.direction,
        trendPercentage: `${weeklyData.trend.percentage.toFixed(1)}%`,
        isSignificant: weeklyData.trend.isSignificant,
        weekCount: dataPoints.length
      },

      // For conditional workflows
      conditions: {
        isTrendingUp: weeklyData.trend.direction === 'up',
        isTrendingDown: weeklyData.trend.direction === 'down',
        isStable: weeklyData.trend.direction === 'stable',
        isHighVolatility: volatility > 25,
        isSignificantChange: weeklyData.trend.isSignificant,
        hasEnoughData: dataPoints.length >= 13,
        latestWeekValue: weeklyData.statistics.latest,
        weeklyGrowthRate: weeklyData.statistics.weeklyGrowthRate
      }
    }
  };
}

/**
 * Helper Functions
 */

function formatValue(value: number, metric: string): string {
  if (metric.includes('sales')) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(value);
  } else if (metric.includes('orders')) {
    return value.toString();
  } else if (metric.includes('efficiency')) {
    return `${value.toFixed(1)}/hr`;
  }
  return value.toString();
}

function categorizePerformance(direction: string, percentage: number): string {
  const absPercent = Math.abs(percentage);
  if (direction === 'up') {
    if (absPercent > 15) return 'excellent';
    if (absPercent > 5) return 'good';
    return 'stable-positive';
  } else if (direction === 'down') {
    if (absPercent > 15) return 'concerning';
    if (absPercent > 5) return 'declining';
    return 'stable-negative';
  }
  return 'stable';
}

function assessRiskLevel(direction: string, percentage: number, volatility: number): string {
  const absPercent = Math.abs(percentage);

  if (direction === 'down' && absPercent > 15) return 'high';
  if (direction === 'down' && absPercent > 5) return 'medium';
  if (volatility > 30) return 'medium';
  return 'low';
}

function generateKeyFindings(weeklyData: WeeklyDataResponse, trendConsistency: number, volatility: number): string[] {
  const findings: string[] = [];
  const stats = weeklyData.statistics;
  const trend = weeklyData.trend;

  // Trend finding
  if (trend.isSignificant) {
    findings.push(`Significant ${trend.direction}ward trend of ${trend.percentage.toFixed(1)}% detected`);
  }

  // Consistency finding
  if (trendConsistency > 0.75) {
    findings.push(`High trend consistency (${(trendConsistency * 100).toFixed(0)}% of changes in same direction)`);
  }

  // Volatility finding
  if (volatility > 25) {
    findings.push(`High volatility detected (${volatility.toFixed(1)}% coefficient of variation)`);
  } else if (volatility < 10) {
    findings.push(`Low volatility indicates stable performance (${volatility.toFixed(1)}% coefficient of variation)`);
  }

  // Performance range finding
  const range = stats.max - stats.min;
  const rangePercent = stats.average > 0 ? (range / stats.average) * 100 : 0;
  if (rangePercent > 50) {
    findings.push(`Wide performance range with ${rangePercent.toFixed(0)}% variation from average`);
  }

  return findings;
}

function generateActionItems(weeklyData: WeeklyDataResponse): string[] {
  const actions: string[] = [];
  const trend = weeklyData.trend;

  if (trend.isSignificant) {
    if (trend.direction === 'down' && Math.abs(trend.percentage) > 10) {
      actions.push('Investigate root causes of declining performance');
      actions.push('Implement immediate corrective measures');
      actions.push('Monitor weekly progress closely');
    } else if (trend.direction === 'up' && trend.percentage > 10) {
      actions.push('Document success factors for replication');
      actions.push('Scale successful strategies');
      actions.push('Maintain momentum through continued monitoring');
    }
  }

  if (!trend.isSignificant) {
    actions.push('Continue regular monitoring');
    actions.push('Maintain current operational procedures');
  }

  return actions;
}