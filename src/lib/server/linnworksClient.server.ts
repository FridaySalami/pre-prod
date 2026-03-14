import { env } from '$env/dynamic/private';
import { getTestOpenOrdersData } from '$lib/shared/mockData';

const {
  LINNWORKS_APP_ID,
  LINNWORKS_APP_SECRET,
  LINNWORKS_ACCESS_TOKEN
} = env;

// API URLs
const AUTH_URL = 'https://api.linnworks.net';
const API_URL = 'https://eu-ext.linnworks.net';

// Store authentication info
let authToken: string | null = null;
let serverURL: string | null = null;

// Types for authentication
interface BaseSession {
  Token: string;
  Server: string;
  [key: string]: any;
}

// Authenticate with Linnworks
async function authenticate(): Promise<{ token: string, server: string }> {
  try {
    console.log('Authenticating with Linnworks...');

    // Using AuthorizeByApplication method from the Linnworks Auth API
    const authResponse = await fetch(`${AUTH_URL}/api/Auth/AuthorizeByApplication`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ApplicationId: LINNWORKS_APP_ID,
        ApplicationSecret: LINNWORKS_APP_SECRET,
        Token: LINNWORKS_ACCESS_TOKEN
      })
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error(`Auth API Error ${authResponse.status}: ${errorText}`);
      throw new Error(`Auth API Error ${authResponse.status}: ${errorText}`);
    }

    const session = await authResponse.json() as BaseSession;
    console.log('Authentication successful. Server:', session.Server);

    return {
      token: session.Token,
      server: session.Server || API_URL // Use the server from the response or fall back to default
    };
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
}

// Get or refresh authentication
export async function getLinnworksAuth(): Promise<{ token: string, server: string }> {
  if (!authToken || !serverURL) {
    const auth = await authenticate();
    authToken = auth.token;
    serverURL = auth.server;
  }
  return { token: authToken, server: serverURL };
}

/**
 * Makes a call to the Linnworks API
 * @param endpoint - API endpoint path (without the /api/ prefix)
 * @param method - HTTP method, either GET or POST
 * @param body - Request body for POST requests
 * @returns Promise with the API response
 */
export async function callLinnworksApi<T>(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<T> {
  // Get auth first
  let auth = await getLinnworksAuth();

  const headers: Record<string, string> = {
    'Authorization': auth.token,
    'Accept': 'application/json'
  };

  const options: RequestInit = { method, headers };

  // Always use HTTPS for API calls
  let url = `${auth.server}/api/${endpoint}`;

  // Add body for POST, or query params for GET
  if (body) {
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    } else {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) {
        searchParams.append(key, String(value));
      }
      url += `?${searchParams.toString()}`;
    }
  }

  console.log(`Making API call to ${url} with method ${method}`);

  let response = await fetch(url, options);

  // If we get a 401, the token might be expired. Try to re-authenticate once
  if (response.status === 401) {
    console.log('Got 401 error, token might be expired. Re-authenticating...');

    // Clear the cached token
    authToken = null;
    serverURL = null;

    // Get a fresh token
    auth = await getLinnworksAuth();
    headers['Authorization'] = auth.token;

    // Retry the request with the new token
    console.log(`Retrying API call to ${url} with fresh token`);
    response = await fetch(url, options);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`API Error ${response.status}: ${errorText}`);
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return await response.json() as T;
}

/**
 * Get refund data from Linnworks
 * This processes Linnworks orders data specifically for refunds
 */
