import { callLinnworksApi } from './linnworksClient.server';
import NodeCache from 'node-cache'; // Adjust the import based on your project structure

// Create a cache with TTL of 1 hour
const financialCache = new NodeCache({ stdTTL: 3600 });

interface PerformanceData {
  OrderCount: number;
  TotalOrderValue: number;
  TotalProfitValue: number;
  AverageOrderValue: number;
  TotalShippingCost: number;
  TotalDiscountValue: number;
  Date: string;
}

interface FinancialResponse {
  SalesPerformance: PerformanceData[];
}

interface DailySalesData {
  date: string;
  formattedDate: string;
  salesData: {
    totalSales: number;
    totalProfit: number;
    orderCount: number;
    averageOrderValue: number;
    totalShipping: number;
    totalDiscount: number;
  };
}

// Helper function with retry logic (reusing the same pattern as in processedOrdersService)
async function callApiWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
  let retries = 0;

  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.message && error.message.includes('429') && retries < maxRetries) {
        retries++;
        const delay = initialDelay * Math.pow(2, retries);
        console.log(`Rate limited. Retrying in ${delay}ms (retry ${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

// Get daily financial data for a date range
export async function getDailyFinancialData(startDate: Date, endDate: Date): Promise<DailySalesData[]> {
  try {
    // Validate dates - don't allow future dates
    const now = new Date();
    now.setHours(23, 59, 59, 999); // End of today

    if (startDate > now || endDate > now) {
      throw new Error("Cannot fetch financial data for future dates");
    }

    // Ensure endDate is not after today
    const adjustedEndDate = endDate > now ? now : endDate;

    console.log(`Getting financial data from ${startDate.toISOString()} to ${adjustedEndDate.toISOString()}`);

    const cacheKey = `financial_${startDate.toISOString()}_${endDate.toISOString()}`;
    const cachedData = financialCache.get(cacheKey);
    if (cachedData) {
      return cachedData as DailySalesData[];
    }

    // Using the Orders/GetSalesPerformance endpoint for financial data
    const result = await callApiWithRetry(() => callLinnworksApi<FinancialResponse>(
      'Orders/GetSalesPerformance',  // More reliable endpoint for financial data
      'POST',
      {
        "FromDate": startDate.toISOString(),
        "ToDate": adjustedEndDate.toISOString(),
        "Source": "",  // Empty string means all sources
        "SubSource": "", // Empty string means all sub-sources
        "LocationId": 0, // 0 means all locations
        "Currency": "GBP",
        "DateField": "PROCESSED", // Could be "RECEIVED" or "PROCESSED"
        "ReportType": "SUMMARY", // Get summary data
        "AdditionalFilters": []  // No additional filters
      }
    ));

    if (!result?.SalesPerformance) {
      console.log('No financial data returned from API');
      return [];
    }

    // Create daily summaries from performance data
    const dailyData: DailySalesData[] = [];
    const performanceByDate = new Map<string, PerformanceData>();

    // Index performance data by date
    if (result?.SalesPerformance) {
      result.SalesPerformance.forEach(perfData => {
        const dateStr = new Date(perfData.Date).toISOString().split('T')[0];
        performanceByDate.set(dateStr, perfData);
      });
    }

    // Create daily summaries for the requested date range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const perfData = performanceByDate.get(dateStr) || {
        OrderCount: 0,
        TotalOrderValue: 0,
        TotalProfitValue: 0,
        AverageOrderValue: 0,
        TotalShippingCost: 0,
        TotalDiscountValue: 0,
        Date: dateStr
      };

      // Map performance data to daily totals
      const salesData = {
        totalSales: perfData.TotalOrderValue,
        totalProfit: perfData.TotalProfitValue,
        orderCount: perfData.OrderCount,
        averageOrderValue: perfData.AverageOrderValue,
        totalShipping: perfData.TotalShippingCost,
        totalDiscount: perfData.TotalDiscountValue
      };

      // Format the date for display
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      };

      dailyData.push({
        date: dateStr,
        formattedDate: currentDate.toLocaleDateString('en-US', options),
        salesData
      });

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Cache the results
    financialCache.set(cacheKey, dailyData);

    return dailyData;
  } catch (error) {
    console.error('Error getting financial data:', error);
    throw error;
  }
}
