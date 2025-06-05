// hours-service.ts
import { supabase } from '../supabaseClient';

/**
 * Get scheduled hours for a date range
 * @param startDate Beginning of the date range
 * @param endDate End of the date range
 * @returns Array of date and hours objects
 */
export async function getScheduledHoursForDateRange(
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: string, hours: number }>> {
  try {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Use dedicated scheduled_hours table
    let { data: hoursData, error: hoursError } = await supabase
      .from('scheduled_hours')
      .select('date, hours')
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    if (hoursError) {
      console.error('Error fetching scheduled hours:', hoursError);

      // Fall back to daily_metrics for backward compatibility
      const { data: metricsData, error: metricsError } = await supabase
        .from('daily_metrics')
        .select('date, scheduled_hours')
        .gte('date', startDateStr)
        .lte('date', endDateStr);

      if (metricsError) {
        console.error('Error fetching scheduled hours from metrics:', metricsError);
        return [];
      }

      // Map the metrics data to match the expected format
      return (metricsData || []).map((item: { date: string, scheduled_hours: number }) => ({
        date: item.date,
        hours: item.scheduled_hours || 0
      }));
    }

    return (hoursData || []).map((item: { date: string, hours: number }) => ({
      date: item.date,
      hours: item.hours || 0
    }));

  } catch (err) {
    console.error('Error in getScheduledHoursForDateRange:', err);
    return [];
  }
}

/**
 * Updates scheduled hours for a specific date based on employee schedules
 * @param date The date to calculate and update hours for
 * @returns The calculated hours value
 */
export async function updateScheduledHoursForDate(date: Date): Promise<number> {
  const dateStr = date.toISOString().split('T')[0];

  try {
    // 1. Get all schedules for this date
    const { data: schedules, error: scheduleError } = await supabase
      .from('schedules')
      .select('*')
      .eq('date', dateStr);

    if (scheduleError) throw scheduleError;

    // 2. Get leave information for employees with schedules
    const employeeIds = schedules?.map((s: { employee_id: string }) => s.employee_id) || [];
    
    let leaveData: any[] = [];
    if (employeeIds.length > 0) {
      const { data: leaveResult } = await supabase
        .from('leave_requests')
        .select('*')
        .lte('start_date', dateStr)
        .gte('end_date', dateStr)
        .in('employee_id', employeeIds)
        .eq('status', 'approved');
      
      leaveData = leaveResult || [];
    }
    
    // 3. Calculate hours (exclude employees on leave)
    const leavesEmployeeIds = leaveData.map((l: { employee_id: string }) => l.employee_id);
    const activeEmployees = schedules?.filter((s: { employee_id: string }) => !leavesEmployeeIds.includes(s.employee_id)) || [];
    const hours = activeEmployees.length * 8.5;

    // 4. Update the scheduled_hours table
    const { error: upsertError } = await supabase
      .from('scheduled_hours')
      .upsert(
        {
          date: dateStr,
          hours: hours,
          updated_at: new Date()
        },
        {
          onConflict: 'date'
        }
      );

    if (upsertError) throw upsertError;

    // 5. Also update the daily_metrics table for backward compatibility
    await supabase
      .from('daily_metrics')
      .upsert(
        {
          date: dateStr,
          scheduled_hours: hours
        },
        {
          onConflict: 'date'
        }
      );

    return hours;
  } catch (err) {
    console.error('Error in updateScheduledHoursForDate:', err);
    throw err;
  }
}

// Batch update function to fix historical data or update multiple dates
export async function updateScheduledHoursBatch(startDate: Date, endDate: Date): Promise<number> {
  let updatedCount = 0;

  // Loop through each day in the range
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    try {
      await updateScheduledHoursForDate(d);
      updatedCount++;
    } catch (err) {
      console.error(`Error updating hours for ${d.toISOString().split('T')[0]}:`, err);
    }
  }

  return updatedCount;
}