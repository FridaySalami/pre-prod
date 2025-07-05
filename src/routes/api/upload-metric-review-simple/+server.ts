import type { RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_SERVICE_KEY } from '$env/static/private';

// Simple version without complex imports to isolate the issue
export const POST: RequestHandler = async ({ request }) => {
  const steps: string[] = [];

  try {
    steps.push("1. Starting simplified upload test");

    // Check environment variables using SvelteKit imports
    steps.push(`2. Environment check: URL=${!!PUBLIC_SUPABASE_URL}, Role=${!!PRIVATE_SUPABASE_SERVICE_KEY}`);

    if (!PUBLIC_SUPABASE_URL || !PRIVATE_SUPABASE_SERVICE_KEY) {
      throw new Error(`Missing environment variables: URL=${!!PUBLIC_SUPABASE_URL}, Role=${!!PRIVATE_SUPABASE_SERVICE_KEY}`);
    }

    // Test Supabase connection
    const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY);
    steps.push("3. Supabase client created");

    // Test a simple Supabase query
    const { data: testData, error: testError } = await supabaseAdmin
      .from('daily_metric_review')
      .select('id')
      .limit(1);

    if (testError) {
      steps.push(`4. Supabase test query failed: ${testError.message}`);
      throw new Error(`Supabase connection test failed: ${testError.message}`);
    } else {
      steps.push("4. Supabase connection test successful");
    }

    // Test internal API calls
    const baseUrl = 'https://jackweston.netlify.app';
    steps.push(`5. Testing internal API calls to: ${baseUrl}`);

    try {
      const testResponse = await fetch(`${baseUrl}/api/linnworks/weeklyOrderCounts?startDate=2025-06-16&endDate=2025-06-22`);
      if (testResponse.ok) {
        steps.push("6. Internal API call successful");
      } else {
        steps.push(`6. Internal API call failed: ${testResponse.status} ${testResponse.statusText}`);
      }
    } catch (fetchErr) {
      steps.push(`6. Internal API call error: ${fetchErr}`);
    }

    // Test the upload service import
    try {
      const { uploadDailyMetricReview } = await import('$lib/dailyMetricReviewService');
      steps.push("7. Upload service import successful");

      // Don't actually upload, just test the import
      steps.push("8. Upload service ready (test mode - no actual upload)");
    } catch (importErr) {
      steps.push(`7. Upload service import failed: ${importErr}`);
      throw importErr;
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Simplified upload test completed successfully",
      steps,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    steps.push(`ERROR: ${err instanceof Error ? err.message : 'Unknown error'}`);

    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      steps,
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
