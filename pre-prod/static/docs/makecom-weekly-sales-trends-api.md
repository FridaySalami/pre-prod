# Make.com Weekly Sales Trends API Documentation

## Overview

The Weekly Sales Trends API endpoint provides comprehensive weekly data analysis for all metrics used by the WeeklyLineChart component. This endpoint is specifically designed for Make.com automation consumption, providing structured JSON output with business intelligence insights.

## Endpoint

```
GET /api/makecom/weekly-sales-trends
```

## Parameters

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `metric` | string | No | `total_sales` | The metric to analyze |
| `weeks` | number | No | `13` | Number of weeks to analyze (13-52, minimum 13 for significance analysis) |
| `endDate` | string | No | current date | End date in YYYY-MM-DD format |

### Valid Metrics

- `total_sales` - Total sales across all channels
- `amazon_sales` - Amazon marketplace sales
- `ebay_sales` - eBay marketplace sales  
- `shopify_sales` - Shopify store sales
- `linnworks_total_orders` - Total order count from Linnworks
- `labor_efficiency` - Labor efficiency metric (items/hour)

## Example Requests

```bash
# Get default total sales for last 13 weeks (minimum for significance analysis)
GET /api/makecom/weekly-sales-trends

# Get Amazon sales for last 16 weeks
GET /api/makecom/weekly-sales-trends?metric=amazon_sales&weeks=16

# Get eBay sales up to specific date
GET /api/makecom/weekly-sales-trends?metric=ebay_sales&endDate=2025-06-15

# Get labor efficiency for last 24 weeks
GET /api/makecom/weekly-sales-trends?metric=labor_efficiency&weeks=24
```

## Important Notes

### Minimum Data Requirements

The endpoint requires a **minimum of 13 weeks** of data for proper statistical significance analysis. This is because:

- Statistical tests need sufficient sample size for reliable results
- Trend analysis requires at least 12 complete weeks plus current week data
- Significance calculations depend on having enough data points to detect meaningful patterns

If you request fewer than 13 weeks, the API will return a validation error. If the database contains fewer than 13 weeks of data, the API will return the available data but mark it as insufficient for full analysis.

## Testing the Endpoint

You can test the endpoint using curl:

```bash
# Test with curl and format JSON
curl "http://localhost:3003/api/makecom/weekly-sales-trends" | jq '.'

# Test validation - should return error
curl "http://localhost:3003/api/makecom/weekly-sales-trends?weeks=12" | jq '.error'

# Test specific sections
curl "http://localhost:3003/api/makecom/weekly-sales-trends" | jq '.data.automation'
curl "http://localhost:3003/api/makecom/weekly-sales-trends" | jq '.meta'

# Test with different metrics
curl "http://localhost:3003/api/makecom/weekly-sales-trends?metric=amazon_sales&weeks=16" | jq '.data.metric'
```

## Response Structure

### Success Response

