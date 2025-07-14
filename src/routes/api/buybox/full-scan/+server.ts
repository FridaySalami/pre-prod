import { json } from '@sveltejs/kit';

const RENDER_SERVICE_URL = 'https://buy-box-render-service.onrender.com';

/**
 * Buy Box full scan endpoint - Proxies to Render service
 * This endpoint forwards the request to the Render service for processing
 * to avoid Netlify function timeouts on long-running operations
 */
export async function POST({ request }) {
  try {
    const requestBody = await request.json();
    const {
      rateLimit = 0.5,   // Default to conservative 0.5 request per second
      jitter = 800,      // Default jitter of 800ms
      maxRetries = 5,    // Default max retries
      source = 'manual'  // Source of the scan request
    } = requestBody;

    console.log(`Proxying scan request to Render service with rate: ${rateLimit}/sec, jitter: ${jitter}ms, retries: ${maxRetries}`);

    // Forward the request to the Render service
    const renderResponse = await fetch(`${RENDER_SERVICE_URL}/api/bulk-scan/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rateLimit,
        jitter,
        maxRetries,
        source
      })
    });

    const renderData = await renderResponse.json();

    if (!renderResponse.ok) {
      console.error('Render service error:', renderData);
      return json({
        success: false,
        error: renderData.error || 'Failed to start scan on Render service'
      }, { status: renderResponse.status });
    }

    console.log('Scan started successfully on Render service:', renderData);

    return json({
      success: true,
      jobId: renderData.jobId,
      message: renderData.message,
      totalAsins: renderData.totalAsins,
      estimatedDuration: renderData.estimatedDuration,
      source: renderData.source
    });

  } catch (error: unknown) {
    console.error('Error proxying to Render service:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}