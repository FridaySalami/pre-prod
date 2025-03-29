<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';
  import { userSession } from '$lib/sessionStore';
  import { supabase } from '$lib/supabaseClient';
  import ScheduleManager from '$lib/ScheduleManager.svelte';
  import EmployeeLeaveModal from '$lib/EmployeeLeaveModal.svelte';
  import BulkLeaveModal from '$lib/BulkLeaveModal.svelte';
  import { toastStore, showToast } from '$lib/toastStore';
  import { updateScheduledHoursForDate } from '$lib/hours-service';
  import { updateScheduledHoursBatch } from '$lib/batchUpdateService';
 // import { scheduledHoursData, updateScheduledHours, getFormattedDate, formatDateKey } from '$lib/scheduleStore';

  // Start with session as undefined (unknown)
  let session: any = undefined;
  const unsubscribe = userSession.subscribe((s) => {
    session = s;
  });
  
  // Define types for schedule data
  interface Employee {
    id: string;
    name: string;
    role: string;
  }
  
  interface ScheduleItem {
    id: string;
    employeeId: string;
    date: string;
    shift: 'morning' | 'afternoon' | 'night';
  }
  
  interface EmployeeSchedule {
    id: string;
    name: string;
    role: string;
    shifts: Record<string, string>; // date -> shift
  }
  
  interface CalendarDay {
    date: Date;
    isCurrentMonth: boolean;
    employees: {
      id: string;
      name: string;
      role: string;
      shift: string;
      onLeave?: boolean;
      leaveType?: string;
      leaveColor?: string;
    }[];
    totalWorkingHours?: number; // Add this property
  }

  // Add this type for weekly patterns
  interface WeeklyPattern {
    id: string;
    employee_id: string;
    day_of_week: number;
    is_working: boolean;
  }

  interface LeaveType {
    id: number;
    name: string;
    color: string;
  }

  interface LeaveRequest {
    id: string;
    employee_id: string;
    start_date: string;
    end_date: string;
    leave_type_id: number;
    leave_type_name: string;
    leave_type_color: string;
    status: string;
    notes: string;
  }
  
  let employees: Employee[] = [];
  let scheduleItems: ScheduleItem[] = [];
  let employeeSchedules: EmployeeSchedule[] = [];
  let leaveRequests: LeaveRequest[] = [];
  let leaveTypes: LeaveType[] = [];
  let loading = true;
  let error: string | null = null;
  
  // Calendar state
  let currentMonth = new Date().getMonth();
  let currentYear = new Date().getFullYear();
  let calendarDays: CalendarDay[] = [];
  let daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Modal state
  let showAddForm = false;
  let newScheduleItem: {
    employeeId: string;
    date: string;
    shift: 'morning' | 'afternoon' | 'night';
  } = {
    employeeId: '',
    date: '',
    shift: 'morning'
  };
  
  // Flag to control which view is active (calendar or manager)
  let showManager = false;
  
  // Function to reload schedules when the manager saves changes
  function handleScheduleUpdate() {
    // Refetch data to update the calendar
    fetchData();
  }
  
  // Generate calendar days for a month
  function generateCalendar(year: number, month: number) {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    // Get the day of the week (0 = Sunday, 1 = Monday, etc.)
    // Adjust to make Monday the first day of the week
    let firstDayWeekday = firstDayOfMonth.getDay() - 1;
    if (firstDayWeekday < 0) firstDayWeekday = 6; // Sunday becomes the last day
    
    const days: CalendarDay[] = [];
    
    // Add days from previous month to start on Monday
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevMonthYear = month === 0 ? year - 1 : year;
    const prevMonthLastDay = new Date(prevMonthYear, prevMonth + 1, 0).getDate();
    
    for (let i = 0; i < firstDayWeekday; i++) {
      const date = new Date(prevMonthYear, prevMonth, prevMonthLastDay - firstDayWeekday + i + 1);
      days.push({
        date,
        isCurrentMonth: false,
        employees: []
      });
    }
    
    // Add days of current month
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const date = new Date(year, month, i);
      days.push({
        date,
        isCurrentMonth: true,
        employees: []
      });
    }
    
    // Add days from next month to complete the grid (6 rows of 7 days = 42)
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextMonthYear = month === 11 ? year + 1 : year;
    
    const daysNeeded = 42 - days.length;
    for (let i = 1; i <= daysNeeded; i++) {
      const date = new Date(nextMonthYear, nextMonth, i);
      days.push({
        date,
        isCurrentMonth: false,
        employees: []
      });
    }
    
    return days;
  }
  
  // Format date for display
  function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  }
  
  // Format month for display
  function formatMonth(date: Date): string {
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  }
  
  // Format date for API
  function formatApiDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  // Add this helper function for timezone safety
  function getLocalISODate(date: Date): string {
    // Get YYYY-MM-DD without timezone shifting
    const offset = date.getTimezoneOffset();
    const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
    return adjustedDate.toISOString().split('T')[0];
  }
  
  // Fetch employees and schedules data
  async function fetchData() {
    try {
      loading = true;
      
      // Generate calendar days first for immediate rendering
      calendarDays = generateCalendar(currentYear, currentMonth);
      
      // Get start and end dates for the current month view
      const startDate = formatApiDate(calendarDays[0].date);
      const endDate = formatApiDate(calendarDays[calendarDays.length - 1].date);
      
      // Fetch essential data first
      const employeesPromise = supabase.from('employees').select('*');
      
      // Get employees first and start rendering
      const { data: empData, error: empError } = await employeesPromise;
      
      if (empError) throw empError;
      employees = empData || [];
      
      // Only after employees are loaded, get schedules and patterns
      const [scheduleResult, patternResult] = await Promise.all([
        supabase
          .from('schedules')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate),
        
        supabase
          .from('employee_schedules')
          .select('*')
      ]);
      
      if (scheduleResult.error) throw scheduleResult.error;
      if (patternResult.error) throw patternResult.error;
      
      // Transform data
      scheduleItems = scheduleResult.data?.map(item => ({
        id: item.id,
        employeeId: item.employee_id,
        date: item.date,
        shift: item.shift
      })) || [];
      
      const weeklyPatterns: WeeklyPattern[] = patternResult.data || [];

      // Add this section to fetch leave requests
      const { data: leaveData, error: leaveError } = await supabase
        .from('leave_requests')
        .select(`
          id, employee_id, start_date, end_date, status, notes,
          leave_types(id, name, color)
        `)
        .gte('start_date', startDate)
        .lte('end_date', endDate)
        .eq('status', 'approved');

      console.log('Leave data from API:', JSON.stringify(leaveData, null, 2));

      if (leaveError) throw leaveError;
      
      // Transform leave data for easier use - fix the object access
      leaveRequests = (leaveData || []).map(leave => {
        // Check if leave_types is an array or an object and handle appropriately
        let leaveType;
        if (Array.isArray(leave.leave_types)) {
          // Handle case where it might be an array
          leaveType = leave.leave_types[0] || {};
        } else {
          // Handle case where it's an object
          leaveType = leave.leave_types || {};
        }
        
        console.log('Leave type for request:', leave.id, leaveType);
        
        return {
          id: leave.id,
          employee_id: leave.employee_id,
          start_date: leave.start_date,
          end_date: leave.end_date,
          leave_type_id: leaveType.id || null,
          leave_type_name: leaveType.name || 'Unknown',
          leave_type_color: leaveType.color || '#9ca3af',
          status: leave.status,
          notes: leave.notes
        };
      });
            
      // Populate calendar
      populateCalendar(weeklyPatterns);
      
      showToast('Schedule updated successfully', 'success');
      
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error(error);
      showToast('Failed to load schedule: ' + error, 'error');
    } finally {
      loading = false;
    }
  }
  
  // Add this function to get the role priority for sorting
  function getRolePriority(role: string): number {
    const priorities: Record<string, number> = {
      'Manager': 1,
      'Supervisor': 2,
      'Team Lead': 3,
      'Associate': 4,
      'Trainee': 5
    };
    return priorities[role] || 99; // Unknown roles go at the end
  }

  // Add this function to check if an employee is on leave
  function getEmployeeLeave(employeeId: string, date: Date): LeaveRequest | null {
    const dateStr = formatApiDate(date);
    const leave = leaveRequests.find(leave => 
      leave.employee_id === employeeId && 
      leave.start_date <= dateStr && 
      leave.end_date >= dateStr
    );
    
    if (leave) {
      console.log("Found leave for employee:", employeeId, "Leave type:", leave.leave_type_name);
    }
    
    return leave || null;
  }

  // Populate calendar with scheduled employees
  function populateCalendar(weeklyPatterns: WeeklyPattern[] = []) {
    // Reset employees for all days
    calendarDays = calendarDays.map(day => ({
      ...day,
      employees: []
    }));
    
    // First, populate based on weekly patterns
    if (weeklyPatterns.length > 0) {
      for (const day of calendarDays) {
        // Get day of week (0 = Monday, 6 = Sunday in our data model)
        let dayOfWeek = day.date.getDay() - 1;
        if (dayOfWeek < 0) dayOfWeek = 6; // Convert Sunday from 0 to 6
        
        // Find all employees scheduled for this day of week
        const scheduledEmployees = weeklyPatterns.filter(
          pattern => pattern.day_of_week === dayOfWeek && pattern.is_working
        );
        
        // For each scheduled employee, add to the day with default morning shift
        for (const pattern of scheduledEmployees) {
          const employee = employees.find(emp => emp.id === pattern.employee_id);
          
          if (employee) {
            // Check if this employee already has a specific schedule for this day
            // (which would override the weekly pattern)
            const hasSpecificSchedule = scheduleItems.some(
              item => 
                item.employeeId === employee.id && 
                formatApiDate(day.date) === item.date
            );
            
            if (!hasSpecificSchedule) {
              day.employees.push({
                id: employee.id,
                name: employee.name,
                role: employee.role,
                shift: 'morning'
              });
            }
          }
        }
      }
    }
    
    // Next, add specific schedule assignments (these override weekly patterns)
    for (const item of scheduleItems) {
      const dayIndex = calendarDays.findIndex(
        day => formatApiDate(day.date) === item.date
      );
      
      if (dayIndex !== -1) {
        const employee = employees.find(emp => emp.id === item.employeeId);
        
        if (employee) {
          // Check if the employee is already in this day (from pattern)
          const existingIndex = calendarDays[dayIndex].employees.findIndex(
            emp => emp.id === employee.id
          );
          
          if (existingIndex !== -1) {
            // Update the existing entry (override pattern with specific shift)
            calendarDays[dayIndex].employees[existingIndex].shift = item.shift;
          } else {
            // Add new entry
            calendarDays[dayIndex].employees.push({
              id: employee.id,
              name: employee.name,
              role: employee.role, // Add role information
              shift: item.shift
            });
          }
        }
      }
    }

    // When adding employees, check for leave
    for (const day of calendarDays) {
      // Your existing day population code...
      
      // After populating employees for the day, check each employee for leave
      day.employees = day.employees.map(emp => {
        const employeeLeave = getEmployeeLeave(emp.id, day.date);
        return {
          ...emp,
          onLeave: !!employeeLeave,
          leaveType: employeeLeave?.leave_type_name || undefined,
          leaveColor: employeeLeave?.leave_type_color || undefined
        };
      });
      

    }
    
    // Sort employees in each day by role priority first, then by name
    calendarDays = calendarDays.map(day => {
      // Count only employees not on leave
      const activeEmployees = day.employees.filter(emp => !emp.onLeave);
      
      return {
        ...day,
        employees: day.employees.sort((a, b) => {
          // First compare by role priority
          const roleDiff = getRolePriority(a.role) - getRolePriority(b.role);
          
          // If same role, then sort by name
          if (roleDiff === 0) {
            return a.name.localeCompare(b.name);
          }
          
          return roleDiff;
        })
      };
    });

    // This should be the ONLY block calculating and saving hours
    for (const day of calendarDays) {
      try {
        const activeEmployees = day.employees.filter(emp => !emp.onLeave);
        const hoursForDay = activeEmployees.length * 8.5;
        
        // Extra validation to ensure the date is valid
        if (!(day.date instanceof Date) || isNaN(day.date.getTime())) {
          console.error('Invalid day date found:', day.date);
          continue;
        }
        
        // Create a clean date object (helps with potential reference issues)
        const cleanDate = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate());
        
        // Log date details for debugging
        console.log(`Processing day: 
          Original date: ${day.date.toISOString()}
          Clean date: ${cleanDate.toISOString()}
          API format: ${getLocalISODate(cleanDate)}
          Day of week: ${cleanDate.getDay()} (0=Sun)
          Active employees: ${activeEmployees.length}
          Hours: ${hoursForDay}
        `);
        
        day.totalWorkingHours = hoursForDay;
        saveScheduledHours(cleanDate, hoursForDay);
      } catch (err) {
        console.error('Error processing calendar day:', err, day);
      }
    }
  }
  
