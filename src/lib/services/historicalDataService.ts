import { supabase } from '../supabaseClient';
import type {
  HistoricalDataRequest,
  HistoricalDataResponse,
  HistoricalMetricPoint,
  WeeklyDataRequest,
  WeeklyDataResponse,
  WeeklyMetricPoint
} from '../types/historicalData';
import { SignificanceAnalyzer } from './significanceAnalyzer';

/**
 * Service for fetching historical metric data for specific weekdays
 */
export class HistoricalDataService {

  /**
   * Fetch historical data for a specific metric and weekday
   */
  static async fetchHistoricalWeekdayData(
    request: HistoricalDataRequest
  ): Promise<HistoricalDataResponse | null> {
    try {
      const { metric, weekday, count = 7, endDate } = request;

      // Calculate the target weekday number (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
      const weekdayMap = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
        'thursday': 4, 'friday': 5, 'saturday': 6
      };

      const targetWeekday = weekdayMap[weekday as keyof typeof weekdayMap];
      const referenceDate = endDate ? new Date(endDate) : new Date();

      // Get data from the last 8 weeks to ensure we have enough weekday instances
      const startDate = new Date(referenceDate);
      startDate.setDate(startDate.getDate() - (8 * 7));

      // Exclude current date as sales data is incomplete until end of day
      const today = new Date();
      const excludeCurrentDate = endDate ? false : true; // Only exclude if using current date as reference

      let queryEndDate = referenceDate;
      if (excludeCurrentDate && this.isSameDay(referenceDate, today)) {
        queryEndDate = new Date(today);
        queryEndDate.setDate(today.getDate() - 1); // Use yesterday as the latest date
      }

      const { data, error } = await supabase
        .from('daily_metric_review')
        .select(`date, ${metric}`)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', queryEndDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching historical data:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return this.createEmptyResponse(metric, weekday);
      }

      // Filter for the specific weekday and take the most recent instances
      // Also exclude today's date as it may have incomplete data
      const weekdayData = data
        .filter((record: any) => {
          const recordDate = new Date(record.date);
          const isTargetWeekday = recordDate.getDay() === targetWeekday;
          const isNotToday = !this.isSameDay(recordDate, today);
          return isTargetWeekday && (endDate ? true : isNotToday); // Only exclude today if using current date
        })
        .slice(0, count)
        .reverse(); // Show chronologically (oldest to newest)

      // Transform to HistoricalMetricPoint format
      const historicalPoints: HistoricalMetricPoint[] = weekdayData.map((record: any, index: number) => {
        const recordDate = new Date(record.date);
        const weekNumber = this.getWeekNumber(recordDate);
        // Mark as current week only if it's actually this week and not excluded due to incomplete data
        const isCurrentWeek = this.isCurrentWeek(recordDate) && !this.isSameDay(recordDate, new Date());

        return {
          date: record.date,
          value: (record as any)[metric] || 0,
          weekday: weekday,
          weekNumber,
          isCurrentWeek
        };
      });

      // Calculate statistics and trend
      const values = historicalPoints.map(p => p.value);
      const statistics = this.calculateWeeklyStatistics(values);
      const trend = this.calculateTrend(values, metric);

