import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const RENDER_SERVICE_URL = 'https://buy-box-render-service.onrender.com';

/**
 * Cancel a running Buy Box monitoring job
 * Proxies the request to the Render service for proper job cancellation
 */
export const POST: RequestHandler = async ({ params }) => {
  try {
    const jobId = params.jobId;

    if (!jobId) {
      return json({
        success: false,
        error: 'Missing job ID'
      }, { status: 400 });
    }

    console.log(`Proxying job cancellation request for job: ${jobId}`);

    // Forward the cancellation request to the Render service
    const renderResponse = await fetch(`${RENDER_SERVICE_URL}/api/job-status/${jobId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const renderData = await renderResponse.json();

    if (!renderResponse.ok) {
      console.error('Render service error:', renderData);
      return json({
        success: false,
        error: renderData.error || 'Failed to cancel job on Render service'
      }, { status: renderResponse.status });
    }

    console.log('Job cancelled successfully on Render service:', renderData);

    return json({
      success: true,
      message: renderData.message || 'Job cancelled successfully'
    });

  } catch (error: unknown) {
    console.error('Error cancelling job:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred while cancelling the job'
    }, { status: 500 });
  }
};
