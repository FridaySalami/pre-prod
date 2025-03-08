import type { RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

// Retrieve the Supabase URL and the service role key from environment variables.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !serviceRole) {
	throw new Error('Missing Supabase configuration in environment variables');
}

// Create an admin Supabase client using the service role key.
const supabaseAdmin = createClient(supabaseUrl, serviceRole);

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