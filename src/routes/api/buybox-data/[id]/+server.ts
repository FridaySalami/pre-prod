import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/supabaseAdmin';

/**
 * GET /api/buybox-data/[id]
 * Fetch a single buybox record by ID with complete data structure
 */
export const GET: RequestHandler = async ({ params }) => {
  try {
    const { id } = params;

    if (!id) {
      return json({ error: 'Record ID is required' }, { status: 400 });
    }

    console.log(`📊 Fetching single buybox record: ${id}`);

    // Use the same query structure as the main buybox API to ensure consistent data
    const { data, error } = await supabaseAdmin
      .from('buybox_data')
      .select(`
        id, sku, asin, item_name, captured_at, 
        price, your_current_price, competitor_price, break_even_price, buybox_price,
        shipping_cost, total_cost, amazon_fees, total_fees,
        profit, current_actual_profit, buybox_actual_profit,
        your_margin_percent_at_current_price, margin_percent_at_buybox_price,
        recommendation, winner, price_gap,
        current_margin_calculation, buybox_margin_calculation,
        total_investment_current, total_investment_buybox,
        run_id, job_id, created_at, updated_at
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Error fetching buybox record:', error.message);
      return json({ error: 'Failed to fetch record' }, { status: 500 });
    }

    if (!data) {
      return json({ error: 'Record not found' }, { status: 404 });
    }

    console.log(`✅ Successfully fetched buybox record: ${id} (SKU: ${data.sku})`);
    return json(data);

  } catch (error) {
    console.error('❌ Error in single buybox record API:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
