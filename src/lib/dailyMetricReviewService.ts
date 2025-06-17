import { supabase } from './supabaseClient';
import { showToast } from './toastStore';

export interface DailyMetricReviewData {
  date: string;

  // Labor metrics (1.x series)
  shipments_packed: number; // 1.1 (now auto-populated from Linnworks orders)
  scheduled_hours: number; // 1.2
  actual_hours_worked: number; // 1.3 Total Hours Used (keeping column name for compatibility)
  management_hours_used: number; // 1.3.1
  packing_hours_used: number; // 1.3.2  
  picking_hours_used: number; // 1.3.3
  labor_efficiency: number; // 1.4 (shipments per hour)
  labor_utilization_percent: number; // 1.5 (%)

  // Sales metrics (2.0 series)
  total_sales: number;
  amazon_sales: number;
  ebay_sales: number;
  shopify_sales: number;

  // Orders metrics (2.1 series) 
  linnworks_total_orders: number;
  linnworks_amazon_orders: number;
  linnworks_ebay_orders: number;
  linnworks_shopify_orders: number;

  // Percentage distribution (2.2 series - computed)
  amazon_orders_percent: number;
  ebay_orders_percent: number;
  shopify_orders_percent: number;
}

/**
 * Uploads daily metric review data to Supabase
 * @param data Array of daily metric review data
 * @returns Promise<boolean> indicating success
 */
export async function uploadDailyMetricReview(data: DailyMetricReviewData[]): Promise<boolean> {
  try {
    console.log('Uploading daily metric review data:', data);

    // Log the first record to verify structure
    if (data.length > 0) {
      console.log('Sample record structure:', Object.keys(data[0]));
      console.log('Sample record values:', data[0]);

      // Validate data types
      const sample = data[0];
      console.log('Data type validation:');
      console.log('date is string:', typeof sample.date === 'string');
      console.log('shipments_packed is number:', typeof sample.shipments_packed === 'number');
      console.log('scheduled_hours is number:', typeof sample.scheduled_hours === 'number');
      console.log('actual_hours_worked is number:', typeof sample.actual_hours_worked === 'number');
      console.log('management_hours_used is number:', typeof sample.management_hours_used === 'number');
      console.log('total_sales is number:', typeof sample.total_sales === 'number');
      console.log('linnworks_total_orders is number:', typeof sample.linnworks_total_orders === 'number');
      console.log('amazon_orders_percent is number:', typeof sample.amazon_orders_percent === 'number');
      console.log('labor_efficiency is number:', typeof sample.labor_efficiency === 'number');
    }

    const { error } = await supabase
      .from('daily_metric_review')
      .upsert(data, {
        onConflict: 'date'
      });

    if (error) {
      console.error('Error uploading daily metric review:', error);
      console.error('Error details:', {
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message
      });

      // If the main upload fails, try a simplified version with just basic fields
      console.log('Trying simplified upload with essential fields only...');
      const simplifiedData = data.map(record => ({
        date: record.date,
        shipments_packed: record.shipments_packed,
        scheduled_hours: record.scheduled_hours,
        actual_hours_worked: record.actual_hours_worked,
        total_sales: record.total_sales,
        linnworks_total_orders: record.linnworks_total_orders
      }));

      const { error: simpleError } = await supabase
        .from('daily_metric_review')
        .upsert(simplifiedData, { onConflict: 'date' });

      if (simpleError) {
        console.error('Simplified upload also failed:', simpleError);
        showToast(`Failed to upload metric review: ${error.message} (Code: ${error.code})`, 'error');
        return false;
      } else {
        console.log('Simplified upload succeeded');
        showToast(`Uploaded simplified metric review (some fields may be missing)`, 'warning');
        return true;
      }
    }

    showToast(`Successfully uploaded ${data.length} daily metric review records`, 'success');
    return true;
  } catch (err) {
    console.error('Exception during upload:', err);
    showToast('Failed to upload metric review due to unexpected error', 'error');
    return false;
  }
}

/**
 * Transforms metrics data from the dashboard into daily metric review format
 * @param metrics The metrics array from the dashboard
 * @param weekDates Array of dates for the week
 * @param computedMetrics Array of computed metric values
 * @returns Array of DailyMetricReviewData
 */
