/**
 * Sales Data Backfill Endpoint
 * 
 * One-time endpoint to backfill historical sales data.
 * Unlike the daily cron which fetches yesterday, this can fetch any date range.
 * 
 * Authentication: Requires CRON_SECRET header
 * 
 * Request body:
 * {
 *   "days": 30  // Number of days to backfill (default: 30)
 * }
 * 
 * Example:
 * curl -X POST https://your-app.com/api/cron/backfill-sales-report \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET" \
 *   -H "Content-Type: application/json" \
 *   -d '{"days": 30}'
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
  const cronSecret = privateEnv.CRON_SECRET || platform?.env?.CRON_SECRET || process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('❌ CRON_SECRET not configured');
    throw error(500, 'Server configuration error');
  }

  const expectedAuth = `Bearer ${cronSecret}`;
  if (authHeader !== expectedAuth) {
    console.error('❌ Invalid authentication');
    throw error(401, 'Unauthorized');
  }

  // 2. Parse request body
  const body = await request.json().catch(() => ({}));
  const daysToBackfill = parseInt(body.days || '30', 10);

  if (daysToBackfill < 1 || daysToBackfill > 365) {
    throw error(400, 'Days must be between 1 and 365');
  }

  console.log('🔄 Sales Data Backfill Started');
  console.log(`📅 Backfilling last ${daysToBackfill} days`);

  // Initialize services
  const reportsService = new ReportsService();
  const salesProcessor = new SalesProcessor();

  let logId: number | null = null;
  let reportId: string | null = null;

  try {
    // 3. Calculate date range
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1); // Yesterday
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToBackfill);
    startDate.setHours(0, 0, 0, 0);

    const dateRange = {
      start: startDate,
      end: endDate
    };

    console.log(`📅 Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    // 4. Log job start
    logId = await reportsService.logJobStart(
      'backfill_sales_report',
      'GET_SALES_AND_TRAFFIC_REPORT',
      dateRange
    );

    // 5. Request report
    reportId = await reportsService.requestReport({
      reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      marketplaceIds: ['A1F83G8C2ARO7P'], // UK marketplace
      reportOptions: {
        dateGranularity: 'DAY',
        asinGranularity: 'CHILD'
      }
    });

    console.log(`📊 Report requested: ${reportId}`);

    if (logId) {
      await reportsService.logJobProcessing(logId, reportId);
    }

    // 6. Poll until complete (max 30 minutes for larger backfills)
    const status = await reportsService.pollReportStatus(reportId, 30, 60);

    if (!status.reportDocumentId) {
      throw new Error('Report completed but no document ID returned');
    }

    // 7. Download report
    const reportDocInfo = await reportsService.getReportDocument(status.reportDocumentId);
    const reportData = await reportsService.downloadReport(
      reportDocInfo.url,
      reportDocInfo.compressionAlgorithm
    );

    // 8. Process and store data
    const result = await salesProcessor.processSalesReport(reportData);

    // 9. Log success
    const executionTimeSeconds = Math.round((Date.now() - startTime) / 1000);

    if (logId) {
      await reportsService.logJobComplete(logId, {
        recordsProcessed: result.processed,
        recordsUpdated: result.updated,
        recordsFailed: result.failed
      });
    }

    console.log(`✅ Backfill completed in ${executionTimeSeconds} seconds`);

    return json({
      success: true,
      reportId,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        days: daysToBackfill
      },
      recordsProcessed: result.processed,
      recordsUpdated: result.updated,
      recordsFailed: result.failed,
      executionTime: `${executionTimeSeconds}s`
    });

  } catch (err) {
    const executionTimeSeconds = Math.round((Date.now() - startTime) / 1000);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    console.error('❌ Backfill failed:', errorMessage);

    // Log failure
    if (logId) {
      await reportsService.logJobFailed(logId, err instanceof Error ? err : new Error(errorMessage));
    }

    throw error(500, {
      message: 'Backfill failed',
      error: errorMessage,
      reportId,
      executionTime: `${executionTimeSeconds}s`
    });
  }
};
