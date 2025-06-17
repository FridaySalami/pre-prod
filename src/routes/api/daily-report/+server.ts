import type { RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE } from '$env/static/private';
import { format, addDays } from 'date-fns';

if (!PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  throw new Error('Missing Supabase configuration in environment variables');
}

const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE);

interface DailyReportData {
  date: string;
  formattedDate: string;

  // Fulfillment Operations
  fulfillment: {
    shipmentsPacked: number;
    scheduledHours: number;
    totalHoursUsed: number;
    managementHoursUsed: number;
    packingHoursUsed: number;
    pickingHoursUsed: number;
    laborEfficiency: number;
    laborUtilization: number;
  };

  // Sales Performance  
  sales: {
    totalSales: number;
    amazonSales: number;
    ebaySales: number;
    shopifySales: number;
    // Formatted currency strings
    totalSalesFormatted: string;
    amazonSalesFormatted: string;
    ebaySalesFormatted: string;
    shopifySalesFormatted: string;
    // Sales breakdown percentages
    amazonSalesPercent: number;
    ebaySalesPercent: number;
    shopifySalesPercent: number;
  };

  // Order Volume
  orders: {
    totalOrders: number;
    amazonOrders: number;
    ebayOrders: number;
    shopifyOrders: number;
    // Order distribution percentages
    amazonOrdersPercent: number;
    ebayOrdersPercent: number;
    shopifyOrdersPercent: number;
  };

  // Additional calculated metrics
  metrics: {
    averageOrderValue: number;
    amazonAOV: number;
    ebayAOV: number;
    shopifyAOV: number;
    shipmentsPerHour: number;
    // Formatted currency strings
    averageOrderValueFormatted: string;
    amazonAOVFormatted: string;
    ebayAOVFormatted: string;
    shopifyAOVFormatted: string;
  };

  // Status information
  status: {
    dataComplete: boolean;
    hasComprehensiveData: boolean;
    lastUpdated: string;
  };
}

