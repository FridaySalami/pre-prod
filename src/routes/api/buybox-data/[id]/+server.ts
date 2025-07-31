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

    // Select all columns to avoid schema mismatch issues
    const { data, error } = await supabaseAdmin
      .from('buybox_data')
      .select('*')
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
