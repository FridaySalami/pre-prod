import { json } from '@sveltejs/kit';
import { callLinnworksApi } from '$lib/server/linnworksClient.server';

export async function GET({ url }) {
  try {
    // Get orders from the last 7 days to find some data
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    console.log(`Debug: Getting single order from ${weekAgo.toISOString()} to ${today.toISOString()}`);

    // First, get a list of recent orders to find one to debug
    const searchRequest = {
      DateField: "processed",
      FromDate: weekAgo.toISOString(),
      ToDate: today.toISOString(),
      PageNumber: 1,
      ResultsPerPage: 20, // Minimum required by Linnworks API
      ExtraFields: [
        "Source",
        "PostalServiceCost",
        "TotalCharge",
        "SubSource",
        "PostageCostExTax",
        "Subtotal",
        "CountryTaxRate",
        "fTax",
        "fPostageCost",
        "fTotalDiscount",
        "PostalServiceName"
      ]
    };

    const result = await callLinnworksApi<any>(
      'ProcessedOrders/SearchProcessedOrders',
      'POST',
      { request: searchRequest }
    );

    if (!result?.ProcessedOrders?.Data || result.ProcessedOrders.Data.length === 0) {
      return json({
        error: "No recent orders found to debug",
        searchRequest,
        searchPeriod: {
          from: weekAgo.toISOString(),
          to: today.toISOString()
        }
      });
    }

    // Get the first order for debugging
    const sampleOrder = result.ProcessedOrders.Data[0];

    // Also try to get order details using the order ID if available
    let orderDetails = null;
    if (sampleOrder.nOrderId) {
      try {
        orderDetails = await callLinnworksApi<any>(
          `Orders/${sampleOrder.nOrderId}`,
          'GET'
        );
      } catch (detailError) {
        console.log('Could not fetch order details:', detailError);
      }
    }

    return json({
      message: "Sample order data for Linnworks support ticket",
      searchRequest,
      searchPeriod: {
        from: weekAgo.toISOString(),
        to: today.toISOString()
      },
      apiEndpoint: "ProcessedOrders/SearchProcessedOrders",
      method: "POST",
      sampleOrder: {
        rawApiResponse: sampleOrder,
        orderDetails: orderDetails,
        analysisForSupport: {
          orderId: sampleOrder.nOrderId || "Not available",
          source: sampleOrder.Source || "Not available",
          totalCharge: sampleOrder.fTotalCharge || "Not available",
          postageCost: sampleOrder.fPostageCost || "Not available",
          postageCostExTax: sampleOrder.PostageCostExTax || "Not available",
          postalServiceCost: sampleOrder.PostalServiceCost || "Not available",
          postalServiceName: sampleOrder.PostalServiceName || "Not available",
          tax: sampleOrder.fTax || "Not available",
          discount: sampleOrder.fTotalDiscount || "Not available",
          subtotal: sampleOrder.Subtotal || "Not available",
          countryTaxRate: sampleOrder.CountryTaxRate || "Not available",
          missingFields: []
        }
      },
      totalOrdersFound: result.ProcessedOrders.Data.length,
      supportTicketInfo: {
        issue: "Missing shipping/postal service cost and fee data in ProcessedOrders API response",
        expectedFields: [
          "PostalServiceCost",
          "fPostageCost",
          "PostageCostExTax",
          "PostalServiceName"
        ],
        actualFieldsReceived: Object.keys(sampleOrder)
      }
    });

  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
