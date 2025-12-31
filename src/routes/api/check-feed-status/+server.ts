import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import AmazonFeedsAPI from '$lib/services/amazon-feeds-api.js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';

const { PRIVATE_SUPABASE_SERVICE_KEY } = env;

const supabase = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY);

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Get user session (authentication handled by hooks.server.ts)
    const user = locals?.user;
    if (!user) {
      throw error(401, 'Authentication required');
    }

    const { feedId, recordId, sku, asin } = await request.json();

    // Validate inputs
    if (!feedId) {
      throw error(400, 'Missing required field: feedId');
    }

    console.log(`🔍 Checking feed status for feed ID: ${feedId}`);

    // Initialize Amazon Feeds API
    const amazonAPI = new AmazonFeedsAPI();
    const token = await amazonAPI.getAccessToken();

    // Get feed status from Amazon
    const feedStatusResponse = await amazonAPI.getFeedStatus(token, feedId);

    console.log(`📊 Feed status response:`, feedStatusResponse);

    // Parse the feed status
    const feedStatus = feedStatusResponse.processingStatus;
    const feedResult = feedStatusResponse.resultFeedDocumentId ? 'HAS_RESULTS' : 'NO_RESULTS';

    // Determine the user-friendly status
    let userStatus = '';
    let statusClass = '';
    let isComplete = false;
    let needsAttention = false;

    switch (feedStatus) {
      case 'IN_QUEUE':
        userStatus = 'Queued for Processing';
        statusClass = 'bg-blue-100 text-blue-800';
        break;
      case 'IN_PROGRESS':
        userStatus = 'Processing';
        statusClass = 'bg-yellow-100 text-yellow-800';
        break;
      case 'DONE':
        userStatus = 'Completed Successfully';
        statusClass = 'bg-green-100 text-green-800';
        isComplete = true;
        break;
      case 'CANCELLED':
        userStatus = 'Cancelled';
        statusClass = 'bg-gray-100 text-gray-800';
        isComplete = true;
        needsAttention = true;
        break;
      case 'FATAL':
        userStatus = 'Failed with Errors';
        statusClass = 'bg-red-100 text-red-800';
        isComplete = true;
        needsAttention = true;
        break;
      default:
        userStatus = feedStatus || 'Unknown Status';
        statusClass = 'bg-gray-100 text-gray-800';
    }

    // If we have a recordId, update the database with the current status
    if (recordId) {
      try {
        await supabase
          .from('price_history')
          .update({
            feed_status: feedStatus,
            feed_result: feedResult,
            feed_checked_at: new Date().toISOString()
          })
          .eq('feed_id', feedId)
          .eq('record_id', recordId);

        console.log(`✅ Updated price_history with feed status for record ${recordId}`);
      } catch (updateError) {
        console.warn('⚠️ Failed to update price_history with feed status:', updateError);
      }
    }

    // Get additional details if available
    let processingReport = null;
    if (feedStatusResponse.resultFeedDocumentId && isComplete) {
      try {
        // Note: Getting the actual document requires additional API calls
        // For now, we'll just indicate that results are available
        processingReport = {
          hasResults: true,
          documentId: feedStatusResponse.resultFeedDocumentId,
          message: 'Processing results available - contact support for detailed report'
        };
      } catch (reportError) {
        console.warn('⚠️ Could not fetch processing report:', reportError);
      }
    }

    const result = {
      success: true,
      feedId,
      status: feedStatus,
      userStatus,
      statusClass,
      isComplete,
      needsAttention,
      lastChecked: new Date().toISOString(),
      sku,
      asin,
      processingReport,
      rawResponse: feedStatusResponse
    };

    console.log(`✅ Feed status check completed:`, result);

    return json(result);

  } catch (err: any) {
    console.error('❌ Feed status check error:', err);

    if (err.status) {
      throw err; // Re-throw SvelteKit errors
    }

    throw error(500, err.message || 'Failed to check feed status');
  }
};

export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    // Get user session
    const user = locals?.user;
    if (!user) {
      throw error(401, 'Authentication required');
    }

    const feedId = url.searchParams.get('feedId');

    if (!feedId) {
      throw error(400, 'Missing feedId parameter');
    }

    // Get recent price updates with feed information
    const { data: recentUpdates, error: dbError } = await supabase
      .from('price_history')
      .select('*')
      .eq('feed_id', feedId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (dbError) {
      throw error(500, `Database error: ${dbError.message}`);
    }

    return json({
      success: true,
      feedId,
      recentUpdates: recentUpdates || []
    });

  } catch (err: any) {
    console.error('❌ Feed history retrieval error:', err);

    if (err.status) {
      throw err;
    }

    throw error(500, err.message || 'Failed to retrieve feed history');
  }
};
