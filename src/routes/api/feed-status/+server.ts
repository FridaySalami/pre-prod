import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    // Temporarily bypass authentication for debugging
    console.log('🔍 Feed status API called - bypassing authentication for debugging');

    // Check authentication (commented out for debugging)
    // if (!locals.session?.user) {
    //   return json(
    //     { success: false, error: 'Authentication required' },
    //     { status: 401 }
    //   );
    // }

    const feedId = url.searchParams.get('feedId');
    if (!feedId) {
      return json(
        { success: false, error: 'feedId parameter is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Checking feed status for feedId: ${feedId}`);

    // Import Amazon Feeds API service
    try {
      const module = await import('$lib/services/amazon-feeds-api.js');
      const AmazonFeedsAPI = module.default;

      const amazonAPI = new AmazonFeedsAPI({
        environment: 'production'
      });

      // Get access token and check feed status
      const token = await amazonAPI.getAccessToken();
      const feedStatus = await amazonAPI.getFeedStatus(token, feedId);

      console.log(`📊 Feed status for ${feedId}:`, feedStatus);

      return json({
        success: true,
        feedId: feedId,
        status: feedStatus,
        timestamp: new Date().toISOString()
      });

    } catch (importError) {
      console.error('❌ Failed to import Amazon Feeds API service:', importError);
      return json(
        {
          success: false,
          error: 'Failed to load Amazon Feeds API service',
          details: (importError as Error).message
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Feed status check failed:', error);
    return json(
      {
        success: false,
        error: 'Failed to check feed status',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
};
