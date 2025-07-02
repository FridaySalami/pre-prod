# Enhanced Significance Analysis System

This document explains the advanced significance analysis system implemented for the Historical Lens feature in the analytics dashboard.

## Overview

The significance analysis has been upgraded from a simple 5% threshold to a comprehensive multi-factor analysis system that provides:

1. **Statistical Significance**: Using z-scores and confidence intervals
2. **Trend Analysis**: Consistent direction over multiple periods
3. **Volatility Detection**: Unusual changes relative to historical variation
4. **Business Context**: Metric-specific thresholds and recommendations
5. **Confidence Scoring**: Quantified confidence in the significance determination

## Current vs Enhanced Implementation

### Before (Simple Threshold)
```typescript
const isSignificant = Math.abs(percentageChange) > 5; // 5% threshold
```

### After (Multi-Factor Analysis)
- **Percentage Threshold**: Configurable per metric type
- **Absolute Threshold**: For metrics where absolute change matters
- **Statistical Tests**: Z-score analysis with confidence levels
- **Trend Consistency**: Pattern recognition over multiple periods
- **Volatility Analysis**: Standard deviation-based outlier detection

## Significance Types

### 1. **Practical Significance**
- Basic percentage and absolute thresholds
- **Sales**: 5% change or £1,000 absolute
- **Orders**: 8% change or 10 orders absolute
- **Efficiency**: 6% change or 0.5 shipments/hour absolute

### 2. **Statistical Significance**
- Uses z-score analysis
- Default: 95% confidence level (z > 1.96)
- Requires minimum 4 data points
- Accounts for historical variance

### 3. **Trend Significance**
- Analyzes consistency over 3+ periods
- Significant if >75% of changes in same direction
- Useful for identifying sustained patterns

### 4. **Volatility Significance**
- Detects outliers using standard deviation
- Default threshold: 2σ from normal variation
- Highlights unusual spikes or drops

### 5. **Combined Significance**
- Multiple factors indicate significance
- Higher confidence scores
- Most reliable indicator

## Configuration Options

```typescript
interface SignificanceConfig {
  // Basic thresholds
  percentageThreshold: number;     // Default 5%
  absoluteThreshold?: number;      // Optional absolute value
  
  // Statistical settings
  useStatisticalSignificance: boolean;  // Default true
  confidenceLevel: number;              // Default 0.95 (95%)
  minimumSampleSize: number;            // Default 4
  
  // Trend analysis
  trendWindowSize: number;              // Default 3 periods
  volatilityThreshold: number;          // Default 2σ
  
  // Business context
  metricType: 'sales' | 'orders' | 'efficiency' | 'other';
  seasonalityAware: boolean;            // Future enhancement
}
```

## Metric-Specific Presets

### Sales Metrics
```typescript
{
  percentageThreshold: 5,      // 5% change
  absoluteThreshold: 1000,     // £1,000
  volatilityThreshold: 2.5     // Higher tolerance for sales volatility
}
```

### Order Metrics
```typescript
{
  percentageThreshold: 8,      // 8% change
  absoluteThreshold: 10,       // 10 orders
  volatilityThreshold: 2.0     // Moderate volatility tolerance
}
```

### Efficiency Metrics
```typescript
{
  percentageThreshold: 6,      // 6% change
  absoluteThreshold: 0.5,      // 0.5 shipments/hour
  volatilityThreshold: 1.8     // Lower tolerance for efficiency changes
}
```

## User Interface Enhancements

### Compact Display (Charts)
- Enhanced badge showing significance type
- Color-coded by analysis type:
  - **Blue**: Statistical significance
  - **Green**: Trend significance
  - **Orange**: Volatility significance
  - **Purple**: Combined significance
- Clickable for detailed tooltip

### Detailed Display
- Full significance analysis card
- Confidence score visualization
- Breakdown of all metrics (z-score, trend strength, volatility)
- Actionable recommendations

