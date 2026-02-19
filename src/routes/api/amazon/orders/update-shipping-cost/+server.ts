import { db } from '$lib/supabaseServer';
import { json } from '@sveltejs/kit';

export async function POST({ request }) {
  try {
    const { orderId, shippingCost } = await request.json();

    if (!orderId) {
      return json({ success: false, error: 'Order ID is required' }, { status: 400 });
    }

    // Update the shipping_cost in the amazon_orders table
    const { data, error } = await db
      .from('amazon_orders')
      .update({
        shipping_cost: shippingCost,
        updated_at: new Date().toISOString()
      })
      .eq('amazon_order_id', orderId)
      .select();

    if (error) {
      console.error('Supabase error updating shipping cost:', error);
      return json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    return json({
      success: true,
      message: `Shipping cost updated for order ${orderId}`,
      data: data[0]
    });
  } catch (error) {
    console.error('Error in update-shipping-cost API:', error);
    return json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
