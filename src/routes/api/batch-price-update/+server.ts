/**
 * Batch Price Update API Route
 * 
 * Handles batch price submissions to Amazon while respecting rate limits:
 * - Amazon Feeds API: 5 submissions per 5 minutes
 * - Each submission can contain multiple SKUs (up to ~1000 items)
 * - Uses JSON_LISTINGS_FEED format for modern batch updates
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface BatchPriceUpdateRequest {
  items: Array<{
    id: string;
    sku: string;
    asin: string;
    currentPrice: number;
    targetPrice: number;
    reason: string;
  }>;
  userEmail: string;
}

interface BatchUpdateResult {
  success: boolean;
  feedId?: string;
  processedItems: number;
  failedItems: number;
  errors?: string[];
  estimatedProcessingTime: string;
}

// Rate limiting for batch submissions (5 per 5 minutes)
const submissionHistory = new Map<string, number[]>();
const MAX_SUBMISSIONS_PER_5MIN = 5;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

function checkRateLimit(userEmail: string): { allowed: boolean; waitTime?: number } {
  const now = Date.now();
  const userHistory = submissionHistory.get(userEmail) || [];

  // Remove submissions older than 5 minutes
  const recentSubmissions = userHistory.filter(timestamp => now - timestamp < FIVE_MINUTES_MS);
  submissionHistory.set(userEmail, recentSubmissions);

  if (recentSubmissions.length >= MAX_SUBMISSIONS_PER_5MIN) {
    const oldestSubmission = Math.min(...recentSubmissions);
    const waitTime = FIVE_MINUTES_MS - (now - oldestSubmission);
    return { allowed: false, waitTime };
  }

  return { allowed: true };
}

function recordSubmission(userEmail: string) {
  const userHistory = submissionHistory.get(userEmail) || [];
  userHistory.push(Date.now());
  submissionHistory.set(userEmail, userHistory);
}

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    console.log('🛒 Batch Price Update API called');

    // Authentication check
    const { user } = locals;
    if (!user) {
      return json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      }, { status: 401 });
    }

    const requestData: BatchPriceUpdateRequest = await request.json();
    const { items, userEmail } = requestData;

    console.log(`📦 Processing batch update for ${items.length} items from ${userEmail}`);

    // Validate request
    if (!items || items.length === 0) {
      return json({
        success: false,
        error: 'No items provided for batch update',
        code: 'NO_ITEMS'
      }, { status: 400 });
    }

    if (items.length > 1000) {
      return json({
        success: false,
        error: 'Batch size too large. Maximum 1000 items per batch.',
        code: 'BATCH_TOO_LARGE'
      }, { status: 400 });
    }

    // Check rate limits
    const rateLimitCheck = checkRateLimit(userEmail);
    if (!rateLimitCheck.allowed) {
      const waitMinutes = Math.ceil((rateLimitCheck.waitTime || 0) / 60000);
      return json({
        success: false,
        error: `Rate limit exceeded. Please wait ${waitMinutes} minutes before submitting another batch.`,
        code: 'RATE_LIMITED',
        waitTime: rateLimitCheck.waitTime
      }, { status: 429 });
    }

    // Initialize Amazon SP-API client
    console.log('🔧 Initializing Amazon SP-API client...');

    // Use the existing Render service API for actual submission
    const renderServiceUrl = 'https://buy-box-render-service-4603.onrender.com';

    const batchSubmissionResponse = await fetch(`${renderServiceUrl}/api/batch-price-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RENDER_SERVICE_API_KEY || 'dev-token'}`
      },
      body: JSON.stringify({
        items: items.map(item => ({
          sku: item.sku,
          asin: item.asin,
          newPrice: item.targetPrice,
          currentPrice: item.currentPrice,
          reason: item.reason
        })),
        userEmail,
        source: 'buy_box_manager_basket'
      })
    });

    if (!batchSubmissionResponse.ok) {
      const errorText = await batchSubmissionResponse.text();
      console.error('❌ Render service batch submission failed:', errorText);

      return json({
        success: false,
        error: 'Failed to submit batch to Amazon',
        code: 'SUBMISSION_FAILED',
        details: errorText
      }, { status: 500 });
    }

    const submissionResult = await batchSubmissionResponse.json();
    console.log('✅ Batch submission result:', submissionResult);

    // Record successful submission for rate limiting
    recordSubmission(userEmail);

    // Log to database for audit trail
    try {
      const { supabaseAdmin } = await import('$lib/supabaseAdmin');

      await supabaseAdmin
        .from('batch_price_updates')
        .insert({
          user_id: user.id,
          user_email: userEmail,
          item_count: items.length,
          feed_id: submissionResult.feedId,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          items: items,
          total_price_change: items.reduce((sum, item) => sum + (item.targetPrice - item.currentPrice), 0)
        });

      console.log('💾 Batch update logged to database');
    } catch (dbError) {
      console.warn('⚠️ Failed to log batch update to database:', dbError);
      // Don't fail the request for logging errors
    }

    const result: BatchUpdateResult = {
      success: true,
      feedId: submissionResult.feedId,
      processedItems: items.length,
      failedItems: 0,
      estimatedProcessingTime: '5-15 minutes'
    };

    console.log('🎉 Batch price update completed successfully');

    return json(result);

  } catch (error) {
    console.error('❌ Batch price update error:', error);

    return json({
      success: false,
      error: 'Internal server error during batch price update',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

export const GET: RequestHandler = async ({ url, locals }) => {
  // Get batch submission history and rate limit status
  const { user } = locals;
  if (!user) {
    return json({ error: 'Authentication required' }, { status: 401 });
  }

  const userEmail = url.searchParams.get('email') || user.email;
  const rateLimitCheck = checkRateLimit(userEmail);

  return json({
    rateLimitStatus: {
      allowed: rateLimitCheck.allowed,
      waitTime: rateLimitCheck.waitTime,
      remainingSubmissions: rateLimitCheck.allowed ?
        MAX_SUBMISSIONS_PER_5MIN - (submissionHistory.get(userEmail) || []).length : 0
    }
  });
};