### Badge Types
- **Statistical**: High confidence, statistically significant
- **Trend**: Consistent directional pattern
- **Volatile**: Unusual variation detected
- **Multi-factor**: Multiple significance indicators
- **Significant**: Basic threshold exceeded

## Recommendations Engine

The system provides context-aware recommendations:

### Sales Metrics
- **>10% change**: "Investigate sales drivers - may indicate campaign success or market changes"
- **Trend significance**: "Monitor trend continuation - consider adjusting sales strategies"

### Order Metrics
- **>15% change**: "Significant order volume change - check inventory and capacity planning"

### Efficiency Metrics
- **>8% change**: "Labor efficiency change detected - review process changes or workload distribution"

### General
- **High volatility**: "High volatility detected - consider investigating underlying causes"
- **Statistical significance**: "Statistically significant change - high confidence in pattern"
- **High confidence (>80%)**: "High confidence result - prioritize for management attention"

## Implementation Status

### ✅ Completed
- [x] SignificanceAnalyzer service with full multi-factor analysis
- [x] Integration with HistoricalDataService
- [x] Enhanced WeeklyLineChart with significance display
- [x] SignificanceDisplay component (compact and detailed)
- [x] Metric-specific configurations
- [x] Confidence scoring system

### 🔄 In Progress
- [ ] HistoricalLineChart integration (weekday analysis)
- [ ] Type definitions for SignificanceResult
- [ ] Error handling for edge cases

### 🚀 Future Enhancements
- [ ] Seasonality awareness
- [ ] Machine learning-based pattern recognition
- [ ] Historical significance tracking
- [ ] Custom user-defined thresholds
- [ ] Export significance analysis reports
- [ ] A/B testing integration
- [ ] Automated alerting for significant changes

## Technical Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   UI Component  │───▶│ HistoricalData   │───▶│ Significance    │
│   (Charts)      │    │ Service          │    │ Analyzer        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │   Supabase       │    │ Multi-factor    │
                       │   Database       │    │ Analysis Engine │
                       └──────────────────┘    └─────────────────┘
```

## Usage Examples

### Basic Usage
```typescript
// Simple significance check
const result = SignificanceAnalyzer.analyzeSignificance(values);
console.log(result.isSignificant); // boolean
console.log(result.reasons);       // string[]
```

### Metric-Specific Analysis
```typescript
// Sales-specific analysis
const config = SignificanceAnalyzer.getMetricConfig('sales');
const result = SignificanceAnalyzer.analyzeSignificance(values, config);
```

### UI Integration
```svelte
<SignificanceDisplay 
  significanceDetails={trend.significanceDetails}
  isSignificant={trend.isSignificant}
  percentage={trend.percentage}
  direction={trend.direction}
  compact={true}
/>
```

## Performance Considerations

- **Lightweight**: Calculations are performed client-side
- **Cached**: Results are cached with the historical data
- **Configurable**: Can disable expensive statistical calculations if needed
- **Scalable**: Handles datasets from 2 to 100+ data points efficiently

## Data Quality Requirements

For best results:
- **Minimum 4 data points** for statistical significance
- **Consistent time intervals** (daily/weekly)
- **Clean data** (no null/undefined values)
- **Reasonable range** (avoid extreme outliers that skew analysis)

## Testing & Validation

The significance analysis should be tested with:
1. **Known significant patterns** (step changes, trends)
2. **Random/noise data** (should show low significance)
3. **Edge cases** (zeros, negative values, single data points)
4. **Real business scenarios** (seasonal patterns, campaign effects)

## Getting Started

1. **Enable enhanced analysis** by ensuring the SignificanceAnalyzer is imported
2. **Configure metric types** appropriately for your data
3. **Review significance badges** in the chart interface
4. **Click for detailed analysis** when investigating significant changes
5. **Act on recommendations** provided by the system

This enhanced system provides much more reliable and actionable insights compared to simple threshold-based approaches, helping users understand not just *what* changed, but *why* it's significant and *what* to do about it.