```json
{
  "success": true,
  "error": null,
  "data": {
    "metric": {
      "key": "total_sales",
      "displayName": "Total Sales",
      "unit": "GBP"
    },
    "timeSeries": {
      "dataPoints": [
        {
          "weekIdentifier": "2025-W01",
          "weekNumber": 1,
          "year": 2025,
          "weekStartDate": "2024-12-30",
          "weekEndDate": "2025-01-05",
          "value": 45000,
          "formattedValue": "£45,000",
          "dailyAverage": 6428.57,
          "workingDays": 7,
          "isCurrentWeek": false,
          "weekIndex": 1,
          "isFirstWeek": true,
          "isLastWeek": false
        }
        // ... more data points
      ],
      "totalWeeks": 12,
      "dateRange": {
        "startDate": "2024-12-30",
        "endDate": "2025-06-22",
        "durationDays": 84
      }
    },
    "statistics": {
      "latest": 52000,
      "average": 48500,
      "minimum": 42000,
      "maximum": 56000,
      "latestFormatted": "£52,000",
      "averageFormatted": "£48,500",
      "minimumFormatted": "£42,000",
      "maximumFormatted": "£56,000",
      "weeklyGrowthRate": 8.3,
      "monthlyGrowthRate": 12.5,
      "averageGrowthRate": 2.1,
      "range": 14000,
      "volatilityPercent": 15.2,
      "consistencyScore": 0.75,
      "bestWeek": {
        "weekIdentifier": "2025-W15",
        "value": 56000,
        "formattedValue": "£56,000",
        "weekStartDate": "2025-04-07"
      },
      "worstWeek": {
        "weekIdentifier": "2025-W03",
        "value": 42000,
        "formattedValue": "£42,000",
        "weekStartDate": "2025-01-13"
      }
    },
    "trend": {
      "direction": "up",
      "percentage": 15.8,
      "isStatisticallySignificant": true,
      "trendStrength": 0.82,
      "r2Score": 0.75,
      "consistencyPercent": 83.3,
      "weeklyChanges": [
        {
          "fromWeek": "2025-W01",
          "toWeek": "2025-W02",
          "fromWeekStartDate": "2024-12-30",
          "toWeekStartDate": "2025-01-06",
          "fromValue": 45000,
          "toValue": 47000,
          "absoluteChange": 2000,
          "percentageChange": 4.4,
          "direction": "up"
        }
        // ... more changes
      ],
      "changeSummary": {
        "totalUpWeeks": 9,
        "totalDownWeeks": 2,
        "totalStableWeeks": 0,
        "dominantDirection": "up"
      },
      "significance": {
        "confidence": 0.95,
        "significanceType": "combined",
        "reasons": ["Significant upward trend detected", "High trend consistency"],
        "recommendations": ["Document success factors", "Scale successful strategies"],
        "statisticalMetrics": {
          "percentageChange": 15.8,
          "pValue": 0.01,
          "zScore": 2.8
        }
      }
    },
    "businessInsights": {
      "performanceRating": "excellent",
      "keyFindings": [
        "Significant upward trend of 15.8% detected",
        "High trend consistency (83% of changes in same direction)",
        "Moderate volatility indicates controlled growth (15.2% coefficient of variation)"
      ],
      "recommendedActions": [
        "Document success factors for replication",
        "Scale successful strategies",
        "Maintain momentum through continued monitoring"
      ],
      "riskLevel": "low",
      "quarterlyComparison": null
    },
    "automation": {
      "shouldTriggerAlert": true,
      "alertLevel": "medium",
      "webhookSummary": {
        "metric": "Total Sales",
        "latestValue": "£52,000",
        "trendDirection": "up",
        "trendPercentage": "15.8%",
        "isSignificant": true,
        "weekCount": 12
      },
      "conditions": {
        "isTrendingUp": true,
        "isTrendingDown": false,
        "isStable": false,
        "isHighVolatility": false,
        "isSignificantChange": true,
        "hasEnoughData": true,
        "latestWeekValue": 52000,
        "weeklyGrowthRate": 8.3
      }
    }
  },
  "meta": {
    "generatedAt": "2025-06-26T10:30:00.000Z",
    "requestedMetric": "total_sales",
    "requestedWeeks": 12,
    "actualDataPoints": 12,
    "endDate": "current",
    "hasSignificantTrend": true
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "data": null
}
```

## Data Sections Explained

### 1. Metric Information
Basic information about the requested metric including display name and units.

### 2. Time Series Data
Complete weekly breakdown with:
- Week identifiers (YYYY-WXX format)
- Raw and formatted values
- Working days and daily averages
- Position indicators (first/last week, etc.)

### 3. Statistics
Comprehensive statistical analysis including:
- Core statistics (min, max, average, latest)
- Growth rates (weekly, monthly, average)
- Performance metrics (volatility, consistency)
- Best and worst performing weeks

### 4. Trend Analysis
Detailed trend information including:
- Overall trend direction and magnitude
- Statistical significance testing
- Week-by-week changes
- Trend consistency metrics
- Significance analysis details