export async function getRefundsData(fromDate: string, toDate: string): Promise<any> {
  console.log(`Getting refunds data from ${fromDate} to ${toDate}`);

  // Define the query parameters for the Linnworks API
  const params = {
    DateFrom: fromDate,
    DateTo: toDate,
    AdditionalFilters: [
      {
        FilterName: "TOTAL_CHARGE",
        FilterValue: "< 0",  // Negative values are refunds
        Condition: "CONDITION_LESS_THAN",
        FilterNameExact: true
      }
    ],
    PageNumber: 1,
    EntriesPerPage: 100
  };

  try {
    // Call the Linnworks Orders API with a specific return type
    interface LinnworksOrdersResponse {
      Data?: any[];
      [key: string]: any;
    }

    const result = await callLinnworksApi<LinnworksOrdersResponse>('Orders/GetOrdersProcessed', 'POST', params);

    // Now we have proper type safety when accessing result properties
    const formattedResult = {
      ProcessedOrders: {
        Data: Array.isArray(result.Data) ? result.Data :
          (Array.isArray(result) ? result : [])
      }
    };

    // Log some debug info
    console.log(`Got ${formattedResult.ProcessedOrders.Data.length} refunds from Linnworks API`);

    if (formattedResult.ProcessedOrders.Data.length > 0) {
      console.log('Sample refund data:', JSON.stringify(formattedResult.ProcessedOrders.Data[0], null, 2));
    }

    return formattedResult;
  } catch (error) {
    console.error('Error getting refunds data:', error);
    // Return empty results rather than throwing
    return {
      ProcessedOrders: {
        Data: []
      }
    };
  }
}

/**
 * Get open orders data from Linnworks
 */
export async function getOpenOrdersData(pageNumber: number, pageSize: number): Promise<any> {
  console.log(`Getting open orders data for page ${pageNumber}, size ${pageSize}`);

  // Define interface for OpenOrders response
  interface OpenOrdersResponse {
    PageNumber?: number;
    EntriesPerPage?: number;
    TotalPages?: number;
    TotalEntries?: number;
    Data?: any[];
    [key: string]: any;
  }

  try {
    // Based on the documentation, first we need to get the IDs of open orders
    // Get stock locations first (might be required for OpenOrders endpoints)
    const locationsResponse = await callLinnworksApi<any[]>('Inventory/GetStockLocations', 'GET');
    const locationId = locationsResponse && locationsResponse.length > 0
      ? locationsResponse[0].StockLocationId
      : '';

    console.log('Got location ID:', locationId);

    // Step 1: First get the list of open orders using GetOpenOrders
    console.log('Making API call to OpenOrders/GetOpenOrders with locationId:', locationId);
    const openOrdersResponse = await callLinnworksApi<OpenOrdersResponse>('OpenOrders/GetOpenOrders', 'POST', {
      ViewId: 0, // Default view
      LocationId: locationId,
      EntriesPerPage: pageSize,
      PageNumber: pageNumber
    });

    console.log(`Got open orders response with ${openOrdersResponse.Data?.length || 0} orders`);

    // Ensure consistent structure for the response
    const formattedResult = {
      PageNumber: openOrdersResponse.PageNumber || pageNumber,
      EntriesPerPage: openOrdersResponse.EntriesPerPage || pageSize,
      TotalPages: openOrdersResponse.TotalPages || 1,
      TotalEntries: openOrdersResponse.TotalEntries || (openOrdersResponse.Data?.length || 0),
      Data: Array.isArray(openOrdersResponse.Data) ? openOrdersResponse.Data : [],
      isRealData: true // Flag to indicate this is real data
    };

    return formattedResult;
  } catch (error) {
    console.error('Error getting open orders data:', error);

    // For development, return mock data instead of throwing when the API fails
    console.log('Falling back to mock data due to API error');
    return {
      ...getTestOpenOrdersData(pageNumber, pageSize),
      isRealData: false // Flag to indicate this is mock data
    };
  }
}

/**
 * Get extended properties for a list of items by their StockItemIds
 */
export async function getExtendedProperties(stockItemIds: string[]) {
  if (!stockItemIds || stockItemIds.length === 0) return [];
  try {
    // API: Inventory/GetStockItemExtendedProperties
    // Requires an array of stockItemIds
    return await callLinnworksApi<any[]>('Inventory/GetStockItemExtendedProperties', 'POST', {
      stockItemIds
    });
  } catch (error) {
    console.error('Error getting extended properties:', error);
    return [];
  }
}

