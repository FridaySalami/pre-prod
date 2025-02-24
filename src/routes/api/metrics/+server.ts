import type { RequestHandler } from '@sveltejs/kit';

// In-memory store for demonstration (data is lost when the server restarts)
let metricsData: Record<string, Record<string, number>> = {};

/**
 * GET /api/metrics?date=YYYY-MM-DD
 * Returns the metrics stored for the given date.
 */
export const GET: RequestHandler = async ({ url }) => {
	const date = url.searchParams.get('date');
	if (!date) {
		return new Response(JSON.stringify({ error: 'Missing date parameter' }), { status: 400 });
	}
	const data = metricsData[date] || {
		shipments: 0,
		defects: 0,
		dpmo: 0,
		orderAccuracy: 0
	};
	return new Response(JSON.stringify(data), {
		headers: { 'Content-Type': 'application/json' }
	});
};

/**
 * POST /api/metrics
 * Body: { date: 'YYYY-MM-DD', data: { shipments, defects, dpmo, orderAccuracy } }
 * Saves the metrics for the given date.
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { date, data } = body;
	if (!date || !data) {
		return new Response(JSON.stringify({ error: 'Missing date or data' }), { status: 400 });
	}
	metricsData[date] = data;
	return new Response(JSON.stringify({ success: true }), {
		headers: { 'Content-Type': 'application/json' }
	});
};