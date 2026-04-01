import { json } from '@sveltejs/kit';
import { getDailyOrders } from '$lib/server/processedOrdersService.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    // Check authentication
    const session = await locals.getSession();
    if (!session) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get required date parameters
    const startDateStr = url.searchParams.get('startDate');
    const endDateStr = url.searchParams.get('endDate');
    const sku = url.searchParams.get('sku');

    if (!startDateStr || !endDateStr) {
      return json({
        success: false,
        error: 'Both startDate and endDate parameters are required'
      }, { status: 400 });
    }

    // Parse the dates
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    // Validate date formats
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return json({
        success: false,
        error: 'Invalid date format. Please use ISO format (YYYY-MM-DD)'
      }, { status: 400 });
    }

    // Set time to start/end of respective days
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // Get orders for the date range
    const orders = await getDailyOrders(startDate, endDate);

    // If SKU is provided, filter orders that contain that SKU
    const filteredOrders = sku
      ? orders.filter(order =>
        order.Items?.some(item =>
          item.SKU?.toLowerCase().includes(sku.toLowerCase())
        )
      )
      : orders;

    return json({
      success: true,
      orders: filteredOrders
    });
  } catch (error) {
    console.error('Error fetching daily orders:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
