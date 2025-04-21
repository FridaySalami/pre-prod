import { json } from '@sveltejs/kit';
import { callLinnworksApi } from '$lib/server/linnworksClient.server';

// Add interface for ProcessedOrders response
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

interface ProcessedOrderData {
  nOrderId?: number;
  Source?: string;
  dProcessedOn?: string;
  dProcessed?: string;
  [key: string]: any;
}

// Add a new interface to define the sourceInfo structure
interface SourceInfo {
  orderId?: number;
  source?: string;
  sourceType?: string;
  channel?: string;
  subSource?: string;
  allKeys: string[];
}

export async function GET({ url }) {
  try {
    const date = new Date();
    
    // Create yesterday's date range for testing
    const yesterday = new Date(date);
    yesterday.setDate(date.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    
    // Try different Source parameter formats
    const sourceFormats = [
      { name: 'No Source', request: {} },
      { name: 'Amazon uppercase', request: { Source: 'AMAZON' } },
      { name: 'Amazon lowercase', request: { Source: 'amazon' } },
      { name: 'Amazon mixed case', request: { Source: 'Amazon' } },
      { name: 'SourceType AMAZON', request: { SourceType: 'AMAZON' } },
      { name: 'Channel AMAZON', request: { Channel: 'AMAZON' } },
      { name: 'SubSource AMAZON', request: { SubSource: 'AMAZON' } }
    ];
    
    // Make a request with each format
    const results = await Promise.all(sourceFormats.map(async (format) => {
      try {
        const searchRequest = {
          DateField: "processed", 
          FromDate: yesterday.toISOString(),
          ToDate: yesterdayEnd.toISOString(),
          PageNumber: 1,
          ResultsPerPage: 20,
          ...format.request
        };
        
        // Type the result properly
        const result = await callLinnworksApi<ProcessedOrdersResponse>(
          'ProcessedOrders/SearchProcessedOrders', 
          'POST', 
          { request: searchRequest }
        );

        // In the getDailyOrderCounts function:
        // Get the orders and process them by day and source
        const allOrders = result?.ProcessedOrders?.Data || [];
        console.log(`Retrieved ${allOrders.length} orders out of ${result?.ProcessedOrders?.TotalEntries} total`);

        // Debug: Log sample orders to see what's in the Source field
        if (allOrders.length > 0) {
          console.log('First 3 orders Source fields:');
          for (let i = 0; i < Math.min(3, allOrders.length); i++) {
            console.log(`Order ${i+1}: Source = "${allOrders[i]?.Source}", Source type = ${typeof allOrders[i]?.Source}`);
          }
        }
        
        return {
          format: format.name,
          request: format.request,
          totalEntries: result?.ProcessedOrders?.TotalEntries,
          dataCount: result?.ProcessedOrders?.Data?.length || 0,
          success: true,
          firstOrderSource: result?.ProcessedOrders?.Data?.[0]?.Source
        };
      } catch (error: any) { // Type error as any
        return {
          format: format.name,
          request: format.request,
          error: error.message || String(error),
          success: false
        };
      }
    }));
    
    return json({ 
      results,
      date: yesterday.toISOString()
    });
  } catch (error: any) { // Type error as any
    return json({ 
      error: error.message || String(error)
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    const date = new Date();
    
    // Use a wider date range to ensure we get some data
    const startDate = new Date(date);
    startDate.setDate(date.getDate() - 14); // Two weeks ago
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    // Just get all orders without filtering
    const searchRequest = {
      DateField: "processed",
      FromDate: startDate.toISOString(),
      ToDate: endDate.toISOString(),
      PageNumber: 1,
      ResultsPerPage: 20
    };
    
    // Make the API call
    const result = await callLinnworksApi<ProcessedOrdersResponse>(
      'ProcessedOrders/SearchProcessedOrders',
      'POST',
      { request: searchRequest }
    );
    
    const allOrders = result?.ProcessedOrders?.Data || [];
    
    // If we have orders, extract the actual source field names and values
    let sourceInfo: SourceInfo[] = []; // Add explicit type here
    if (allOrders.length > 0) {
      sourceInfo = allOrders.map(order => {
        // Extract all fields that might be related to source/channel
        return {
          orderId: order.nOrderId,
          source: order.Source,
          sourceType: order.SourceType,
          channel: order.Channel,
          subSource: order.SubSource,
          allKeys: Object.keys(order).filter(key => 
            key.toLowerCase().includes('source') || 
            key.toLowerCase().includes('channel')
          )
        };
      });
    }
    
    return json({
      dateRange: {
        from: startDate.toISOString(),
        to: endDate.toISOString()
      },
      totalEntries: result?.ProcessedOrders?.TotalEntries,
      dataCount: allOrders.length,
      sourceInfo,
      // Include the first 3 orders in full for inspection
      sampleOrders: allOrders.slice(0, 3)
    });
  } catch (error: any) {
    return json({ 
      error: error.message || String(error)
    }, { status: 500 });
  }
}