import { callLinnworksApi } from './linnworksClient.server';
import NodeCache from 'node-cache';

// Create a cache with TTL of 1 hour
const financialCache = new NodeCache({ stdTTL: 3600 });

interface ProcessedOrderData {
  dProcessedOn?: string;
  dProcessed?: string;
  fTotalCharge?: number;
  fPostageCost?: number;
  fTotalDiscount?: number;
  fTax?: number;
  Source?: string;
  SubSource?: string;
  PostageCostExTax?: number;
  Subtotal?: number;
  CountryTaxRate?: number;
}

interface FinancialResponse {
  ProcessedOrders?: {
    TotalEntries?: number;
    TotalPages?: number;
    EntriesPerPage?: number;
    PageNumber?: number;
    Data?: ProcessedOrderData[];
  };
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
    totalTax: number;
    totalSubtotal: number;
    totalPostageCost: number;
    bySource: {
      [source: string]: {
        count: number;
        sales: number;
      };
    };
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

    // Convert dates to start of day for comparison
    const startOfStartDate = new Date(startDate);
    startOfStartDate.setHours(0, 0, 0, 0);
    const startOfEndDate = new Date(endDate);
    startOfEndDate.setHours(0, 0, 0, 0);
    const startOfNow = new Date(now);
    startOfNow.setHours(0, 0, 0, 0);

    if (startOfStartDate > startOfNow) {
      throw new Error("Start date cannot be in the future");
    }

    // Ensure endDate is not after today
    const adjustedEndDate = startOfEndDate > startOfNow ? now : endDate;

    console.log(`Getting financial data from ${startDate.toISOString()} to ${adjustedEndDate.toISOString()}`);

    const cacheKey = `financial_${startDate.toISOString()}_${endDate.toISOString()}`;
    const cachedData = financialCache.get(cacheKey);
    if (cachedData) {
      return cachedData as DailySalesData[];
    }

    // Using the ProcessedOrders/SearchProcessedOrders endpoint with pagination
    let allOrders: ProcessedOrderData[] = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const result = await callApiWithRetry(() => callLinnworksApi<FinancialResponse>(
        'ProcessedOrders/SearchProcessedOrders',
        'POST',
        {
          request: {
            DateField: "processed",
            FromDate: startDate.toISOString(),
            ToDate: adjustedEndDate.toISOString(),
            PageNumber: currentPage,
            ResultsPerPage: 500, // API maximum limit
            AdditionalFilters: [],
            ExtraFields: [
              "PostalServiceCost",
              "TotalCharge",
              "Source",
              "SubSource",
              "PostageCostExTax",
              "Subtotal",
              "CountryTaxRate",
              "fTax"
            ],
            OrderStates: []
          }
        }
      ));

      if (!result?.ProcessedOrders?.Data) {
        console.log('No processed orders returned from API');
        return [];
      }

      // Add this page's orders to our collection
      allOrders = allOrders.concat(result.ProcessedOrders.Data);

      console.log(`Retrieved page ${currentPage} with ${result.ProcessedOrders.Data.length} orders. Total entries: ${result.ProcessedOrders.TotalEntries}`);

      // Check if there are more pages
      if (result.ProcessedOrders.TotalPages && currentPage < result.ProcessedOrders.TotalPages) {
        currentPage++;
      } else {
        hasMorePages = false;
      }

      // Safety check - if we've fetched all available orders, stop
      if (allOrders.length >= (result.ProcessedOrders.TotalEntries || 0)) {
        console.log('Retrieved all available orders');
        hasMorePages = false;
      }
    }

    // Create daily summaries from order data
    const dailyData: DailySalesData[] = [];
    const ordersByDate = new Map<string, ProcessedOrderData[]>();

    // Group orders by date
    allOrders.forEach(order => {
      const processedDate = order.dProcessedOn || order.dProcessed;
      if (processedDate) {
        const dateStr = new Date(processedDate).toISOString().split('T')[0];
        const orders = ordersByDate.get(dateStr) || [];
        orders.push(order);
        ordersByDate.set(dateStr, orders);
      }
    });

    // Create daily summaries for the requested date range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const orders = ordersByDate.get(dateStr) || [];

      // Calculate daily totals from orders
      const totalSales = orders.reduce((sum: number, order: ProcessedOrderData) => sum + (order.fTotalCharge || 0), 0);
      const totalOrders = orders.length;

      // Group orders by source
      const ordersBySource = orders.reduce((acc, order) => {
        const source = order.Source || 'Unknown';
        if (!acc[source]) {
          acc[source] = { count: 0, sales: 0 };
        }
        acc[source].count++;
        acc[source].sales += order.fTotalCharge || 0;
        return acc;
      }, {} as Record<string, { count: number; sales: number; }>);

      // Map order data to daily totals
      console.log(`Processing data for ${dateStr}:`, {
        orderCount: orders.length,
        totalCharges: orders.map(o => o.fTotalCharge || 0),
        totalAmount: totalSales
      });

      const salesData = {
        totalSales: totalSales,
        totalProfit: 0, // Set to 0 since profit data comes from Sage
        orderCount: totalOrders,
        averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
        totalShipping: orders.reduce((sum: number, order: ProcessedOrderData) => sum + (order.fPostageCost || 0), 0),
        totalDiscount: orders.reduce((sum: number, order: ProcessedOrderData) => sum + (order.fTotalDiscount || 0), 0),
        totalTax: orders.reduce((sum: number, order: ProcessedOrderData) => sum + (order.fTax || 0), 0),
        totalSubtotal: orders.reduce((sum: number, order: ProcessedOrderData) => sum + (order.Subtotal || 0), 0),
        totalPostageCost: orders.reduce((sum: number, order: ProcessedOrderData) => sum + (order.PostageCostExTax || 0), 0),
        bySource: ordersBySource
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
