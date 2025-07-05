import type { RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_SERVICE_KEY } from '$env/static/private';

if (!PUBLIC_SUPABASE_URL || !PRIVATE_SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase configuration in environment variables');
}

const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY);

// Helper function to get Monday of current week
function getMonday(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// Working version of the upload API with simplified logic
export const POST: RequestHandler = async ({ request }) => {
  const totalStartTime = Date.now();
  let linnworksTime = 0;
  let financialTime = 0;
  let scheduledTime = 0;
  let employeeTime = 0;

  try {
    console.log('🚀 API: Starting streamlined daily metric review upload...');

    // Get current week dates
    const displayedMonday = getMonday(new Date());
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(displayedMonday);
      date.setDate(displayedMonday.getDate() + i);
      return date;
    });

    const mondayStr = displayedMonday.toISOString().split('T')[0];
    const sundayStr = new Date(displayedMonday.getTime() + 6 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    console.log(`📅 Target week: ${mondayStr} to ${sundayStr}`);

    // Step 1: Get Linnworks data
    console.log('📊 Step 1: Fetching Linnworks data...');
    const linnworksStartTime = Date.now();

    const linnworksResponse = await fetch(`https://jackweston.netlify.app/api/linnworks/weeklyOrderCounts?startDate=${mondayStr}&endDate=${sundayStr}`);

    if (!linnworksResponse.ok) {
      throw new Error(`Linnworks API failed: ${linnworksResponse.status}`);
    }

    const linnworksData = await linnworksResponse.json();
    linnworksTime = Date.now() - linnworksStartTime;

    console.log(`✅ Linnworks data fetched in ${linnworksTime}ms`);
    console.log('📋 Linnworks Response Structure:');
    console.log('   - Start Date:', linnworksData.startDate);
    console.log('   - End Date:', linnworksData.endDate);
    console.log('   - Daily Orders Count:', linnworksData.dailyOrders?.length || 0);
    console.log('   - Total Orders (summary):', linnworksData.summary?.totalOrders || 0);

    // Step 2: Get financial data
    console.log('📊 Step 2: Fetching financial data...');
    const financialStartTime = Date.now();

    const financialResponse = await fetch(`https://jackweston.netlify.app/api/linnworks/financialData?startDate=${mondayStr}&endDate=${sundayStr}`);

    if (!financialResponse.ok) {
      throw new Error(`Financial API failed: ${financialResponse.status}`);
    }

    const financialData = await financialResponse.json();
    financialTime = Date.now() - financialStartTime;

    console.log(`✅ Financial data fetched in ${financialTime}ms`);
    console.log('💰 Financial Response Structure:');
    console.log('   - Start Date:', financialData.startDate);
    console.log('   - End Date:', financialData.endDate);
    console.log('   - Daily Data Count:', financialData.dailyData?.length || 0);
    console.log('   - Total Sales (summary):', financialData.summary?.totalSales || 0);

    // Step 3: Get scheduled hours (simplified)
    console.log('📊 Step 3: Fetching scheduled hours...');
    const scheduledStartTime = Date.now();
    let scheduledHoursData = [];

    try {
      const { getScheduledHoursForDateRange } = await import('$lib/schedule/hours-service');
      const currentWeekStart = new Date(mondayStr);
      const currentWeekEnd = new Date(sundayStr);
      scheduledHoursData = await getScheduledHoursForDateRange(currentWeekStart, currentWeekEnd);

      scheduledTime = Date.now() - scheduledStartTime;
      console.log(`✅ Scheduled hours fetched in ${scheduledTime}ms`);

    } catch (err) {
      scheduledTime = Date.now() - scheduledStartTime;
      console.warn(`⚠️ Scheduled hours failed after ${scheduledTime}ms, using defaults:`, err);
      // Create default scheduled hours
      scheduledHoursData = weekDates.map(date => ({
        date: date.toISOString().split('T')[0],
        hours: 40 // Default 40 hours per day
      }));
      console.log('📝 Using default scheduled hours (40 hours per day)');
    }

    // Step 4: Get employee hours with role breakdown
    console.log('📊 Step 4: Fetching employee hours with role breakdown...');
    const employeeStartTime = Date.now();
    let employeeHoursData: Record<string, number> = {};
    let employeeRoleBreakdowns: Record<string, { management: number; packing: number; picking: number; }> = {};

    try {
      const startDateStr = mondayStr;
      const endDateStr = sundayStr;

      const { data, error } = await supabaseAdmin
        .from('daily_employee_hours')
        .select('work_date, hours_worked, employee_role')
        .gte('work_date', startDateStr)
        .lte('work_date', endDateStr);

      employeeTime = Date.now() - employeeStartTime;

      if (error) {
        console.warn(`⚠️ Employee hours query failed after ${employeeTime}ms:`, error);
      } else {
        console.log(`✅ Employee hours fetched in ${employeeTime}ms`);
        console.log('👥 Employee Hours Raw Data:');
        console.log('   - Records from Supabase:', data?.length || 0);

        // Group by date and sum hours, calculate role breakdowns
        data?.forEach((record) => {
          const date = record.work_date;
          const hours = record.hours_worked || 0;
          const role = record.employee_role?.toLowerCase() || '';

          // Initialize if needed
          if (!employeeHoursData[date]) {
            employeeHoursData[date] = 0;
          }
          if (!employeeRoleBreakdowns[date]) {
            employeeRoleBreakdowns[date] = { management: 0, packing: 0, picking: 0 };
          }

          // Add to total
          employeeHoursData[date] += hours;

          // Categorize by role
          if (role.includes('supervisor') || role.includes('manager')) {
            employeeRoleBreakdowns[date].management += hours;
          } else if (role.includes('associate')) {
            employeeRoleBreakdowns[date].packing += hours;
          } else if (role.includes('picking')) {
            employeeRoleBreakdowns[date].picking += hours;
          }
        });

        if (Object.keys(employeeHoursData).length === 0) {
          console.log('⚠️ No employee hours data found for this date range');
        }
      }
    } catch (err) {
      employeeTime = Date.now() - employeeStartTime;
      console.warn(`⚠️ Employee hours failed after ${employeeTime}ms, using defaults:`, err);
    }

    // Step 5: Prepare upload data (using correct column names)
    console.log('📊 Step 5: Preparing upload data...');
    const uploadData = weekDates.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      const dayData = linnworksData.dailyOrders?.find((d: any) => d.date === dateStr);
      const financialDayData = financialData.dailyData?.find((d: any) => d.date === dateStr);
      const scheduledHours = scheduledHoursData.find((h: any) => h.date === dateStr);
      const roleBreakdown = employeeRoleBreakdowns[dateStr] || { management: 0, packing: 0, picking: 0 };

      const totalOrders = dayData?.count || 0;
      const amazonOrders = dayData?.channels?.amazon || 0;
      const ebayOrders = dayData?.channels?.ebay || 0;
      const shopifyOrders = dayData?.channels?.shopify || 0;
      const actualHours = employeeHoursData[dateStr] || 0;
      const schedHours = scheduledHours?.hours || 40;

      return {
        date: dateStr,

        // Labor metrics (using correct column names from schema)
        shipments_packed: totalOrders,
        scheduled_hours: schedHours,
        actual_hours_worked: actualHours, // Note: using actual_hours_worked, not total_hours_used
        management_hours_used: roleBreakdown.management,
        packing_hours_used: roleBreakdown.packing,
        picking_hours_used: roleBreakdown.picking,
        labor_efficiency: actualHours > 0 ? Math.round((totalOrders / actualHours) * 100) / 100 : 0,
        labor_utilization_percent: schedHours > 0 ? Math.round((actualHours / schedHours) * 100) : 0,

        // Sales metrics
        total_sales: financialDayData?.salesData?.totalSales || 0,
        amazon_sales: financialDayData?.salesData?.amazonSales || 0,
        ebay_sales: financialDayData?.salesData?.ebaySales || 0,
        shopify_sales: financialDayData?.salesData?.shopifySales || 0,

        // Order metrics (using correct column names)
        linnworks_total_orders: totalOrders,
        linnworks_amazon_orders: amazonOrders,
        linnworks_ebay_orders: ebayOrders,
        linnworks_shopify_orders: shopifyOrders,

        // Percentage distribution (computed)
        amazon_orders_percent: totalOrders > 0 ? Math.round((amazonOrders / totalOrders) * 10000) / 100 : 0,
        ebay_orders_percent: totalOrders > 0 ? Math.round((ebayOrders / totalOrders) * 10000) / 100 : 0,
        shopify_orders_percent: totalOrders > 0 ? Math.round((shopifyOrders / totalOrders) * 10000) / 100 : 0
      };
    });

    console.log('📊 Upload data prepared:', uploadData.length, 'records');

    // Debug: Show sample upload record
    if (uploadData.length > 0) {
      console.log('📋 Sample Upload Record (Day 1):');
      const sample = uploadData[0];
      console.log(`   Date: ${sample.date}`);
      console.log(`   Shipments: ${sample.shipments_packed}`);
      console.log(`   Scheduled Hours: ${sample.scheduled_hours}`);
      console.log(`   Actual Hours: ${sample.actual_hours_worked}`);
      console.log(`   Management Hours: ${sample.management_hours_used}`);
      console.log(`   Packing Hours: ${sample.packing_hours_used}`);
      console.log(`   Picking Hours: ${sample.picking_hours_used}`);
      console.log(`   Labor Efficiency: ${sample.labor_efficiency}`);
      console.log(`   Labor Utilization: ${sample.labor_utilization_percent}%`);
      console.log(`   Total Sales: £${sample.total_sales}`);
      console.log(`   Linnworks Orders: ${sample.linnworks_total_orders}`);
      console.log(`   Amazon %: ${sample.amazon_orders_percent}%`);
    }

    // Step 6: Upload to Supabase
    console.log('☁️ Step 6: Uploading to Supabase...');
    const uploadStartTime = Date.now();

    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('daily_metric_review')
      .upsert(uploadData, {
        onConflict: 'date',
        ignoreDuplicates: false
      });

    const uploadTime = Date.now() - uploadStartTime;

    if (insertError) {
      console.error(`❌ Supabase upload failed after ${uploadTime}ms:`, insertError);
      throw new Error(`Supabase upload failed: ${insertError.message}`);
    }

    console.log(`✅ Upload completed successfully in ${uploadTime}ms`);

    const totalTime = Date.now() - totalStartTime;
    console.log('📤 Upload Summary:');
    console.log(`   - Records processed: ${uploadData.length}`);
    console.log(`   - Week range: ${mondayStr} to ${sundayStr}`);

    console.log('⏱️ Detailed Timing Breakdown:');
    console.log(`   - Linnworks API: ${linnworksTime}ms`);
    console.log(`   - Financial API: ${financialTime}ms`);
    console.log(`   - Scheduled Hours: ${scheduledTime}ms`);
    console.log(`   - Employee Hours: ${employeeTime}ms`);
    console.log(`   - Supabase Upload: ${uploadTime}ms`);
    console.log(`   - Total Processing: ${totalTime}ms`);

    console.log('📊 Data Quality Summary:');
    console.log(`   - Linnworks days with data: ${linnworksData.dailyOrders?.length || 0}/7`);
    console.log(`   - Financial days with data: ${financialData.dailyData?.length || 0}/7`);
    console.log(`   - Employee hours days: ${Object.keys(employeeHoursData).length}/7`);
    console.log(`   - Role breakdown days: ${Object.keys(employeeRoleBreakdowns).length}/7`);
    console.log(`   - Scheduled hours days: ${scheduledHoursData.length}/7`);

    // Show role breakdown totals
    const totalManagementHours = Object.values(employeeRoleBreakdowns).reduce((sum, day) => sum + day.management, 0);
    const totalPackingHours = Object.values(employeeRoleBreakdowns).reduce((sum, day) => sum + day.packing, 0);
    const totalPickingHours = Object.values(employeeRoleBreakdowns).reduce((sum, day) => sum + day.picking, 0);
    console.log('🎯 Role Breakdown Week Totals:');
    console.log(`   - Management: ${totalManagementHours} hours`);
    console.log(`   - Packing/Associate: ${totalPackingHours} hours`);
    console.log(`   - Picking: ${totalPickingHours} hours`);

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully uploaded daily metric review for week ${weekDates[0].toLocaleDateString()} - ${weekDates[6].toLocaleDateString()} via streamlined API`,
      weekRange: `${weekDates[0].toLocaleDateString()} - ${weekDates[6].toLocaleDateString()}`,
      recordsUploaded: uploadData.length,
      uploadedAt: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('❌ API: Error in streamlined upload:', err);

    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * GET /api/upload-metric-review-working
 * Returns status and information about the current week that would be uploaded
 */
export const GET: RequestHandler = async () => {
  try {
    const displayedMonday = getMonday(new Date());
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(displayedMonday);
      date.setDate(displayedMonday.getDate() + i);
      return date;
    });

    return new Response(JSON.stringify({
      currentWeek: {
        start: weekDates[0].toISOString().split('T')[0],
        end: weekDates[6].toISOString().split('T')[0],
        range: `${weekDates[0].toLocaleDateString()} - ${weekDates[6].toLocaleDateString()}`
      },
      endpoint: '/api/upload-metric-review-working',
      method: 'POST',
      description: 'Streamlined version - Call this endpoint with POST to trigger metric review upload for current week'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
