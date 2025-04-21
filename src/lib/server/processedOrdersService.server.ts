import { callLinnworksApi } from './linnworksClient.server';

interface DateRange {
  fromDate: string;
  toDate: string;
}

export interface DailyOrderCount {
  date: string;
  count: number;
  formattedDate: string; // e.g. "Monday, Apr 21"
}

// Define interfaces for Linnworks API responses
interface ProcessedOrdersResponse {
  ProcessedOrders?: {
    TotalEntries?: number;
    TotalPages?: number;
    EntriesPerPage?: number;
    PageNumber?: number;
    Data?: any[];
  };
  [key: string]: any;
}

/**
 * Get daily order counts for a specified date range
 */
export async function getDailyOrderCounts(startDate: Date, endDate: Date): Promise<DailyOrderCount[]> {
  try {
    console.log(`Getting daily order counts from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    const searchRequest = {
      DateField: "processed", // Use processed date as we want completed orders
      FromDate: startDate.toISOString(),
      ToDate: endDate.toISOString(),
      PageNumber: 1,
      ResultsPerPage: 20, // Minimum required by API
      SearchSorting: {
        SortField: "dProcessedOn", // Changed from "ProcessedOn" to "dProcessedOn"
        SortDirection: "DESC"
      }
    };

    // Call the Linnworks API to get order counts with proper type
    const result = await callLinnworksApi<ProcessedOrdersResponse>('ProcessedOrders/SearchProcessedOrders', 'POST', {
      request: searchRequest
    });

    // If no results, return empty array
    if (!result || !result.ProcessedOrders) {
      return [];
    }

    // Now we need to break this down by day
    // Create an array with one entry per day in the date range
    const days: DailyOrderCount[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      // Create a date range for just this day
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);
      
      // Get orders for just this day
      const dayOrders = await getDayOrderCount(dayStart, dayEnd);
      
      // Format the date for display
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      };
      
      days.push({
        date: currentDate.toISOString().split('T')[0],
        count: dayOrders,
        formattedDate: currentDate.toLocaleDateString('en-US', options)
      });
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  } catch (error) {
    console.error('Error getting daily order counts:', error);
    throw error;
  }
}

/**
 * Helper function to get order count for a specific day
 */
async function getDayOrderCount(dayStart: Date, dayEnd: Date): Promise<number> {
  const searchRequest = {
    DateField: "processed", 
    FromDate: dayStart.toISOString(),
    ToDate: dayEnd.toISOString(),
    PageNumber: 1,
    ResultsPerPage: 20 // Changed from 1 to 20 to meet API minimum requirement
  };

  // Use the defined interface for proper typing
  const result = await callLinnworksApi<ProcessedOrdersResponse>('ProcessedOrders/SearchProcessedOrders', 'POST', {
    request: searchRequest
  });

  // Return the total count of orders for this day
  return result?.ProcessedOrders?.TotalEntries || 0;
}

/**
 * Get the date range for the current week (Monday to Sunday)
 */
export function getCurrentWeekRange(): DateRange {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate days to subtract to get to Monday (if today is Sunday, subtract 6 days)
  const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
  
  // Calculate start of week (Monday)
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - daysToMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  
  // Calculate end of week (Sunday)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  return {
    fromDate: startOfWeek.toISOString(),
    toDate: endOfWeek.toISOString()
  };
}