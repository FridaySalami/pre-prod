/**
 * Daily Sales Report Cron Job
 * 
 * This endpoint is called by an external cron scheduler (Render Cron, GitHub Actions, etc.)
 * to fetch the last 2 days of sales data from Amazon Reports API (incremental updates)
 * 
 * Why 2 days? To ensure we don't miss data if the cron runs early or Amazon has delays.
 * The upsert logic handles duplicates, so it's safe to re-fetch recent data.
 * 
 * Schedule: Daily at 2:00 AM UTC
 * Cron Expression: 0 2 * * *
 * 
 * Authentication: Requires CRON_SECRET header to match environment variable
 * 
 * Flow:
 * 1. Verify authentication
 * 2. Request sales report for last 2 days (incremental)
 * 3. Poll until complete (15-20 min typical)
 * 4. Download and process data
 * 5. Store in database (upsert handles duplicates)
 * 6. Log execution details
 * 
 * Note: For initial 30-day backfill, use /api/cron/backfill-sales-report instead
 * 
 * Example curl:
 * curl -X POST https://your-app.com/api/cron/daily-sales-report \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ReportsService } from '$lib/amazon/reports-service';
import { SalesProcessor } from '$lib/amazon/sales-processor';
import { env as privateEnv } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request, platform }) => {
  const startTime = Date.now();

  // 1. Verify authentication
  const authHeader = request.headers.get('authorization');

  // Try multiple sources for the secret
  const cronSecret = privateEnv.CRON_SECRET ||
    process.env.CRON_SECRET;

  // Debug logging
  console.log('🔐 Auth Debug:');
  console.log('  - Auth Header:', authHeader ? `${authHeader.substring(0, 20)}...` : 'MISSING');
  console.log('  - Env Secret (privateEnv):', privateEnv.CRON_SECRET ? `${privateEnv.CRON_SECRET.substring(0, 10)}...` : 'MISSING');
  console.log('  - Env Secret (process.env):', process.env.CRON_SECRET ? `${process.env.CRON_SECRET.substring(0, 10)}...` : 'MISSING');
  console.log('  - Final Secret:', cronSecret ? `${cronSecret.substring(0, 10)}...` : 'MISSING');

  if (!cronSecret) {
    console.error('❌ CRON_SECRET not configured in environment variables');
    return json({ success: false, error: 'Cron secret not configured' }, { status: 500 });
  }

  const providedSecret = authHeader?.replace('Bearer ', '');

  console.log('  - Provided Secret:', providedSecret ? `${providedSecret.substring(0, 10)}...` : 'NONE');
  console.log('  - Match:', providedSecret === cronSecret);

  if (providedSecret !== cronSecret) {
    console.error('❌ Unauthorized cron job attempt');
    console.error('  - Provided:', providedSecret ? `${providedSecret.substring(0, 10)}...` : 'NONE');
    console.error('  - Expected:', `${cronSecret.substring(0, 10)}...`);
    return json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  console.log('✅ Cron job authenticated');
  console.log('🚀 Starting daily sales report job...');

  const reportsService = new ReportsService();
  const salesProcessor = new SalesProcessor();

  let logId: number | null = null;
  let reportId: string | null = null;

  try {
    // 2. Calculate date range (yesterday, or last 2 days for safety)
    // We fetch the last 2 days to ensure we don't miss data if cron runs early
    // Upsert will handle any duplicates
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(0, 0, 0, 0);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    const dateRange = {
      start: twoDaysAgo,
      end: yesterday
    };

    console.log(`📅 Requesting sales data for: ${twoDaysAgo.toISOString().split('T')[0]} to ${yesterday.toISOString().split('T')[0]}`);

    // 3. Log job start
    logId = await reportsService.logJobStart(
      'daily_sales_report',
      'GET_SALES_AND_TRAFFIC_REPORT',
      dateRange
    );

    // 4. Request report with CHILD granularity for detailed per-variation data
    reportId = await reportsService.requestReport({
      reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
      startDate: twoDaysAgo.toISOString(),
      endDate: yesterday.toISOString(),
      marketplaceIds: ['A1F83G8C2ARO7P'], // UK marketplace
      reportOptions: {
        dateGranularity: 'DAY',
        asinGranularity: 'CHILD' // Get child ASIN details instead of parent rollup
      }
    });

    console.log(`📊 Report requested: ${reportId}`);

    // Update log with report ID
    if (logId) {
      await reportsService.logJobProcessing(logId, reportId);
    }

    // 5. Poll until complete (max 20 minutes)
    const status = await reportsService.pollReportStatus(reportId, 20, 60);

    if (!status.reportDocumentId) {
      throw new Error('Report completed but no document ID');
    }

    console.log(`📄 Report document ready: ${status.reportDocumentId}`);

    // Update log with document ID
    if (logId) {
      await reportsService.logJobProcessing(logId, reportId, status.reportDocumentId);
    }

    // 6. Download report
    const document = await reportsService.getReportDocument(status.reportDocumentId);
    const reportData = await reportsService.downloadReport(
      document.url,
      document.compressionAlgorithm
    );

    console.log('📥 Report data downloaded');
    console.log('📊 Report data type:', typeof reportData);
    console.log('📊 Report keys:', reportData ? Object.keys(reportData).slice(0, 5) : 'null');
    if (typeof reportData === 'object' && reportData !== null) {
      console.log('📊 Sample data:', JSON.stringify(reportData).substring(0, 200));
    }

    // 7. Process and store data
    const reportDateStr = yesterday.toISOString().split('T')[0];
    const stats = await salesProcessor.processSalesReport(reportData, reportId, reportDateStr);

    console.log('💾 Sales data stored in database');
    console.log(`   ${stats.processed} records processed`);
    console.log(`   ${stats.updated} records updated`);
    console.log(`   ${stats.failed} records failed`);

    // 8. Mark job as complete
    if (logId) {
      await reportsService.logJobComplete(logId, stats);
    }

    const duration = Math.floor((Date.now() - startTime) / 1000);
    console.log(`✅ Daily sales report job completed in ${duration} seconds`);

    return json({
      success: true,
      reportId,
      documentId: status.reportDocumentId,
      stats,
      duration,
      date: yesterday.toISOString().split('T')[0]
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Cron job failed:', errorMessage);

    // Log failure
    if (logId) {
      await reportsService.logJobFailed(logId, err instanceof Error ? err : new Error(errorMessage));
    }

    // Return error details
    return json({
      success: false,
      error: errorMessage,
      reportId,
      duration: Math.floor((Date.now() - startTime) / 1000)
    }, { status: 500 });
  }
};

// GET endpoint to check cron job status (for testing)
export const GET: RequestHandler = async () => {
  return json({
    endpoint: 'Daily Sales Report Cron Job',
    method: 'POST',
    authentication: 'Bearer token in Authorization header',
    schedule: '0 2 * * * (Daily at 2:00 AM UTC)',
    description: 'Fetches yesterday\'s sales data from Amazon Reports API'
  });
};
