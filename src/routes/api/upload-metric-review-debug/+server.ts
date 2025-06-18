import type { RequestHandler } from '@sveltejs/kit';

/**
 * Step-by-step debugging version of the upload API
 * This will test each piece individually to find the exact failure point
 */
export const POST: RequestHandler = async ({ request }) => {
  const steps: string[] = [];

  try {
    steps.push("1. API endpoint called successfully");

    // Test 1: Basic request parsing
    let body = {};
    try {
      body = await request.json();
      steps.push("2. Request body parsed successfully");
    } catch (err) {
      steps.push(`2. Request body parsing failed: ${err}`);
    }

    // Test 2: Environment variables
    try {
      steps.push("3. Checking environment variables...");
      const hasPublicUrl = !!process.env.PUBLIC_SUPABASE_URL;
      const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE;
      steps.push(`3. Environment check: PUBLIC_SUPABASE_URL=${hasPublicUrl}, SUPABASE_SERVICE_ROLE=${hasServiceRole}`);
    } catch (err) {
      steps.push(`3. Environment check failed: ${err}`);
    }

    // Test 3: Try importing Supabase
    try {
      steps.push("4. Testing Supabase import...");
      const { createClient } = await import('@supabase/supabase-js');
      steps.push("4. Supabase import successful");

      // Test creating client
      if (process.env.PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE) {
        const supabaseAdmin = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
        steps.push("4. Supabase client created successfully");
      }
    } catch (err) {
      steps.push(`4. Supabase import/client failed: ${err}`);
    }

    // Test 4: Try date operations
    try {
      steps.push("5. Testing date operations...");
      const today = new Date();
      const monday = new Date(today);
      const day = monday.getDay();
      const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
      monday.setDate(diff);
      steps.push(`5. Date operations successful: ${monday.toISOString().split('T')[0]}`);
    } catch (err) {
      steps.push(`5. Date operations failed: ${err}`);
    }

    // Test 5: Try importing other dependencies
    try {
      steps.push("6. Testing scheduled hours import...");
      const { getScheduledHoursForDateRange } = await import('$lib/schedule/hours-service');
      steps.push("6. Scheduled hours service import successful");
    } catch (err) {
      steps.push(`6. Scheduled hours import failed: ${err}`);
    }

    try {
      steps.push("7. Testing metric review import...");
      const { uploadDailyMetricReview, transformMetricsForReview } = await import('$lib/dailyMetricReviewService');
      steps.push("7. Metric review service import successful");
    } catch (err) {
      steps.push(`7. Metric review import failed: ${err}`);
    }

    // Test 6: Try a simple fetch
    try {
      steps.push("8. Testing internal fetch capability...");
      const testResponse = await fetch('https://jackweston.netlify.app/api/upload-metric-review-test');
      const testData = await testResponse.text();
      steps.push(`8. Internal fetch successful: ${testResponse.status}`);
    } catch (err) {
      steps.push(`8. Internal fetch failed: ${err}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: "All debug steps completed",
      steps,
      timestamp: new Date().toISOString()
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
