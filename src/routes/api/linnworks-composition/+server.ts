import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
  const { searchParams } = url;
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '10');
  const filter = searchParams.get('filter') ?? '';

  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin
      .from('linnworks_composition')
      .select('*', { count: 'exact' });

    if (filter) {
      query = query.or(`parent_sku.ilike.%${filter}%,parent_title.ilike.%${filter}%,child_sku.ilike.%${filter}%,child_title.ilike.%${filter}%`);
    }

    const { data, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return json({
      data,
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('Failed to fetch Linnworks composition data:', error);
    return json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE() {
  try {
    const { error, count } = await supabaseAdmin
      .from('linnworks_composition')
      .delete()
      .gte('created_at', '1900-01-01'); // Delete all records

    if (error) throw error;

    return json({
      success: true,
      message: `Cleared ${count || 0} Linnworks composition records`
    });
  } catch (error) {
    console.error('Failed to clear Linnworks composition data:', error);
    return json({
      success: false,
      error: 'Failed to clear data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
