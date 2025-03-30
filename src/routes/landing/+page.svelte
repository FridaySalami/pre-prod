<script lang="ts">
  import { onMount } from 'svelte';
  import { format, addDays, isWeekend } from 'date-fns';
  import { supabase } from '$lib/supabaseClient';
  
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
          mintemp_f: number;
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

  onMount(async () => {
    // Fetch all data in parallel
    await Promise.all([
      fetchStaffScheduled(),
      fetchUpcomingLeave(),
      fetchWeather(),
      fetchYesterdayMetrics()
    ]);
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

  // Fetch upcoming leave days
  async function fetchUpcomingLeave(): Promise<void> {
    try {
      const todayFormatted = format(today, 'yyyy-MM-dd');
      
      // Updated interface to match your leave_requests table structure
      interface LeaveItem {
        uuid: string;
        employee_id: string;
        start_date: string;
        end_date: string;
        leave_type: string;
        employee?: {
          id: string;
          name: string;
        };
      }
      
      // Fetch all leave entries starting from today from the correct table
      const { data, error } = await supabase
        .from('leave_requests')  // Updated table name
        .select('*, employee:employees(id, name)')  // Join with employees table
        .gte('start_date', todayFormatted)
        .order('start_date', { ascending: true });
        
      if (error) throw error;
      
      // Process and group by date with proper typing
      const leaveByDate: Record<string, LeaveDay> = {};
      
      (data as LeaveItem[]).forEach(leave => {
        // Skip if employee data is missing
        if (!leave.employee) return;
        
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        
        // Create entries for each date in the range
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateKey = format(d, 'yyyy-MM-dd');
          if (!leaveByDate[dateKey]) {
            leaveByDate[dateKey] = {
              date: new Date(d),
              staff: []
            };
          }
          
          leaveByDate[dateKey].staff.push({
            id: leave.employee.id,
            name: leave.employee.name,
            leaveType: leave.leave_type
          });
        }
      });
      
      // Convert to array and take next 5 unique dates
      upcomingLeave = Object.values(leaveByDate)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, 5);
        
    } catch (error) {
      console.error('Error fetching upcoming leave:', error);
    } finally {
      isLoading.leave = false;
    }
  }

  // Fetch weather data with forecast
  async function fetchWeather(): Promise<void> {
    try {
      const apiKey = '29f822e1fd8345edb1354635253003';
      const location = 'BN18 0BF';
      
      // Updated to get forecast data (includes high/low temps)
      const response = await fetch(
        `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${location}&days=1&aqi=no`
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
</script>

<svelte:head>
  <title>Dashboard | Parker's Foodservice</title>
</svelte:head>

<div class="dashboard-container">
  <!-- Dashboard Header -->
  <header class="dashboard-header">
    <h1>Operations Dashboard</h1>
    <p class="date-display">{format(today, 'EEEE, do MMMM yyyy')}</p>
  </header>
  
  <div class="dashboard-grid">
    <!-- Left Column: Staff and Leave -->
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
              {#each sortStaffByRank(todayStaff) as person}
                <li class="staff-item">
                  <span class="staff-name">{person.name}</span>
                  {#if person.role}
                    <span class="staff-role">{person.role}</span>
                  {/if}
                </li>
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
              {#each sortStaffByRank(tomorrowStaff) as person}
                <li class="staff-item">
                  <span class="staff-name">{person.name}</span>
                  {#if person.role}
                    <span class="staff-role">{person.role}</span>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
      
      <!-- Leave Calendar -->
      <div class="card">
        <h2>Upcoming Leave</h2>
        
        {#if isLoading.leave}
          <div class="loading-placeholder">
            <div class="loading-bar"></div>
          </div>
        {:else if upcomingLeave.length === 0}
          <p class="empty-state">No upcoming leave scheduled</p>
        {:else}
          <div class="leave-grid">
            {#each upcomingLeave as leaveDay}
              <div class="leave-card">
                <div class="leave-date">
                  {formatDate(leaveDay.date)}
                </div>
                <ul class="leave-staff-list">
                  {#each leaveDay.staff as person}
                    <li class="leave-staff-item">
                      <span class="leave-icon">
                        {person.leaveType === 'Sick' ? '🤒' : '🌴'}
                      </span>
                      {person.name}
                    </li>
                  {/each}
                </ul>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
    
    <!-- Right Column: Weather and Metrics -->
    <div class="sidebar-column">
      <!-- Weather Widget with High/Low Temperatures -->
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
                    <div class="high-low">
                      <span class="high">H: {weatherData.forecast.forecastday[0].day.maxtemp_c}°</span>
                      <span class="low">L: {weatherData.forecast.forecastday[0].day.mintemp_c}°</span>
                    </div>
                  {/if}
                </div>
              </div>
              <div class="weather-updated">
                <span>Updated</span>
                {weatherData.current.last_updated.split(' ')[1]}
              </div>
            </div>
            
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
              
              <!-- Rain chance instead of UV index -->
              <div class="weather-detail-item">
                <div class="detail-label">Rain chance</div>
                <div class="detail-value">
                  {weatherData.forecast?.forecastday?.[0]?.day?.daily_chance_of_rain || 0}%
                </div>
              </div>
            </div>
            
            {#if weatherData.alerts && weatherData.alerts.alert.length}
              <div class="weather-alert">
                <div class="alert-title">Weather Alert</div>
                <div class="alert-text">{weatherData.alerts.alert[0].headline}</div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
      
      <!-- Yesterday's Metrics -->
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
  </div>
</div>

<style>
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

  .staff-role {
    font-size: 0.85rem;
    color: #86868b;
    text-align: right;
  }

  .shift-badge {
    font-size: 0.75rem;
    font-weight: 500;
    padding: 3px 8px;
    border-radius: 4px;
    margin-right: 12px;
    min-width: 36px;
    text-align: center;
  }

  .morning {
    background-color: #e3f2fd;
    color: #0071e3;
  }

  .afternoon {
    background-color: #fff8e1;
    color: #f5a623;
  }

  .night {
    background-color: #e8eaf6;
    color: #5856d6;
  }

  /* Leave Calendar Styles */
  .leave-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
  }

  .leave-card {
    background: #f5f5f7;
    border-radius: 8px;
    padding: 12px;
  }

  .leave-date {
    font-weight: 500;
    color: #1d1d1f;
    margin-bottom: 8px;
    font-size: 0.9rem;
  }

  .leave-staff-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .leave-staff-item {
    display: flex;
    align-items: center;
    font-size: 0.85rem;
    padding: 4px 0;
  }

  .leave-icon {
    font-size: 1rem;
    margin-right: 8px;
    width: 16px;
    display: inline-flex;
    justify-content: center;
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
    
    .leave-grid {
      grid-template-columns: 1fr 1fr;
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
</style>