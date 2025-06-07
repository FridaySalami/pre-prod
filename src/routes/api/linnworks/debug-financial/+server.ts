import { json } from '@sveltejs/kit';
import { callLinnworksApi } from '$lib/server/linnworksClient.server';

interface OrderItem {
  ItemNumber?: string;
  ItemName?: string;
  Quantity?: number;
  CategoryName?: string;
  SKU?: string;
  Weight?: number;
  ItemValue?: number;
}

interface ProcessedOrderData {
  dProcessedOn?: string;
  dProcessed?: string;
  fTotalCharge?: number;
  fPostageCost?: number;
  fTotalDiscount?: number;
  OrderId?: string;
  nOrderId?: number;
  Status?: number;
  Currency?: string;
  Source?: string;
  SubSource?: string;
  CountryTaxRate?: number;
  PostalServiceName?: string;
  FulfilmentLocationName?: string;
  ItemWeight?: number;
  TotalWeight?: number;
  Items?: OrderItem[];
  [key: string]: any; // Allow additional fields
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

export async function GET() {
  try {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    // Make API call
    const result = await callLinnworksApi<FinancialResponse>(
      'ProcessedOrders/SearchProcessedOrders',
      'POST',
      {
        request: {
          DateField: "processed",
          FromDate: yesterday.toISOString(),
          ToDate: yesterdayEnd.toISOString(),
          PageNumber: 1,
          ResultsPerPage: 20, // Keep small for debug endpoint
          ExtraFields: [
            "PostalServiceCost",
            "TotalCharge",
            "Subtotal",
            "OrderId",
            "Status",
            "Currency",
            "Source",
            "SubSource",
            "CountryTaxRate",
            "PostalServiceName",
            "FulfilmentLocationName",
            "ItemWeight",
            "TotalWeight",
            "Items"
          ],
          OrderStates: []
        }
      }
    );

    if (!result?.ProcessedOrders?.Data) {
      return json({
        error: 'No data returned from API'
      }, { status: 500 });
    }

    // Get the actual field names present in the first order
    const sampleOrder = result.ProcessedOrders.Data[0];
    const allFields = sampleOrder ? Object.keys(sampleOrder) : [];
    const financialFields = allFields.filter(field => field.startsWith('f'));

    return json({
      totalEntries: result.ProcessedOrders.TotalEntries,
      dataCount: result.ProcessedOrders.Data.length,
      sampleFinancialFields: financialFields,
      // Include full sample orders for inspection
      sampleOrders: result.ProcessedOrders.Data.map(order => ({
        orderInfo: {
          id: order.OrderId || order.nOrderId,
          source: `${order.Source}${order.SubSource ? ` (${order.SubSource})` : ''}`,
          service: order.PostalServiceName,
          fulfillment: order.FulfilmentLocationName,
          currency: order.Currency,
          status: order.Status
        },
        financial: {
          totalCharge: order.fTotalCharge,
          postageCost: order.fPostageCost,
          totalDiscount: order.fTotalDiscount,
          countryTaxRate: order.CountryTaxRate
        },
        shipping: {
          itemWeight: order.ItemWeight,
          totalWeight: order.TotalWeight,
          service: order.PostalServiceName
        },
        items: order.Items || []
      }))
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return json({
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