export function transformMetricsForReview(
  metrics: any[],
  weekDates: Date[],
  computedMetrics: number[][]
): DailyMetricReviewData[] {
  const reviewData: DailyMetricReviewData[] = [];

  // Find metric indices by name
  const findMetricIndex = (name: string) => metrics.findIndex(m => m.name === name);

  // Labor metrics (1.x series)
  const shipmentsPackedIdx = findMetricIndex('1.1 Shipments Packed');
  const scheduledHoursIdx = findMetricIndex('1.2 Scheduled Hours');
  const totalHoursIdx = findMetricIndex('1.3 Total Hours Used');
  const managementHoursIdx = findMetricIndex('1.3.1 Management Hours Used');
  const packingHoursIdx = findMetricIndex('1.3.2 Packing Hours Used');
  const pickingHoursIdx = findMetricIndex('1.3.3 Picking Hours Used');
  const laborEfficiencyIdx = findMetricIndex('1.4 Labor Efficiency (shipments/hour)');
  const laborUtilizationIdx = findMetricIndex('1.5 Labor Utilization (%)');

  // Sales metrics (2.0 series)
  const totalSalesIdx = findMetricIndex('2.0 Total Sales');
  const amazonSalesIdx = findMetricIndex('2.0.1 Amazon Sales');
  const ebaySalesIdx = findMetricIndex('2.0.2 eBay Sales');
  const shopifySalesIdx = findMetricIndex('2.0.3 Shopify Sales');

  // Orders metrics (2.1 series)
  const totalOrdersIdx = findMetricIndex('2.1 Linnworks Total Orders');
  const amazonOrdersIdx = findMetricIndex('2.1.1 Amazon Orders');
  const ebayOrdersIdx = findMetricIndex('2.1.2 eBay Orders');
  const shopifyOrdersIdx = findMetricIndex('2.1.3 Shopify Orders');

  // Percentage metrics (2.2 series)
  const amazonPercentIdx = findMetricIndex('2.2.1 Amazon Orders %');
  const ebayPercentIdx = findMetricIndex('2.2.2 eBay Orders %');
  const shopifyPercentIdx = findMetricIndex('2.2.3 Shopify Orders %');

  for (let dayIndex = 0; dayIndex < weekDates.length; dayIndex++) {
    const date = weekDates[dayIndex];
    const dateStr = date.toISOString().split('T')[0];

    const dayData: DailyMetricReviewData = {
      date: dateStr,

      // Labor metrics (1.x series)
      shipments_packed: shipmentsPackedIdx >= 0 ? (metrics[shipmentsPackedIdx].values[dayIndex] || 0) : 0,
      scheduled_hours: scheduledHoursIdx >= 0 ? (metrics[scheduledHoursIdx].values[dayIndex] || 0) : 0,
      actual_hours_worked: totalHoursIdx >= 0 ? (metrics[totalHoursIdx].values[dayIndex] || 0) : 0,
      management_hours_used: managementHoursIdx >= 0 ? (metrics[managementHoursIdx].values[dayIndex] || 0) : 0,
      packing_hours_used: packingHoursIdx >= 0 ? (metrics[packingHoursIdx].values[dayIndex] || 0) : 0,
      picking_hours_used: pickingHoursIdx >= 0 ? (metrics[pickingHoursIdx].values[dayIndex] || 0) : 0,
      labor_efficiency: laborEfficiencyIdx >= 0 ? (computedMetrics[laborEfficiencyIdx]?.[dayIndex] || 0) : 0,
      labor_utilization_percent: laborUtilizationIdx >= 0 ? (computedMetrics[laborUtilizationIdx]?.[dayIndex] || 0) : 0,

      // Sales data (2.0 series)
      total_sales: totalSalesIdx >= 0 ? (metrics[totalSalesIdx].values[dayIndex] || 0) : 0,
      amazon_sales: amazonSalesIdx >= 0 ? (metrics[amazonSalesIdx].values[dayIndex] || 0) : 0,
      ebay_sales: ebaySalesIdx >= 0 ? (metrics[ebaySalesIdx].values[dayIndex] || 0) : 0,
      shopify_sales: shopifySalesIdx >= 0 ? (metrics[shopifySalesIdx].values[dayIndex] || 0) : 0,

      // Orders data (2.1 series)
      linnworks_total_orders: totalOrdersIdx >= 0 ? (metrics[totalOrdersIdx].values[dayIndex] || 0) : 0,
      linnworks_amazon_orders: amazonOrdersIdx >= 0 ? (metrics[amazonOrdersIdx].values[dayIndex] || 0) : 0,
      linnworks_ebay_orders: ebayOrdersIdx >= 0 ? (metrics[ebayOrdersIdx].values[dayIndex] || 0) : 0,
      linnworks_shopify_orders: shopifyOrdersIdx >= 0 ? (metrics[shopifyOrdersIdx].values[dayIndex] || 0) : 0,

      // Percentage distribution (2.2 series - from computed metrics)
      amazon_orders_percent: amazonPercentIdx >= 0 ? (computedMetrics[amazonPercentIdx]?.[dayIndex] || 0) : 0,
      ebay_orders_percent: ebayPercentIdx >= 0 ? (computedMetrics[ebayPercentIdx]?.[dayIndex] || 0) : 0,
      shopify_orders_percent: shopifyPercentIdx >= 0 ? (computedMetrics[shopifyPercentIdx]?.[dayIndex] || 0) : 0
    };

    reviewData.push(dayData);
  }

  return reviewData;
}
