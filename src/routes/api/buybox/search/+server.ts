import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';

/**
 * Search for SKU/ASIN across all Buy Box data
 */
export async function GET({ url }) {
  try {
    const query = url.searchParams.get('query');

    if (!query) {
      return json({
        success: false,
        error: 'Missing search query'
      }, { status: 400 });
    }

    // Search for the query in both SKU and ASIN fields
    const { data: results, error } = await supabaseAdmin
      .from('buybox_data')
      .select(`
        id,
        asin,
        sku,
        price,
        is_winner,
        opportunity_flag,
        margin_at_buybox,
        margin_percent_at_buybox,
        captured_at,
        buybox_jobs(id, started_at, source)
      `)
      .or(`sku.ilike.%${query}%,asin.ilike.%${query}%`)
      .order('captured_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error searching for SKU/ASIN:', error);
      return json({
        success: false,
        error: error.message || 'Failed to search for SKU/ASIN'
      }, { status: 500 });
    }

    return json({
      success: true,
      results: results || [],
      query
    });

  } catch (error: unknown) {
    console.error('Error in search endpoint:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred during search'
    }, { status: 500 });
  }
}
