// API endpoint to fetch daily sales data for a specific ASIN
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/supabaseAdmin';

export const GET: RequestHandler = async ({ params }) => {
  const { asin } = params;

  if (!asin) {
    throw error(400, 'ASIN is required');
  }

  try {
    // Fetch last 30 days of sales data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateFilter = thirtyDaysAgo.toISOString().split('T')[0];

    const { data: salesData, error: salesError } = await supabaseAdmin
      .from('amazon_sales_data')
      .select('report_date, ordered_product_sales, ordered_units, sessions, page_views, buy_box_percentage, unit_session_percentage')
      .eq('asin', asin)
      .gte('report_date', dateFilter)
      .order('report_date', { ascending: true });

    if (salesError) {
      console.error(`Error fetching sales data for ${asin}:`, salesError);
      throw error(500, 'Failed to fetch sales data');
    }

    return json(salesData || []);
  } catch (err) {
    console.error(`Error in sales API for ${asin}:`, err);
    throw error(500, err instanceof Error ? err.message : 'Unknown error');
  }
};