// Change month
function changeMonth(delta: number) {
  const newMonth = currentMonth + delta;
  
  // Handle year change when navigating months
  if (newMonth < 0) {
    currentMonth = 11;
    currentYear--;
  } else if (newMonth > 11) {
    currentMonth = 0;
    currentYear++;
  } else {
    currentMonth = newMonth;
  }
  
  // Fetch data for the new month
  fetchData();
}
  // Add a new schedule
  async function addScheduleItem() {
    if (!newScheduleItem.employeeId || !newScheduleItem.date || !newScheduleItem.shift) {
      showToast('Please fill out all required fields', 'error');
      return;
    }
    
    try {
      const { data, error: insertError } = await supabase
        .from('schedules')
        .insert({
          employee_id: newScheduleItem.employeeId,
          date: newScheduleItem.date,
          shift: newScheduleItem.shift
        })
        .select();
      
      if (insertError) throw insertError;
      
      // Refresh data
      await fetchData();
      const employee = employees.find(emp => emp.id === newScheduleItem.employeeId);
      // Calculate the new hours after schedule change
      const hours = await updateScheduledHoursForDate(new Date(newScheduleItem.date));
      console.log(`Updated hours for ${newScheduleItem.date} to ${hours}`);
      
      // Show success message
      showToast(
        `Scheduled ${employee?.name || 'Employee'} for ${new Date(newScheduleItem.date).toLocaleDateString()}`,
        'success'
      );
      hideAddScheduleForm();
      
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to add schedule';
      console.error(error);
      showToast('Failed to add schedule: ' + error, 'error');
    }
  }
  
  // Get shift display name
  function getShiftName(shift: string): string {
    const shiftNames = {
      morning: 'Morning',
      afternoon: 'Afternoon',
      night: 'Night'
    };
    return shiftNames[shift as keyof typeof shiftNames] || shift;
  }
  
  // Get shift class for styling
  function getShiftClass(shift: string): string {
    return `shift-${shift}`;
  }
  
  // Initialize
  onMount(() => {
    // Once we know the session, if it's null then redirect
    if (session === null) {
      goto('/login');
    } else if (session) {
      // Only fetch data if we have a valid session
      fetchData();
    }
  });

  onDestroy(() => {
    unsubscribe();
  });
  
  // Employee management modal state
  let showEmployeeModal = false;
  let newEmployee = {
    name: '',
    role: ''
  };
  let employeeError: string | null = null;
  
  // Add employee function
  async function addEmployee() {
    if (!newEmployee.name || !newEmployee.role) {
      employeeError = 'Please fill out all fields';
      return;
    }
    
    try {
      const { data, error: insertError } = await supabase
        .from('employees')
        .insert({
          name: newEmployee.name,
          role: newEmployee.role
        })
        .select();
      
      if (insertError) throw insertError;
      
      // Refresh employee data
      await fetchData();
      showToast(`Added employee: ${newEmployee.name}`, 'success');
      hideEmployeeModal();
      
    } catch (err) {
      employeeError = err instanceof Error ? err.message : 'Failed to add employee';
      console.error(employeeError);
      showToast('Failed to add employee: ' + employeeError, 'error');
    }
  }
  
  // Show employee modal
  function showAddEmployeeModal() {
    employeeError = null;
    newEmployee = {
      name: '',
      role: ''
    };
    showEmployeeModal = true;
  }
  
  // Hide employee modal
  function hideEmployeeModal() {
    showEmployeeModal = false;
  }

  // Get role class for styling
  function getRoleClass(role: string): string {
    const roleClasses: Record<string, string> = {
      'Manager': 'role-manager',
      'Supervisor': 'role-supervisor',
      'Team Lead': 'role-team-lead',
      'Associate': 'role-associate',
      'Trainee': 'role-trainee'
    };
    
    return roleClasses[role] || 'role-default';
  }

  // Get short abbreviation for role badge
  function getRoleBadge(role: string): string {
    const roleBadges: Record<string, string> = {
      'Manager': 'M',
      'Supervisor': 'S',
      'Team Lead': 'TL',
      'Associate': 'A',
      'Trainee': 'T'
    };
    
    return roleBadges[role] || '?';
  }

  // Show add schedule form
  function showAddScheduleForm(selectedDate?: Date) {
    newScheduleItem = {
      employeeId: '',
      date: selectedDate ? formatApiDate(selectedDate) : '',
      shift: 'morning'
    };
    showAddForm = true;
  }

  // Hide add schedule form
  function hideAddScheduleForm() {
    showAddForm = false;
  }

  // Add these variables to track viewport
  let visibleMonthStart = 0;
  let visibleMonthEnd = 5; // Show all weeks initially
  let calendarViewport: HTMLElement;
  
  onMount(() => {
    // Check if IntersectionObserver is available for optimization
    if ('IntersectionObserver' in window) {
      const options = {
        root: calendarViewport,
        rootMargin: '0px',
        threshold: 0.1
      };
      
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const weekIndex = parseInt(entry.target.getAttribute('data-week-index') || '0');
          
          if (entry.isIntersecting) {
            // Week is visible, ensure it's rendered
            if (weekIndex < visibleMonthStart) visibleMonthStart = weekIndex;
            if (weekIndex > visibleMonthEnd) visibleMonthEnd = weekIndex;
          }
        });
      }, options);
      
      // Observe all week elements
      document.querySelectorAll('.calendar-week').forEach(week => {
        observer.observe(week);
      });
    }
  });

  // Add these functions to handle employee click and leave management
  let showLeaveModal = false;
  let showBulkLeaveModal = false;
  let selectedEmployee: any = null;
  let selectedDate: Date | null = null;
  let selectedLeave: any = null;

  function handleEmployeeClick(employee: any, date: Date) {
    selectedEmployee = employee;
    selectedDate = date;
    selectedLeave = getEmployeeLeave(employee.id, date);
    showLeaveModal = true;
  }
  
  function handleLeaveModalClose() {
    showLeaveModal = false;
    selectedEmployee = null;
    selectedDate = null;
    selectedLeave = null;
  }
  
  function handleLeaveSaved() {
    showLeaveModal = false;
    showBulkLeaveModal = false;
    
    // Get employee name for better message
    const employeeName = selectedEmployee?.name || 'Employee';
    
    showToast(`Leave updated for ${employeeName}`, 'success');
    
    selectedEmployee = null;
    selectedDate = null;
    selectedLeave = null;
    fetchData(); // Refresh data
  }

  // Function to update all scheduled hours in the database

