import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';

/**
 * Search endpoint for Buy Box Monitor
 * Searches sku_asin_mapping table for products by SKU, ASIN, or product name
 */
export async function GET({ url }) {
  try {
    const query = url.searchParams.get('query') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    if (!query.trim()) {
      return json({
        success: false,
        error: 'Search query is required'
      }, { status: 400 });
    }

    // Build search query
    let supabaseQuery = supabaseAdmin
      .from('sku_asin_mapping')
      .select('*', { count: 'exact' });

    // Search across multiple columns
    supabaseQuery = supabaseQuery.or(
      `seller_sku.ilike.%${query}%,item_name.ilike.%${query}%,asin1.ilike.%${query}%`
    );

    // Add pagination
    supabaseQuery = supabaseQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Execute query
    const { data, error, count } = await supabaseQuery;

    if (error) {
      console.error('Search error:', error);
      return json({
        success: false,
        error: 'Failed to search products'
      }, { status: 500 });
    }

    return json({
      success: true,
      results: data || [],
      total: count || 0,
      page,
      limit
    });

  } catch (error: unknown) {
    console.error('Search endpoint error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
}
