/**
 * Business Context Service
 * Provides business calendar and contextual information for significance analysis
 */

export interface BusinessEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  type: 'holiday' | 'promotion' | 'seasonal' | 'operational' | 'external';
  impact: 'high' | 'medium' | 'low';
  description?: string;
  expectedEffect?: 'increase' | 'decrease' | 'variable';
  affectedMetrics?: string[];
}

export interface BusinessContext {
  events: BusinessEvent[];
  seasonalPeriod: {
    name: string;
    type: 'peak' | 'low' | 'transition';
    historicalMultiplier: number; // e.g., 1.2 for 20% increase during peak
  } | null;
  marketConditions: {
    economy: 'growth' | 'recession' | 'stable';
    industry: 'growth' | 'decline' | 'stable';
    competition: 'high' | 'medium' | 'low';
  };
  operationalFactors: {
    staffingLevel: 'understaffed' | 'normal' | 'overstaffed';
    systemChanges: Array<{
      date: string;
      type: 'upgrade' | 'maintenance' | 'outage';
      impact: 'high' | 'medium' | 'low';
    }>;
    processChanges: Array<{
      date: string;
      description: string;
      expectedImpact: 'positive' | 'negative' | 'neutral';
    }>;
  };
}

export class BusinessContextService {

  // UK retail calendar - can be extended/configured
  private static readonly UK_HOLIDAYS_2024_2025 = [
    { name: 'New Year\'s Day', date: '2024-01-01', impact: 'high' },
    { name: 'Good Friday', date: '2024-03-29', impact: 'high' },
    { name: 'Easter Monday', date: '2024-04-01', impact: 'medium' },
    { name: 'Early May Bank Holiday', date: '2024-05-06', impact: 'medium' },
    { name: 'Spring Bank Holiday', date: '2024-05-27', impact: 'medium' },
    { name: 'Summer Bank Holiday', date: '2024-08-26', impact: 'medium' },
    { name: 'Christmas Day', date: '2024-12-25', impact: 'high' },
    { name: 'Boxing Day', date: '2024-12-26', impact: 'high' },
    // 2025
    { name: 'New Year\'s Day', date: '2025-01-01', impact: 'high' },
    { name: 'Good Friday', date: '2025-04-18', impact: 'high' },
    { name: 'Easter Monday', date: '2025-04-21', impact: 'medium' },
  ];

  private static readonly SEASONAL_PERIODS = [
    {
      name: 'Black Friday / Cyber Monday',
      startMonth: 11, startDay: 20,
      endMonth: 12, endDay: 2,
      type: 'peak' as const,
      multiplier: 1.8,
      affectedMetrics: ['sales', 'orders']
    },
    {
      name: 'Christmas Shopping',
      startMonth: 12, startDay: 1,
      endMonth: 12, endDay: 24,
      type: 'peak' as const,
      multiplier: 1.5,
      affectedMetrics: ['sales', 'orders']
    },
    {
      name: 'January Sales',
      startMonth: 1, startDay: 2,
      endMonth: 1, endDay: 31,
      type: 'peak' as const,
      multiplier: 1.3,
      affectedMetrics: ['sales', 'orders']
    },
    {
      name: 'Summer Holiday Period',
      startMonth: 7, startDay: 15,
      endMonth: 8, endDay: 31,
      type: 'low' as const,
      multiplier: 0.8,
      affectedMetrics: ['efficiency', 'orders']
    },
    {
      name: 'Back to School',
      startMonth: 8, startDay: 15,
      endMonth: 9, endDay: 15,
      type: 'peak' as const,
      multiplier: 1.2,
      affectedMetrics: ['sales', 'orders']
    }
  ];

  /**
   * Get business context for a date range
   */
  static getBusinessContext(startDate: string, endDate: string): BusinessContext {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const events = this.getBusinessEvents(start, end);
    const seasonalPeriod = this.getCurrentSeasonalPeriod(end);
    const marketConditions = this.getMarketConditions();
    const operationalFactors = this.getOperationalFactors(start, end);

    return {
      events,
      seasonalPeriod,
      marketConditions,
      operationalFactors
    };
  }

  /**
   * Get business events affecting the date range
   */
  private static getBusinessEvents(startDate: Date, endDate: Date): BusinessEvent[] {
    const events: BusinessEvent[] = [];

    // Add holidays
    this.UK_HOLIDAYS_2024_2025.forEach(holiday => {
      const holidayDate = new Date(holiday.date);
      if (holidayDate >= startDate && holidayDate <= endDate) {
        events.push({
          id: `holiday-${holiday.name.toLowerCase().replace(/\s+/g, '-')}`,
          name: holiday.name,
          startDate: holiday.date,
          endDate: holiday.date,
          type: 'holiday',
          impact: holiday.impact as 'high' | 'medium' | 'low',
          description: `UK Bank Holiday: ${holiday.name}`,
          expectedEffect: 'decrease',
          affectedMetrics: ['sales', 'orders', 'efficiency']
        });
      }
    });

    // Add seasonal periods
    this.SEASONAL_PERIODS.forEach(period => {
      const periodStart = new Date(endDate.getFullYear(), period.startMonth - 1, period.startDay);
      const periodEnd = new Date(endDate.getFullYear(), period.endMonth - 1, period.endDay);

      // Check if period overlaps with our date range
      if (periodStart <= endDate && periodEnd >= startDate) {
        events.push({
          id: `seasonal-${period.name.toLowerCase().replace(/\s+/g, '-')}`,
          name: period.name,
          startDate: periodStart.toISOString().split('T')[0],
          endDate: periodEnd.toISOString().split('T')[0],
          type: 'seasonal',
          impact: period.multiplier > 1.2 || period.multiplier < 0.9 ? 'high' : 'medium',
          description: `Seasonal period with ${period.multiplier}x historical average`,
          expectedEffect: period.multiplier > 1 ? 'increase' : 'decrease',
          affectedMetrics: period.affectedMetrics
        });
      }
    });

    return events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }

