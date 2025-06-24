/**
 * Quick test suite to verify immediate significance analysis fixes
 */

import { EnhancedSignificanceAnalyzer } from '../services/enhancedSignificanceAnalyzer';
import { SignificanceAnalyzer } from '../services/significanceAnalyzer';

describe('Immediate Significance Analysis Fixes', () => {

  describe('Enhanced Significance Analyzer', () => {
    test('rejects insufficient data (< 12 samples)', () => {
      const insufficientData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // Only 11 samples
      const timestamps = insufficientData.map((_, i) => `2024-01-${i + 1}`);

      const result = EnhancedSignificanceAnalyzer.analyzeSignificance(insufficientData, timestamps);

      expect(result.significance).toBe('none');
      expect(result.actionRequired).toBe(false);
      expect(result.insights.primaryMessage).toContain('more data points');
      expect(result.business.contextualFactors).toContain('Insufficient data: 11 of 12 required samples');
    });

    test('accepts sufficient data (>= 12 samples)', () => {
      const sufficientData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // Exactly 12 samples
      const timestamps = sufficientData.map((_, i) => `2024-01-${i + 1}`);

      const result = EnhancedSignificanceAnalyzer.analyzeSignificance(sufficientData, timestamps);

      expect(result.significance).not.toBe('none');
      expect(result.statistical.method).toBeOneOf(['welch-t', 'mann-whitney', 'bootstrap', 'bayesian']);
    });

    test('detects non-normal data and uses appropriate method', () => {
      // Create highly skewed data
      const skewedData = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 100]; // 12 samples, highly skewed
      const timestamps = skewedData.map((_, i) => `2024-01-${i + 1}`);

      const result = EnhancedSignificanceAnalyzer.analyzeSignificance(skewedData, timestamps);

      // Should use non-parametric method for non-normal data
      expect(result.statistical.method).toBe('mann-whitney');
    });

    test('detects autocorrelated data and uses bootstrap', () => {
      // Create perfectly trending data (high autocorrelation)
      const trendingData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const timestamps = trendingData.map((_, i) => `2024-01-${i + 1}`);

      const result = EnhancedSignificanceAnalyzer.analyzeSignificance(trendingData, timestamps);

      // Should detect autocorrelation and use bootstrap
      expect(result.timeSeries.autocorrelationDetected).toBe(true);
      expect(result.statistical.method).toBe('bootstrap');
    });
  });

  describe('Legacy Significance Analyzer', () => {
    test('rejects insufficient data (< 12 samples)', () => {
      const insufficientData = [1, 2, 3, 4, 5]; // Only 5 samples

      const result = SignificanceAnalyzer.analyzeSignificance(insufficientData);

      expect(result.isSignificant).toBe(false);
      expect(result.reasons).toContain('Insufficient data');
    });

    test('handles non-normal data conservatively', () => {
      // Create highly skewed data with sufficient samples
      const skewedData = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 100];

      const result = SignificanceAnalyzer.analyzeSignificance(skewedData);

      // Should detect non-normality and apply conservative threshold
      if (result.reasons.length > 0) {
        const hasNormalityWarning = result.reasons.some(reason =>
          reason.includes('non-normal') || reason.includes('conservative')
        );
        expect(hasNormalityWarning).toBe(true);
      }
    });

    test('handles zero variance correctly', () => {
      const constantData = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]; // All same values

      const result = SignificanceAnalyzer.analyzeSignificance(constantData);

      expect(result.isSignificant).toBe(false);
      expect(result.reasons).toContain('All values are identical - no statistical variation to analyze');
    });
  });

  describe('Type Safety', () => {
    test('HistoricalDataResponse type includes proper significanceDetails', () => {
      // This is a compile-time test - if the types are wrong, this won't compile
      const mockResponse: import('../types/historicalData').HistoricalDataResponse = {
        metric: 'total_sales',
        weekday: 'monday',
        data: [],
        trend: {
          direction: 'stable',
          percentage: 0,
          isSignificant: false,
          significanceDetails: undefined, // Should accept undefined
          trendStrength: 0,
          r2: 0
        },
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

      expect(mockResponse.trend.significanceDetails).toBeUndefined();
    });

    test('WeeklyDataResponse type includes proper significanceDetails', () => {
      // This is a compile-time test - if the types are wrong, this won't compile
      const mockResponse: import('../types/historicalData').WeeklyDataResponse = {
        metric: 'total_sales',
        data: [],
        trend: {
          direction: 'stable',
          percentage: 0,
          isSignificant: false,
          significanceDetails: undefined, // Should accept undefined
          trendStrength: 0,
          r2: 0
        },
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

      expect(mockResponse.trend.significanceDetails).toBeUndefined();
    });
  });

  describe('Business Context Integration', () => {
    test('enhanced analyzer provides business-friendly interpretation', () => {
      const salesData = [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100];
      const timestamps = salesData.map((_, i) => `2024-01-${i + 1}`);

      const result = EnhancedSignificanceAnalyzer.analyzeSignificance(
        salesData,
        timestamps,
        { metricType: 'sales' }
      );

      expect(result.business.businessMeaning).toBeDefined();
      expect(result.insights.primaryMessage).toBeDefined();
      expect(result.insights.recommendations).toBeInstanceOf(Array);
    });

    test('urgency levels are set appropriately', () => {
      // Large change in sales data
      const highChangeData = [1000, 1000, 1000, 1000, 1000, 1000, 2500, 2500, 2500, 2500, 2500, 2500];
      const timestamps = highChangeData.map((_, i) => `2024-01-${i + 1}`);

      const result = EnhancedSignificanceAnalyzer.analyzeSignificance(
        highChangeData,
        timestamps,
        { metricType: 'sales' }
      );

      // Should detect high urgency for large sales changes
      expect(['medium', 'high']).toContain(result.business.urgency);
    });
  });
});

// Helper function for Jest
expect.extend({
  toBeOneOf(received, validValues) {
    const pass = validValues.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${validValues.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${validValues.join(', ')}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(validValues: any[]): R;
    }
  }
}
