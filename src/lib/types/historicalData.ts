// Historical data types for enhanced analytics
import type { SignificanceResult } from '../services/significanceAnalyzer';
import type { SmartPrediction } from '../services/smartPredictionService';

export interface HistoricalMetricPoint {
  date: string;
  value: number;
  weekday: string;
  weekNumber: number;
  isCurrentWeek: boolean;
}

export interface WeeklyMetricPoint {
  weekStartDate: string;
  weekEndDate: string;
  weekNumber: number;
  year: number;
  value: number;
  isCurrentWeek: boolean;
  dailyAverage: number;
  workingDays: number;
}

export interface HistoricalDataRequest {
  metric: 'total_sales' | 'amazon_sales' | 'ebay_sales' | 'shopify_sales' |
  'linnworks_total_orders' | 'labor_efficiency';
  weekday: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  count: number; // Number of historical instances (default 7)
  endDate?: string; // Optional end date, defaults to current date (excludes today if incomplete data)
}

export interface WeeklyDataRequest {
  metric: 'total_sales' | 'amazon_sales' | 'ebay_sales' | 'shopify_sales' |
  'linnworks_total_orders' | 'labor_efficiency';
  count: number; // Number of weeks (default 12, minimum 12 for statistical analysis)
  endDate?: string; // Optional end date, defaults to current date
}

export interface HistoricalDataResponse {
  metric: string;
  weekday: string;
  data: HistoricalMetricPoint[];
  trend: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    isSignificant: boolean;
    significanceDetails?: SignificanceResult; // Now properly typed
    trendStrength?: number;    // How strong the trend is (0-1)
    r2?: number;              // R-squared value for trend line fit (0-1)
  };
  statistics: {
    average: number;
    min: number;
    max: number;
    latest: number;
    previousWeek: number;
    weeklyGrowthRate: number;    // Latest vs previous period
    monthlyGrowthRate: number;   // Latest vs 4 periods ago
    averageGrowthRate: number;   // Average growth rate across all periods
    consistencyScore: number;    // How consistent the trend direction is (0-1)
  };
}

export interface WeeklyDataResponse {
  metric: string;
  data: WeeklyMetricPoint[];
  yearOverYearData?: WeeklyMetricPoint[]; // Previous year data for overlay
  smartPredictions?: SmartPrediction; // AI-generated future predictions
  trend: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    isSignificant: boolean;
    significanceDetails?: SignificanceResult;
    trendStrength?: number;    // How strong the trend is (0-1)
    r2?: number;              // R-squared value for trend line fit (0-1)
  };
  statistics: {
    average: number;
    median: number;
    min: number;
    max: number;
    standardDeviation: number;
    variance: number;
    currentWeek: number;
    previousWeek: number;
    weeklyGrowthRate: number;    // Last week vs previous week
    monthlyGrowthRate: number;   // Latest vs 4 weeks ago
    averageGrowthRate: number;   // Average growth rate across all periods
    consistencyScore: number;    // How consistent the trend direction is (0-1)
  };
}

export type MetricDisplayMode = 'current-month' | 'historical-weekday' | 'historical-weekly';

export interface WeekdayHistoricalConfig {
  selectedMetric: string;
  selectedWeekday: string;
  historicalCount: number;
  showTrend: boolean;
  showAverage: boolean;
}

export interface WeeklyHistoricalConfig {
  selectedMetric: string;
  weeksCount: number;
  showTrend: boolean;
  showWorkingDaysOnly: boolean;
}
