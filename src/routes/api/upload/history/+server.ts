import { supabaseAdmin } from '$lib/supabaseAdmin';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const importType = url.searchParams.get('type');

    let query = supabaseAdmin
      .from('import_records')
      .select(`
        id,
        session_id,
        import_type,
        file_name,
        file_size,
        total_records,
        processed_records,
        imported_records,
        updated_records,
        error_count,
        status,
        started_at,
        completed_at,
        error_message,
        created_by,
        created_at
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by import type if specified
    if (importType) {
      query = query.eq('import_type', importType);
    }

    const { data: history, error } = await query;

    if (error) {
      console.error('Error fetching upload history:', error);
      return json({ error: 'Failed to fetch upload history' }, { status: 500 });
    }

    // Calculate additional statistics
    const enhancedHistory = history.map(record => ({
      ...record,
      percentage: record.total_records > 0
        ? Math.round((record.processed_records / record.total_records) * 100)
        : 0,
      duration: record.started_at && record.completed_at
        ? new Date(record.completed_at).getTime() - new Date(record.started_at).getTime()
        : null,
      success_rate: record.processed_records > 0
        ? Math.round(((record.processed_records - record.error_count) / record.processed_records) * 100)
        : 0
    }));

    return json(enhancedHistory);

  } catch (error) {
    console.error('Error in upload history endpoint:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
