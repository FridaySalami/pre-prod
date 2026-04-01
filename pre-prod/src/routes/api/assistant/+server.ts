import { json, error } from '@sveltejs/kit';
import { OpenAI } from 'openai';
import type { RequestHandler } from './$types';

// Use runtime environment variables to avoid build-time dependency
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  return new OpenAI({ apiKey });
};

// Define the tools/functions the assistant can use
const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'query_analytics_data',
      description: 'Query analytics data for specific date ranges, channels, or metrics',
      parameters: {
        type: 'object',
        properties: {
          dateRange: {
            type: 'object',
            properties: {
              startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
              endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' }
            },
            description: 'Date range to query'
          },
          channels: {
            type: 'array',
            items: { type: 'string', enum: ['amazon', 'ebay', 'shopify', 'all'] },
            description: 'Sales channels to include'
          },
          metrics: {
            type: 'array',
            items: { type: 'string', enum: ['sales', 'orders', 'labor_efficiency', 'all'] },
            description: 'Metrics to include'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculate_growth_rate',
      description: 'Calculate growth rates between time periods',
      parameters: {
        type: 'object',
        properties: {
          metric: {
            type: 'string',
            description: "The metric to calculate growth for (e.g., 'total_sales', 'labor_efficiency')"
          },
          period1: {
            type: 'string',
            description: 'First period for comparison (YYYY-MM format)'
          },
          period2: {
            type: 'string',
            description: 'Second period for comparison (YYYY-MM format)'
          }
        },
        required: ['metric', 'period1', 'period2']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_performance_insight',
      description: 'Generate specific business insights based on current data patterns',
      parameters: {
        type: 'object',
        properties: {
          focusArea: {
            type: 'string',
            enum: ['overall', 'channels', 'efficiency', 'trends'],
            description: 'Area to focus the insight on'
          }
        },
        required: ['focusArea']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'analyze_statistical_significance',
      description: 'Analyze statistical significance data and provide business insights on best/worst performance periods',
      parameters: {
        type: 'object',
        properties: {
          metricName: {
            type: 'string',
            description: 'Name of the metric being analyzed'
          },
          significance: {
            type: 'string',
            enum: ['substantial', 'moderate', 'minimal'],
            description: 'Statistical significance level'
          },
          bestWeek: {
            type: 'object',
            properties: {
              week: { type: 'string' },
              value: { type: 'string' }
            },
            description: 'Best performing week data'
          },
          worstWeek: {
            type: 'object',
            properties: {
              week: { type: 'string' },
              value: { type: 'string' }
            },
            description: 'Worst performing week data'
          }
        },
        required: ['metricName', 'significance']
      }
    }
  }
];

// Simplified function implementations using chat completions with function calling
async function executeFunction(functionName: string, args: any, analyticsData: any) {
  switch (functionName) {
    case 'query_analytics_data':
      return queryAnalyticsData(args, analyticsData);
    case 'calculate_growth_rate':
      return calculateGrowthRate(args, analyticsData);
    case 'generate_performance_insight':
      return generatePerformanceInsight(args, analyticsData);
    case 'analyze_statistical_significance':
      return analyzeStatisticalSignificance(args, analyticsData);
    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}

function queryAnalyticsData(args: any, analyticsData: any) {
  const { dateRange, channels, metrics } = args;

  let filteredData = analyticsData.dailyData || [];

  if (dateRange) {
    filteredData = filteredData.filter((day: any) => {
      const dayDate = new Date(day.date);
      const start = new Date(dateRange.startDate);
      const end = new Date(dateRange.endDate);
      return dayDate >= start && dayDate <= end;
    });
  }

  const result = {
    period: dateRange || analyticsData.selectedPeriod,
    totalDays: filteredData.length,
    totalSales: filteredData.reduce((sum: number, day: any) => sum + (day.total_sales || 0), 0),
    totalOrders: filteredData.reduce((sum: number, day: any) => sum + (day.linnworks_total_orders || 0), 0),
    avgLaborEfficiency:
      filteredData.length > 0
        ? filteredData.reduce((sum: number, day: any) => sum + (day.labor_efficiency || 0), 0) /
        filteredData.length
        : 0,
    channelBreakdown: {
      amazon: filteredData.reduce((sum: number, day: any) => sum + (day.amazon_sales || 0), 0),
      ebay: filteredData.reduce((sum: number, day: any) => sum + (day.ebay_sales || 0), 0),
      shopify: filteredData.reduce((sum: number, day: any) => sum + (day.shopify_sales || 0), 0)
    }
  };

  return result;
}

function calculateGrowthRate(args: any, analyticsData: any) {
  const { metric, period1, period2 } = args;

  // This is a simplified version - in a real implementation, you'd query historical data
  const currentData = analyticsData.dailyData || [];
  const currentValue = currentData.reduce((sum: number, day: any) => sum + (day[metric] || 0), 0);

  // Mock historical comparison (you'd fetch real historical data)
  const mockHistoricalValue = currentValue * 0.85; // Simulate 15% growth
  const growthRate = mockHistoricalValue > 0 ? ((currentValue - mockHistoricalValue) / mockHistoricalValue) * 100 : 0;

  return {
    metric,
    currentPeriod: period2,
    comparisonPeriod: period1,
    currentValue,
    historicalValue: mockHistoricalValue,
    growthRate: growthRate.toFixed(2) + '%',
    trend: growthRate > 0 ? 'increasing' : growthRate < 0 ? 'decreasing' : 'stable'
  };
}

function generatePerformanceInsight(args: any, analyticsData: any) {
  const { focusArea } = args;

  const summary = analyticsData.summary || {};
  const dailyData = analyticsData.dailyData || [];

  switch (focusArea) {
    case 'overall':
      return {
        type: 'overall_performance',
        insights: [
          `Total sales for the period: £${summary.avgDailySales ? (summary.avgDailySales * dailyData.length).toFixed(2) : 0}`,
          `Average daily sales: £${summary.avgDailySales?.toFixed(2) || 0}`,
          `Average daily orders: ${summary.avgDailyOrders?.toFixed(0) || 0}`,
          `Labor efficiency: ${summary.avgLaborEfficiency?.toFixed(2) || 0} shipments/hour`
        ]
      };

    case 'channels':
      const channelData =
        dailyData.length > 0
          ? {
            amazon: dailyData.reduce((sum: number, day: any) => sum + (day.amazon_sales || 0), 0),
            ebay: dailyData.reduce((sum: number, day: any) => sum + (day.ebay_sales || 0), 0),
            shopify: dailyData.reduce((sum: number, day: any) => sum + (day.shopify_sales || 0), 0)
          }
          : { amazon: 0, ebay: 0, shopify: 0 };

      const totalChannelSales = channelData.amazon + channelData.ebay + channelData.shopify;

      return {
        type: 'channel_performance',
        breakdown: channelData,
        insights: [
          `Amazon represents ${totalChannelSales > 0 ? ((channelData.amazon / totalChannelSales) * 100).toFixed(1) : 0}% of sales`,
          `eBay represents ${totalChannelSales > 0 ? ((channelData.ebay / totalChannelSales) * 100).toFixed(1) : 0}% of sales`,
          `Shopify represents ${totalChannelSales > 0 ? ((channelData.shopify / totalChannelSales) * 100).toFixed(1) : 0}% of sales`
        ]
      };

    default:
      return { type: focusArea, insight: 'Analysis completed' };
  }
}

function analyzeStatisticalSignificance(args: any, analyticsData: any) {
  const { metricName, significance, bestWeek, worstWeek } = args;

  // Extract additional context from analyticsData
  const primaryMessage = analyticsData.primaryMessage || '';
  const keyFindings = analyticsData.keyFindings || [];
  const businessContext = analyticsData.businessContext || {};
  const dataPoints = analyticsData.dataPoints || [];
  const totalDataPoints = analyticsData.totalDataPoints || 0;
  const operatingDaysCount = analyticsData.operatingDaysCount || dataPoints.length;

  // Helper function to check if a data point is likely from a Sunday
  function isSundayDataPoint(point: any): boolean {
    if (!point.week) return false;

    const weekStr = point.week.toLowerCase();

    // Check for explicit Sunday mentions
    if (weekStr.includes('sunday') || weekStr.includes('sun')) {
      return true;
    }

    // Check for zero/very low sales which might indicate non-operating day
    if (point.value !== undefined && point.value <= 0) {
      return true;
    }

    return false;
  }

  // Filter out Sunday data points (business is closed)
  const operatingDayPoints = dataPoints.filter((point: any) => !isSundayDataPoint(point));

  // Generate contextual insights based on the statistical significance
  const insights = [];

  // Business-focused significance insights (more concise)
  if (significance === 'substantial') {
    insights.push('⚠️ Significant change detected - review and action recommended');
  } else if (significance === 'moderate') {
    insights.push('📊 Moderate change observed - monitor trend closely');
  } else if (significance === 'minimal') {
    insights.push('✓ Minor variation within normal range');
  }

  // Best/Worst analysis (excluding Sundays)
  if (bestWeek && worstWeek) {
    // Check if these are Sunday data points
    const isBestSunday = isSundayDataPoint({ week: bestWeek.week, value: extractNumericValue(bestWeek.value) });
    const isWorstSunday = isSundayDataPoint({ week: worstWeek.week, value: extractNumericValue(worstWeek.value) });

    if (!isBestSunday) {
      insights.push(`🏆 Peak: ${bestWeek.week} (${bestWeek.value})`);
    }

    if (!isWorstSunday) {
      insights.push(`📉 Low: ${worstWeek.week} (${worstWeek.value})`);
    }

    // Performance gap analysis (only for operating days)
    if (!isBestSunday && !isWorstSunday) {
      const bestValue = extractNumericValue(bestWeek.value);
      const worstValue = extractNumericValue(worstWeek.value);

      if (bestValue && worstValue && bestValue > 0 && worstValue > 0) {
        const difference = ((bestValue - worstValue) / worstValue) * 100;
        if (difference > 50) {
          insights.push('� High performance variation - investigate consistency factors');
        } else if (difference > 25) {
          insights.push('📈 Moderate performance range - room for optimization');
        }
      }
    }
  }

  // Data quality insight (focus on operating days)
  if (operatingDaysCount >= 10) {
    insights.push(`✅ Strong data confidence (${operatingDaysCount} operating days)`);
  } else if (operatingDaysCount >= 5) {
    insights.push(`⚠️ Moderate confidence (${operatingDaysCount} operating days) - extend analysis period for better insights`);
  } else {
    insights.push(`❓ Limited data (${operatingDaysCount} operating days) - results preliminary`);
  }

  // Business recommendations (concise and actionable)
  const recommendations = [];

  if (significance === 'substantial') {
    if (keyFindings.some((finding: string) => finding.toLowerCase().includes('increased'))) {
      recommendations.push('🎯 Replicate success factors from high-performing periods');
    }
    if (keyFindings.some((finding: string) => finding.toLowerCase().includes('decreased'))) {
      recommendations.push('🔧 Investigate root causes and implement corrective actions');
    }
  } else if (significance === 'moderate') {
    recommendations.push('� Continue monitoring trend for 2-3 more weeks');
  }

  // Add business context note about Sundays
  if (dataPoints.some((point: any) =>
    point.week?.toLowerCase().includes('sunday') ||
    point.week?.toLowerCase().includes('sun')
  )) {
    insights.push('ℹ️ Sunday data excluded (business closed)');
  }

  return {
    type: 'business_insights',
    metric: metricName,
    significance: significance,
    insights: insights,
    recommendations: recommendations,
    operatingDaysAnalyzed: operatingDaysCount,
    summary: `${metricName} analysis: ${significance} significance across ${operatingDaysCount} operating days`
  };
}

// Helper function to extract numeric values from formatted strings
function extractNumericValue(formattedValue: string): number | null {
  if (!formattedValue) return null;

  // Remove currency symbols, commas, and other formatting
  const numericString = formattedValue.replace(/[£$,\s]/g, '');
  const match = numericString.match(/[\d.]+/);

  return match ? parseFloat(match[0]) : null;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { message, analyticsData } = await request.json();

    const openai = getOpenAIClient();

    if (!message) {
      throw error(400, 'Message is required');
    }

    // Enhanced system prompt for function calling
    const systemPrompt = `You are an advanced business analytics assistant with access to function tools to analyze dashboard data.

BUSINESS CONTEXT:
- The business is CLOSED on Sundays, so zero sales on Sunday should NOT be flagged as concerning
- Normal operating days are Monday-Saturday
- Sunday data points should be excluded from significance analysis
- Focus on actionable business insights rather than technical statistical details

RESPONSE GUIDELINES:
- Keep responses concise and business-focused
- Avoid duplicating information already visible in the UI
- When using analyze_statistical_significance, DO NOT repeat the function output verbatim
- Synthesize function results into clear, actionable recommendations
- Prioritize insights that lead to specific business actions
- When providing statistical summaries, focus on business implications not raw statistics

Current Analytics Data:
${JSON.stringify(analyticsData, null, 2)}

You have access to the following tools:
1. query_analytics_data - Query and filter analytics data by date ranges and channels
2. calculate_growth_rate - Calculate growth rates between different time periods  
3. generate_performance_insight - Generate detailed insights for specific business areas
4. analyze_statistical_significance - Analyze statistical significance with business context

IMPORTANT GUIDELINES:
- When using analyze_statistical_significance, provide concise business insights
- Do NOT repeat the function results verbatim - synthesize them into clear recommendations
- Exclude Sunday data from performance analysis (business is closed)
- Focus on actionable insights for Monday-Saturday operations
- Keep responses concise and business-focused

Examples of when to use tools:
- "How did sales perform compared to last month?" → use calculate_growth_rate
- "What's the breakdown by channel?" → use generate_performance_insight with focusArea: "channels"  
- "Show me data for the first week" → use query_analytics_data with appropriate date range
- "Give me an overall summary" → use generate_performance_insight with focusArea: "overall"
- For statistical analysis summaries → use analyze_statistical_significance with proper business context

CRITICAL: When providing statistical analysis summaries, focus on business implications and next steps rather than repeating raw statistical findings.`;

    // Use chat completions with function calling (simpler than Assistants API)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: message
        }
      ],
      tools: tools,
      tool_choice: 'auto',
      max_tokens: 1000,
      temperature: 0.7
    });

    const responseMessage = completion.choices[0]?.message;

    if (!responseMessage) {
      throw error(500, 'No response from OpenAI');
    }

    // Handle function calls
    if (responseMessage.tool_calls) {
      const functionResults = [];
      const toolMessages = [];

      for (const toolCall of responseMessage.tool_calls) {
        if (toolCall.type === 'function') {
          try {
            const functionResult = await executeFunction(
              toolCall.function.name,
              JSON.parse(toolCall.function.arguments),
              analyticsData
            );

            functionResults.push({
              name: toolCall.function.name,
              result: functionResult
            });

            // Add tool message in the correct format
            toolMessages.push({
              role: 'tool' as const,
              tool_call_id: toolCall.id,
              content: JSON.stringify(functionResult)
            });
          } catch (err) {
            functionResults.push({
              name: toolCall.function.name,
              error: (err as Error).message
            });

            // Add error tool message
            toolMessages.push({
              role: 'tool' as const,
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: (err as Error).message })
            });
          }
        }
      }

      // Make a second call to get the final response with function results
      const finalCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: message
          },
          responseMessage, // The assistant message with tool_calls
          ...toolMessages // All the tool response messages
        ],
        max_tokens: 1000,
        temperature: 0.7
      });

      const finalResponse = finalCompletion.choices[0]?.message?.content;

      return json({
        response: finalResponse,
        functionCalls: functionResults,
        usage: finalCompletion.usage
      });
    }

    // Regular response without function calls
    return json({
      response: responseMessage.content,
      usage: completion.usage
    });
  } catch (err) {
    console.error('OpenAI Assistant API error:', err);

    if (err instanceof Error) {
      if (err.message.includes('API key')) {
        throw error(500, 'Invalid API key configuration');
      }
      if (err.message.includes('quota')) {
        throw error(429, 'API quota exceeded');
      }
    }

    throw error(500, 'Failed to get AI assistant response');
  }
};
