// src/lib/employeeHoursService.ts
import { supabase } from './supabaseClient';

export interface Employee {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

export interface EmployeeHours {
  id: string;
  employee_id: string;
  date: string;
  hours: number;
  created_at: string;
  updated_at: string;
}

export interface HourSubmission {
  employee_id: string;
  date: string;
  hours: number;
}

/**
 * Fetch all employees from the database
 */
export async function getEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, name, role')
    .order('name');

  if (error) {
    throw new Error(`Error fetching employees: ${error.message}`);
  }

  return data || [];
}

/**
 * Submit hours for multiple employees on a specific date
 */
export async function submitEmployeeHours(submissions: HourSubmission[]): Promise<void> {
  if (submissions.length === 0) {
    throw new Error('No hours to submit');
  }

  const hoursData = submissions.map(submission => ({
    employee_id: submission.employee_id,
    date: submission.date,
    hours: submission.hours,
    created_at: new Date().toISOString()
  }));

  const { error } = await supabase
    .from('employee_hours')
    .insert(hoursData);

  if (error) {
    throw new Error(`Error submitting hours: ${error.message}`);
  }
}

/**
 * Get hours for a specific date
 */
export async function getHoursForDate(date: string): Promise<EmployeeHours[]> {
  const { data, error } = await supabase
    .from('employee_hours')
    .select('*')
    .eq('date', date)
    .order('created_at');

  if (error) {
    throw new Error(`Error fetching hours for date: ${error.message}`);
  }

  return data || [];
}

/**
 * Get hours for a specific employee within a date range
 */
export async function getEmployeeHours(
  employeeId: string,
  startDate: string,
  endDate: string
): Promise<EmployeeHours[]> {
  const { data, error } = await supabase
    .from('employee_hours')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');

  if (error) {
    throw new Error(`Error fetching employee hours: ${error.message}`);
  }

  return data || [];
}

/**
 * Update hours for a specific employee and date
 */
export async function updateEmployeeHours(
  employeeId: string,
  date: string,
  hours: number
): Promise<void> {
  const { error } = await supabase
    .from('employee_hours')
    .update({
      hours,
      updated_at: new Date().toISOString()
    })
    .eq('employee_id', employeeId)
    .eq('date', date);

  if (error) {
    throw new Error(`Error updating hours: ${error.message}`);
  }
}

/**
 * Delete hours entry for a specific employee and date
 */
export async function deleteEmployeeHours(employeeId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('employee_hours')
    .delete()
    .eq('employee_id', employeeId)
    .eq('date', date);

  if (error) {
    throw new Error(`Error deleting hours: ${error.message}`);
  }
}

/**
 * Get total hours worked by all employees for a specific date
 */
export async function getTotalHoursForDate(date: string): Promise<number> {
  const { data, error } = await supabase
    .from('employee_hours')
    .select('hours')
    .eq('date', date);

  if (error) {
    throw new Error(`Error fetching total hours: ${error.message}`);
  }

  return (data || []).reduce((total, entry) => total + entry.hours, 0);
}

/**
 * Get employees with their hours for a specific date (useful for reporting)
 */
export async function getEmployeesWithHoursForDate(date: string): Promise<(Employee & { hours: number })[]> {
  const [employees, hoursData] = await Promise.all([
    getEmployees(),
    getHoursForDate(date)
  ]);

  return employees.map(employee => {
    const hours = hoursData.find(h => h.employee_id === employee.id);
    return {
      ...employee,
      hours: hours?.hours || 0
    };
  });
}

/**
 * Get hours breakdown by role for a specific date
 */
export async function getHoursByRoleForDate(date: string): Promise<Record<string, { employees: number; totalHours: number }>> {
  const employeesWithHours = await getEmployeesWithHoursForDate(date);

  const breakdown: Record<string, { employees: number; totalHours: number }> = {};

  employeesWithHours.forEach(emp => {
    const role = emp.role || 'Unknown';
    if (!breakdown[role]) {
      breakdown[role] = { employees: 0, totalHours: 0 };
    }
    breakdown[role].employees += 1;
    breakdown[role].totalHours += emp.hours;
  });

  return breakdown;
}