      return {
        metric,
        weekday,
        data: historicalPoints,
        trend,
        statistics
      };

    } catch (error) {
      console.error('Error in fetchHistoricalWeekdayData:', error);
      return null;
    }
  }

  /**
   * Fetch weekly aggregated data for a specific metric
   */
  static async fetchWeeklyData(
    request: WeeklyDataRequest
  ): Promise<WeeklyDataResponse | null> {
    try {
      const { metric, count = 8, endDate } = request;

      const referenceDate = endDate ? new Date(endDate) : new Date();

      // Exclude current date as it may have incomplete data
      const today = new Date();
      let queryEndDate = referenceDate;
      if (!endDate && this.isSameDay(referenceDate, today)) {
        queryEndDate = new Date(today);
        queryEndDate.setDate(today.getDate() - 1);
      }

      // Get data from enough weeks back to ensure we have complete weeks
      const startDate = new Date(queryEndDate);
      startDate.setDate(startDate.getDate() - (count + 2) * 7);

      const { data, error } = await supabase
        .from('daily_metric_review')
        .select(`date, ${metric}`)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', queryEndDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching weekly data:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return this.createEmptyWeeklyResponse(metric);
      }

      // Group data by week (Monday to Sunday)
      const weeklyData = this.groupDataByWeek(data, metric, count);

      // Calculate statistics and trend
      const values = weeklyData.map(w => w.value);
      const statistics = this.calculateWeeklyStatistics(values);
      const trend = this.calculateTrend(values, metric);

      return {
        metric,
        data: weeklyData,
        trend,
        statistics
      };

    } catch (error) {
      console.error('Error in fetchWeeklyData:', error);
      return null;
    }
  }

  /**
   * Group daily data by week (Monday to Sunday)
   */
  private static groupDataByWeek(
    data: any[],
    metric: string,
    maxWeeks: number
  ): WeeklyMetricPoint[] {
    const weeks: Map<string, {
      weekStart: Date;
      weekEnd: Date;
      data: any[];
      weekNumber: number;
      year: number;
    }> = new Map();

    // Group data by week
    data.forEach((record: any) => {
      const recordDate = new Date(record.date);

      // Find Monday of this week
      const dayOfWeek = recordDate.getDay();
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, adjust to Monday = 0
      const weekStart = new Date(recordDate);
      weekStart.setDate(recordDate.getDate() - daysFromMonday);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const weekKey = weekStart.toISOString().split('T')[0];
      const weekNumber = this.getWeekNumber(weekStart);
      const year = weekStart.getFullYear();

      if (!weeks.has(weekKey)) {
        weeks.set(weekKey, {
          weekStart,
          weekEnd,
          data: [],
          weekNumber,
          year
        });
      }

      weeks.get(weekKey)!.data.push(record);
    });

    // Convert to WeeklyMetricPoint and sort by date (newest first)
    const weeklyPoints: WeeklyMetricPoint[] = Array.from(weeks.values())
      .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())
      .slice(0, maxWeeks) // Take only the requested number of weeks
      .map(week => {
        const weekData = week.data;
        const totalValue = weekData.reduce((sum, record) => sum + ((record as any)[metric] || 0), 0);
        const workingDays = weekData.filter(record => {
          const date = new Date(record.date);
          const dayOfWeek = date.getDay();
          return dayOfWeek !== 0 && dayOfWeek !== 6; // Exclude weekends if needed
        }).length;

        const dailyAverage = weekData.length > 0 ? totalValue / weekData.length : 0;
        const isCurrentWeek = this.isCurrentWeek(week.weekStart);

        return {
          weekStartDate: week.weekStart.toISOString().split('T')[0],
          weekEndDate: week.weekEnd.toISOString().split('T')[0],
          weekNumber: week.weekNumber,
          year: week.year,
          value: totalValue,
          isCurrentWeek,
          dailyAverage,
          workingDays: Math.max(weekData.length, workingDays)
        };
      })
      .filter(week => !week.isCurrentWeek) // Exclude current incomplete week
      .reverse(); // Show chronologically (oldest to newest)

    return weeklyPoints;
  }

  /**
   * Check if two dates are the same day
   */
  private static isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate();
  }

  /**
   * Get week number for a date
   */
  private static getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Check if date is in current week
   */
  private static isCurrentWeek(date: Date): boolean {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return date >= startOfWeek && date <= endOfWeek;
  }

  /**
   * Calculate basic statistics
   */
  private static calculateStatistics(values: number[]) {
    if (values.length === 0) {
      return { average: 0, min: 0, max: 0, latest: 0, previousWeek: 0 };
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const latest = values[values.length - 1] || 0;
    const previousWeek = values[values.length - 2] || 0;

    return { average, min, max, latest, previousWeek };
  }

  /**
   * Calculate weekly statistics with more meaningful growth metrics
   */
  private static calculateWeeklyStatistics(values: number[]) {
    if (values.length === 0) {
      return {
        average: 0,
        min: 0,
        max: 0,
        latest: 0,
        previousWeek: 0,
        weeklyGrowthRate: 0,
        monthlyGrowthRate: 0,
        averageGrowthRate: 0,
        consistencyScore: 0
      };
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const latest = values[values.length - 1] || 0;
    const previousWeek = values[values.length - 2] || 0;

    // 1. Week-over-week growth rate (immediate change)
    let weeklyGrowthRate = 0;
    if (values.length >= 2 && previousWeek > 0) {
      weeklyGrowthRate = ((latest - previousWeek) / previousWeek) * 100;
    }

    // 2. Monthly growth rate (4 weeks ago vs latest)
    let monthlyGrowthRate = 0;
    if (values.length >= 4) {
      const fourWeeksAgo = values[values.length - 4];
      if (fourWeeksAgo > 0) {
        monthlyGrowthRate = ((latest - fourWeeksAgo) / fourWeeksAgo) * 100;
      }
    }

    // 3. Average growth rate (trend slope over all periods)
    let averageGrowthRate = 0;
    if (values.length >= 3) {
      const growthRates: number[] = [];
      for (let i = 1; i < values.length; i++) {
        if (values[i - 1] > 0) {
          const rate = ((values[i] - values[i - 1]) / values[i - 1]) * 100;
          growthRates.push(rate);
        }
      }
      if (growthRates.length > 0) {
        averageGrowthRate = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
      }
    }

    // 4. Consistency score (how consistent is the trend direction)
    let consistencyScore = 0;
    if (values.length >= 3) {
      let positiveChanges = 0;
      let negativeChanges = 0;

      for (let i = 1; i < values.length; i++) {
        const change = values[i] - values[i - 1];
        if (change > 0) positiveChanges++;
        else if (change < 0) negativeChanges++;
      }

      const totalChanges = positiveChanges + negativeChanges;
      if (totalChanges > 0) {
        consistencyScore = Math.max(positiveChanges, negativeChanges) / totalChanges;
      }
    }

    return {
      average,
      min,
      max,
      latest,
      previousWeek,
      weeklyGrowthRate,
      monthlyGrowthRate,
      averageGrowthRate,
      consistencyScore
    };
  }

  /**
   * Calculate trend information using linear regression and enhanced significance analysis
   */
  private static calculateTrend(values: number[], metric?: string) {
    if (values.length < 2) {
      return {
        direction: 'stable' as const,
        percentage: 0,
        isSignificant: false,
        significanceDetails: null,
        trendStrength: 0,
        r2: 0
      };
    }

    // Calculate linear regression to determine overall trend
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i); // Time periods: 0, 1, 2, ...
    const y = values;

    // Linear regression calculations
    const sumX = x.reduce((sum, xi) => sum + xi, 0);
    const sumY = y.reduce((sum, yi) => sum + yi, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R² (coefficient of determination)
    const yMean = sumY / n;
    const totalSumSquares = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const residualSumSquares = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    const r2 = totalSumSquares > 0 ? 1 - (residualSumSquares / totalSumSquares) : 0;

    // Calculate trend strength based on R² (coefficient of determination)
    // R² tells us how well the linear trend explains the data variance
    // 0 = no trend, 1 = perfect linear trend
    const trendStrength = Math.max(0, Math.min(1, r2)); // Clamp between 0 and 1

    // Determine trend direction and percentage change over the full period
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const totalPercentageChange = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

    let direction: 'up' | 'down' | 'stable';
    if (slope > 0.01 * yMean) { // Positive trend (slope > 1% of average)
      direction = 'up';
    } else if (slope < -0.01 * yMean) { // Negative trend (slope < -1% of average)
      direction = 'down';
    } else {
      direction = 'stable';
    }

    // Enhanced significance analysis
    let metricType: 'sales' | 'orders' | 'efficiency' | 'other' = 'other';
    if (metric) {
      if (metric.includes('sales')) metricType = 'sales';
      else if (metric.includes('orders')) metricType = 'orders';
      else if (metric.includes('efficiency')) metricType = 'efficiency';
    }

    const config = metricType !== 'other'
      ? SignificanceAnalyzer.getMetricConfig(metricType)
      : {};

    const significanceResult = SignificanceAnalyzer.analyzeSignificance(values, config);

    return {
      direction,
      percentage: Math.abs(totalPercentageChange),
      isSignificant: significanceResult.isSignificant,
      significanceDetails: significanceResult,
      trendStrength: trendStrength,
      r2: r2
    };
  }

  /**
   * Create empty response structure
   */
  private static createEmptyResponse(metric: string, weekday: string): HistoricalDataResponse {
    return {
      metric,
      weekday,
      data: [],
      trend: { direction: 'stable', percentage: 0, isSignificant: false },
      statistics: {
        average: 0,
        min: 0,
        max: 0,
        latest: 0,
        previousWeek: 0,
        weeklyGrowthRate: 0,
        monthlyGrowthRate: 0,
        averageGrowthRate: 0,
        consistencyScore: 0
      }
    };
  }

  /**
   * Create empty weekly response structure
   */
  private static createEmptyWeeklyResponse(metric: string): WeeklyDataResponse {
    return {
      metric,
      data: [],
      trend: { direction: 'stable', percentage: 0, isSignificant: false },
      statistics: {
        average: 0,
        min: 0,
        max: 0,
        latest: 0,
        previousWeek: 0,
        weeklyGrowthRate: 0,
        monthlyGrowthRate: 0,
        averageGrowthRate: 0,
        consistencyScore: 0
      }
    };
  }

  /**
   * Batch fetch multiple historical data requests
   */
  static async fetchMultipleHistoricalData(
    requests: HistoricalDataRequest[]
  ): Promise<(HistoricalDataResponse | null)[]> {
    const promises = requests.map(request => this.fetchHistoricalWeekdayData(request));
    return Promise.all(promises);
  }

  /**
   * Batch fetch multiple weekly data requests
   */
  static async fetchMultipleWeeklyData(
    requests: WeeklyDataRequest[]
  ): Promise<(WeeklyDataResponse | null)[]> {
    const promises = requests.map(request => this.fetchWeeklyData(request));
    return Promise.all(promises);
  }
}
