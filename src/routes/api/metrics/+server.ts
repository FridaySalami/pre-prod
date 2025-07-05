import type { RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_SERVICE_KEY } from '$env/static/private';

if (!PUBLIC_SUPABASE_URL || !PRIVATE_SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase configuration in environment variables');
}

const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY);

/**
 * GET /api/metrics?date=YYYY-MM-DD
 * Returns the metrics stored for the given date.
 */
export const GET: RequestHandler = async ({ url }) => {
  const date = url.searchParams.get('date');
  if (!date) {
    return new Response(JSON.stringify({ error: 'Missing date parameter' }), { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('daily_metrics')
    .select('*')
    .eq('date', date)
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  return new Response(JSON.stringify(data || {}), {
    headers: { 'Content-Type': 'application/json' }
  });
};

/**
 * POST /api/metrics
 * Body: { date: 'YYYY-MM-DD', data: { shipments, defects, dpmo, orderAccuracy } }
 * Saves (or upserts) the metrics for the given date.
 */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { date, data } = body;
  if (!date || !data) {
    return new Response(JSON.stringify({ error: 'Missing date or data' }), { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('daily_metrics')
    .upsert({ date, ...data }, { onConflict: 'date' });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
};