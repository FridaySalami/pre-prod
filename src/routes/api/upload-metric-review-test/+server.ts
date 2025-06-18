import type { RequestHandler } from '@sveltejs/kit';

/**
 * Simple test endpoint to check if basic API works
 * GET /api/upload-metric-review-test
 */
export const GET: RequestHandler = async () => {
	try {
		console.log('🧪 Test endpoint called successfully');
		
		return new Response(JSON.stringify({
			success: true,
			message: "Test endpoint working",
			timestamp: new Date().toISOString(),
			environment: process.env.NODE_ENV || 'unknown'
		}), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('❌ Test endpoint error:', err);
		
		return new Response(JSON.stringify({
			success: false,
			error: err instanceof Error ? err.message : 'Unknown error',
			timestamp: new Date().toISOString()
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

/**
 * Simple test POST endpoint
 * POST /api/upload-metric-review-test
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		console.log('🧪 Test POST endpoint called');
		
		// Try to parse the request body
		let body = {};
		try {
			body = await request.json();
			console.log('📥 Received body:', body);
		} catch (parseErr) {
			console.warn('⚠️ Could not parse request body:', parseErr);
		}
		
		// Check environment variables without importing them
		const hasSupabaseUrl = !!process.env.PUBLIC_SUPABASE_URL;
		const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE;
		
		return new Response(JSON.stringify({
			success: true,
			message: "Test POST endpoint working",
			receivedBody: body,
			environment: {
				nodeEnv: process.env.NODE_ENV || 'unknown',
				hasSupabaseUrl,
				hasServiceRole,
				netlifyContext: process.env.CONTEXT || 'unknown'
			},
			timestamp: new Date().toISOString()
		}), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('❌ Test POST endpoint error:', err);
		
		return new Response(JSON.stringify({
			success: false,
			error: err instanceof Error ? err.message : 'Unknown error',
			stack: err instanceof Error ? err.stack : undefined,
			timestamp: new Date().toISOString()
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
