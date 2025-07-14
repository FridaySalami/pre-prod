import { json } from '@sveltejs/kit';
import { RENDER_SERVICE_URL } from '$env/static/private';

/**
 * Get Buy Box job failures (proxy to Render service)
 */
export async function GET({ url }) {
  try {
    // Extract query parameters
    const searchParams = url.searchParams;
    const queryString = searchParams.toString();

    // Proxy request to Render service
    const renderUrl = `${RENDER_SERVICE_URL}/api/job-failures${queryString ? '?' + queryString : ''}`;

    const response = await fetch(renderUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Render service responded with status: ${response.status}`);
    }

    const data = await response.json();
    return json(data);

  } catch (error) {
    console.error('Buy Box failures proxy error:', error);
    return json({
      success: false,
      error: (error as Error).message || 'Failed to fetch Buy Box failures'
    }, { status: 500 });
  }
}
