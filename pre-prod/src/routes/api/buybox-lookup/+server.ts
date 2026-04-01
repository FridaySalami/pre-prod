import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';

const { PRIVATE_SUPABASE_SERVICE_KEY } = env;

const supabase = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY);

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Temporarily disable session check for testing
    // const session = locals.session;
    // if (!session) {
    //   return json({ success: false, error: 'Unauthorized' }, { status: 401 });
    // }

    const { asin } = await request.json();

    if (!asin) {
      return json({ success: false, error: 'ASIN is required' }, { status: 400 });
    }

    console.log(`Looking up ASIN: ${asin}`);

    // Query buybox_data table for ASIN to get SKU, product name, and cost analysis data
    const { data, error } = await supabase
      .from('buybox_data')
      .select('asin, sku, item_name, price, your_current_price, is_winner, your_cost, your_shipping_cost, your_material_total_cost, your_box_cost, your_vat_amount, your_fragile_charge, material_cost_only, total_operating_cost, your_margin_at_current_price, your_margin_percent_at_current_price, margin_at_buybox_price, margin_percent_at_buybox_price, margin_difference, profit_opportunity, current_actual_profit, buybox_actual_profit, total_offers, competitor_price, competitor_name, competitor_id, opportunity_flag, captured_at')
      .eq('asin', asin)
      .order('captured_at', { ascending: false })
      .limit(1)
      .single(); console.log('Supabase query result:', { data, error });

    if (error) {
      console.error('Supabase error details:', error);
      return json({
        success: false,
        error: 'Product not found in buybox_data',
        asin
      }, { status: 404 });
    }

    return json({
      success: true,
      data: {
        asin: data.asin,
        sku: data.sku,
        item_name: data.item_name,
        price: data.price,
        your_current_price: data.your_current_price,
        is_winner: data.is_winner,
        // Cost breakdown
        your_cost: data.your_cost,
        your_shipping_cost: data.your_shipping_cost,
        your_material_total_cost: data.your_material_total_cost,
        your_box_cost: data.your_box_cost,
        your_vat_amount: data.your_vat_amount,
        your_fragile_charge: data.your_fragile_charge,
        material_cost_only: data.material_cost_only,
        total_operating_cost: data.total_operating_cost,
        // Margin analysis
        your_margin_at_current_price: data.your_margin_at_current_price,
        your_margin_percent_at_current_price: data.your_margin_percent_at_current_price,
        margin_at_buybox_price: data.margin_at_buybox_price,
        margin_percent_at_buybox_price: data.margin_percent_at_buybox_price,
        margin_difference: data.margin_difference,
        profit_opportunity: data.profit_opportunity,
        // Profit breakdown
        current_actual_profit: data.current_actual_profit,
        buybox_actual_profit: data.buybox_actual_profit,
        // Competitor data
        total_offers: data.total_offers,
        competitor_price: data.competitor_price,
        competitor_name: data.competitor_name,
        competitor_id: data.competitor_id,
        opportunity_flag: data.opportunity_flag,
        captured_at: data.captured_at
      }
    });

  } catch (error: any) {
    console.error('BuyBox lookup error:', error);
    return json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
};