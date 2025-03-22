<script lang="ts">
  import { onMount } from 'svelte';
  import ScheduleManager from '$lib/ScheduleManager.svelte';
  import { supabase } from '$lib/supabaseClient';
  
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
      role: string; // Add role property
      shift: string;
    }[];
  }

  // Add this type for weekly patterns
  interface WeeklyPattern {
    id: string;
    employee_id: string;
    day_of_week: number;
    is_working: boolean;
  }
  
  let employees: Employee[] = [];
  let scheduleItems: ScheduleItem[] = [];
  let employeeSchedules: EmployeeSchedule[] = [];
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
  
  // Fetch employees and schedules data
  async function fetchData() {
    try {
      loading = true;
      
      // Get employees from Supabase
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*');
      
      if (empError) throw empError;
      employees = empData || [];
      
      // Generate calendar days
      calendarDays = generateCalendar(currentYear, currentMonth);
      
      // Get start and end dates for the current month view
      const startDate = formatApiDate(calendarDays[0].date);
      const endDate = formatApiDate(calendarDays[calendarDays.length - 1].date);
      
      // Get specific schedule assignments for the date range
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .select('*, employees(id, name, role)')
        .gte('date', startDate)
        .lte('date', endDate);
      
      if (scheduleError) throw scheduleError;
      
      // Transform specific schedule data
      scheduleItems = scheduleData?.map(item => ({
        id: item.id,
        employeeId: item.employee_id,
        date: item.date,
        shift: item.shift
      })) || [];
      
      // Get the weekly patterns for all employees
      const { data: patternData, error: patternError } = await supabase
        .from('employee_schedules')
        .select('*');
      
      if (patternError) throw patternError;
      
      // Process weekly patterns and populate the calendar
      const weeklyPatterns: WeeklyPattern[] = patternData || [];
      populateCalendar(weeklyPatterns);
      
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error(error);
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
    
    // Sort employees in each day by role priority first, then by name
    calendarDays = calendarDays.map(day => ({
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
    }));
  }
  
  // Change month
  function changeMonth(delta: number) {
    const newMonth = currentMonth + delta;
    
    // Handle year change
    if (newMonth < 0) {
      currentMonth = 11;
      currentYear -= 1;
    } else if (newMonth > 11) {
      currentMonth = 0;
      currentYear += 1;
    } else {
      currentMonth = newMonth;
    }
    
    // Fetch data for the new month
    fetchData();
  }
  
  // Add a new schedule
  async function addScheduleItem() {
    if (!newScheduleItem.employeeId || !newScheduleItem.date || !newScheduleItem.shift) {
      alert('Please fill out all required fields');
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
      hideAddScheduleForm();
      
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to add schedule';
      console.error(error);
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
    try {
      fetchData();
    } catch (error) {
      console.error('Error in onMount:', error);
    }
  });

  // Add these to your existing script section
  
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
      hideEmployeeModal();
      
    } catch (err) {
      employeeError = err instanceof Error ? err.message : 'Failed to add employee';
      console.error(employeeError);
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

  // Add this to your script section
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
</script>

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
    </div>
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
      <div class="calendar">
        <div class="calendar-header">
          {#each daysOfWeek as day}
            <div class="weekday-header">{day}</div>
          {/each}
        </div>
        
        <div class="calendar-grid">
          {#each Array(6) as _, weekIndex}
            <div class="calendar-week">
              {#each Array(7) as _, dayIndex}
                {@const calendarIndex = weekIndex * 7 + dayIndex}
                {@const day = calendarDays[calendarIndex] || { date: new Date(), isCurrentMonth: false, employees: [] }}
                {@const isToday = day.date.toDateString() === new Date().toDateString()}
                
                <div 
                  class="calendar-day {day.isCurrentMonth ? 'current-month' : 'other-month'} {isToday ? 'current-day' : ''}" 
                  on:click={() => showAddScheduleForm(day.date)}
                  on:keydown={e => e.key === 'Enter' && showAddScheduleForm(day.date)}
                  role="button"
                  tabindex="0"
                >
                  <div class="day-header">
                    <span class="day-date">
                      {day.date.getDate()}
                    </span>
                    <span class="day-name">
                      {day.date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                  </div>
                  
                  <div class="day-content">
                    {#if day.employees.length === 0}
                      <div class="no-schedule">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <path d="M12 6v6l4 2"></path>
                        </svg>
                        <span>Available</span>
                      </div>
                    {:else}
                      <ul class="employee-list">
                        {#each day.employees as employee}
                          <li class="employee {getRoleClass(employee.role)}">
                            {employee.name}
                            <!-- Role indicator instead of shift -->
                            <span class="role-indicator" title="{employee.role}">{getRoleBadge(employee.role)}</span>
                          </li>
                        {/each}
                      </ul>
                    {/if}
                  </div>
                  
                  <!-- Add this employee count badge -->
                  {#if day.employees.length > 0}
                    <div class="employee-count" title="{day.employees.length} employee{day.employees.length !== 1 ? 's' : ''} scheduled">
                      {day.employees.length}
                    </div>
                  {/if}
                </div>
              {/each}
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
      role="dialog"
      aria-labelledby="schedule-modal-title"
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

<style>
  .calendar-container {
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    padding: 1rem;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    color: #1f2937;
    letter-spacing: -0.01em;
  }
  
  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
    background: linear-gradient(to right, #f9fafb, #f3f4f6);
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
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
    display: flex;
    align-items: center;
    gap: 8px;
    background: #004225;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
  
  .add-button:hover {
    background: #006339;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  }
  
  .add-button:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
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
    width: 100%;
    background: white;
  }
  
  .calendar-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: linear-gradient(to bottom, #f9fafb, #f3f4f6);
    border-bottom: 1px solid #e5e7eb;
  }
  
  .weekday-header {
    padding: 14px 8px;
    text-align: center;
    font-weight: 500;
    color: #4b5563;
    font-size: 0.9rem;
  }
  
  .calendar-grid {
    display: flex;
    flex-direction: column;
  }
  
  .calendar-week {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    border-bottom: 1px solid #e5e7eb;
  }
  
  .calendar-week:last-child {
    border-bottom: none;
  }
  
  .calendar-day {
    min-height: 130px; /* Slightly taller for better content display */
    border-right: 1px solid #e5e7eb;
    cursor: pointer;
    padding: 12px; /* Increase padding for more breathing room */
    transition: all 0.25s ease;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    gap: 6px; /* Add gap between day header and content */
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
    background-color: rgba(53, 176, 123, 0.15);
    box-shadow: inset 0 0 0 2px rgba(53, 176, 123, 0.3);
  }
  
  .current-day .day-date {
    color: #004225;
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
    flex-grow: 1;
    overflow-y: auto;
    /* Customize scrollbar */
    scrollbar-width: thin;
    scrollbar-color: #e5e7eb transparent;
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
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
    font-size: 0.85rem;
    gap: 6px;
    opacity: 0.8;
  }
  
  .employee-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .employee {
    font-size: 0.85rem;
    padding: 6px 10px;
    margin-bottom: 6px;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
  
  .employee:hover {
    transform: translateX(2px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
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
    background: linear-gradient(to right, #f9fafb, #f3f4f6);
    border-bottom: 1px solid #e5e7eb;
  }
  
  .modal h2 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 500;
    color: #1f2937;
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
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 1rem;
    transition: all 0.2s ease;
    font-family: inherit;
    background-color: #f9fafb;
  }
  
  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: #35b07b;
    box-shadow: 0 0 0 3px rgba(53, 176, 123, 0.2);
    background-color: white;
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
    background: #004225;
    color: white;
    border: none;
    padding: 8px 16px;
    font-size: 0.95rem;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
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
    
    .month-navigation {
      width: 100%;
      justify-content: space-between;
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
    background-color: #e0f2fe;
    color: #0369a1;
    border-left: 3px solid #0ea5e9;
  }

  .role-supervisor {
    background-color: #fef9c3;
    color: #854d0e;
    border-left: 3px solid #eab308;
  }

  .role-team-lead {
    background-color: #f3e8ff;
    color: #6b21a8;
    border-left: 3px solid #a855f7;
  }

  .role-associate {
    background-color: #e6f7f0;
    color: #065f46;
    border-left: 3px solid #35b07b;
  }

  .role-trainee {
    background-color: #fce7f3;
    color: #9d174d;
    border-left: 3px solid #ec4899;
  }

  .role-default {
    background-color: #f3f4f6;
    color: #4b5563;
    border-left: 3px solid #9ca3af;
  }

  /* Update the role indicator style */
  .role-indicator {
    font-weight: 600;
    font-size: 0.7rem;
    min-width: 24px; /* Fixed width for consistency */
    height: 18px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(4px);
    padding: 0 4px;
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
    font-weight: 600;
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
    flex-direction: column;
    position: relative; /* Make sure this is here */
    overflow: hidden;
    gap: 6px; /* Add gap between day header and content */
  }

  /* Make the employee count badge more elegant */
  .employee-count {
    position: absolute;
    bottom: 6px;
    right: 6px;
    background: #004225;
    color: white;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 600;
    min-width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
    transition: transform 0.2s ease;
    padding: 0 6px;
  }

  .calendar-day:hover .employee-count {
    transform: scale(1.05);
  }
</style>