### 5. Business Insights
Business-friendly analysis including:
- Performance categorization
- Key findings in plain language
- Recommended actions
- Risk assessment
- Quarterly comparisons (when sufficient data)

### 6. Automation Features
Make.com specific features including:
- Alert trigger conditions
- Webhook-ready summary data
- Boolean conditions for workflow logic
- Alert level classification

## Make.com Integration Examples

### 1. Performance Alert Workflow

Use the `automation.shouldTriggerAlert` and `automation.alertLevel` fields to trigger notifications when significant changes occur.

```javascript
// In Make.com scenario
if (data.automation.shouldTriggerAlert && data.automation.alertLevel === "high") {
  // Send urgent notification
  sendSlackMessage({
    channel: "#alerts",
    message: `🚨 HIGH ALERT: ${data.automation.webhookSummary.metric} ${data.automation.webhookSummary.trendDirection} ${data.automation.webhookSummary.trendPercentage}`
  });
}
```

### 2. Conditional Logic

Use the `automation.conditions` object for conditional workflow logic:

```javascript
// Route based on trend direction
if (data.automation.conditions.isTrendingDown && data.automation.conditions.isSignificantChange) {
  // Execute declining performance workflow
  executeWorkflow("declining-performance");
} else if (data.automation.conditions.isTrendingUp && data.automation.conditions.isSignificantChange) {
  // Execute growth optimization workflow
  executeWorkflow("growth-optimization");
}
```

### 3. Report Generation

Use the comprehensive data for automated report generation:

```javascript
// Generate weekly report
const report = {
  title: `Weekly ${data.metric.displayName} Report`,
  summary: data.automation.webhookSummary,
  keyFindings: data.businessInsights.keyFindings,
  recommendations: data.businessInsights.recommendedActions,
  performanceRating: data.businessInsights.performanceRating,
  statisticalSummary: {
    latest: data.statistics.latestFormatted,
    average: data.statistics.averageFormatted,
    weeklyGrowth: `${data.statistics.weeklyGrowthRate.toFixed(1)}%`,
    trendDirection: data.trend.direction
  }
};
```

### 4. Data Validation

Use the meta information to validate data quality:

```javascript
// Check data quality before processing
if (data.meta.actualDataPoints < 8) {
  console.log("Insufficient data for reliable analysis");
  return;
}

if (!data.automation.conditions.hasEnoughData) {
  console.log("Need more historical data for significance testing");
  return;
}
```

## Error Handling

The API returns appropriate HTTP status codes:

- `200` - Success
- `400` - Bad request (invalid parameters)
- `500` - Internal server error

Always check the `success` field in the response before processing data.

## Rate Limiting

No explicit rate limiting is currently implemented, but reasonable usage is expected for automation workflows.

## Data Freshness

- Data is sourced from the daily_metric_review table
- Current incomplete weeks are excluded from analysis
- Data freshness depends on the underlying data pipeline

## Troubleshooting

### Empty Data Response

If the endpoint returns empty data (`actualDataPoints: 0`), this could be due to:

1. **Database Connection Issues**: Verify Supabase connection and environment variables
2. **Date Range**: The requested date range may not have data available
3. **Metric Availability**: Some metrics may not be populated for all time periods
4. **Current Week Exclusion**: The service excludes the current incomplete week

### Testing Data Availability

Use the debug endpoint to check raw data availability:

```bash
curl "http://localhost:3003/api/debug/data-test" | jq '.'
```

### Expected Data Structure When Empty

When no data is available, the endpoint still returns a valid structure:

```json
{
  "success": true,
  "data": {
    "timeSeries": { "dataPoints": [], "totalWeeks": 0 },
    "businessInsights": { "performanceRating": "insufficient-data" },
    "automation": { "shouldTriggerAlert": false, "conditions": { "hasEnoughData": false } }
  },
  "meta": { "actualDataPoints": 0 }
}
```

## Support

For technical support or feature requests related to this API endpoint, please contact the development team.