  /**
   * Determine current seasonal period
   */
  private static getCurrentSeasonalPeriod(date: Date): BusinessContext['seasonalPeriod'] {
    const month = date.getMonth() + 1; // 1-indexed
    const day = date.getDate();

    for (const period of this.SEASONAL_PERIODS) {
      const inPeriod = this.isDateInPeriod(month, day, period);
      if (inPeriod) {
        return {
          name: period.name,
          type: period.type,
          historicalMultiplier: period.multiplier
        };
      }
    }

    return null;
  }

  /**
   * Check if a date falls within a seasonal period
   */
  private static isDateInPeriod(month: number, day: number, period: typeof this.SEASONAL_PERIODS[0]): boolean {
    if (period.startMonth === period.endMonth) {
      return month === period.startMonth && day >= period.startDay && day <= period.endDay;
    } else if (period.startMonth < period.endMonth) {
      return (month === period.startMonth && day >= period.startDay) ||
        (month > period.startMonth && month < period.endMonth) ||
        (month === period.endMonth && day <= period.endDay);
    } else {
      // Period crosses year boundary
      return (month === period.startMonth && day >= period.startDay) ||
        (month > period.startMonth || month < period.endMonth) ||
        (month === period.endMonth && day <= period.endDay);
    }
  }

  /**
   * Get current market conditions (would be dynamically updated)
   */
  private static getMarketConditions(): BusinessContext['marketConditions'] {
    // This would typically come from external data sources or manual configuration
    return {
      economy: 'stable',
      industry: 'growth',
      competition: 'medium'
    };
  }

  /**
   * Get operational factors (would be integrated with internal systems)
   */
  private static getOperationalFactors(startDate: Date, endDate: Date): BusinessContext['operationalFactors'] {
    // This would typically come from HR systems, change management, etc.
    return {
      staffingLevel: 'normal',
      systemChanges: [],
      processChanges: []
    };
  }

  /**
   * Analyze if a metric change might be explained by business context
   */
  static analyzeContextualImpact(
    metricChange: number,
    metricType: string,
    context: BusinessContext
  ): {
    isExplainedByContext: boolean;
    explanations: string[];
    adjustedExpectation: number | null;
  } {
    const explanations: string[] = [];
    let adjustedExpectation: number | null = null;
    let isExplainedByContext = false;

    // Check seasonal impact
    if (context.seasonalPeriod) {
      const expectedMultiplier = context.seasonalPeriod.historicalMultiplier;
      const expectedChange = (expectedMultiplier - 1) * 100;

      if (context.seasonalPeriod.name.toLowerCase().includes(metricType) ||
        (metricType === 'sales' && Math.abs(expectedChange) > 10)) {
        explanations.push(`${context.seasonalPeriod.name} period (typically ${expectedChange > 0 ? '+' : ''}${expectedChange.toFixed(1)}%)`);
        adjustedExpectation = expectedChange;

        // If the change is within 50% of expected seasonal change, consider it explained
        if (Math.abs(metricChange - expectedChange) < Math.abs(expectedChange) * 0.5) {
          isExplainedByContext = true;
        }
      }
    }

    // Check for major events
    const majorEvents = context.events.filter(e => e.impact === 'high' &&
      (e.affectedMetrics?.includes(metricType) || e.type === 'holiday'));

    if (majorEvents.length > 0) {
      majorEvents.forEach(event => {
        explanations.push(`${event.name} (${event.description})`);
      });

      // If multiple major events, likely to explain significant changes
      if (majorEvents.length > 1 && Math.abs(metricChange) > 15) {
        isExplainedByContext = true;
      }
    }

    // Check operational factors
    if (context.operationalFactors.systemChanges.length > 0) {
      const recentChanges = context.operationalFactors.systemChanges.filter(c => c.impact !== 'low');
      if (recentChanges.length > 0) {
        explanations.push(`Recent system changes: ${recentChanges.map(c => c.type).join(', ')}`);
      }
    }

    return {
      isExplainedByContext,
      explanations,
      adjustedExpectation
    };
  }

  /**
   * Get contextual factors as strings for display
   */
  static getContextualFactors(context: BusinessContext): string[] {
    const factors: string[] = [];

    if (context.seasonalPeriod) {
      factors.push(`${context.seasonalPeriod.name} (${context.seasonalPeriod.type} season)`);
    }

    const majorEvents = context.events.filter(e => e.impact === 'high');
    majorEvents.forEach(event => {
      factors.push(event.name);
    });

    if (context.operationalFactors.staffingLevel !== 'normal') {
      factors.push(`Staffing: ${context.operationalFactors.staffingLevel}`);
    }

    if (context.operationalFactors.systemChanges.length > 0) {
      factors.push(`${context.operationalFactors.systemChanges.length} system changes`);
    }

    return factors;
  }

  /**
   * Configuration method for adding custom business events
   */
  static addCustomEvent(event: Omit<BusinessEvent, 'id'>): void {
    // Would integrate with database or configuration system
    console.log('Custom event added:', event);
  }

  /**
   * Configuration method for updating market conditions
   */
  static updateMarketConditions(conditions: Partial<BusinessContext['marketConditions']>): void {
    // Would integrate with external data sources or admin interface
    console.log('Market conditions updated:', conditions);
  }
}