async function updateAllScheduledHours() {
  try {
    showToast('Starting database update...', 'info');
    
    // Get date range (2 months before and after)
    const today = new Date();
    const startDate = new Date(today);
    startDate.setMonth(today.getMonth() - 2);
    
    const endDate = new Date(today);
    endDate.setMonth(today.getMonth() + 2);
    
    // Use the batch update service
    const updatedCount = await updateScheduledHoursBatch(startDate, endDate);
    
    showToast(`Successfully updated hours for ${updatedCount} days`, 'success');
  } catch (err) {
    console.error('Error updating hours:', err);
    showToast('Failed to update hours: ' + (err instanceof Error ? err.message : String(err)), 'error');
  }
}
  
  function showBulkLeaveForm() {
    showBulkLeaveModal = true;
  }
  
  function hideBulkLeaveForm() {
    showBulkLeaveModal = false;
  }

  // Add this near your other state variables
  let showOnlyLeave = false;

  // Add these constants for shift durations (in hours)
  const SHIFT_DURATIONS = {
    morning: 8.5, // 8:00 - 16:30 with paid break
    afternoon: 8.5, // Assuming same duration for afternoon shift
    night: 8.5 // Assuming same duration for night shift
  };

  // Function to calculate total working hours for a day
  function calculateDayWorkingHours(employees: any[]): number {
    // Only count employees who are not on leave
    return employees
      .filter(emp => !emp.onLeave)
      .reduce((total, emp) => {
        return total + (SHIFT_DURATIONS[emp.shift as keyof typeof SHIFT_DURATIONS] || 8.5);
      }, 0);
  }

  // Add this function to save scheduled hours to the database
  // Updated saveScheduledHours with validation and better logging
