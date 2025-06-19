import { callLinnworksApi } from './linnworksClient.server';
import NodeCache from 'node-cache';

// Create a cache with TTL of 1 hour
const orderCountCache = new NodeCache({ stdTTL: 3600 });
const stockItemsCache = new NodeCache({ stdTTL: 3600 }); // Cache for stock items

interface DateRange {
  fromDate: string;
  toDate: string;
}

export interface DailyOrderCount {
  date: string;
  count: number;
  formattedDate: string; // e.g. "Monday, Apr 21"
  channels?: {
    amazon: number;
    ebay: number;
    shopify: number;
    other: number;
  };
}

// Define a new interface to capture the order source
interface OrderItem {
  ItemNumber?: string;
  ItemName?: string;
  SKU?: string;
  Quantity?: number;
  ItemValue?: number;
  StockItemId?: number;
}

interface ProcessedOrderData {
  nOrderId: number;
  Source: string;
  OrderId?: string;
  Items?: OrderItem[];
  fTotalCharge?: number;
  fPostageCost?: number;
  Status?: number;
  PostalServiceName?: string;
  dProcessedOn?: string;
  dProcessed?: string;
  extendedProperties?: Record<string, string>;  // Added extended properties support
}

// Update this interface to include Data with proper typing
interface ProcessedOrdersResponse {
  ProcessedOrders?: {
    TotalEntries?: number;
    TotalPages?: number;
    EntriesPerPage?: number;
    PageNumber?: number;
    Data?: ProcessedOrderData[];
  };
  [key: string]: any;
}

interface StockItem {
  ItemNumber: string;
  ItemTitle: string;
  Quantity: number;
  SKU: string;
  RetailPrice: number;
  PurchasePrice: number;
  StockItemId: number;
  ItemDescription?: string;
}

interface OrderDetails {
  OrderId: string;
  NumOrderId: number;
  FullyPaid: boolean;
  Status: number;
  Items: Array<{
    OrderId: string;
    StockItemId: number;
    SKU: string;
    ItemNumber: string;
    Quantity: number;
    PricePerUnit: number;
  }>;
}

