import { json } from '@sveltejs/kit';
import { callLinnworksApi } from '$lib/server/linnworksClient.server';
import type { RequestEvent } from '@sveltejs/kit';

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

export async function GET({ url }: RequestEvent) {
  try {
    const dateStr = url.searchParams.get('date');
    if (!dateStr) {
      return json({ error: 'Date parameter is required' }, { status: 400 });
    }

    const startDate = new Date(dateStr);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateStr);
    endDate.setHours(23, 59, 59, 999);

    console.log('Fetching orders for date range:', {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    });

    const result = await callLinnworksApi<FinancialResponse>(
      'ProcessedOrders/SearchProcessedOrders',
      'POST',
      {
        request: {
          DateField: "processed",
          FromDate: startDate.toISOString(),
          ToDate: endDate.toISOString(),
          PageNumber: 1,
          ResultsPerPage: 100,
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

    console.log('API Response:', result);

    if (!result?.ProcessedOrders?.Data) {
      console.log('No ProcessedOrders.Data in response');
      return json({
        error: 'No data returned from API'
      }, { status: 500 });
    }

    const formattedOrders = result.ProcessedOrders.Data.map((order: ProcessedOrderData) => ({
      orderInfo: {
        id: order.OrderId || order.nOrderId,
        source: `${order.Source}${order.SubSource ? ` (${order.SubSource})` : ''}`,
        service: order.PostalServiceName || '',
        fulfillment: order.FulfilmentLocationName || '',
        currency: order.Currency || 'GBP',
        status: order.Status || 0
      },
      financial: {
        totalCharge: order.fTotalCharge || 0,
        postageCost: order.fPostageCost || 0,
        totalDiscount: order.fTotalDiscount || 0,
        countryTaxRate: order.CountryTaxRate || 0
      },
      shipping: {
        itemWeight: order.ItemWeight || 0,
        totalWeight: order.TotalWeight || 0,
        service: order.PostalServiceName || ''
      },
      items: order.Items || []
    }));

    console.log('Formatted orders:', formattedOrders);

    return json({
      totalEntries: result.ProcessedOrders.TotalEntries,
      orders: result.ProcessedOrders?.Data?.map((order: ProcessedOrderData) => ({
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
    console.error('Error in daily products endpoint:', error);
    return json({
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
