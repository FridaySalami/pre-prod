import { supabase } from './supabaseClient';
import { updateScheduledHoursForDate } from './hours-service';

/**
 * Updates scheduled hours for all days within a date range
 * @param startDate Beginning of range to update
 * @param endDate End of range to update
 * @returns Number of days that were updated
 */
export async function updateScheduledHoursBatch(startDate: Date, endDate: Date): Promise<number> {
  try {
    // Validate date inputs
    if (!(startDate instanceof Date) || isNaN(startDate.getTime()) ||
        !(endDate instanceof Date) || isNaN(endDate.getTime())) {
      console.error('Invalid date range provided:', { startDate, endDate });
      return 0;
    }
    
    // Format dates for API and logging
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);
    
    console.log(`Starting batch update from ${startDateStr} to ${endDateStr}`);
    
    // Get all scheduled data in the range
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('schedules')
      .select('*')
      .gte('date', startDateStr)
      .lte('date', endDateStr);
    
    if (scheduleError) throw scheduleError;
    
    console.log(`Found ${scheduleData?.length || 0} schedule records in range`);
    
    // Group by date
    const schedulesByDate: Record<string, any[]> = {};
    scheduleData?.forEach(item => {
      const date = item.date;
      if (!schedulesByDate[date]) schedulesByDate[date] = [];
      schedulesByDate[date].push(item);
    });
    
    // Log how many dates we'll be processing
    const datesToUpdate = Object.keys(schedulesByDate);
    console.log(`Processing ${datesToUpdate.length} unique dates`);
    
    // Update each date's hours - only process dates that have schedules
    let updatedCount = 0;
    
    // Only process dates that actually have schedules
    for (const dateStr of datesToUpdate) {
      try {
        // Verify the date string format is correct (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          console.error(`Invalid date format found: ${dateStr}, skipping`);
          continue;
        }
        
        // Convert string to date object for processing and verification
        const date = new Date(dateStr);
        
        // Additional verification of parsed date
        if (isNaN(date.getTime())) {
          console.error(`Failed to parse date: ${dateStr}, skipping`);
          continue;
        }
        
        // Log what we're processing
        console.log(`Processing date: ${dateStr} (${date.toLocaleDateString('en-US', { weekday: 'long' })})`);
        
        // Update hours for this date
        await updateScheduledHoursForDate(date);
        updatedCount++;
        
        if (updatedCount % 10 === 0) {
          console.log(`Updated ${updatedCount} days so far...`);
        }
      } catch (err) {
        console.error(`Error updating ${dateStr}:`, err);
      }
    }
    
    console.log(`Batch update completed. Updated ${updatedCount} days.`);
    return updatedCount;
  } catch (err) {
    console.error('Error in updateScheduledHoursBatch:', err);
    return 0;
  }
}

/**
 * Format date for API (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
