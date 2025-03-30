<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { userSession } from '$lib/sessionStore';
  import { format, addDays, isWeekend } from 'date-fns';
  import { supabase } from '$lib/supabaseClient';
  
  // Add authentication check
  // Start with session as undefined (unknown)
  let session: any = undefined;
  const unsubscribe = userSession.subscribe((s) => {
    session = s;
  });
  
  // Define proper interfaces for our data
  interface Employee {
    id: string;
    name: string;
    shift: string;
    role?: string;  // Add this property
  }
  
  interface LeaveEmployee {
    id: string;
    name: string;
    leaveType: string;
  }
  
  interface LeaveDay {
    date: Date;
    staff: LeaveEmployee[];
  }
  
  interface Metrics {
    shipmentsPacked: number;
    shipmentsPerHour: number;
    labourUtilisation: number;
  }

  interface LoadingState {
    staff: boolean;
    leave: boolean;
    weather: boolean;
    metrics: boolean;
  }

  interface WeatherData {
    location: {
      name: string;
      country: string;
    };
    current: {
      last_updated: string;
      temp_c: number;
      temp_f: number;
      feelslike_c: number;
      feelslike_f: number;
      condition: {
        text: string;
        icon: string;
        code: number;
      };
      wind_mph: number;
      wind_kph: number;
      wind_dir: string;
      humidity: number;
      pressure_mb: number;
      uv: number;
      vis_miles: number;
    };
    forecast: {
      forecastday: Array<{
        date: string;
        day: {
          maxtemp_c: number;
          mintemp_c: number;
          maxtemp_f: number;
          condition: {
            text: string;
            icon: string;
            code: number;
          };
          daily_chance_of_rain: number;
        };
        astro: {
          sunrise: string;
          sunset: string;
        };
        hour: Array<{
          time: string;
          temp_c: number;
          condition: {
            text: string;
            icon: string;
          };
        }>;
      }>;
    };
    alerts?: {
      alert: Array<{
        headline: string;
      }>;
    };
  }
  
  // State management with proper typing
  const today: Date = new Date();
  const tomorrow: Date = addDays(today, 1);
  let todayStaff: Employee[] = [];
  let tomorrowStaff: Employee[] = [];
  let upcomingLeave: LeaveDay[] = [];
  let weatherData: WeatherData | null = null;
  let weatherError: string | null = null;
  let metrics: Metrics = {
    shipmentsPacked: 0,
    shipmentsPerHour: 0,
    labourUtilisation: 0
  };
  let isLoading: LoadingState = {
    staff: true,
    leave: true,
    weather: true,
    metrics: true
  };

  // Add new variable for leave ranges
  let leaveRanges: Array<{
    startDate: Date,
    endDate: Date,
    isRange: boolean,
    staff: LeaveEmployee[]
  }> = [];

  onMount(async () => {
    // Once we know the session, if it's null then redirect
    if (session === null) {
      goto('/login');
      return;
    }
    
    // Only fetch data if user is authenticated
    if (session) {
      // Fetch all data in parallel
      await Promise.all([
        fetchStaffScheduled(),
        fetchUpcomingLeave(),
        fetchWeather(),
        fetchYesterdayMetrics()
      ]);
    }
  });
  
  onDestroy(() => {
    unsubscribe();
  });

  // Updated fetchStaffScheduled function with correct day_of_week query
  async function fetchStaffScheduled(): Promise<void> {
    try {
      const todayFormatted = format(today, 'yyyy-MM-dd');
      const tomorrowFormatted = format(tomorrow, 'yyyy-MM-dd');
      
      // Convert day of week to match your DB schema (1=Monday, 2=Tuesday, etc.)
      // JavaScript's getDay() returns 0=Sunday, 1=Monday, etc., so we need to adjust
      const todayDayOfWeek = today.getDay() === 0 ? 7 : today.getDay(); // Convert Sunday from 0 to 7 if needed
      const tomorrowDayOfWeek = tomorrow.getDay() === 0 ? 7 : tomorrow.getDay();
      
      console.log("Looking for schedules on:", todayFormatted, tomorrowFormatted);
      console.log("Days of week (numeric):", todayDayOfWeek, tomorrowDayOfWeek);
      
      // First check for specific date assignments in the schedules table
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select('*')
        .or(`date.eq.${todayFormatted},date.eq.${tomorrowFormatted}`);
      
      if (schedulesError) {
        console.error('Error fetching specific schedules:', schedulesError);
        throw schedulesError;
      }
      
      // Then check for recurring patterns in employee_schedules table using day_of_week
      const { data: patternsData, error: patternsError } = await supabase
        .from('employee_schedules')
        .select('*')
        .or(`day_of_week.eq.${todayDayOfWeek},day_of_week.eq.${tomorrowDayOfWeek}`);
      
      if (patternsError) {
        console.error('Error fetching schedule patterns:', patternsError);
        throw patternsError;
      }
      
      console.log("Specific schedules data:", schedulesData);
      console.log("Pattern data:", patternsData);
      
      // Separate specific assignments by date
      const specificTodayData = schedulesData?.filter(item => item.date === todayFormatted) || [];
      const specificTomorrowData = schedulesData?.filter(item => item.date === tomorrowFormatted) || [];
      
      // Separate patterns by day of week (numeric)
      const patternTodayData = patternsData?.filter(item => item.day_of_week === todayDayOfWeek) || [];
      const patternTomorrowData = patternsData?.filter(item => item.day_of_week === tomorrowDayOfWeek) || [];
      
      // Get all unique employee IDs we need to fetch
      const employeeIds = new Set([
        ...specificTodayData.map(item => item.employee_id),
        ...specificTomorrowData.map(item => item.employee_id),
        ...patternTodayData.map(item => item.employee_id),
        ...patternTomorrowData.map(item => item.employee_id)
      ]);
      
      // If we have no data at all, use demo data
      if (employeeIds.size === 0) {
        console.log("No employee data found, using demo data");
        
        // Demo data for development
        todayStaff = [
          { id: 'demo1', name: 'John Smith', shift: 'morning' },
          { id: 'demo2', name: 'Sarah Jones', shift: 'afternoon' }
        ];
        
        tomorrowStaff = [
          { id: 'demo1', name: 'John Smith', shift: 'morning' },
          { id: 'demo3', name: 'Michael Brown', shift: 'night' },
          { id: 'demo4', name: 'Alice Green', shift: 'afternoon' }
        ];
      } else {
        // Fetch employee details
        const { data: employeeData, error: employeeError } = await supabase
          .from('employees')
          .select('*')
          .in('id', Array.from(employeeIds));
          
        if (employeeError) {
          console.error('Error fetching employees:', employeeError);
          throw employeeError;
        }
        
        console.log("Employee data:", employeeData);
        
        // Rest of your existing code remains the same
        // ... (leave data fetch, employee mapping, etc.)
        
        // Process today's schedule
        // Priority: specific assignments override patterns
        const todayScheduledEmployees = new Map();
        
        // Add pattern-based staff first (can be overridden)
        patternTodayData.forEach(pattern => {
          todayScheduledEmployees.set(pattern.employee_id, {
            employee_id: pattern.employee_id,
            shift: pattern.shift || 'morning' // Default to morning if not specified
          });
        });
        
        // Override with specific assignments
        specificTodayData.forEach(schedule => {
          todayScheduledEmployees.set(schedule.employee_id, {
            employee_id: schedule.employee_id,
            shift: schedule.shift
          });
        });
        
        // Process tomorrow's schedule with same logic
        const tomorrowScheduledEmployees = new Map();
        
        patternTomorrowData.forEach(pattern => {
          tomorrowScheduledEmployees.set(pattern.employee_id, {
            employee_id: pattern.employee_id,
            shift: pattern.shift || 'morning'
          });
        });
        
        specificTomorrowData.forEach(schedule => {
          tomorrowScheduledEmployees.set(schedule.employee_id, {
            employee_id: schedule.employee_id,
            shift: schedule.shift
          });
        });
        
        console.log("Combined today schedules:", Array.from(todayScheduledEmployees.values()));
        console.log("Combined tomorrow schedules:", Array.from(tomorrowScheduledEmployees.values()));
        
        // Fetch leave data to filter out employees on leave
        const { data: leaveData, error: leaveError } = await supabase
          .from('leave_requests')
          .select('*')
          .or(`start_date.lte.${todayFormatted},end_date.gte.${todayFormatted},start_date.lte.${tomorrowFormatted},end_date.gte.${tomorrowFormatted}`)
          .eq('status', 'approved');
        
        if (leaveError) {
          console.error('Error fetching leave data:', leaveError);
        }
        
        console.log("Leave data:", leaveData);
        
        // Filter out employees on leave
        const isOnLeaveToday = (employeeId: string) => {
          return leaveData?.some(leave => 
            leave.employee_id === employeeId &&
            new Date(leave.start_date) <= new Date(todayFormatted) &&
            new Date(leave.end_date) >= new Date(todayFormatted)
          ) || false;
        };
        
        const isOnLeaveTomorrow = (employeeId: string) => {
          return leaveData?.some(leave => 
            leave.employee_id === employeeId &&
            new Date(leave.start_date) <= new Date(tomorrowFormatted) &&
            new Date(leave.end_date) >= new Date(tomorrowFormatted)
          ) || false;
        };
        
        // Build final staff arrays
        todayStaff = Array.from(todayScheduledEmployees.values())
          .filter(schedule => !isOnLeaveToday(schedule.employee_id))
          .map(schedule => {
            const employee = employeeData?.find(emp => emp.id === schedule.employee_id);
            return {
              id: schedule.employee_id,
              name: employee?.name || 'Unknown',
              shift: schedule.shift,
              role: employee?.role || undefined
            };
          });
        
        tomorrowStaff = Array.from(tomorrowScheduledEmployees.values())
          .filter(schedule => !isOnLeaveTomorrow(schedule.employee_id))
          .map(schedule => {
            const employee = employeeData?.find(emp => emp.id === schedule.employee_id);
            return {
              id: schedule.employee_id,
              name: employee?.name || 'Unknown',
              shift: schedule.shift,
              role: employee?.role || undefined
            };
          });
      }
      
      console.log("Final today staff:", todayStaff);
      console.log("Final tomorrow staff:", tomorrowStaff);
      
    } catch (error) {
      console.error('Error fetching scheduled staff:', error);
    } finally {
      isLoading.staff = false;
    }
  }

  // Helper function to check for employees on leave
  async function checkEmployeesForLeave(): Promise<void> {
    try {
      const todayFormatted = format(today, 'yyyy-MM-dd');
      const tomorrowFormatted = format(tomorrow, 'yyyy-MM-dd');
      
      // Fetch leave requests that overlap with today or tomorrow
      const { data: leaveData, error: leaveError } = await supabase
        .from('leave_requests')
        .select('id, employee_id, start_date, end_date')
        .or(`start_date.lte.${todayFormatted},end_date.gte.${todayFormatted},start_date.lte.${tomorrowFormatted},end_date.gte.${tomorrowFormatted}`)
        .eq('status', 'approved');
      
      if (leaveError) {
        console.error('Error checking for leave:', leaveError);
        return;
      }
      
      console.log("Leave data:", leaveData);
      
      // Filter out employees who are on leave today
      if (leaveData && leaveData.length > 0) {
        todayStaff = todayStaff.filter(employee => {
          const onLeave = leaveData.some(leave => 
            leave.employee_id === employee.id && 
            new Date(leave.start_date) <= new Date(todayFormatted) && 
            new Date(leave.end_date) >= new Date(todayFormatted)
          );
          return !onLeave;
        });
        
        // Filter out employees who are on leave tomorrow
        tomorrowStaff = tomorrowStaff.filter(employee => {
          const onLeave = leaveData.some(leave => 
            leave.employee_id === employee.id && 
            new Date(leave.start_date) <= new Date(tomorrowFormatted) && 
            new Date(leave.end_date) >= new Date(tomorrowFormatted)
          );
          return !onLeave;
        });
      }
    } catch (error) {
      console.error('Error checking for employee leave:', error);
    }
  }

  // Enhanced fetchUpcomingLeave function that properly preserves date ranges
  async function fetchUpcomingLeave(): Promise<void> {
    try {
      const todayFormatted = format(today, 'yyyy-MM-dd');
      
      // Fetch all leave entries starting from today
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*, employee:employees(id, name)')
        .gte('start_date', todayFormatted)
        .order('start_date', { ascending: true });
        
      if (error) throw error;
      
      console.log("Raw leave data:", data);
      
      // Process each leave request directly into range groups
      const dateRangeGroups = new Map<string, {
        startDate: Date,
        endDate: Date,
        isRange: boolean,
        staff: LeaveEmployee[]
      }>();
      
      // Process each leave request
      (data as any[]).forEach(leave => {
        // Skip if employee data is missing
        if (!leave.employee) return;
        
        const startDate = new Date(leave.start_date);
        const endDate = new Date(leave.end_date);
        
        // Check if this is a multi-day leave
        const isRange = format(startDate, 'yyyy-MM-dd') !== format(endDate, 'yyyy-MM-dd');
        
        // Create a key for this date range
        const rangeKey = `${leave.start_date}_${leave.end_date}`;
        
        if (!dateRangeGroups.has(rangeKey)) {
          dateRangeGroups.set(rangeKey, {
            startDate,
            endDate,
            isRange,
            staff: []
          });
        }
        
        // Add employee to this date range
        dateRangeGroups.get(rangeKey)!.staff.push({
          id: leave.employee.id,
          name: leave.employee.name,
          leaveType: leave.leave_type
        });
      });
      
      console.log("Processed leave groups:", Array.from(dateRangeGroups.values()));
      
      // Convert to array of leave groups sorted by start date
      upcomingLeave = [];
      
      // Sort the date ranges by start date and take first 8
      const sortedRanges = Array.from(dateRangeGroups.values())
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
        .slice(0, 8);
        
      // Create dummy structure to satisfy the LeaveDay[] type
      sortedRanges.forEach(range => {
        upcomingLeave.push({
          date: range.startDate,
          staff: range.staff
        });
      });
      
      // Store the range data for display
      leaveRanges = sortedRanges;
      
    } catch (error) {
      console.error('Error fetching upcoming leave:', error);
    } finally {
      isLoading.leave = false;
    }
  }

  // Fetch weather data with forecast for today AND tomorrow
  async function fetchWeather(): Promise<void> {
    try {
      const apiKey = '29f822e1fd8345edb1354635253003';
      const location = 'BN18 0BF';
      
      // Updated to get 2 days of forecast data
      const response = await fetch(
        `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${location}&days=2&aqi=no`
      );
      
      if (!response.ok) {
        throw new Error('Weather API request failed');
      }
      
      weatherData = await response.json() as WeatherData;
      console.log('Weather data:', weatherData);
    } catch (error) {
      console.error('Error fetching weather data:', error);
      weatherError = 'Unable to load weather data';
    } finally {
      isLoading.weather = false;
    }
  }

  // Fetch yesterday's metrics
  async function fetchYesterdayMetrics(): Promise<void> {
    try {
      const yesterday = format(addDays(today, -1), 'yyyy-MM-dd');
      
      // Define metrics type
      interface MetricData {
        shipments_packed: number;
        shipments_per_hour: number;
        labour_utilisation: number;
      }
      
      // Replace with your actual metrics data source
      const { data, error } = await supabase
        .from('daily_metrics')
        .select('*')
        .eq('date', yesterday)
        .single();
        
      if (error) throw error;
      
      if (data) {
        const typedData = data as MetricData;
        metrics = {
          shipmentsPacked: typedData.shipments_packed || 0,
          shipmentsPerHour: typedData.shipments_per_hour || 0,
          labourUtilisation: typedData.labour_utilisation || 0
        };
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      isLoading.metrics = false;
    }
  }

  // Format date for display with explicit return type
  function formatDate(date: Date): string {
    return format(date, 'EEEE, do MMMM');
  }

  // Helper function to sort staff by role/rank
  function sortStaffByRank(staff: Employee[]): Employee[] {
    // Define role priorities (higher number = higher rank)
    const rolePriorities: Record<string, number> = {
      'Manager': 100,
      'Supervisor': 90,
      'Team Lead': 80,
      'Senior': 70,
      'Associate': 50,
      'Junior': 40,
      'Intern': 30,
      'Unknown': 0
    };
    
    // Helper function to determine priority of a role
    const getRolePriority = (role: string | undefined): number => {
      if (!role) return 0;
      
      // Check for partial matches
      for (const [key, value] of Object.entries(rolePriorities)) {
        if (role.toLowerCase().includes(key.toLowerCase())) {
          return value;
        }
      }
      
      return 20; // Default for roles not specifically listed
    };
    
    // Create a sorted copy of the staff array
    return [...staff].sort((a, b) => {
      const priorityA = getRolePriority(a.role);
      const priorityB = getRolePriority(b.role);
      
      // First sort by role priority (descending)
      if (priorityB !== priorityA) {
        return priorityB - priorityA;
      }
      
      // If same priority, sort alphabetically by name
      return a.name.localeCompare(b.name);
    });
  }

  // Helper function to group staff by role
  function groupStaffByRole(staff: Employee[]): Array<{ role: string, staff: Employee[] }> {
    // Define role priorities (higher number = higher rank)
    const rolePriorities: Record<string, number> = {
      'Manager': 100,
      'Supervisor': 90,
      'Team Lead': 80,
      'Senior': 70,
      'Associate': 50,
      'Junior': 40,
      'Intern': 30,
      'Unknown': 0
    };
    
    // Helper function to determine priority of a role
    const getRolePriority = (role: string | undefined): { priority: number, roleGroup: string } => {
      if (!role) return { priority: 0, roleGroup: 'Staff' };
      
      // Check for partial matches
      for (const [key, value] of Object.entries(rolePriorities)) {
        if (role.toLowerCase().includes(key.toLowerCase())) {
          return { priority: value, roleGroup: key };
        }
      }
      
      return { priority: 20, roleGroup: 'Staff' };
    };
    
    // Create a map to group staff by role group
    const roleGroups = new Map<string, { priority: number, staff: Employee[] }>();
    
    // Group staff by their role
    for (const employee of staff) {
      const { priority, roleGroup } = getRolePriority(employee.role);
      
      if (!roleGroups.has(roleGroup)) {
        roleGroups.set(roleGroup, { priority, staff: [] });
      }
      
      roleGroups.get(roleGroup)?.staff.push(employee);
    }
    
    // Sort each group alphabetically
    for (const group of roleGroups.values()) {
      group.staff.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    // Convert map to sorted array
    return Array.from(roleGroups.entries())
      .map(([role, { priority, staff }]) => ({ role, priority, staff }))
      .sort((a, b) => b.priority - a.priority)
      .map(({ role, staff }) => ({ role, staff }));
  }

  // Fixed groupLeaveByDateRange function to handle dates reliably
  function groupLeaveByDateRange(leaveData: LeaveDay[]): Array<{
    startDate: Date,
    endDate: Date,
    isRange: boolean,
    staff: LeaveEmployee[]
  }> {
    // Directly use the actual leave periods rather than trying to parse from text
    const employeeLeavePeriods = new Map<string, {
      id: string,
      name: string,
      startDate: Date,
      endDate: Date,
      leaveType: string
    }>();
    
    // Process each leave day
    leaveData.forEach(leaveDay => {
      // Get date as a string for lookup
      const dateKey = format(leaveDay.date, 'yyyy-MM-dd');
      
      // Process each person on leave
      leaveDay.staff.forEach(person => {
        const employeeKey = `${person.id}-${dateKey}`;
        
        // Instead of trying to parse dates from text, initialize with known date
        if (!employeeLeavePeriods.has(employeeKey)) {
          // Extract clean name - remove any existing date patterns
          const cleanName = person.name.replace(/\s*\(until.*\)/, '');
          
          employeeLeavePeriods.set(employeeKey, {
            id: person.id,
            name: cleanName,
            startDate: new Date(leaveDay.date),
            endDate: new Date(leaveDay.date), // Start with single day period
            leaveType: person.leaveType
          });
        }
      });
    });
    
    // Consolidate consecutive days for the same employee
    const consolidatedLeave = new Map<string, {
      id: string,
      name: string,
      startDate: Date,
      endDate: Date,
      leaveType: string
    }>();
    
    // Process each leave entry
    Array.from(employeeLeavePeriods.values()).forEach(period => {
      const employeeKey = period.id;
      
      if (!consolidatedLeave.has(employeeKey)) {
        // First entry for this employee
        consolidatedLeave.set(employeeKey, { ...period });
      } else {
        // Update existing entry if needed
        const existing = consolidatedLeave.get(employeeKey)!;
        
        // Check if dates are within 1 day of each other (consecutive)
        const timeDiff = Math.abs(period.startDate.getTime() - existing.endDate.getTime());
        const dayDiff = timeDiff / (1000 * 3600 * 24);
        
        if (dayDiff <= 1) {
          // Extend period if this is a consecutive day
          if (period.startDate < existing.startDate) {
            existing.startDate = period.startDate;
          }
          if (period.endDate > existing.endDate) {
            existing.endDate = period.endDate;
          }
        } 
        // Otherwise it's a separate period that we'll handle later
      }
    });
    
    // Group by date range
    const dateRangeGroups = new Map<string, {
      startDate: Date,
      endDate: Date,
      isRange: boolean,
      staff: LeaveEmployee[]
    }>();
    
    // Process each employee's consolidated leave period
    for (const period of consolidatedLeave.values()) {
      // Format dates safely
      const startStr = format(period.startDate, 'yyyy-MM-dd');
      const endStr = format(period.endDate, 'yyyy-MM-dd');
      const isRange = startStr !== endStr;
      
      const rangeKey = `${startStr}_${endStr}`;
      
      if (!dateRangeGroups.has(rangeKey)) {
        dateRangeGroups.set(rangeKey, {
          startDate: period.startDate,
          endDate: period.endDate,
          isRange,
          staff: []
        });
      }
      
      // Add employee to this date range group
      dateRangeGroups.get(rangeKey)!.staff.push({
        id: period.id,
        name: period.name,
        leaveType: period.leaveType
      });
    }
    
    // Convert to array, sort by start date
    return Array.from(dateRangeGroups.values())
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }
</script>

<svelte:head>
  <title>Dashboard | Parker's Foodservice</title>
</svelte:head>

<!-- Add authentication check wrapper around landing content -->
{#if session === undefined}
  <div class="loading-container">
    <div class="loading-spinner"></div>
    <p>Loading...</p>
  </div>
{:else if session}
  <!-- Your existing landing page content - keep everything the same -->
  <div class="dashboard-container">
    <header class="dashboard-header">
      <h1>Operations Dashboard</h1>
      <p class="date-display">{format(today, 'EEEE, do MMMM yyyy')}</p>
    </header>
    
    <!-- Rest of your existing landing page content -->
    <div class="dashboard-grid">
      <!-- Left Column: Staff and Yesterday's Performance -->
      <div class="main-column">
        <div class="staff-row">
          <!-- Today's Staff -->
          <div class="card">
            <h2>Today's Staffing</h2>
            
            {#if isLoading.staff}
              <div class="loading-placeholder">
                <div class="loading-bar"></div>
              </div>
            {:else if todayStaff.length === 0}
              <p class="empty-state">No staff scheduled for today</p>
            {:else}
              <ul class="staff-list">
                {#each groupStaffByRole(todayStaff) as { role, staff }, i}
                  {#if i > 0}
                    <li class="role-separator"></li>
                  {/if}
                  {#each staff as person}
                    <li class="staff-item">
                      <span class="staff-name">{person.name}</span>
                    </li>
                  {/each}
                {/each}
              </ul>
            {/if}
          </div>
          
          <!-- Tomorrow's Staff -->
          <div class="card">
            <h2>Tomorrow's Staffing</h2>
            
            {#if isLoading.staff}
              <div class="loading-placeholder">
                <div class="loading-bar"></div>
              </div>
            {:else if tomorrowStaff.length === 0}
              <p class="empty-state">No staff scheduled for tomorrow</p>
            {:else}
              <ul class="staff-list">
                {#each groupStaffByRole(tomorrowStaff) as { role, staff }, i}
                  {#if i > 0}
                    <li class="role-separator"></li>
                  {/if}
                  {#each staff as person}
                    <li class="staff-item">
                      <span class="staff-name">{person.name}</span>
                    </li>
                  {/each}
                {/each}
              </ul>
            {/if}
          </div>
        </div>
        
        <!-- MOVED: Yesterday's Performance -->
        <div class="card">
          <h2>
            Yesterday's Performance
            <span class="date-badge">{format(addDays(today, -1), 'do MMM')}</span>
          </h2>
          
          {#if isLoading.metrics}
            <div class="loading-placeholder">
              <div class="loading-bar"></div>
              <div class="loading-bar"></div>
              <div class="loading-bar"></div>
            </div>
          {:else}
            <div class="metrics-list">
              <div class="metric-item">
                <div class="metric-label">Shipments Packed</div>
                <div class="metric-value">{metrics.shipmentsPacked}</div>
              </div>
              
              <div class="metric-item">
                <div class="metric-label">Shipments per Hour</div>
                <div class="metric-value">{metrics.shipmentsPerHour.toFixed(1)}</div>
              </div>
              
              <div class="metric-item">
                <div class="metric-label">Labour Utilisation</div>
                <div class="metric-value">{metrics.labourUtilisation.toFixed(1)}%</div>
              </div>
            </div>
          {/if}
        </div>
      </div>
      
      <!-- Right Column: Upcoming Leave and Weather -->
      <div class="sidebar-column">
        <!-- MOVED: Upcoming Leave (Simplified) -->
        <!-- Updated Upcoming Leave section with more robust date handling -->
        <!-- Corrected Upcoming Leave section with proper end tag and date range display -->
        <!-- Upcoming Leave section using leaveRanges directly -->
        <div class="card">
          <h2>Upcoming Leave</h2>
          
          {#if isLoading.leave}
            <div class="loading-placeholder">
              <div class="loading-bar"></div>
            </div>
          {:else if leaveRanges.length === 0}
            <p class="empty-state">No upcoming leave scheduled</p>
          {:else}
            <div class="leave-list-container">
              {#each leaveRanges as leaveGroup}
                <div class="leave-section">
                  <div class="leave-date-header">
                    {#if leaveGroup.isRange}
                      {#if leaveGroup.startDate instanceof Date && !isNaN(leaveGroup.startDate.getTime()) && 
                           leaveGroup.endDate instanceof Date && !isNaN(leaveGroup.endDate.getTime())}
                        {format(leaveGroup.startDate, 'EEEE, do MMMM')} - {format(leaveGroup.endDate, 'EEEE, do MMMM')}
                      {:else}
                        Invalid Date Range
                      {/if}
                    {:else}
                      {#if leaveGroup.startDate instanceof Date && !isNaN(leaveGroup.startDate.getTime())}
                        {format(leaveGroup.startDate, 'EEEE, do MMMM')}
                      {:else}
                        Invalid Date
                      {/if}
                    {/if}
                  </div>
                  <ul class="leave-staff-list simple">
                    {#each leaveGroup.staff as person}
                      <li class="leave-staff-item simple">
                        {person.name}
                      </li>
                    {/each}
                  </ul>
                </div>
              {/each}
            </div>
          {/if}
        </div>
        
        <!-- MOVED: Weather Widget -->
        <div class="card">
          <div class="widget-header">
            <h2>Weather</h2>
            <span class="location-badge">{weatherData?.location?.name || 'Southampton'}, UK</span>
          </div>
          
          {#if isLoading.weather}
            <div class="loading-placeholder center">
              <div class="loading-circle"></div>
            </div>
          {:else if weatherError}
            <div class="error-state">{weatherError}</div>
          {:else if weatherData}
            <div class="weather-content">
              <!-- Today's Weather -->
              <div class="weather-main">
                <div class="weather-icon-temp">
                  <img 
                    src={weatherData.current.condition.icon.replace('64x64', '128x128')} 
                    alt={weatherData.current.condition.text}
                    class="weather-icon"
                  />
                  <div>
                    <div class="weather-temp">{weatherData.current.temp_c}°C</div>
                    <div class="weather-condition">{weatherData.current.condition.text}</div>
                    
                    <!-- High/Low Temperature -->
                    {#if weatherData.forecast?.forecastday?.[0]?.day}
                      {@const maxTemp = Math.max(
                        weatherData.current.temp_c,
                        weatherData.forecast.forecastday[0].day.maxtemp_c
                      )}
                      <div class="high-low">
                        <span class="high">H: {maxTemp.toFixed(0)}°</span>
                        <span class="low">L: {weatherData.forecast.forecastday[0].day.mintemp_c.toFixed(0)}°</span>
                      </div>
                    {/if}
                  </div>
                </div>
                <div class="weather-updated">
                  <span>Updated</span>
                  {weatherData.current.last_updated.split(' ')[1]}
                </div>
              </div>
              
              <!-- Weather Details for Today -->
              <div class="weather-details">
                <div class="weather-detail-item">
                  <div class="detail-label">Feels like</div>
                  <div class="detail-value">{weatherData.current.feelslike_c}°C</div>
                </div>
                <div class="weather-detail-item">
                  <div class="detail-label">Humidity</div>
                  <div class="detail-value">{weatherData.current.humidity}%</div>
                </div>
                <div class="weather-detail-item">
                  <div class="detail-label">Wind</div>
                  <div class="detail-value">{weatherData.current.wind_mph} mph {weatherData.current.wind_dir}</div>
                </div>
                <div class="weather-detail-item">
                  <div class="detail-label">Rain chance</div>
                  <div class="detail-value">
                    {weatherData.forecast?.forecastday?.[0]?.day?.daily_chance_of_rain || 0}%
                  </div>
                </div>
              </div>
              
              <!-- Tomorrow's Forecast -->
              {#if weatherData.forecast?.forecastday?.[1]?.day}
                <div class="tomorrow-forecast">
                  <div class="tomorrow-header">
                    <span>Tomorrow</span>
                    <span>{format(tomorrow, 'EEE, do')}</span>
                  </div>
                  <div class="tomorrow-content">
                    <div class="tomorrow-icon-temp">
                      <img 
                        src={weatherData.forecast.forecastday[1].day.condition.icon} 
                        alt={weatherData.forecast.forecastday[1].day.condition.text}
                        class="tomorrow-icon"
                      />
                      <div class="tomorrow-condition">
                        {weatherData.forecast.forecastday[1].day.condition.text}
                      </div>
                    </div>
                    <div class="tomorrow-temps">
                      <div class="tomorrow-high">
                        H: {weatherData.forecast.forecastday[1].day.maxtemp_c.toFixed(0)}°
                      </div>
                      <div class="tomorrow-low">
                        L: {weatherData.forecast.forecastday[1].day.mintemp_c.toFixed(0)}°
                      </div>
                      <div class="tomorrow-rain">
                        <span class="rain-icon">💧</span>
                        {weatherData.forecast.forecastday[1].day.daily_chance_of_rain}%
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{:else}
  <!-- When session is null, onMount should have redirected already -->
  <div class="loading-container">
    <p>Redirecting to login...</p>
  </div>
{/if}

<style>
  /* Add these new styles for loading state */
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    color: #1d1d1f;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(0, 122, 255, 0.1);
    border-radius: 50%;
    border-top-color: #007aff;
    animation: spin 1s ease-in-out infinite;
    margin-bottom: 16px;
  }
  
  /* Your existing styles... */
  /* Global Dashboard Styles */
  .dashboard-container {
    padding: 24px;
    max-width: 1400px;
    margin: 0 auto;
  }

  .dashboard-header {
    margin-bottom: 24px;
  }

  .dashboard-header h1 {
    font-size: 1.75rem;
    font-weight: 500;
    color: #1d1d1f;
    margin: 0;
    padding: 0;
  }

  .date-display {
    color: #86868b;
    margin-top: 4px;
    font-size: 0.95rem;
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 24px;
  }

  /* Card Styles */
  .card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    padding: 20px;
    margin-bottom: 24px;
    border: 1px solid #e5e5e7;
  }

  h2 {
    font-size: 1.1rem;
    font-weight: 500;
    color: #1d1d1f;
    margin: 0 0 16px 0;
    padding: 0;
  }

  .date-badge {
    font-size: 0.85rem;
    font-weight: normal;
    color: #86868b;
    margin-left: 8px;
  }

  /* Staff Columns Layout */
  .staff-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 24px;
  }

  /* Add to your existing styles */

  /* Staff List Styles */
  .staff-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .staff-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #f5f5f7;
  }

  .staff-item:last-child {
    border-bottom: none;
  }

  .staff-name {
    font-weight: 500;
    color: #1d1d1f;
  }


  .leave-staff-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .leave-staff-item {
    font-size: 0.9rem;
    padding: 4px 0;
    color: #1d1d1f;
  }

  /* Tomorrow's forecast styles */
.tomorrow-forecast {
  margin-top: 20px;
  background: #f5f5f7;
  border-radius: 8px;
  padding: 12px;
}

.tomorrow-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.85rem;
  color: #1d1d1f;
  font-weight: 500;
}

.tomorrow-header span:last-child {
  color: #86868b;
  font-weight: normal;
}

.tomorrow-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tomorrow-icon-temp {
  display: flex;
  align-items: center;
}

.tomorrow-icon {
  width: 36px;
  height: 36px;
  margin-right: 8px;
}

.tomorrow-condition {
  font-size: 0.85rem;
  color: #1d1d1f;
}

.tomorrow-temps {
  text-align: right;
  font-size: 0.85rem;
}

.tomorrow-high {
  color: #ff3b30;
  font-weight: 500;
}

.tomorrow-low {
  color: #007aff;
  margin: 4px 0;
}

.tomorrow-rain {
  color: #86868b;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.rain-icon {
  margin-right: 4px;
  font-size: 0.8rem;
}

  /* Weather Widget Styles */
  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .location-badge {
    font-size: 0.7rem;
    color: #86868b;
    background: #f5f5f7;
    padding: 3px 8px;
    border-radius: 12px;
  }

  .weather-main {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
  }

  .weather-icon-temp {
    display: flex;
    align-items: center;
  }

  .weather-icon {
    width: 50px;
    height: 50px;
    margin-right: 12px;
  }

  .weather-temp {
    font-size: 1.8rem;
    font-weight: 500;
    color: #1d1d1f;
  }

  .weather-condition {
    color: #86868b;
    font-size: 0.9rem;
  }

  .weather-updated {
    font-size: 0.75rem;
    color: #86868b;
    text-align: right;
  }
  
  .weather-updated span {
    display: block;
    margin-bottom: 2px;
  }

  .weather-details {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 16px;
    margin-top: 16px;
    background: #f5f5f7;
    border-radius: 8px;
    padding: 12px;
  }

  .weather-detail-item {
    display: flex;
    flex-direction: column;
  }

  .detail-label {
    font-size: 0.75rem;
    color: #86868b;
  }

  .detail-value {
    font-size: 0.9rem;
    font-weight: 500;
    color: #1d1d1f;
    margin-top: 2px;
  }

  /* Add to your existing styles */
.high-low {
  font-size: 0.8rem;
  margin-top: 4px;
  color: #86868b;
}

.high {
  color: #ff3b30;
  margin-right: 8px;
}

.low {
  color: #007aff;
}

  .weather-alert {
    margin-top: 16px;
    background-color: rgba(255, 204, 0, 0.1);
    border-left: 3px solid #ffcc00;
    padding: 12px;
    border-radius: 6px;
  }

  .alert-title {
    font-weight: 500;
    color: #1d1d1f;
    margin-bottom: 4px;
    font-size: 0.9rem;
  }

  .alert-text {
    font-size: 0.8rem;
    color: #86868b;
  }

  /* Metrics Styles */
  .metrics-list {
    display: flex;
    flex-direction: column;
  }

  .metric-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #f5f5f7;
  }

  .metric-item:last-child {
    border-bottom: none;
  }

  .metric-label {
    color: #86868b;
    font-size: 0.9rem;
  }

  .metric-value {
    font-size: 1.2rem;
    font-weight: 500;
    color: #1d1d1f;
  }

  /* Loading States */
  .loading-placeholder {
    padding: 16px 0;
  }

  .loading-bar {
    height: 12px;
    width: 100%;
    background-color: #f5f5f7;
    border-radius: 6px;
    margin-bottom: 12px;
    animation: pulse 1.5s infinite;
  }

  .loading-circle {
    height: 50px;
    width: 50px;
    background-color: #f5f5f7;
    border-radius: 50%;
    animation: pulse 1.5s infinite;
  }

  .center {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 32px 0;
  }

  /* Empty and Error States */
  .empty-state, .error-state {
    color: #86868b;
    text-align: center;
    padding: 24px 0;
    font-size: 0.95rem;
  }

  /* Animation */
  @keyframes pulse {
    0% { opacity: 0.6; }
    50% { opacity: 1; }
    100% { opacity: 0.6; }
  }

  /* Responsive Adjustments */
  @media (max-width: 900px) {
    .dashboard-grid {
      grid-template-columns: 1fr;
    }
    
    .main-column {
      order: 2;
    }
    
    .sidebar-column {
      order: 1;
    }
  }

  @media (max-width: 640px) {
    .staff-row {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 480px) {
    .leave-grid {
      grid-template-columns: 1fr;
    }
    
    .dashboard-container {
      padding: 16px;
    }
  }

  /* Simplified Leave List Styles */
.leave-list-container {
  display: flex;
  flex-direction: column;
}

.leave-section {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f5f5f7;
}

.leave-section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.leave-date-header {
  font-weight: 500;
  color: #1d1d1f;
  margin-bottom: 6px;
  font-size: 0.9rem;
}

.leave-staff-list.simple {
  list-style: none;
  padding: 0;
  margin: 0;
}

.leave-staff-item.simple {
  font-size: 0.9rem;
  padding: 3px 0;
  color: #1d1d1f;
}

/* You can remove or comment out the old grid-based leave styles if not used elsewhere */
</style>