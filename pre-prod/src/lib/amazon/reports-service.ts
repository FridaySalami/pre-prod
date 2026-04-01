/**
 * Amazon Reports API Service
 * 
 * Handles requesting, polling, downloading, and processing reports from Amazon SP-API
 * 
 * Report Flow:
 * 1. requestReport() - Create report request
 * 2. pollReportStatus() - Wait for report to complete
 * 3. getReportDocument() - Get download URL
 * 4. downloadReport() - Download and decompress data
 * 
 * Rate Limits:
 * - Request Report: 0.0167 requests/second (1 per 60 seconds)
 * - Get Report: 2 requests/second
 * - Get Report Document: 0.0167 requests/second (1 per 60 seconds)
 */

import { SPAPIClient } from './sp-api-client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { gunzipSync } from 'zlib';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';

// Lazy-initialize Supabase client
let supabaseInstance: SupabaseClient | null = null;
function getSupabase() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(
      PUBLIC_SUPABASE_URL,
      env.PRIVATE_SUPABASE_SERVICE_KEY!
    );
  }
  return supabaseInstance;
}

export interface ReportOptions {
  reportType: string;
  startDate?: string; // ISO date string
  endDate?: string;
  marketplaceIds?: string[];
  reportOptions?: Record<string, string>;
}

export interface ReportStatus {
  reportId: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' | 'FATAL';
  reportDocumentId?: string;
  processingStartDate?: string;
  processingEndDate?: string;
  createdTime: string;
}

export interface ReportDocument {
  reportDocumentId: string;
  url: string;
  compressionAlgorithm?: string;
}

export class ReportsService {
  private client: SPAPIClient;

  constructor() {
    // Manually create client with credentials from SvelteKit env
    // SPAPIClient.fromEnv() doesn't work in SvelteKit because process.env is not populated
    this.client = new SPAPIClient({
      clientId: env.AMAZON_CLIENT_ID || '',
      clientSecret: env.AMAZON_CLIENT_SECRET || '',
      refreshToken: env.AMAZON_REFRESH_TOKEN || '',
      awsAccessKeyId: env.AMAZON_AWS_ACCESS_KEY_ID || '',
      awsSecretAccessKey: env.AMAZON_AWS_SECRET_ACCESS_KEY || '',
      awsRegion: env.AMAZON_AWS_REGION || 'eu-west-1',
      marketplaceId: env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
      roleArn: env.AMAZON_ROLE_ARN,
      sellerId: env.AMAZON_SELLER_ID
    });
  }

  /**
   * Request a new report
   * @returns reportId to poll for status
   */
  async requestReport(options: ReportOptions): Promise<string> {
    console.log('📊 Requesting Amazon report:', options.reportType);

    const body = {
      reportType: options.reportType,
      marketplaceIds: options.marketplaceIds || ['A1F83G8C2ARO7P'], // UK marketplace
      ...(options.startDate && { dataStartTime: options.startDate }),
      ...(options.endDate && { dataEndTime: options.endDate }),
      ...(options.reportOptions && { reportOptions: options.reportOptions })
    };

    const response = await this.client.request(
      'POST',
      '/reports/2021-06-30/reports',
      { body }
    );

    if (!response.data?.reportId) {
      throw new Error('Failed to create report - no reportId returned');
    }

    console.log('✅ Report requested successfully. Report ID:', response.data.reportId);
    return response.data.reportId;
  }

  /**
   * Get the status of a report
   * @param reportId The report ID from requestReport()
   */
  async getReportStatus(reportId: string): Promise<ReportStatus> {
    const response = await this.client.request(
      'GET',
      `/reports/2021-06-30/reports/${reportId}`
    );

    return {
      reportId: response.data.reportId,
      status: response.data.processingStatus,
      reportDocumentId: response.data.reportDocumentId,
      processingStartDate: response.data.processingStartDate,
      processingEndDate: response.data.processingEndDate,
      createdTime: response.data.createdTime
    };
  }

  /**
   * Poll report status until complete or timeout
   * @param reportId The report ID to poll
   * @param maxWaitMinutes Maximum time to wait (default 20 minutes)
   * @param pollIntervalSeconds How often to check (default 60 seconds)
   */
  async pollReportStatus(
    reportId: string,
    maxWaitMinutes = 20,
    pollIntervalSeconds = 60
  ): Promise<ReportStatus> {
    console.log(`⏳ Polling report ${reportId} status...`);

    const maxAttempts = (maxWaitMinutes * 60) / pollIntervalSeconds;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await this.getReportStatus(reportId);

      console.log(`   Status: ${status.status} (attempt ${attempts + 1}/${maxAttempts})`);

      if (status.status === 'DONE') {
        console.log('✅ Report completed!');
        return status;
      }

      if (status.status === 'CANCELLED' || status.status === 'FATAL') {
        throw new Error(`Report ${status.status.toLowerCase()}`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalSeconds * 1000));
      attempts++;
    }

