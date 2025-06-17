import { supabase } from './supabaseClient';

export interface DailyEmployeeHour {
  id?: string;
  employee_id: string;
  employee_name: string;
  employee_role: string;
  work_date: string; // Format: YYYY-MM-DD
  hours_worked: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface DailyHoursSummary {
  date: string;
  total_employees: number;
  working_today: number;
  total_hours: number;
  role_breakdown: {
    [role: string]: {
      employee_count: number;
      total_hours: number;
    };
  };
}

/**
 * Save daily hours for multiple employees
 * Uses upsert to handle both inserts and updates
 */
export async function saveDailyHours(
  employeeHours: Record<string, number>,
  employees: Array<{ id: string; name: string; role: string }>,
  workDate: string,
  createdBy?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Prepare the data for upsert
    const hoursData: Omit<DailyEmployeeHour, 'id' | 'created_at' | 'updated_at'>[] = employees.map(
      (employee) => ({
        employee_id: employee.id,
        employee_name: employee.name,
        employee_role: employee.role || 'Unknown',
        work_date: workDate,
        hours_worked: employeeHours[employee.id] || 0,
        created_by: createdBy || 'system'
      })
    );

    // Filter out records with 0 hours if you don't want to store them
    // const nonZeroHours = hoursData.filter(record => record.hours_worked > 0);

    const { data, error } = await supabase
      .from('daily_employee_hours')
      .upsert(hoursData, {
        onConflict: 'employee_id,work_date',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('Error saving daily hours:', error);
      return { success: false, error: error.message };
    }

    console.log('Successfully saved daily hours:', data);
    return { success: true };
  } catch (err) {
    console.error('Unexpected error saving daily hours:', err);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get daily hours for a specific date
 */
export async function getDailyHours(workDate: string): Promise<DailyEmployeeHour[]> {
  try {
    const { data, error } = await supabase
      .from('daily_employee_hours')
      .select('*')
      .eq('work_date', workDate)
      .order('employee_role', { ascending: true })
      .order('employee_name', { ascending: true });

    if (error) {
      console.error('Error fetching daily hours:', error);
      throw new Error(error.message);
    }

    return data || [];
  } catch (err) {
    console.error('Error fetching daily hours:', err);
    throw err;
  }
}

/**
 * Get daily hours summary for a specific date
 */
export async function getDailyHoursSummary(workDate: string): Promise<DailyHoursSummary> {
  try {
    const dailyHours = await getDailyHours(workDate);

    const summary: DailyHoursSummary = {
      date: workDate,
      total_employees: dailyHours.length,
      working_today: dailyHours.filter((h) => h.hours_worked > 0).length,
      total_hours: dailyHours.reduce((sum, h) => sum + h.hours_worked, 0),
      role_breakdown: {}
    };

    // Calculate role breakdown
    dailyHours.forEach((hour) => {
      const role = hour.employee_role;
      if (!summary.role_breakdown[role]) {
        summary.role_breakdown[role] = {
          employee_count: 0,
          total_hours: 0
        };
      }
      summary.role_breakdown[role].employee_count += 1;
      summary.role_breakdown[role].total_hours += hour.hours_worked;
    });

    return summary;
  } catch (err) {
    console.error('Error calculating daily hours summary:', err);
    throw err;
  }
}

/**
 * Delete daily hours for a specific date (useful for clearing/resetting)
 */
export async function deleteDailyHours(workDate: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('daily_employee_hours')
      .delete()
      .eq('work_date', workDate);

    if (error) {
      console.error('Error deleting daily hours:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Unexpected error deleting daily hours:', err);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get hours for a date range (useful for reports)
 */
export async function getHoursDateRange(
  startDate: string,
  endDate: string
): Promise<DailyEmployeeHour[]> {
  try {
    const { data, error } = await supabase
      .from('daily_employee_hours')
      .select('*')
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('work_date', { ascending: true })
      .order('employee_role', { ascending: true })
      .order('employee_name', { ascending: true });

    if (error) {
      console.error('Error fetching hours date range:', error);
      throw new Error(error.message);
    }

    return data || [];
  } catch (err) {
    console.error('Error fetching hours date range:', err);
    throw err;
  }
}

/**
 * Check if hours exist for a specific date
 */
export async function checkHoursExist(workDate: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('daily_employee_hours')
      .select('id')
      .eq('work_date', workDate)
      .limit(1);

    if (error) {
      console.error('Error checking if hours exist:', error);
      return false;
    }

    return (data && data.length > 0) || false;
  } catch (err) {
    console.error('Error checking if hours exist:', err);
    return false;
  }
}
