// API endpoint to update competitor product titles
// /api/buy-box-monitor/competitors/[id]/title

import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';

export async function PATCH({ params, request }) {
  try {
    const { id } = params;
    const { title } = await request.json();

    if (!id || !title?.trim()) {
      return json({
        success: false,
        error: 'Competitor ID and title are required'
      }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('competitive_asins')
      .update({
        competitive_product_title: title.trim()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating competitor title:', error);
      return json({
        success: false,
        error: 'Failed to update title'
      }, { status: 500 });
    }

    return json({
      success: true,
      competitor: data
    });

  } catch (error) {
    console.error('Update competitor title error:', error);
    return json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