    throw new Error(`Report timeout - still ${await this.getReportStatus(reportId).then(s => s.status)} after ${maxWaitMinutes} minutes`);
  }

  /**
   * Get report document download information
   * @param reportDocumentId From completed report status
   */
  async getReportDocument(reportDocumentId: string): Promise<ReportDocument> {
    console.log('📥 Getting report document:', reportDocumentId);

    const response = await this.client.request(
      'GET',
      `/reports/2021-06-30/documents/${reportDocumentId}`
    );

    return {
      reportDocumentId: response.data.reportDocumentId,
      url: response.data.url,
      compressionAlgorithm: response.data.compressionAlgorithm
    };
  }

  /**
   * Download and decompress report data
   * @param url Download URL from getReportDocument()
   * @param compressionAlgorithm Compression algorithm from getReportDocument()
   */
  async downloadReport(url: string, compressionAlgorithm?: string): Promise<any> {
    console.log('⬇️  Downloading report data...');

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download report: ${response.status} ${response.statusText}`);
    }

    let data: string;

    // Check if data is compressed
    if (compressionAlgorithm === 'GZIP') {
      console.log('📦 Decompressing GZIP report...');
      const buffer = Buffer.from(await response.arrayBuffer());
      const decompressed = gunzipSync(buffer);
      data = decompressed.toString('utf-8');
    } else {
      console.log('📄 Reading uncompressed report...');
      data = await response.text();
    }

    // Try to parse as JSON, otherwise return raw text (CSV)
    try {
      return JSON.parse(data);
    } catch {
      // Not JSON, return as text (probably CSV)
      return data;
    }
  }

  /**
   * Complete flow: Request -> Poll -> Download
   * @param options Report request options
   */
  async requestAndWaitForReport(options: ReportOptions): Promise<any> {
    console.log('🚀 Starting complete report flow...');

    // Step 1: Request report
    const reportId = await this.requestReport(options);

    // Step 2: Poll until complete
    const status = await this.pollReportStatus(reportId);

    if (!status.reportDocumentId) {
      throw new Error('Report completed but no document ID provided');
    }

    // Step 3: Get download URL
    const document = await this.getReportDocument(status.reportDocumentId);

    // Step 4: Download and decompress
    const data = await this.downloadReport(
      document.url,
      document.compressionAlgorithm
    );

    console.log('✅ Report flow complete!');
    return data;
  }

  /**
   * Log job execution to database
   */
  async logJobStart(jobType: string, reportType: string, dateRange?: { start: Date; end: Date }) {
    const { data, error } = await getSupabase()
      .from('report_job_logs')
      .insert({
        job_type: jobType,
        report_type: reportType,
        status: 'started',
        date_range_start: dateRange?.start,
        date_range_end: dateRange?.end,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to log job start:', error);
      throw error;
    }

    return data.id;
  }

  /**
   * Update job log with report ID and processing status
   */
  async logJobProcessing(logId: number, reportId: string, reportDocumentId?: string) {
    const { error } = await getSupabase()
      .from('report_job_logs')
      .update({
        report_id: reportId,
        report_document_id: reportDocumentId,
        status: 'processing'
      })
      .eq('id', logId);

    if (error) {
      console.error('Failed to update job log:', error);
    }
  }

  /**
   * Mark job as complete
   */
  async logJobComplete(
    logId: number,
    stats: { processed: number; failed: number; updated: number }
  ) {
    const { data: log } = await getSupabase()
      .from('report_job_logs')
      .select('started_at')
      .eq('id', logId)
      .single();

    const durationSeconds = log
      ? Math.floor((Date.now() - new Date(log.started_at).getTime()) / 1000)
      : null;

    const { error } = await getSupabase()
      .from('report_job_logs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        records_processed: stats.processed,
        records_failed: stats.failed,
        records_updated: stats.updated
      })
      .eq('id', logId);

    if (error) {
      console.error('Failed to complete job log:', error);
    }
  }

  /**
   * Mark job as failed
   */
  async logJobFailed(logId: number, error: Error) {
    const { data: log } = await getSupabase()
      .from('report_job_logs')
      .select('started_at')
      .eq('id', logId)
      .single();

    const durationSeconds = log
      ? Math.floor((Date.now() - new Date(log.started_at).getTime()) / 1000)
      : null;

    await getSupabase()
      .from('report_job_logs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        error_message: error.message,
        error_code: error.name
      })
      .eq('id', logId);
  }
}
