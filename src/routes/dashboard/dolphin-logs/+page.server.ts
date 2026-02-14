import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_SERVICE_KEY } from '$env/static/private';
import type { PageServerLoad } from './$types';

const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY);

export const load: PageServerLoad = async ({ url }) => {
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const query = url.searchParams.get('q') || '';
  const pageSize = 50;

  let supabaseQuery = supabaseAdmin
    .from('dolphin_logs')
    .select('*', { count: 'exact' });

  if (query) {
    // Search in both order_id and sku columns
    supabaseQuery = supabaseQuery.or(`order_id.ilike.%${query}%,sku.ilike.%${query}%`);
  }

  const { data: logs, error, count } = await supabaseQuery
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) {
    console.error('Error fetching dolphin logs:', error);
    return {
      logs: [],
      totalCount: 0,
      page,
      pageSize,
      error: error.message
    };
  }

  return {
    logs,
    totalCount: count || 0,
    page,
    pageSize,
    query
  };
};
