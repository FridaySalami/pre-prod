import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Simple test endpoint to debug the issue
 * GET /api/product-lookup/test
 */
export const GET: RequestHandler = async () => {
  try {
    console.log('Test endpoint called');

    return json({
      success: true,
      message: 'Test endpoint working',
      env: {
        hasSupabaseUrl: !!process.env.PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.PRIVATE_SUPABASE_SERVICE_KEY,
        nodeEnv: process.env.NODE_ENV
      }
    });

  } catch (error: any) {
    console.error('❌ Error in test endpoint:', error);
    return json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
};