// Helper function with retry logic for rate limiting
async function callApiWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
  let retries = 0;

  while (true) {
    try {
      return await fn();
    } catch (error: any) { // Add explicit any type here
      // If it's a rate limit error (429) and we haven't reached max retries
      if (error.message && error.message.includes('429') && retries < maxRetries) {
        retries++;
        const delay = initialDelay * Math.pow(2, retries); // Exponential backoff
        console.log(`Rate limited. Retrying in ${delay}ms (retry ${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Not a rate limit error or we've exceeded retries
        throw error;
      }
    }
  }
}

// These helper functions are kept for API compatibility with existing code but are no longer used
// by the optimized getDailyOrderCounts function
async function getDayOrderCountByChannel(dayStart: Date, dayEnd: Date, channel: string): Promise<number> {
  console.log(`getDayOrderCountByChannel is deprecated. Use the optimized getDailyOrderCounts instead.`);
  return 0;
}

async function getDayOrderCount(dayStart: Date, dayEnd: Date): Promise<number> {
  console.log(`getDayOrderCount is deprecated. Use the optimized getDailyOrderCounts instead.`);
  return 0;
}

// Get all daily order counts for a date range, including channel breakdown
export async function getDailyOrderCounts(startDate: Date, endDate: Date): Promise<{ data: DailyOrderCount[], isCached: boolean }> {
  try {
    console.log(`Getting daily order counts from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Generate cache key for the entire week
    const cacheKey = `weekly_counts_${startDate.toISOString()}_${endDate.toISOString()}`;
    const cachedData = orderCountCache.get(cacheKey);
    if (cachedData) {
      console.log('Using cached weekly order counts data');
      return { data: cachedData as DailyOrderCount[], isCached: true };
    }

    // Initialize days structure
    const days: DailyOrderCount[] = [];
    const currentDate = new Date(startDate);

    // Build the days array with formatted dates
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];

      // Format the date for display
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      };

      // Add to days array - we'll populate counts later
      days.push({
        date: dateStr,
        count: 0, // Will update this later
        formattedDate: currentDate.toLocaleDateString('en-US', options),
        channels: {
          amazon: 0,
          ebay: 0,
          shopify: 0,
          other: 0
        }
      });

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Fetch data for the whole date range with pagination to avoid rate limits
    const ordersByDate: Record<string, {
      total: number;
      bySource: Record<string, number>;
    }> = {};

    // Initialize order counts structure for each day
    days.forEach(day => {
      ordersByDate[day.date] = {
        total: 0,
        bySource: {}
      };
    });

    // Make paginated API calls to get ALL orders for the entire date range
    await fetchAllOrdersWithPagination(startDate, endDate, (orders) => {
      // Process each batch of orders
      for (const order of orders) {
        // Get the processed date
        const processedDate = order.dProcessedOn || order.dProcessed;
        if (!processedDate) continue;

        const dateStr = new Date(processedDate).toISOString().split('T')[0];

        // Only process if it's within our date range
        if (ordersByDate[dateStr]) {
          // Increment total count
          ordersByDate[dateStr].total++;

          // Process by source
          const source = (order.Source || 'unknown').toLowerCase();
          if (!ordersByDate[dateStr].bySource[source]) {
            ordersByDate[dateStr].bySource[source] = 0;
          }
          ordersByDate[dateStr].bySource[source]++;
        }
      }
    });

    // Update each day with the counted data
    for (const day of days) {
      const dateData = ordersByDate[day.date];

      // Set total count
      day.count = dateData.total;

      // Set channel counts
      if (day.channels) {
        // Calculate Amazon count (combining variations of the name)
        day.channels.amazon = Object.entries(dateData.bySource)
          .filter(([source]) => source.includes('amazon') || source === 'amz')
          .reduce((sum, [_, count]) => sum + count, 0);

        // Calculate eBay count
        day.channels.ebay = Object.entries(dateData.bySource)
          .filter(([source]) => source.includes('ebay'))
          .reduce((sum, [_, count]) => sum + count, 0);

        // Calculate Shopify count
        day.channels.shopify = Object.entries(dateData.bySource)
          .filter(([source]) => source.includes('shopify'))
          .reduce((sum, [_, count]) => sum + count, 0);

        // Calculate Others (everything not counted above)
        day.channels.other = day.count - day.channels.amazon - day.channels.ebay - day.channels.shopify;
      }
    }

    // Cache the results for future use
    orderCountCache.set(cacheKey, days, 3600); // Cache for 1 hour
    console.log(`Cached order counts data for date range ${startDate.toISOString()} to ${endDate.toISOString()}`);

    return { data: days, isCached: false };
  } catch (error) {
    console.error('Error getting daily order counts:', error);
    throw error;
  }
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

/**
 * Get stock items by their SKUs with batch processing
 */
async function getStockItems(skus: string[]): Promise<Map<string, StockItem>> {
  const BATCH_SIZE = 100; // Linnworks API recommendation
  const stockItemsMap = new Map<string, StockItem>();
  const uniqueSkus = Array.from(new Set(skus)); // Remove duplicates
  const uncachedSkus: string[] = [];

  // Check cache first
  for (const sku of uniqueSkus) {
    const cachedItem = stockItemsCache.get(sku);
    if (cachedItem) {
      stockItemsMap.set(sku, cachedItem as StockItem);
    } else {
      uncachedSkus.push(sku);
    }
  }

  if (uncachedSkus.length > 0) {
    try {
      // Process SKUs in batches
      for (let i = 0; i < uncachedSkus.length; i += BATCH_SIZE) {
        const batch = uncachedSkus.slice(i, i + BATCH_SIZE);

        // Add exponential backoff for rate limiting
        const items = await callApiWithRetry(
          () => callLinnworksApi<StockItem[]>(
            'Inventory/GetInventoryItemsByIds',
            'POST',
            { request: { StockItemIds: batch } }
          ),
          5, // Increase max retries for large batches
          2000 // Increase initial delay
        );

        // Cache and store results
        items.forEach(item => {
          if (item.SKU) { // Ensure SKU exists
            stockItemsCache.set(item.SKU, item);
            stockItemsMap.set(item.SKU, item);
          }
        });

        // Add a small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < uncachedSkus.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error('Error fetching stock items:', error);
      // Continue with partial results rather than failing completely
    }
  }

  return stockItemsMap;
}

/**
 * Get detailed order information
 */
async function getOrderDetails(orderId: string): Promise<OrderDetails | null> {
  try {
    const details = await callApiWithRetry(() => callLinnworksApi<OrderDetails>(
      'Orders/GetOrderById',
      'POST',
      {
        request: {
          OrderId: orderId,
          LoadItems: true,
          LoadOrderProperties: true
        }
      }
    ));
    return details;
  } catch (error) {
    console.error(`Error fetching order details for order ${orderId}:`, error);
    return null;
  }
}

/**
 * Get daily orders for a specific date range with optional SKU filter
 */
export async function getDailyOrders(
  startDate: Date,
  endDate: Date,
  skuFilter?: string
): Promise<ProcessedOrderData[]> {
  try {
    console.log(`Getting daily orders from ${startDate.toISOString()} to ${endDate.toISOString()}${skuFilter ? ` with SKU filter: ${skuFilter}` : ''}`);

    let allOrders: ProcessedOrderData[] = [];
    let currentPage = 1;
    let hasMorePages = true;

    // Step 1: Get list of orders using SearchProcessedOrdersPaged
    while (hasMorePages) {
      const searchRequest = {
        DateField: "PROCESSED",
        FromDate: startDate.toISOString(),
        ToDate: endDate.toISOString(),
        PageNumber: currentPage,
        ResultsPerPage: 100, // Reduced to avoid rate limiting
        SearchTerm: "", // Empty string to match all
        SearchField: "REFERENCE", // Required field even if not searching
        ExactMatch: false,
        SearchTypes: [], // Empty array means all types
        Filters: [] // No additional filters
      };

      const result = await callApiWithRetry(() => callLinnworksApi<ProcessedOrdersResponse>(
        'ProcessedOrders/SearchProcessedOrders',
        'POST',
        { request: searchRequest }
      ));

      if (!result?.ProcessedOrders?.Data) {
        console.log('API Response:', JSON.stringify(result, null, 2));
        console.log('No order data returned from API');
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

      // Add a small delay between pages to avoid rate limiting
      if (hasMorePages) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`Retrieved ${allOrders.length} total orders`);

    // If we have a SKU filter but no items data, we can't filter by SKU
    if (skuFilter) {
      console.log('Warning: Cannot apply SKU filter without order details');
    }

    return allOrders;

  } catch (error) {
    console.error('Error getting daily orders:', error);
    throw error;
  }
}

/**
 * Fetches all orders with pagination to avoid API rate limits
 * @param startDate The start date for the order query
 * @param endDate The end date for the order query
 * @param batchProcessor A callback function to process each batch of orders
 */
async function fetchAllOrdersWithPagination(
  startDate: Date,
  endDate: Date,
  batchProcessor: (orders: ProcessedOrderData[]) => void
): Promise<void> {
  let currentPage = 1;
  let hasMorePages = true;
  let totalProcessed = 0;
  let delayBetweenRequests = 500; // Start with a small delay, will increase if rate limited

  console.log('Starting paginated fetch of all orders');

  while (hasMorePages) {
    try {
      // Avoid overwhelming the API by adding a delay between requests
      if (currentPage > 1) {
        console.log(`Waiting ${delayBetweenRequests}ms before next request`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }

      console.log(`Fetching page ${currentPage} of orders from ${startDate.toISOString()} to ${endDate.toISOString()}`);

      const searchRequest = {
        DateField: "processed",
        FromDate: startDate.toISOString(),
        ToDate: endDate.toISOString(),
        PageNumber: currentPage,
        ResultsPerPage: 250, // Fetch a good number of results per page to reduce total API calls
        ExtraFields: ["Source"] // Ensure we get the Source field
      };

      const result = await callApiWithRetry(
        () => callLinnworksApi<ProcessedOrdersResponse>(
          'ProcessedOrders/SearchProcessedOrders',
          'POST',
          { request: searchRequest }
        ),
        3,  // max retries
        2000 // initial delay
      );

      if (!result?.ProcessedOrders?.Data || result.ProcessedOrders.Data.length === 0) {
        console.log('No more orders to process');
        break;
      }

      const batch = result.ProcessedOrders.Data;
      const totalPages = result.ProcessedOrders.TotalPages || 1;
      const totalEntries = result.ProcessedOrders.TotalEntries || 0;

      console.log(`Retrieved page ${currentPage}/${totalPages} with ${batch.length} orders. Total entries: ${totalEntries}`);

      // Process this batch of orders
      batchProcessor(batch);

      totalProcessed += batch.length;

      // Check if there are more pages
      if (result.ProcessedOrders.TotalPages && currentPage < result.ProcessedOrders.TotalPages) {
        currentPage++;

        // If we're starting to get rate limited, increase the delay between requests
        if (currentPage % 5 === 0) {
          delayBetweenRequests = Math.min(delayBetweenRequests * 1.5, 5000); // Gradually increase delay up to 5 seconds max
        }
      } else {
        hasMorePages = false;
      }
    } catch (error: any) {
      if (error.message && error.message.includes('429')) {
        // If we hit a rate limit that our retry mechanism couldn't handle,
        // let's increase the delay dramatically and try again
        delayBetweenRequests = Math.min(delayBetweenRequests * 2, 10000);
        console.log(`Rate limit hit. Increasing delay to ${delayBetweenRequests}ms and retrying`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      } else {
        // For non-rate-limit errors, stop the pagination
        console.error('Error during paginated fetch:', error);
        hasMorePages = false;
      }
    }
  }

  console.log(`Completed paginated fetch. Processed ${totalProcessed} orders total.`);
}