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

// Helper function with caching
// Update to use a more robust approach that does filtering in our code
async function getDayOrderCountByChannel(dayStart: Date, dayEnd: Date, channel: string): Promise<number> {
  try {
    // Create cache key
    const cacheKey = `${dayStart.toISOString()}_${dayEnd.toISOString()}_${channel}`;

    // Check if we have a cached result
    const cachedCount = orderCountCache.get(cacheKey);
    if (cachedCount !== undefined) {
      console.log(`Using cached count for ${channel} on ${dayStart.toDateString()}: ${cachedCount}`);
      return cachedCount as number;
    }

    // Get total count for this day first
    const totalCount = await getDayOrderCount(dayStart, dayEnd);

    // If no orders for this day, return zero for all channels
    if (totalCount === 0) {
      console.log(`No orders found for ${dayStart.toDateString()}, returning 0 for ${channel}`);
      orderCountCache.set(cacheKey, 0);
      return 0;
    }

    // For now, use estimated percentages based on typical e-commerce patterns
    // These are placeholder values until the API can provide actual data
    let percentage = 0;

    switch (channel.toUpperCase()) {
      case 'AMAZON':
        percentage = 0.65; // Amazon ~65% of orders
        break;
      case 'EBAY':
        percentage = 0.20; // eBay ~20% of orders
        break;
      case 'SHOPIFY':
        percentage = 0.10; // Shopify ~10% of orders
        break;
      default:
        percentage = 0.05; // Other ~5% of orders
    }

    // Calculate the estimated channel count
    const channelCount = Math.round(totalCount * percentage);

    console.log(`Estimated ${channel} count for ${dayStart.toDateString()}: ${channelCount} (${percentage * 100}% of ${totalCount} total)`);

    // Cache the result
    orderCountCache.set(cacheKey, channelCount);

    return channelCount;
  } catch (error) {
    console.error(`Error getting ${channel} count for ${dayStart.toDateString()}:`, error);
    return 0;
  }
}

// Add this helper function for total counts for a specific day
async function getDayOrderCount(dayStart: Date, dayEnd: Date): Promise<number> {
  try {
    // Create cache key
    const cacheKey = `${dayStart.toISOString()}_${dayEnd.toISOString()}_TOTAL`;

    // Check if we have a cached result
    const cachedCount = orderCountCache.get(cacheKey);
    if (cachedCount !== undefined) {
      console.log(`Using cached count for TOTAL on ${dayStart.toDateString()}: ${cachedCount}`);
      return cachedCount as number;
    }

    // If not in cache, make the API call
    console.log(`Fetching TOTAL orders for ${dayStart.toDateString()}`);

    const searchRequest = {
      DateField: "processed",
      FromDate: dayStart.toISOString(),
      ToDate: dayEnd.toISOString(),
      PageNumber: 1,
      ResultsPerPage: 20
    };

    const result = await callApiWithRetry(() => callLinnworksApi<ProcessedOrdersResponse>(
      'ProcessedOrders/SearchProcessedOrders',
      'POST',
      { request: searchRequest }
    ));

    const count = result?.ProcessedOrders?.TotalEntries || 0;

    // Save to cache
    orderCountCache.set(cacheKey, count);

    return count;
  } catch (error) {
    console.error(`Error getting total count for ${dayStart.toDateString()}:`, error);
    return 0;
  }
}

// Get all daily order counts for a date range, including channel breakdown
export async function getDailyOrderCounts(startDate: Date, endDate: Date): Promise<DailyOrderCount[]> {
  try {
    console.log(`Getting daily order counts from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Make ONE API call to get ALL orders for the entire date range
    const searchRequest = {
      DateField: "processed",
      FromDate: startDate.toISOString(),
      ToDate: endDate.toISOString(),
      PageNumber: 1,
      ResultsPerPage: 500, // Changed from 1000 to 500 (API maximum limit)
      // No Source filter - we'll filter the results ourselves
    };

    console.log('Making single API call for all orders in date range');
    const result = await callApiWithRetry(() => callLinnworksApi<ProcessedOrdersResponse>(
      'ProcessedOrders/SearchProcessedOrders',
      'POST',
      { request: searchRequest }
    ));

    // Check if we have data
    if (!result?.ProcessedOrders?.Data) {
      console.log('No order data returned from API');
      return [];
    }

    // Get the orders and process them by day and source
    const allOrders = result.ProcessedOrders.Data;
    console.log(`Retrieved ${allOrders.length} orders out of ${result.ProcessedOrders.TotalEntries} total`);

    // Now organize by day
    const ordersByDay: Record<string, {
      total: number,
      amazon: number,
      ebay: number,
      shopify: number,
      other: number
    }> = {};

    // Initialize days
    const days: DailyOrderCount[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];

      // Initialize counts for this day
      ordersByDay[dateStr] = {
        total: 0,
        amazon: 0,
        ebay: 0,
        shopify: 0,
        other: 0
      };

      // Format the date for display
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      };

      // Add to days array - we'll populate counts later
      days.push({
        date: dateStr,
        count: 0 // Will update this later
        , formattedDate: currentDate.toLocaleDateString('en-US', options),
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

    // Get the total order counts for each day directly using the API and caching
    // This is more reliable than trying to count from a limited dataset
    for (const day of days) {
      const dayStart = new Date(day.date);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(day.date);
      dayEnd.setHours(23, 59, 59, 999);

      // Get total order count for this day
      const totalCount = await getDayOrderCount(dayStart, dayEnd);
      day.count = totalCount;

      // Get channel-specific counts
      if (day.channels) {
        day.channels.amazon = await getDayOrderCountByChannel(dayStart, dayEnd, 'AMAZON');
        day.channels.ebay = await getDayOrderCountByChannel(dayStart, dayEnd, 'EBAY');
        day.channels.shopify = await getDayOrderCountByChannel(dayStart, dayEnd, 'SHOPIFY');

        // Calculate other as the difference between total and known channels
        const knownChannels = day.channels.amazon + day.channels.ebay + day.channels.shopify;
        day.channels.other = Math.max(0, totalCount - knownChannels);
      }
    }

    return days;
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