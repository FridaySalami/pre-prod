import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Cancel a running Buy Box monitoring job
 * 
 * This endpoint forwards the cancel request to the Render service
 * which will properly stop the background processing and update the database.
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

    // Forward cancel request to Render service with timeout
    const renderServiceUrl = 'https://buy-box-render-service-4603.onrender.com';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(`${renderServiceUrl}/api/job-status/${jobId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data = await response.json();

    if (!response.ok) {
      return json({
        success: false,
        error: data.error || 'Failed to cancel job on Render service'
      }, { status: response.status });
    }

    return json({
      success: true,
      message: data.message || 'Job cancelled successfully',
      jobId: jobId,
      previousStatus: data.previousStatus,
      newStatus: data.newStatus
    });

  } catch (error) {
    console.error('Error cancelling job:', error);

    // Check if it's a timeout or network error
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('timeout'))) {
      return json({
        success: false,
        error: 'Timeout while trying to cancel job. The job may still be running on the server.'
      }, { status: 504 });
    }

    return json({
      success: false,
      error: (error as Error).message || 'An error occurred while cancelling the job'
    }, { status: 500 });
  }
};
