<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { slide } from 'svelte/transition';
  import { writable } from 'svelte/store';
  
  export let employees: any[] = [];
  export let onScheduleUpdate: () => void = () => {};
  
  // Local state
  let expanded: Record<string, boolean> = {};
  let schedulesLoading: Record<string, boolean> = {};
  let employeeSchedules: Record<string, boolean[]> = {};
  let saving = false;
  let error: string | null = null; // Fix: Explicit type for error

  // Create a local store for scheduled hours
  const scheduledHoursData = writable<Record<string, number>>({});

  // Helper function for date formatting
  function getFormattedDate(date: Date): string {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return '';
  }

  // Then use these local versions in your component
  let scheduledHours: Record<string, number> = {};
  const unsubscribeHours = scheduledHoursData.subscribe(value => {
    scheduledHours = value;
    // You can log the hours or do other processing if needed
    if (Object.keys(scheduledHours).length > 0) {
      console.log('Scheduled hours updated:', scheduledHours);
      // If you need to notify parent component of hours changes
      onScheduleUpdate();
    }
  });
  
  // For week display (Monday to Sunday)
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Initialize expanded state for all employees (collapsed by default)
  onMount(() => {
    employees.forEach(emp => {
      expanded[emp.id] = false;
      loadEmployeeSchedule(emp.id);
    });
  });
  
  // Toggle expanded state for an employee
  function toggleExpanded(employeeId: string) {
    expanded[employeeId] = !expanded[employeeId];
    if (expanded[employeeId] && !employeeSchedules[employeeId]) {
      loadEmployeeSchedule(employeeId);
    }
  }
  
  // Load schedule for a specific employee from Supabase
  async function loadEmployeeSchedule(employeeId: string) {
    try {
      schedulesLoading[employeeId] = true;
      
      // Initialize default schedule (all days off)
      const defaultSchedule = Array(7).fill(false);
      
      // Fetch from Supabase
      const { data, error: supabaseError } = await supabase
        .from('employee_schedules')
        .select('day_of_week, is_working')
        .eq('employee_id', employeeId);
      
      if (supabaseError) throw supabaseError;
      
      // Transform data into array of booleans [mon, tue, wed, thu, fri, sat, sun]
      if (data && data.length > 0) {
        const schedule = [...defaultSchedule];
        data.forEach(item => {
          schedule[item.day_of_week] = item.is_working;
        });
        employeeSchedules[employeeId] = schedule;
      } else {
        // No schedule found, use default
        employeeSchedules[employeeId] = defaultSchedule;
      }
      
    } catch (err: unknown) { // Fix: Type err as unknown
      console.error('Error loading employee schedule:', err);
      error = err instanceof Error ? err.message : 'Unknown error loading schedule';
    } finally {
      schedulesLoading[employeeId] = false;
    }
  }
  
  // Toggle a specific day for an employee
  function toggleDay(employeeId: string, dayIndex: number) {
    if (!employeeSchedules[employeeId]) {
      employeeSchedules[employeeId] = Array(7).fill(false);
    }
    
    // Create a new array to ensure reactivity
    const newSchedule = [...employeeSchedules[employeeId]];
    newSchedule[dayIndex] = !newSchedule[dayIndex];
    employeeSchedules[employeeId] = newSchedule;
  }
  
  // Save all schedules to Supabase
  async function saveAllSchedules() {
    try {
      saving = true;
      error = null;
      
      // For each employee with a schedule
      for (const [employeeId, schedule] of Object.entries(employeeSchedules)) {
        // Delete existing schedule
        const { error: deleteError } = await supabase
          .from('employee_schedules')
          .delete()
          .eq('employee_id', employeeId);
          
        if (deleteError) throw deleteError;
        
        // Insert new schedule entries
        const scheduleEntries = schedule.map((isWorking, dayIndex) => ({
          employee_id: employeeId,
          day_of_week: dayIndex,
          is_working: isWorking
        }));
        
        const { error: insertError } = await supabase
          .from('employee_schedules')
          .insert(scheduleEntries);
        
        if (insertError) throw insertError;
      }
      
      // Notify parent component that schedules were updated
      onScheduleUpdate();
      
    } catch (err: unknown) { // Fix: Type err as unknown
      console.error('Error saving schedules:', err);
      error = err instanceof Error ? err.message : 'Unknown error saving schedules';
    } finally {
      saving = false;
    }
  }
  
  // Get the number of working days for an employee
  function getWorkingDaysCount(employeeId: string): number {
    if (!employeeSchedules[employeeId]) return 0;
    return employeeSchedules[employeeId].filter(Boolean).length;
  }

  // Delete an employee
  async function deleteEmployee(employeeId: string) {
    if (!confirm('Are you sure you want to delete this employee? This will also remove all their schedules.')) {
      return;
    }
    
    try {
      const { error: deleteError } = await supabase
        .from('employees')
        .delete()
        .eq('id', employeeId);
      
      if (deleteError) throw deleteError;
      
      // Notify parent to refresh data
      onScheduleUpdate();
      
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : 'Error deleting employee';
      console.error('Error deleting employee:', err);
    }
  }
