import { json } from '@sveltejs/kit';

export async function GET({ locals, url }) {
  const supabase = locals.supabase;
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');

  let query = supabase
    .from('holidays')
    .select('*')
    .not('internal_employee_id', 'is', null)
    .order('from_date', { ascending: true });

  if (start) {
    query = query.gte('from_date', start);
  }
  if (end) {
    query = query.lte('to_date', end);
  }

  const { data, error } = await query;

  if (error) {
    return json({ error: error.message }, { status: 500 });
  }

  return json(data);
}
