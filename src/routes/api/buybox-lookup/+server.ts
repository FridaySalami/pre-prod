import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_SERVICE_KEY } from '$env/static/private';

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

    // Query buybox_data table for ASIN to get SKU and product name
    const { data, error } = await supabase
      .from('buybox_data')
      .select('asin, sku, item_name, price, is_winner')
      .eq('asin', asin)
      .limit(1)
      .single();

    console.log('Supabase query result:', { data, error });

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
        is_winner: data.is_winner
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