async function saveScheduledHours(date: Date, hours: number) {
  try {
    // Validate the date is valid
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      console.error('Invalid date provided to saveScheduledHours:', date);
      return;
    }
    
    const dateStr = getLocalISODate(date);
    const formattedDate = new Date(date).toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
    
    console.log(`Saving ${hours} hours for ${formattedDate} (${dateStr})`);
    
    // Update the scheduled_hours table
    const { data: savedData, error: hoursError } = await supabase
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
      )
      .select();
    
    if (hoursError) {
      console.error(`Error saving to scheduled_hours for ${formattedDate}:`, hoursError);
      throw hoursError;
    }
    
    console.log(`Successfully saved to scheduled_hours: ${JSON.stringify(savedData)}`);
    
    // Also update daily_metrics for backward compatibility
    const { error: metricsError } = await supabase
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
    
    if (metricsError) {
      console.error(`Error saving to daily_metrics for ${formattedDate}:`, metricsError);
    } else {
      console.log(`Successfully saved to daily_metrics for ${formattedDate}`);
    }
  } catch (err) {
    console.error(`Error in saveScheduledHours for ${date.toLocaleDateString()}:`, err);
  }
}

  // Add this function to your file, after the other utility functions
  function getFormattedDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

// Update the handleViewAllEmployees function with proper type
function handleViewAllEmployees(day: CalendarDay) {
  // You could implement a modal that shows all employees for the selected day
  console.log("View all employees for", day.date.toDateString());
  
  // For now, let's just use the existing handler to add a schedule on this day
  showAddScheduleForm(day.date);
}

// Add this function for debugging
async function checkScheduledHours() {
  try {
    showToast('Checking database records...', 'info');
    
    // Get current month dates
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    
    const startDateStr = formatApiDate(firstDay);
    const endDateStr = formatApiDate(lastDay);
    
    // Get data from both tables
    const [hoursResult, metricsResult] = await Promise.all([
      supabase
        .from('scheduled_hours')
        .select('date, hours, updated_at')
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date'),
        
      supabase
        .from('daily_metrics')
        .select('date, scheduled_hours')
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date')
    ]);
    
    // Format for comparison
    const hoursData = (hoursResult.data || []).reduce((acc, item) => {
      acc[item.date] = item.hours;
      return acc;
    }, {} as Record<string, number>);
    
    const metricsData = (metricsResult.data || []).reduce((acc, item) => {
      acc[item.date] = item.scheduled_hours;
      return acc;
    }, {} as Record<string, number>);
    
    // Compare the data
    const allDates = new Set([...Object.keys(hoursData), ...Object.keys(metricsData)]);
    const discrepancies = [];
    
    for (const dateStr of allDates) {
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
      
      if (hoursData[dateStr] !== metricsData[dateStr]) {
        discrepancies.push({
          date: dateStr,
          dayOfWeek: dayName,
          scheduledHours: hoursData[dateStr],
          metricsHours: metricsData[dateStr]
        });
      }
    }
    
    console.log('Data comparison:');
    console.table(discrepancies);
    
    if (discrepancies.length > 0) {
      showToast(`Found ${discrepancies.length} discrepancies. Check console.`, 'warning');
    } else {
      showToast('All data matches between tables!', 'success');
    }
  } catch (err) {
    console.error('Error checking hours data:', err);
    showToast('Error checking data', 'error');
  }
}

</script>