</script>

<div class="schedule-manager">
  <div class="manager-header">
    <h2>Employee Schedule Management</h2>
    <p class="help-text">Set which days each employee typically works each week.</p>
  </div>
  
  {#if error}
    <div class="error-message">
      <p>{error}</p>
      <button on:click={() => error = null}>Dismiss</button>
    </div>
  {/if}
  
  {#if employees.length === 0}
    <div class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
      <h3>No Employees Yet</h3>
      <p>Add employees to start creating schedules.</p>
    </div>
  {:else}
    <div class="employee-list">
      {#each employees as employee}
        <div class="employee-item">
          <!-- Fix: Add role, tabindex, and keyboard event -->
          <div 
            class="employee-header" 
            on:click={() => toggleExpanded(employee.id)}
            on:keydown={e => e.key === 'Enter' && toggleExpanded(employee.id)}
            role="button"
            tabindex="0"
          >
            <div class="employee-info">
              <span class="employee-name">{employee.name}</span>
              <span class="employee-role">{employee.role}</span>
            </div>
            
            <div class="employee-summary">
              <span class="working-days">
                Working {getWorkingDaysCount(employee.id)} days/week
              </span>
              
              <div class="employee-actions">
                <button 
                  class="delete-button" 
                  on:click|stopPropagation={() => deleteEmployee(employee.id)}
                  aria-label="Delete employee"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
                
                <button class="expand-button" aria-label={expanded[employee.id] ? 'Collapse' : 'Expand'}>
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    stroke-width="2" 
                    stroke-linecap="round" 
                    stroke-linejoin="round"
                    style="transform: {expanded[employee.id] ? 'rotate(180deg)' : 'rotate(0deg)'}; transition: transform 0.2s ease"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          {#if expanded[employee.id]}
            <div class="schedule-table" transition:slide={{ duration: 250 }}>
              {#if schedulesLoading[employee.id]}
                <div class="loading">
                  <span class="spinner small"></span>
                  Loading schedule...
                </div>
              {:else}
                <table>
                  <thead>
                    <tr>
                      {#each weekDays as day}
                        <th>{day}</th>
                      {/each}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {#each weekDays as _, dayIndex}
                        <td>
                          <label class="checkbox-container">
                            <input 
                              type="checkbox" 
                              checked={employeeSchedules[employee.id]?.[dayIndex] || false}
                              on:change={() => toggleDay(employee.id, dayIndex)} 
                            />
                            <span class="checkmark"></span>
                          </label>
                        </td>
                      {/each}
                    </tr>
                  </tbody>
                </table>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
  
  <div class="action-bar">
    <button 
      class="save-button" 
      on:click={saveAllSchedules} 
      disabled={saving}
    >
      {#if saving}
        <span class="spinner"></span>
        Saving...
      {:else}
        Save All Schedules
      {/if}
    </button>
  </div>
</div>

<style>
  .schedule-manager {
    background: white;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.08);
    padding: 24px;
    margin-bottom: 32px;
  }
  
  .manager-header {
    margin-bottom: 24px;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 16px;
  }
  
  h2 {
    margin: 0 0 8px 0;
    font-size: 1.5rem;
    font-weight: 500;
    color: #1f2937;
  }
  
  .help-text {
    margin: 0;
    color: #6b7280;
    font-size: 0.95rem;
  }
  
  .error-message {
    background: #fef2f2;
    color: #b91c1c;
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .error-message p {
    margin: 0;
  }
  
  .error-message button {
    background: transparent;
    border: 1px solid #b91c1c;
    color: #b91c1c;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 0.85rem;
    cursor: pointer;
  }
  
  .employee-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .employee-item {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .employee-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    cursor: pointer;
    background: #f9fafb;
    transition: background-color 0.2s ease;
  }
  
  .employee-header:hover {
    background: #f3f4f6;
  }
  
  .employee-header:focus {
    outline: 2px solid #35b07b;
    outline-offset: -2px;
  }
  
  .employee-info {
    display: flex;
    flex-direction: column;
  }
  
  .employee-name {
    font-weight: 500;
    color: #1f2937;
  }
  
  .employee-role {
    font-size: 0.85rem;
    color: #6b7280;
    margin-top: 4px;
  }
  
  .employee-summary {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  
  .working-days {
    font-size: 0.9rem;
    color: #4b5563;
  }
  
  .expand-button {
    background: transparent;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .schedule-table {
    padding: 16px;
    border-top: 1px solid #e5e7eb;
  }
  
  .loading {
    text-align: center;
    padding: 16px;
    color: #6b7280;
    font-style: italic;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
  }
  
  table th {
    padding: 8px;
    text-align: center;
    font-weight: 500;
    color: #4b5563;
    font-size: 0.9rem;
    border-bottom: 1px solid #e5e7eb;
  }
  
  table td {
    padding: 12px 8px;
    text-align: center;
  }
  
  /* Checkbox styling */
  .checkbox-container {
    display: block;
    position: relative;
    padding-left: 0;
    margin: 0 auto;
    cursor: pointer;
    user-select: none;
    width: 20px;
    height: 20px;
  }
  
  .checkbox-container input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
  }
  
  .checkmark {
    position: absolute;
    top: 0;
    left: 0;
    height: 20px;
    width: 20px;
    background-color: #fff;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    transition: all 0.2s ease;
  }
  
  .checkbox-container:hover input ~ .checkmark {
    border-color: #9ca3af;
  }
  
  .checkbox-container input:checked ~ .checkmark {
    background-color: #004225;
    border-color: #004225;
  }
  
  .checkmark:after {
    content: "";
    position: absolute;
    display: none;
  }
  
  .checkbox-container input:checked ~ .checkmark:after {
    display: block;
  }
  
  .checkbox-container .checkmark:after {
    left: 7px;
    top: 3px;
    width: 5px;
    height: 10px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }
  
  .action-bar {
    margin-top: 24px;
    display: flex;
    justify-content: flex-end;
  }
  
  .save-button {
    background: #004225;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 20px;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .save-button:hover:not(:disabled) {
    background: #006339;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  }
  
  .save-button:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
  
  .save-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s ease-in-out infinite;
  }
  
  .spinner.small {
    width: 12px;
    height: 12px;
    border-width: 1.5px;
    border-color: rgba(107, 114, 128, 0.3);
    border-top-color: #6b7280;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  @media (max-width: 768px) {
    .schedule-manager {
      padding: 16px;
    }
    
    .employee-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    
    .employee-summary {
      width: 100%;
      justify-content: space-between;
    }
  }

  /* Add to your existing styles */
  
  .employee-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .delete-button {
    background: transparent;
    border: none;
    color: #ef4444;
    opacity: 0.7;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s ease;
  }
  
  .delete-button:hover {
    opacity: 1;
    background-color: #fee2e2;
  }

  .empty-state {
    text-align: center;
    padding: 48px 24px;
    background: #f9fafb;
    border-radius: 8px;
    border: 1px dashed #d1d5db;
    margin: 24px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }
  
  .empty-state h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 500;
    color: #374151;
  }
  
  .empty-state p {
    margin: 0;
    color: #6b7280;
  }
</style>