/**
 * Get stock items by SKU to get their StockItemIds and dimensions
 */
/**
 * Get stock items by SKU to get their StockItemIds and dimensions
 */
export async function getStockItemsBySku(skus: string[]) {
  if (!skus || skus.length === 0) return [];
  try {
    // Use Promise.all to search in parallel for all requested SKUs
    const results = await Promise.all(
      skus.map(async (sku) => {
        const item = await searchStockItemBySku(sku);
        if (item) {
          // Map search fields to the format expected by the caller
          // Keep both SKU and ItemNumber for clarity as requested
          return {
            ...item,
            LinnworksSKU: item.SKU,
            ItemNumber: item.ItemNumber,
            StockItemId: item.StockItemId,
            Width: item.Width,
            Height: item.Height,
            Depth: item.Depth
          };
        }
        return null;
      })
    );

    const validResults = results.filter(item => item !== null);
    console.log(`Successfully fetched ${validResults.length} items from Linnworks out of ${skus.length} requested`);
    return validResults;
  } catch (error) {
    console.error('Error in getStockItemsBySku:', error);
    return [];
  }
}

/**
 * Get item by SKU using the generic stock item search
 */
export async function searchStockItemBySku(sku: string) {
  try {
    const response = await callLinnworksApi<any>('Stock/GetStockItems', 'POST', {
      SearchTerm: sku,
      EntriesPerPage: 10,
      PageNumber: 1,
      IncludeImages: false,
      DataRequirements: ["Inventory"] 
    });

    console.log(`[RAW FEEDS] Search response for ${sku}:`, JSON.stringify(response, null, 2));

    const items = response?.Data || [];

    const norm = (s: string | undefined | null) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const targetSku = norm(sku);

    const exactMatch = items.find((i: any) =>
      norm(i.ItemNumber) === targetSku || norm(i.SKU) === targetSku
    );

    if (exactMatch) {
      // Step 2: Use Stock/GetStockItemsFull to get detailed item data including dimensions
      try {
        const fullDetails = await callLinnworksApi<any>('Stock/GetStockItemsFull', 'POST', {
          stockItemIds: [exactMatch.StockItemId],
          dataRequirements: ["Inventory", "StockLevels", "ExtendedProperties"]
        });
        
        console.log(`[TWO-STEP DEBUG] GetStockItemsFull (POST) for SKU ${sku}:`, JSON.stringify(fullDetails, null, 2));

        if (fullDetails && Array.isArray(fullDetails) && fullDetails.length > 0) {
          const target = fullDetails[0];

          // Robust mapping for dimensions which can be in several places depending on the API version/requirements
          const width = Number(target.Inventory?.Width || target.Item?.Width || target.Width || target.DimWidth || 0);
          const height = Number(target.Inventory?.Height || target.Item?.Height || target.Height || target.DimHeight || 0);
          const depth = Number(target.Inventory?.Depth || target.Item?.Depth || target.Depth || target.DimDepth || 0);

          return {
            ...exactMatch,
            Width: width,
            Height: height,
            Depth: depth,
            PackageGroupName: target.Inventory?.PackageGroupName || target.Item?.PackageGroupName || exactMatch.PackageGroupName || exactMatch.DefaultPackageGroup,
            ExtendedProperties: target.ExtendedProperties || target.Item?.ExtendedProperties || []
          };
        }
      } catch (err) {
        console.error(`Error fetching full details for SKU ${sku}:`, err.message);
      }

      return {
        ...exactMatch,
        Width: Number(exactMatch.Width || exactMatch.DimWidth || 0),
        Height: Number(exactMatch.Height || exactMatch.DimHeight || 0),
        Depth: Number(exactMatch.Depth || exactMatch.DimDepth || 0),
        PackageGroupName: exactMatch.PackageGroupName || exactMatch.DefaultPackageGroup
      };
    }

    return null;
  } catch (error) {
    return null;
  }
}