/**
 * GET /api/daily-report?date=YYYY-MM-DD
 * Returns comprehensive daily metrics formatted for business reporting.
 * If no date is provided, returns yesterday's data by default.
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    // Get the requested date or default to yesterday
    let requestedDate = url.searchParams.get('date');

    if (!requestedDate) {
      // Default to yesterday for Make.com's 6am call - use UK timezone
      const now = new Date();
      // Get current time in UK timezone
      const ukTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" }));
      const yesterday = addDays(ukTime, -1);
      requestedDate = format(yesterday, 'yyyy-MM-dd');
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(requestedDate)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid date format. Use YYYY-MM-DD format.'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Query the daily_metric_review table for comprehensive data
    const { data: reviewData, error: reviewError } = await supabaseAdmin
      .from('daily_metric_review')
      .select('*')
      .eq('date', requestedDate)
      .maybeSingle();

    if (reviewError) {
      console.error('Error fetching daily metric review:', reviewError);
      return new Response(
        JSON.stringify({
          error: 'Database error while fetching metrics data'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // If no comprehensive data, try basic metrics as fallback
    let fallbackData = null;
    if (!reviewData) {
      const { data: basicData, error: basicError } = await supabaseAdmin
        .from('daily_metrics')
        .select('*')
        .eq('date', requestedDate)
        .maybeSingle();

      if (!basicError && basicData) {
        fallbackData = basicData;
      }
    }

    // Prepare the response data
    const response: DailyReportData = {
      date: requestedDate,
      formattedDate: format(new Date(requestedDate), 'EEEE, do MMMM yyyy'),

      fulfillment: {
        shipmentsPacked: 0,
        scheduledHours: 0,
        totalHoursUsed: 0,
        managementHoursUsed: 0,
        packingHoursUsed: 0,
        pickingHoursUsed: 0,
        laborEfficiency: 0,
        laborUtilization: 0
      },

      sales: {
        totalSales: 0,
        amazonSales: 0,
        ebaySales: 0,
        shopifySales: 0,
        totalSalesFormatted: '£0.00',
        amazonSalesFormatted: '£0.00',
        ebaySalesFormatted: '£0.00',
        shopifySalesFormatted: '£0.00',
        amazonSalesPercent: 0,
        ebaySalesPercent: 0,
        shopifySalesPercent: 0
      },

      orders: {
        totalOrders: 0,
        amazonOrders: 0,
        ebayOrders: 0,
        shopifyOrders: 0,
        amazonOrdersPercent: 0,
        ebayOrdersPercent: 0,
        shopifyOrdersPercent: 0
      },

      metrics: {
        averageOrderValue: 0,
        amazonAOV: 0,
        ebayAOV: 0,
        shopifyAOV: 0,
        shipmentsPerHour: 0,
        averageOrderValueFormatted: '£0.00',
        amazonAOVFormatted: '£0.00',
        ebayAOVFormatted: '£0.00',
        shopifyAOVFormatted: '£0.00'
      },

      status: {
        dataComplete: false,
        hasComprehensiveData: !!reviewData,
        lastUpdated: new Date().toISOString()
      }
    };

    // Populate data from comprehensive source if available
    if (reviewData) {
      // Fulfillment data
      response.fulfillment = {
        shipmentsPacked: reviewData.shipments_packed || 0,
        scheduledHours: reviewData.scheduled_hours || 0,
        totalHoursUsed: reviewData.actual_hours_worked || 0,
        managementHoursUsed: reviewData.management_hours_used || 0,
        packingHoursUsed: reviewData.packing_hours_used || 0,
        pickingHoursUsed: reviewData.picking_hours_used || 0,
        laborEfficiency: reviewData.labor_efficiency || 0,
        laborUtilization: reviewData.labor_utilization_percent || 0
      };

      // Sales data with proper formatting
      const totalSales = reviewData.total_sales || 0;
      const amazonSales = reviewData.amazon_sales || 0;
      const ebaySales = reviewData.ebay_sales || 0;
      const shopifySales = reviewData.shopify_sales || 0;

      response.sales = {
        totalSales,
        amazonSales,
        ebaySales,
        shopifySales,
        totalSalesFormatted: `£${totalSales.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        amazonSalesFormatted: `£${amazonSales.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        ebaySalesFormatted: `£${ebaySales.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        shopifySalesFormatted: `£${shopifySales.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        amazonSalesPercent: totalSales > 0 ? Math.round((amazonSales / totalSales) * 100 * 10) / 10 : 0,
        ebaySalesPercent: totalSales > 0 ? Math.round((ebaySales / totalSales) * 100 * 10) / 10 : 0,
        shopifySalesPercent: totalSales > 0 ? Math.round((shopifySales / totalSales) * 100 * 10) / 10 : 0
      };

      // Orders data
      response.orders = {
        totalOrders: reviewData.linnworks_total_orders || 0,
        amazonOrders: reviewData.linnworks_amazon_orders || 0,
        ebayOrders: reviewData.linnworks_ebay_orders || 0,
        shopifyOrders: reviewData.linnworks_shopify_orders || 0,
        amazonOrdersPercent: reviewData.amazon_orders_percent || 0,
        ebayOrdersPercent: reviewData.ebay_orders_percent || 0,
        shopifyOrdersPercent: reviewData.shopify_orders_percent || 0
      };

      // Calculated metrics
      const avgOrderValue = response.orders.totalOrders > 0
        ? Math.round((totalSales / response.orders.totalOrders) * 100) / 100
        : 0;
      const amazonAOV = response.orders.amazonOrders > 0
        ? Math.round((response.sales.amazonSales / response.orders.amazonOrders) * 100) / 100
        : 0;
      const ebayAOV = response.orders.ebayOrders > 0
        ? Math.round((response.sales.ebaySales / response.orders.ebayOrders) * 100) / 100
        : 0;
      const shopifyAOV = response.orders.shopifyOrders > 0
        ? Math.round((response.sales.shopifySales / response.orders.shopifyOrders) * 100) / 100
        : 0;

      response.metrics = {
        averageOrderValue: avgOrderValue,
        amazonAOV,
        ebayAOV,
        shopifyAOV,
        shipmentsPerHour: reviewData.labor_efficiency || 0,
        averageOrderValueFormatted: `£${avgOrderValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        amazonAOVFormatted: `£${amazonAOV.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        ebayAOVFormatted: `£${ebayAOV.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        shopifyAOVFormatted: `£${shopifyAOV.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      };

      response.status.dataComplete = true;
    }
    // Fallback to basic data if no comprehensive data available
    else if (fallbackData) {
      response.fulfillment = {
        shipmentsPacked: fallbackData.shipments || 0,
        scheduledHours: fallbackData.scheduled_hours || 0,
        totalHoursUsed: fallbackData.hours_worked || 0,
        managementHoursUsed: 0, // Not available in fallback data
        packingHoursUsed: 0, // Not available in fallback data
        pickingHoursUsed: 0, // Not available in fallback data
        laborEfficiency: fallbackData.hours_worked > 0
          ? Math.round((fallbackData.shipments / fallbackData.hours_worked) * 100) / 100
          : 0,
        laborUtilization: fallbackData.scheduled_hours > 0
          ? Math.round((fallbackData.hours_worked / fallbackData.scheduled_hours) * 10000) / 100
          : 0
      };

      response.metrics.shipmentsPerHour = response.fulfillment.laborEfficiency;
      response.status.dataComplete = false; // Only basic data available
    }

    return new Response(JSON.stringify(response, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Allow CORS for Make.com
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('Error in daily report API:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

/**
 * OPTIONS handler for CORS preflight requests
 */
export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
};