{#if session === undefined || loading}
  <div class="loading">
    <svg class="spinner" viewBox="0 0 50 50">
      <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
    </svg>
    <p>Loading...</p>
  </div>
{:else if session === null}
  <!-- When session is null, onMount should have redirected already -->
  <div>Redirecting to login...</div>
{:else if error}
  <div class="error">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
    <p>Error loading schedule: {error}</p>
    <button on:click={fetchData}>Retry</button>
  </div>
{:else}
  <!-- Your existing calendar container with schedule content -->
  <div class="calendar-container">
    <div class="dashboard-header">
      <h1>Work Schedule</h1>
      
      <div class="month-navigation">
        <button on:click={() => changeMonth(-1)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Previous
        </button>
        <span class="current-month">
          {formatMonth(new Date(currentYear, currentMonth, 1))}
        </span>
        <button on:click={() => changeMonth(1)}>
          Next
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
      
      <!-- Add this toggle button -->
      <div class="view-filter">
        <button 
          class="toggle-button {showOnlyLeave ? 'active' : ''}"
          on:click={() => showOnlyLeave = !showOnlyLeave}
          aria-pressed={showOnlyLeave}
        >
          <span class="toggle-icon">
            {#if showOnlyLeave}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 11 12 14 22 4"></polyline>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
              </svg>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <path d="M8 9v2"></path>
                <path d="M8 15v2"></path>
                <path d="M12 9v2"></path>
                <path d="M12 15v2"></path>
                <path d="M16 9v2"></path>
                <path d="M16 15v2"></path>
              </svg>
            {/if}
          </span>
          <span>{showOnlyLeave ? 'Show All Employees' : 'Show Only Leave'}</span>
        </button>
      </div>
      
      <div class="header-buttons">
        <button class="add-button" on:click={() => showAddEmployeeModal()}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          Add Employee
        </button>
        
        <button class="add-button" on:click={() => showAddScheduleForm()}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Schedule
        </button>

        <button class="add-button" on:click={showBulkLeaveForm}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
            <path d="M8 14h.01"></path>
            <path d="M12 14h.01"></path>
            <path d="M16 14h.01"></path>
            <path d="M8 18h.01"></path>
            <path d="M12 18h.01"></path>
            <path d="M16 18h.01"></path>
          </svg>
          Bulk Leave
        </button>
      </div>
    </div>
    <div class="header-buttons">

      <!-- Add this new update button -->
      <button class="add-button update-button" on:click={updateAllScheduledHours}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 2v6h-6"></path>
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
          <path d="M3 12a9 9 0 0 0 6 8.5l2-4.5"></path>
          <path d="M12 16l-2 4.5"></path>
          <path d="M16 20a9 9 0 0 0 5-7.5"></path>
        </svg>
        Update Hours
      </button>

      <!-- Add this button next to your Update Hours button -->
      <button class="add-button debug-button" on:click={checkScheduledHours}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        Check Hours
      </button>
    </div>
    <div class="view-toggle">
      <button 
        class={!showManager ? 'active' : ''} 
        on:click={() => showManager = false}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        Calendar View
      </button>
      <button 
        class={showManager ? 'active' : ''} 
        on:click={() => showManager = true}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="8" y1="6" x2="21" y2="6"></line>
          <line x1="8" y1="12" x2="21" y2="12"></line>
          <line x1="8" y1="18" x2="21" y2="18"></line>
          <line x1="3" y1="6" x2="3.01" y2="6"></line>
          <line x1="3" y1="12" x2="3.01" y2="12"></line>
          <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>
        Manage Schedule Patterns
      </button>
    </div>
    
    {#if loading}
      <div class="loading">
        <svg class="spinner" viewBox="0 0 50 50">
          <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
        </svg>
        <p>Loading schedule...</p>
      </div>
    {:else if error}
      <div class="error">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>Error loading schedule: {error}</p>
        <button on:click={fetchData}>Retry</button>
      </div>
    {:else if showManager}
      <!-- Show the Schedule Manager component -->
      <ScheduleManager 
        employees={employees} 
        onScheduleUpdate={handleScheduleUpdate}
      />
    {:else if employees.length === 0}
      <div class="card empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <h3>No Employees Yet</h3>
        <p>Add employees to start creating schedules.</p>
        <button class="add-button" on:click={showAddEmployeeModal}>Add Employee</button>
      </div>
    {:else}
      <!-- Show your existing calendar -->
      <div class="card">
        <div class="calendar {showOnlyLeave ? 'leave-only-mode' : ''}">
          <div class="calendar-header">
            {#each daysOfWeek as day}
              <div class="weekday-header">{day}</div>
            {/each}
          </div>
          
          <!-- Updated calendar grid with virtual scrolling optimization -->
          <div class="calendar-grid" bind:this={calendarViewport}>
            {#each Array(6) as _, weekIndex (weekIndex)}
              <div class="calendar-week" data-week-index={weekIndex}>
                <!-- Only render when in or near viewport -->
                {#if Math.abs(weekIndex - visibleMonthStart) <= 2 || Math.abs(weekIndex - visibleMonthEnd) <= 2}
                  {#each Array(7) as _, dayIndex (weekIndex * 7 + dayIndex)}
                    {@const calendarIndex = weekIndex * 7 + dayIndex}
                    {@const day = calendarDays[calendarIndex] || { date: new Date(), isCurrentMonth: false, employees: [] }}
                    {@const isToday = day.date.toDateString() === new Date().toDateString()}
                    {@const isSunday = day.date.getDay() === 0}
                    
                    <div 
                      class="calendar-day {day.isCurrentMonth ? 'current-month' : 'other-month'} {isToday ? 'current-day' : ''} {isSunday ? 'closed-day' : ''}"
                      on:click={() => !isSunday && showAddScheduleForm(day.date)}
                      on:keydown={e => !isSunday && e.key === 'Enter' && showAddScheduleForm(day.date)}
                      role={isSunday ? 'presentation' : 'button'}
                      tabindex={isSunday ? undefined : 0}
                    >
                      <div class="day-header">
                        <span class="day-date">{day.date.getDate()}</span>
                        <span class="day-name">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day.date.getDay()]}</span>
                      </div>
                      
                      <div class="day-content">
                        {#if day.employees.length === 0}
                          <div class="no-schedule">Available</div>
                        {:else}
                          {@const filteredEmployees = showOnlyLeave ? day.employees.filter(emp => emp.onLeave) : day.employees}
                          {@const displayEmployees = filteredEmployees.slice(0, 6)}
                          {@const remainingCount = filteredEmployees.length - 6}
                          
                          <div class="employee-list">
                            {#each displayEmployees as employee (employee.id)}
                              <button 
                                class="employee-button {employee.onLeave ? 'employee-on-leave' : getRoleClass(employee.role)}"
                                on:click|stopPropagation={() => handleEmployeeClick(employee, day.date)}
                              >
                                <span class="employee-name">
                                  {employee.name}
                                  {#if employee.onLeave}
                                    <span class="leave-tag">{employee.leaveType}</span>
                                  {/if}
                                </span>
                                <span class={employee.onLeave ? "leave-indicator" : "role-indicator"}>
                                  {employee.onLeave ? '🏝️' : getRoleBadge(employee.role)}
                                </span>
                              </button>
                            {/each}
                            
                            {#if remainingCount > 0}
                              <div class="employee-more" on:click|stopPropagation={() => handleViewAllEmployees(day)}>
                                +{remainingCount} more
                              </div>
                            {/if}
                          </div>
                        {/if}
                      </div>
                      
                      {#if !showOnlyLeave && day.employees.length > 0}
  {@const visibleEmployees = day.employees}
  {@const activeCount = visibleEmployees.filter(emp => !emp.onLeave).length}
  
  <div class="employee-count" class:has-leave={day.employees.some(emp => emp.onLeave)}>
    {activeCount}
  </div>
  
  <!-- Always show hours badge when there are employees -->
  <div class="hours-badge">
    {(day.totalWorkingHours ?? 0).toFixed(1)}h
  </div>
{:else if showOnlyLeave && day.employees.some(emp => emp.onLeave)}
  <!-- Leave count badge in leave-only mode -->
  {@const leaveCount = day.employees.filter(emp => emp.onLeave).length}
  <div class="employee-count leave-count">
    {leaveCount}
  </div>
{/if}                    </div>
                  {/each}
                {:else}
                  <!-- Placeholder with correct height to maintain scroll position -->
                  <div class="calendar-week-placeholder" style="height: {130}px;"></div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
    
    {#if showAddForm}
    <div 
    class="modal-overlay" 
    on:click|self={hideAddScheduleForm} 
    on:keydown={e => e.key === 'Escape' && hideAddScheduleForm()}
    role="presentation"
    tabindex="-1"
      >
        <div class="modal">
          <div class="modal-header">
            <h2 id="schedule-modal-title">Add Schedule</h2>
            <button 
              class="close-button" 
              on:click={hideAddScheduleForm}
              aria-label="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <form on:submit|preventDefault={addScheduleItem}>
            <div class="form-group">
              <label for="employee">Employee</label>
              <select 
                id="employee" 
                bind:value={newScheduleItem.employeeId} 
                required
              >
                <option value="">Select Employee</option>
                {#each employees as emp}
                  <option value={emp.id}>{emp.name}</option>
                {/each}
              </select>
            </div>
            
            <div class="form-group">
              <label for="date">Date</label>
              <input 
                id="date" 
                type="date" 
                bind:value={newScheduleItem.date} 
                required
              />
            </div>
            
            <div class="form-group">
              <label for="shift">Shift</label>
              <select id="shift" bind:value={newScheduleItem.shift}>
                <option value="morning">Morning (8am-4pm)</option>
                <option value="afternoon">Afternoon (4pm-12am)</option>
                <option value="night">Night (12am-8am)</option>
              </select>
            </div>
            
            <div class="form-actions">
              <button type="button" class="cancel-button" on:click={hideAddScheduleForm}>Cancel</button>
              <button type="submit" class="save-button">Save Schedule</button>
            </div>
          </form>
        </div>
      </div>
    {/if}
  
    {#if showEmployeeModal}
      <div 
        class="modal-overlay" 
        on:click|self={hideEmployeeModal}
        on:keydown={e => e.key === 'Escape' && hideEmployeeModal()} 
        role="dialog"
        aria-labelledby="employee-modal-title"
        tabindex="-1"
      >
        <div class="modal">
          <div class="modal-header">
            <h2 id="employee-modal-title">Add Employee</h2>
            <button 
              class="close-button" 
              on:click={hideEmployeeModal}
              aria-label="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <form on:submit|preventDefault={addEmployee}>
            {#if employeeError}
              <div class="form-error">
                <p>{employeeError}</p>
              </div>
            {/if}
            
            <div class="form-group">
              <label for="employeeName">Employee Name</label>
              <input 
                id="employeeName" 
                type="text" 
                bind:value={newEmployee.name} 
                placeholder="John Smith"
                required
              />
            </div>
            
            <div class="form-group">
              <label for="employeeRole">Role</label>
              <select 
                id="employeeRole" 
                bind:value={newEmployee.role} 
                required
              >
                <option value="">Select Role</option>
                <option value="Manager">Manager</option>
                <option value="Supervisor">Supervisor</option>
                <option value="Team Lead">Team Lead</option>
                <option value="Associate">Associate</option>
                <option value="Trainee">Trainee</option>
              </select>
            </div>
            
            <div class="form-actions">
              <button type="button" class="cancel-button" on:click={hideEmployeeModal}>Cancel</button>
              <button type="submit" class="save-button">Add Employee</button>
            </div>
          </form>
        </div>
      </div>
    {/if}
  </div>
{/if}

{#if showLeaveModal && selectedEmployee && selectedDate}
  <div 
    class="modal-overlay" 
    on:click|self={handleLeaveModalClose}
    role="dialog"
    aria-modal="true"
  >
    <EmployeeLeaveModal
      employee={selectedEmployee}
      date={selectedDate}
      existingLeave={selectedLeave}
      on:close={handleLeaveModalClose}
      on:saved={handleLeaveSaved}
    />
  </div>
{/if}

{#if showBulkLeaveModal}
  <div 
    class="modal-overlay" 
    on:click|self={hideBulkLeaveForm}
    role="dialog"
    aria-modal="true"
  >
    <BulkLeaveModal
      employees={employees}
      on:close={hideBulkLeaveForm}
      on:saved={handleLeaveSaved}
    />
  </div>
{/if}

<!-- Toast notification -->
{#if $toastStore.show}
  <div class="toast-container">
    <div class="toast toast-{$toastStore.type}">
      <div class="toast-icon">
        {#if $toastStore.type === 'success'}
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        {:else if $toastStore.type === 'error'}
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        {/if}
      </div>
      <div class="toast-message">{$toastStore.message}</div>
    </div>
  </div>
{/if}

<style>
  .calendar-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
  }
  
  .dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
  background: white; /* Apple uses white backgrounds */
  border-radius: 12px;
  border: 1px solid var(--apple-light-gray);
}

  h1 {
    margin: 0;
    font-size: 1.8rem;
    font-weight: 500;
    color: #1f2937;
  }
  
  .month-navigation {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  
  .month-navigation button {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    color: #374151;
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .month-navigation button:hover {
    background: #f3f4f6;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
  
  .month-navigation button:active {
    transform: translateY(0);
    box-shadow: none;
  }
  
  .current-month {
    font-size: 1.1rem;
    font-weight: 500;
    min-width: 180px;
    text-align: center;
    letter-spacing: -0.01em;
  }
  
  .add-button {
  background: var(--apple-blue);
  color: white;
  border: none;
  border-radius: 18px;
  padding: 8px 16px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.add-button:hover {
  background: var(--apple-blue-hover);
}
  
  .loading, .error {
    padding: 3rem;
    text-align: center;
    background: #f9fafb;
    border-radius: 10px;
    margin: 2rem 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }
  
  .error {
    color: #b91c1c;
    border: 1px solid #fee2e2;
    background: #fef2f2;
  }
  
  .spinner {
    animation: rotate 2s linear infinite;
    width: 40px;
    height: 40px;
  }
  
  .spinner .path {
    stroke: #004225;
    stroke-linecap: round;
    animation: dash 1.5s ease-in-out infinite;
  }
  
  @keyframes rotate {
    100% {
      transform: rotate(360deg);
    }
  }
  
  @keyframes dash {
    0% {
      stroke-dasharray: 1, 150;
      stroke-dashoffset: 0;
    }
    50% {
      stroke-dasharray: 90, 150;
      stroke-dashoffset: -35;
    }
    100% {
      stroke-dasharray: 90, 150;
      stroke-dashoffset: -124;
    }
  }
  
  /* Card Styles */
  .card {
    background: white;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.08);
    overflow: hidden;
    margin-bottom: 24px;
  }
  
  /* Calendar Styles */
  .calendar {
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  background: white;
  overflow: hidden;
}

  .calendar-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: white;
  border-bottom: 1px solid var(--apple-light-gray);
  width: 100%;
  position: sticky;
  top: 0;
  z-index: 10;
}

.weekday-header {
  padding: 14px 8px;
  text-align: center;
  font-weight: 600;
  color: var(--apple-dark-gray);
  font-size: 0.85rem;
  letter-spacing: 0.03em;
  /* Add these constraints */
  overflow: hidden;
  white-space: nowrap;
}
.update-button {
  background: var(--apple-warning);
}

.update-button:hover {
  background: #ffb340;
}
  .calendar-grid {
    display: flex;
    flex-direction: column;
    will-change: transform; /* Hint to browser about animations */
    transform: translateZ(0); /* Force hardware acceleration */
    backface-visibility: hidden; /* Reduce composite layers */
    width: 100%; /* Ensure full width */
  }
  
  .calendar-header,
  .calendar-week,
  .calendar-grid {
    grid-template-columns: repeat(7, 1fr);
    min-width: 800px; /* Minimum width for the entire grid */
  }
  
  .calendar-week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border-bottom: 1px solid #e5e7eb;
  width: 100%;
  /* Add these properties */
  grid-gap: 0; /* No gaps between columns */
  overflow: visible; /* Allow content to overflow within its own cell */
  position: relative; /* Establish positioning context */
}

  .calendar-week:last-child {
    border-bottom: none;
  }
  
  .calendar-day {
  height: auto; /* Remove fixed height constraint */
  min-height: 130px; 
  max-height: 330px; /* Limit maximum height */
  border-right: 1px solid #e5e7eb;
  padding: 12px;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: auto; /* Change from hidden to auto for controlled scrolling */
  box-sizing: border-box;
  margin: 0;
  gap: 6px;
  min-width: 0; /* Allow cell to shrink if needed */
  flex: 1 0 0%; /* Equal width flex items */
  contain: content; /* Use CSS containment to optimize rendering */
  isolation: isolate; /* Create a new stacking context */
}

  .calendar-day:last-child {
    border-right: none;
  }
  
  .calendar-day:hover {
    background-color: #f9fafb;
  }
  
  .calendar-day:focus {
    outline: none;
    box-shadow: inset 0 0 0 2px #35b07b;
  }
  
  .current-month {
    background: white;
  }
  
  .other-month {
    background: #f9fafb;
    color: #9ca3af;
  }
  
  .current-day {
  background-color: rgba(0, 113, 227, 0.08) !important; /* Apple blue with low opacity */
  box-shadow: inset 0 0 0 2px rgba(0, 113, 227, 0.3);
}

.current-day .day-date {
  color: var(--apple-blue);
  font-weight: 600;
}
  
  .day-header {
    display: flex;
    flex-direction: column; /* Change to column layout */
    align-items: center; /* Center horizontally */
    justify-content: center;
    text-align: center;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .day-date {
    font-size: 1.1rem;
    font-weight: 500;
    margin-bottom: 2px; /* Add space between date and day name */
  }
  
  .day-name {
    font-size: 0.8rem;
    color: #6b7280;
  }
  
  .day-content {
  flex: 1;
  overflow: visible; /* Show all content */
  margin: 0;
  padding: 0;
}

  .day-content::-webkit-scrollbar {
    width: 6px;
  }
  
  .day-content::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .day-content::-webkit-scrollbar-thumb {
    background-color: #e5e7eb;
    border-radius: 3px;
  }
  
  .no-schedule {
  display: inline-block;
  font-size: 0.8rem;
  color: #86868b; /* Apple gray text */
  background-color: #f5f5f7;
  padding: 4px 10px;
  border-radius: 12px;
  margin-top: 8px;
  text-align: center;
}

  
  .employee-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .employee-button {
  font-size: 0.85rem;
  padding: 0px 12px;
  margin-bottom: 1px;
  border-radius: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  text-align: left;
  background: white;
  border: none;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: normal;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  position: relative;
}

.employee-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.06);
}

.employee-button:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

  .shift-indicator {
    font-weight: 600;
    font-size: 0.7rem;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.5);
  }
  
  .shift-morning {
    background-color: #e6f7f0;
    color: #065f46;
    border-left: 3px solid #35b07b;
  }
  
  .shift-afternoon {
    background-color: #fef3c7;
    color: #92400e;
    border-left: 3px solid #f59e0b;
  }
  
  .shift-night {
    background-color: #e0e7ff;
    color: #3730a3;
    border-left: 3px solid #6366f1;
  }
  
  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    animation: fadeIn 0.25s ease;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .modal {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 480px;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
    max-width: 480px;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
  }
  
  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    background: white; /* Apple uses white headers */
    border-bottom: 1px solid var(--apple-light-gray);
  }
  
  .modal h2 {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--apple-black);
  }
  
  .close-button {
    background: transparent;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  
  .close-button:hover {
    background: #f3f4f6;
    color: #1f2937;
  }
  
  form {
    padding: 24px;
  }
  
  .form-group {
    margin-bottom: 20px;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: #374151;
    font-size: 0.95rem;
  }
  
  .form-group input,
.form-group select {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--apple-light-gray);
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s ease;
  font-family: inherit;
  background-color: white;
}
  
.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--apple-blue);
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.2);
}

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
  }
  
  .cancel-button {
    background: #f9fafb;
    color: #374151;
    border: 1px solid #d1d5db;
    padding: 8px 16px;
    font-size: 0.95rem;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .cancel-button:hover {
    background: #f3f4f6;
  }
  
  .save-button {
  background: var(--apple-blue);
  color: white;
  border: none;
  padding: 10px 18px;
  font-size: 0.95rem;
  font-weight: 500;
  border-radius: 18px;
  cursor: pointer;
  transition: all 0.2s ease;
}

  .save-button:hover {
    background: #006339;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  }
  
  .save-button:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
  
  /* Responsive Styles */
  @media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    padding: 16px;
  }
  
  .calendar-day {
    min-height: 100px;
    padding: 8px;
  }
  
  .employee-button {
    padding: 5px 8px;
    font-size: 0.8rem;
  }
   
  .month-navigation {
    width: 100%;
    justify-content: space-between;
  }
  
  .month-navigation button {
    padding: 8px 12px;
  }
  
    .add-button {
      width: 100%;
      justify-content: center;
    }
    
    .card {
      border-radius: 8px;
      margin: 0;
    }
    
    .calendar {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
  }

  .calendar-grid {
    min-width: 700px; /* Ensure grid is wide enough to scroll */
  }
  
    .calendar-day {
      min-height: 100px;
      padding: 6px;
    }
    
    .employee {
      font-size: 0.75rem;
      padding: 4px 6px;
    }
    
    .day-date {
      font-size: 1rem;
    }
    
    .day-name {
      font-size: 0.7rem;
    }
  }
  
  @media (max-width: 480px) {
    .modal {
      width: 92%;
      max-width: none;
    }
    
    .form-actions {
      flex-direction: column;
    }
    
    .cancel-button, .save-button {
      width: 100%;
      padding: 12px;
    }
  }
  
  .view-toggle {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }
  
  .view-toggle button {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    color: #374151;
    border-radius: 8px;
    padding: 8px 16px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .view-toggle button:hover {
    background: #f3f4f6;
  }
  
  .view-toggle button.active {
    background: #004225;
    color: white;
    border-color: #004225;
  }
  
  @media (max-width: 768px) {
    .view-toggle {
      width: 100%;
    }
    
    .view-toggle button {
      flex: 1;
      justify-content: center;
    }
  }

  /* Add these new styles to your existing style section */
  
  .header-buttons {
    display: flex;
    gap: 12px;
  }
  
  .form-error {
    background-color: #fef2f2;
    color: #b91c1c;
    padding: 12px 16px;
    border-radius: 6px;
    margin-bottom: 16px;
  }
  
  .form-error p {
    margin: 0;
    font-size: 0.9rem;
  }
  
  @media (max-width: 768px) {
    .header-buttons {
      width: 100%;
      flex-direction: column;
      gap: 8px;
    }
  }

  /* Role-based styling */
  .role-manager {
  background: white;
  color: #111;
  border-left: 3px solid #0071e3; /* Apple blue */
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
}

.role-supervisor {
  background: white;
  color: #111;
  border-left: 3px solid #ff9f0a; /* Apple orange */
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
}

.role-team-lead {
  background: white;
  color: #111;
  border-left: 3px solid #ac39ff; /* Apple purple */
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
}

.role-associate {
  background: white;
  color: #111;
  border-left: 3px solid #39ca74; /* Adjusted green */
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
}

.role-trainee {
  background: white;
  color: #111;
  border-left: 3px solid #ff3b30; /* Apple red */
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
}

.role-default {
    background-color: #f3f4f6;
    color: #4b5563;
    border-left: 3px solid #9ca3af;
  }

  .sunday-hours {
    background-color: #8E8E93; /* Muted gray for closed days */
  }

  /* Update the role indicator style */
  .role-indicator {
  font-weight: 500; /* Less bold */
  font-size: 0.7rem;
  min-width: 22px;
  height: 22px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f7;
  padding: 0 6px;
  color: #86868b;
}

  /* Add this new style for employee count badge */
  .employee-count {
    position: absolute;
    top: 10px;  /* Move to top right instead of bottom */
    right: 10px;
    background: #004225;
    color: white;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 500; /* Less bold */
    min-width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
    transition: transform 0.2s ease;
    padding: 0 6px;
    z-index: 5; /* Ensure it stays above other content */
  }

  /* Add this to your existing styles */
  
  .employee-count {
    position: absolute;
    bottom: 6px;
    right: 6px;
    background: #004225;
    color: white;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 600;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
  
  /* Update calendar-day to ensure proper positioning */
  .calendar-day {
    min-height: 130px; /* Slightly taller for better content display */
    border-right: 1px solid #e5e7eb;
    cursor: pointer;
    padding: 12px; /* Increase padding for more breathing room */
    transition: all 0.25s ease;
    display: flex;
    flex-direction: column; /* Ensure flex layout */
    position: relative; /* Make sure this is here */
    overflow: hidden; /* Contain content within each day */
    box-sizing: border-box; /* Include padding in width calculation */
    margin: 0; /* Remove any margins */
    gap: 6px; /* Add gap between day header and content */
  }

  .closed-day {
    background-color: #f1f5f9 !important;
    cursor: default !important;
    user-select: none;
    opacity: 0.9;
  }

  .closed-notice {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    font-size: 0.9rem;
    gap: 8px;
    font-weight: 500;
  }

  .closed-day .day-header {
    opacity: 0.7;
  }

  /* Simplified employee rendering for better performance */
  .employee-summary {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .employee-preview {
    font-size: 0.85rem;
    padding: 4px 8px;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .employee-more {
    text-align: center;
    font-size: 0.8rem;
    color: #86868b;
    background: rgba(245, 245, 247, 0.7);
    padding: 6px 12px;
    border-radius: 6px;
    margin-top: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .employee-more:hover {
    background: rgba(245, 245, 247, 1);
    color: #0071e3;
  }

  /* CSS icons instead of SVGs */
  .icon-closed {
    display: inline-block;
    width: 18px;
    height: 18px;
    position: relative;
    border: 2px solid #94a3b8;
    border-radius: 3px;
  }
  
  .icon-closed::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 6px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #94a3b8;
  }

  .modal-content {
    padding: 20px;
  }
  
  .delete-button {
    background: #fee2e2;
    color: #b91c1c;
    border: 1px solid #fecaca;
    padding: 8px 16px;
    font-size: 0.95rem;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-right: auto;
  }
  
  .delete-button:hover {
    background: #fecaca;
  }

  /* Employee on leave styling */
  .employee-on-leave {
  background: white;
  opacity: 0.9;
  border-left: 3px solid #8E8E93; /* Muted color for leave */
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
}
  
  .leave-tag {
    font-size: 0.7rem;
    padding: 2px 6px;
    background: #f5f5f7;
    border-radius: 4px;
    margin-left: 6px;
    color: #86868b;
    font-weight: 500;
  }
  
  .leave-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 22px;
    min-width: 22px;
    font-size: 0.9rem;
    background: #f5f5f7;
    border-radius: 11px;
    color: #86868b;
  }
  
  .employee {
    cursor: pointer;
  }
  
  .employee-name {
  display: flex;
  align-items: center;
  font-weight: 500;
  color: #1d1d1f;
  padding-right: 8px;
  max-width: calc(100% - 28px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

  .employee-count.has-leave {
    background: linear-gradient(to right, #004225 50%, #9ca3af 50%);
  }

  .view-filter {
    display: flex;
    justify-content: center;
  }

  .toggle-button {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    color: #374151;
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .toggle-button:hover {
    background: #f3f4f6;
  }

  .toggle-button.active {
    background: #004225;
    color: white;
    border-color: #004225;
  }

  .toggle-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .leave-count {
    background: var(--leave-color, #ef4444);
  }

  @media (max-width: 768px) {
    .view-filter {
      width: 100%;
    }
    
    .toggle-button {
      width: 100%;
      justify-content: center;
    }
  }

  .calendar.leave-only-mode {
    background: linear-gradient(to right, #fff8f8, #fff);
  }

  /* Toast notification styles */


.toast {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 10px;
  background-color: white;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  animation: toastSlideIn 0.3s ease forwards;
  pointer-events: auto;
  max-width: 320px;
}

  .toast-success {
    border-left: 4px solid #10b981;
    color: #064e3b;
  }

  .toast-error {
    border-left: 4px solid #ef4444;
    color: #7f1d1d;
  }

  .toast-info {
    border-left: 4px solid #3b82f6;
    color: #1e40af;
  }

  .toast-icon {
    margin-right: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: inherit;
  }

  .toast-message {
    font-size: 0.9rem;
    font-weight: 500;
    color: #374151;
  }

  @keyframes toastSlideIn {
    0% {
      transform: translateX(100%);
      opacity: 0;
    }
    100% {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @media (max-width: 480px) {
    .toast-container {
      bottom: 0;
      right: 0;
      left: 0;
      padding: 10px;
    }
    
    .toast {
      width: 100%;
      border-radius: 8px;
    }
  }

  .hours-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  background: #0071e3; /* Apple blue */
  color: white;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 500; /* Less bold */
  padding: 2px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

  :root {
    --apple-blue: #0071e3;
    --apple-blue-hover: #0077ed;
    --apple-gray: #f5f5f7;
    --apple-dark-gray: #86868b;
    --apple-light-gray: #d2d2d7;
    --apple-black: #1d1d1f;
    --apple-success: #39ca74;
    --apple-warning: #ff9f0a;
    --apple-error: #ff3b30;
  }

  /* Apply Apple-like typography */

  h1 {
    font-size: 1.8rem;
    font-weight: 600; /* Apple uses semi-bold for headings */
    letter-spacing: -0.02em; /* Slight negative tracking */
  }

  .current-month {
    font-size: 1.2rem;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  /* Add this style */
  .debug-button {
    background: var(--apple-dark-gray);
  }

  .debug-button:hover {
    background: #6b6b6b;
  }
</style>
