/**
 * Sales Data Processor
 * 
 * Processes Amazon Sales & Traffic reports and stores data in Supabase
 * 
 * Report Format: GET_SALES_AND_TRAFFIC_REPORT returns JSON with:
 * - salesAndTrafficByDate: Array of daily metrics
 * - salesAndTrafficByAsin: Array of per-ASIN metrics
 * 
 * This processor handles:
 * - Parsing JSON report data
 * - Extracting per-ASIN metrics
 * - Deduplication (UPSERT on conflict)
 * - Data validation and cleanup
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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

interface AmazonSalesData {
  parentAsin?: string;
  childAsin: string;
  sku?: string;
  date: string; // ISO date string

  // Sales metrics
  orderedProductSales?: {
    amount: number;
    currencyCode: string;
  };
  orderedProductSalesB2B?: {
    amount: number;
    currencyCode: string;
  };
  unitsOrdered: number;
  unitsOrderedB2B?: number;
  totalOrderItems: number;
  totalOrderItemsB2B?: number;

  // Traffic metrics
  browserSessions?: number;
  browserSessionsB2B?: number;
  mobileAppSessions?: number;
  mobileAppSessionsB2B?: number;
  sessions?: number; // Total sessions
  sessionsB2B?: number;
  browserSessionPercentage?: number;
  mobileAppSessionPercentage?: number;
  sessionPercentage?: number;
  browserPageViews?: number;
  browserPageViewsB2B?: number;
  mobileAppPageViews?: number;
  mobileAppPageViewsB2B?: number;
  pageViews?: number; // Total page views
  pageViewsB2B?: number;
  browserPageViewsPercentage?: number;
  mobileAppPageViewsPercentage?: number;
  pageViewsPercentage?: number;

  // Conversion metrics
  unitSessionPercentage?: number; // Conversion rate
  unitSessionPercentageB2B?: number;

  // Buy Box metrics
  buyBoxPercentage?: number;
  buyBoxPercentageB2B?: number;

  // Other metrics
  averageSalesPrice?: {
    amount: number;
    currencyCode: string;
  };
  averageSellingPrice?: {
    amount: number;
    currencyCode: string;
  };
  averageOfferCount?: number;
}

export interface ProcessingStats {
  processed: number;
  failed: number;
  updated: number;
  errors: string[];
}

export class SalesProcessor {
  /**
   * Process a sales report and store in database
   * @param reportData The JSON data from Amazon report
   * @param reportId The report ID for tracking
   * @param reportDate The date this report covers (YYYY-MM-DD)
   */
  async processSalesReport(reportData: any, reportId: string, reportDate?: string): Promise<ProcessingStats> {
    console.log('📊 Processing sales report...');
    console.log('📊 Report data keys:', reportData ? Object.keys(reportData) : 'null');

    const stats: ProcessingStats = {
      processed: 0,
      failed: 0,
      updated: 0,
      errors: []
    };

    // Amazon reports have two formats:
    // 1. salesAndTrafficByDate - aggregated by date
    // 2. salesAndTrafficByAsin - per ASIN metrics (this is what we want)

    const asinData = reportData.salesAndTrafficByAsin || [];

    if (!Array.isArray(asinData)) {
      console.error('❌ Invalid report format. Report structure:', JSON.stringify(reportData).substring(0, 500));
      throw new Error('Invalid report format - salesAndTrafficByAsin not found or not an array');
    }

    console.log(`   Found ${asinData.length} ASIN records to process`);

    // Process in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < asinData.length; i += batchSize) {
      const batch = asinData.slice(i, i + batchSize);
      const results = await this.processBatch(batch, reportId, reportDate);

      stats.processed += results.processed;
      stats.failed += results.failed;
      stats.updated += results.updated;
      stats.errors.push(...results.errors);
    }

    console.log('✅ Sales report processing complete');
    console.log(`   Processed: ${stats.processed}, Updated: ${stats.updated}, Failed: ${stats.failed}`);

    return stats;
  }

  /**
   * Process a batch of ASIN records
   */
  private async processBatch(records: any[], reportId: string, reportDate?: string): Promise<ProcessingStats> {
    const stats: ProcessingStats = {
      processed: 0,
      failed: 0,
      updated: 0,
      errors: []
    };

    const rows = records.map(record => {
      try {
        return this.transformRecord(record, reportId, reportDate);
      } catch (error) {
        stats.failed++;
        stats.errors.push(`Failed to transform record for ${record.parentAsin || 'unknown'}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
      }
    }).filter(row => row !== null);

    if (rows.length === 0) {
      return stats;
    }

    // Deduplicate within the batch to avoid "cannot affect row a second time" error
    // Keep the last occurrence of each asin+report_date+marketplace_id combination
    const deduplicatedRows = Array.from(
      rows.reduce((map, row) => {
        const key = `${row.asin}|${row.report_date}|${row.marketplace_id}`;
        map.set(key, row); // This will overwrite duplicates, keeping the last one
        return map;
      }, new Map()).values()
    );

    const duplicatesRemoved = rows.length - deduplicatedRows.length;
    if (duplicatesRemoved > 0) {
      console.log(`   Removed ${duplicatesRemoved} duplicate(s) within batch`);
    }

    // Upsert to database (insert or update on conflict)
    const { data, error } = await getSupabase()
      .from('amazon_sales_data')
      .upsert(deduplicatedRows, {
        onConflict: 'asin,report_date,marketplace_id',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('Database error:', error);
      stats.failed += rows.length;
      stats.errors.push(`Database error: ${error.message}`);
    } else {
      stats.processed += rows.length;
      // Count how many were actually updated vs inserted
      // (Supabase doesn't tell us, so we assume all were processed)
    }

    return stats;
  }

  /**
   * Transform Amazon report record to database schema
   * Handles both PARENT and CHILD granularity reports
   */
  private transformRecord(record: any, reportId: string, reportDate?: string) {
    // Amazon Sales & Traffic Report structures:
    // 
    // PARENT granularity:
    // {
    //   parentAsin: "B07N7S2CNS",
    //   salesByAsin: { unitsOrdered: 1, orderedProductSales: {...}, ... },
    //   trafficByAsin: { browserSessions: 10, ... }
    // }
    //
    // CHILD granularity:
    // {
    //   parentAsin: "B0BGPMD867",
    //   childAsin: "B0BGPMD867",
    //   title: "Product Title Here",
    //   salesByAsin: { unitsOrdered: 1, orderedProductSales: {...}, ... },
    //   trafficByAsin: { browserSessions: 10, ... }
    // }

    // Try child ASIN first (more specific), fall back to parent
    const asin = record.childAsin || record.parentAsin;

    if (!asin) {
      console.error('⚠️  Record missing ASIN:', JSON.stringify(record).substring(0, 200));
      throw new Error('Record is missing ASIN field');
    }

    const sales = record.salesByAsin || {};
    const traffic = record.trafficByAsin || {};

    // Use provided date or default to today
    const dateStr = reportDate || new Date().toISOString().split('T')[0];

    // Calculate total sessions (browser + mobile app)
    const sessions = traffic.sessions ||
      ((traffic.browserSessions || 0) + (traffic.mobileAppSessions || 0)) || 0;

    // Calculate total page views
    const pageViews = traffic.pageViews ||
      ((traffic.browserPageViews || 0) + (traffic.mobileAppPageViews || 0)) || 0;

    return {
      asin: asin,
      parent_asin: record.parentAsin || asin,
      sku: null, // Not provided in this report type
      report_date: dateStr,

      // Sales metrics
      ordered_units: sales.unitsOrdered || 0,
      ordered_product_sales: sales.orderedProductSales?.amount || 0,
      total_order_items: sales.totalOrderItems || 0,

      // Traffic metrics
      sessions: sessions,
      session_percentage: traffic.sessionPercentage || null,
      page_views: pageViews,
      page_views_percentage: traffic.pageViewsPercentage || null,

      // Conversion metrics
      unit_session_percentage: traffic.unitSessionPercentage || null,
      buy_box_percentage: traffic.buyBoxPercentage || null,

      // Other metrics
      average_sales_price: sales.averageSalesPrice?.amount ||
        sales.averageSellingPrice?.amount || null,
      average_offer_count: traffic.averageOfferCount || null,

      // Metadata
      marketplace_id: 'A1F83G8C2ARO7P', // UK marketplace
      currency_code: sales.orderedProductSales?.currencyCode || 'GBP',
      report_id: reportId
    };
  }

  /**
   * Get 30-day sales summary for specific ASIN
   */
  async get30DaySummary(asin: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await getSupabase()
      .from('amazon_sales_data')
      .select('*')
      .eq('asin', asin)
      .gte('report_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('report_date', { ascending: false });

    if (error) {
      console.error('Failed to fetch 30-day summary:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return null;
    }

    // Calculate aggregates
    const summary = {
      asin,
      days: data.length,
      totalRevenue: data.reduce((sum, row) => sum + (row.ordered_product_sales || 0), 0),
      totalUnits: data.reduce((sum, row) => sum + (row.ordered_units || 0), 0),
      totalSessions: data.reduce((sum, row) => sum + (row.sessions || 0), 0),
      totalPageViews: data.reduce((sum, row) => sum + (row.page_views || 0), 0),
      avgConversionRate: this.calculateAverage(data, 'unit_session_percentage'),
      avgBuyBoxPercentage: this.calculateAverage(data, 'buy_box_percentage'),
      avgSalesPrice: this.calculateAverage(data, 'average_sales_price'),
      latestData: data[0],
      oldestData: data[data.length - 1]
    };

    return summary;
  }

  /**
   * Helper to calculate average of non-null values
   */
  private calculateAverage(data: any[], field: string): number | null {
    const values = data
      .map(row => row[field])
      .filter(val => val !== null && val !== undefined && !isNaN(val));

    if (values.length === 0) return null;

    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Get sales trend data for charting
   */
  async getSalesTrend(asin: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await getSupabase()
      .from('amazon_sales_data')
      .select('report_date, ordered_product_sales, ordered_units, sessions, unit_session_percentage')
      .eq('asin', asin)
      .gte('report_date', startDate.toISOString().split('T')[0])
      .order('report_date', { ascending: true });

    if (error) {
      console.error('Failed to fetch sales trend:', error);
      throw error;
    }

    return data;
  }
}
