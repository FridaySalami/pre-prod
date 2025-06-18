// Optimized data fetching strategy for scheduling system
import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class ScheduleDataCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl = this.DEFAULT_TTL): void {
    const timestamp = Date.now();
    this.cache.set(key, {
      data,
      timestamp,
      expiresAt: timestamp + ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    // Remove entries matching pattern
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }
}

export const dataCache = new ScheduleDataCache();

// Request deduplication
const pendingRequests = new Map<string, Promise<any>>();

async function dedupedRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  const promise = requestFn().finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
}

// Optimized data fetcher
export class OptimizedScheduleFetcher {
  static async fetchEmployees(): Promise<any[]> {
    const cacheKey = 'employees';
    const cached = dataCache.get<any[]>(cacheKey);

    if (cached) {
      return cached;
    }

    return dedupedRequest(cacheKey, async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name');

      if (error) throw error;

      dataCache.set(cacheKey, data || []);
      return data || [];
    });
  }

  static async fetchSchedulesForRange(startDate: string, endDate: string): Promise<any[]> {
    const cacheKey = `schedules_${startDate}_${endDate}`;
    const cached = dataCache.get<any[]>(cacheKey);

    if (cached) {
      return cached;
    }

    return dedupedRequest(cacheKey, async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;

      // Cache for shorter time since schedules change more frequently
      dataCache.set(cacheKey, data || [], 2 * 60 * 1000); // 2 minutes
      return data || [];
    });
  }

  static async fetchLeaveRequests(startDate: string, endDate: string): Promise<any[]> {
    const cacheKey = `leaves_${startDate}_${endDate}`;
    const cached = dataCache.get<any[]>(cacheKey);

    if (cached) {
      return cached;
    }

    return dedupedRequest(cacheKey, async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          id, employee_id, start_date, end_date, status, notes,
          leave_types(id, name, color)
        `)
        .gte('start_date', startDate)
        .lte('end_date', endDate)
        .eq('status', 'approved');

      if (error) throw error;

      dataCache.set(cacheKey, data || [], 2 * 60 * 1000); // 2 minutes
      return data || [];
    });
  }

  static async fetchWeeklyPatterns(): Promise<any[]> {
    const cacheKey = 'weekly_patterns';
    const cached = dataCache.get<any[]>(cacheKey);

    if (cached) {
      return cached;
    }

    return dedupedRequest(cacheKey, async () => {
      const { data, error } = await supabase
        .from('employee_schedules')
        .select('*');

      if (error) throw error;

      // Weekly patterns change infrequently, cache longer
      dataCache.set(cacheKey, data || [], 15 * 60 * 1000); // 15 minutes
      return data || [];
    });
  }

  // Batch fetch all data needed for calendar
  static async fetchCalendarData(startDate: string, endDate: string) {
    try {
      const [employees, schedules, leaves, patterns] = await Promise.all([
        this.fetchEmployees(),
        this.fetchSchedulesForRange(startDate, endDate),
        this.fetchLeaveRequests(startDate, endDate),
        this.fetchWeeklyPatterns()
      ]);

      return { employees, schedules, leaves, patterns };
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      throw error;
    }
  }

  // Invalidate related caches when data changes
  static invalidateScheduleCache(date?: string): void {
    if (date) {
      // Invalidate caches that might contain this date
      dataCache.invalidate(`schedules_`);
      dataCache.invalidate(`leaves_`);
    } else {
      // Invalidate all schedule-related caches
      dataCache.invalidate('schedules_');
      dataCache.invalidate('leaves_');
    }
  }

  static invalidateEmployeeCache(): void {
    dataCache.invalidate('employees');
    dataCache.invalidate('weekly_patterns');
  }
}

// Reactive stores for schedule data
export const scheduleStore = writable({
  employees: [],
  schedules: [],
  leaves: [],
  patterns: [],
  loading: false,
  error: null,
  lastUpdated: null
});

export const calendarDataStore = derived(
  scheduleStore,
  ($store) => {
    // Transform and combine data for calendar display
    return {
      ...$store,
      combinedData: combineScheduleData($store)
    };
  }
);

function combineScheduleData(data: any) {
  // Logic to combine employees, schedules, leaves, and patterns
  // This would be similar to your current populateCalendar function
  // but optimized for reactive updates
  return data;
}

// Preloading strategy
export function preloadAdjacentMonths(currentMonth: Date): void {
  const prevMonth = new Date(currentMonth);
  prevMonth.setMonth(currentMonth.getMonth() - 1);

  const nextMonth = new Date(currentMonth);
  nextMonth.setMonth(currentMonth.getMonth() + 1);

  // Preload data for adjacent months in background
  setTimeout(() => {
    const prevStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1).toISOString().split('T')[0];
    const prevEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).toISOString().split('T')[0];

    OptimizedScheduleFetcher.fetchCalendarData(prevStart, prevEnd).catch(() => {
      // Ignore errors for preloading
    });
  }, 100);

  setTimeout(() => {
    const nextStart = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1).toISOString().split('T')[0];
    const nextEnd = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).toISOString().split('T')[0];

    OptimizedScheduleFetcher.fetchCalendarData(nextStart, nextEnd).catch(() => {
      // Ignore errors for preloading
    });
  }, 200);
}
