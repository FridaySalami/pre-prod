<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { writable } from 'svelte/store';
  
  // Type definitions
  interface Employee {
    id: string;
    name: string;
    role?: string;
  }

  interface LeaveType {
    id: number;
    name: string;
    color: string;
  }

  export let employees: Employee[] = [];
  let leaveTypes: LeaveType[] = [];
  
  const dispatch = createEventDispatcher();
  let loading = false;
  let error: string | null = null;
  
  let bulkLeave = {
    employeeId: '',
    leaveTypeId: '' as string | number,
    startDate: '',
    endDate: '',
    notes: ''
  };
  
  // Create a store for preview dates
  const previewDates = writable<string[]>([]);
  
  // Functions
  function formatApiDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
  
  function getDayOfWeek(dateString: string): number {
    return new Date(dateString).getDay();
  }
  
  function getDatesBetween(start: string, end: string): string[] {
    const dates = [];
    let currentDate = new Date(start);
    const endDate = new Date(end);
    
    while (currentDate <= endDate) {
      dates.push(formatApiDate(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  }
  
  async function loadLeaveTypes() {
    try {
      const { data, error: fetchError } = await supabase
        .from('leave_types')
        .select('*')
        .order('name');
      
      if (fetchError) throw fetchError;
      
      leaveTypes = data || [];
      
      if (leaveTypes.length === 0) {
        leaveTypes = [
          { id: -1, name: 'Vacation', color: '#10b981' },
          { id: -2, name: 'Sick Leave', color: '#ef4444' },
          { id: -3, name: 'Personal', color: '#6366f1' }
        ];
      }
      
      if (leaveTypes.length > 0) {
        bulkLeave.leaveTypeId = leaveTypes[0].id;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load leave types';
    }
  }
  
  async function submitBulkLeave() {
    if (!bulkLeave.employeeId || !bulkLeave.leaveTypeId || !bulkLeave.startDate || !bulkLeave.endDate) {
      error = 'Please complete all required fields';
      return;
    }
    
    if (new Date(bulkLeave.endDate) < new Date(bulkLeave.startDate)) {
      error = 'End date cannot be before start date';
      return;
    }
    
    loading = true;
    error = null;
    
    try {
      // Get employee schedules
      const { data: patterns, error: patternsError } = await supabase
        .from('employee_schedules')
        .select('*')
        .eq('employee_id', bulkLeave.employeeId);
      
      if (patternsError) throw patternsError;
      
      // Create leave request
      const { error: insertError } = await supabase
        .from('leave_requests')
        .insert({
          employee_id: bulkLeave.employeeId,
          leave_type_id: bulkLeave.leaveTypeId,
          start_date: bulkLeave.startDate,
          end_date: bulkLeave.endDate,
          status: 'approved',
          notes: bulkLeave.notes
        });
      
      if (insertError) throw insertError;
      
      dispatch('saved');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save leave requests';
    } finally {
      loading = false;
    }
  }
  
  // Update preview dates when inputs change
  $: if (bulkLeave.startDate && bulkLeave.endDate && bulkLeave.employeeId) {
    updatePreviewDates();
  }

  async function updatePreviewDates() {
    const dates = await calculateWorkingDays(
      bulkLeave.startDate, 
      bulkLeave.endDate, 
      bulkLeave.employeeId
    );
    previewDates.set(dates);
  }
     
  async function calculateWorkingDays(start: string, end: string, employeeId: string) {
    const allDates = getDatesBetween(start, end);
    
    if (!employeeId || allDates.length === 0) return [];
    
    try {
      const { data: patterns } = await supabase
        .from('employee_schedules')
        .select('*')
        .eq('employee_id', employeeId);
      
      if (!patterns) return allDates;
      
      return allDates.filter(date => {
        const dayOfWeek = getDayOfWeek(date);
        let patternDay = dayOfWeek - 1;
        if (patternDay < 0) patternDay = 6;
        
        return patterns.some(p => 
          p.day_of_week === patternDay && p.is_working
        ) || false;
      });
    } catch (err) {
      console.error('Error calculating working days:', err);
      return allDates;
    }
  }
  
  onMount(() => {
    loadLeaveTypes();
  });
</script>

<!-- Apple-inspired design with condensed layout -->
<div class="modal-backdrop" on:click|self={() => dispatch('close')}>
  <div class="modal">
    <div class="modal-header">
      <h2>Add Leave</h2>
      <button 
        class="close-button" 
        on:click={() => dispatch('close')}
        aria-label="Close modal"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    
    <form on:submit|preventDefault={submitBulkLeave}>
      <div class="modal-content">
        {#if error}
          <div class="form-error">
            <p>{error}</p>
          </div>
        {/if}
        
        <div class="form-row">
          <div class="form-column">
            <label for="employee">Employee</label>
            <select id="employee" bind:value={bulkLeave.employeeId} required disabled={loading}>
              <option value="">Select</option>
              {#each employees as emp}
                <option value={emp.id}>{emp.name}</option>
              {/each}
            </select>
          </div>
          
          <div class="form-column">
            <label for="leaveType">Leave Type</label>
            <select id="leaveType" bind:value={bulkLeave.leaveTypeId} required disabled={loading}>
              <option value="">Select</option>
              {#each leaveTypes as type}
                <option value={type.id}>{type.name}</option>
              {/each}
            </select>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-column">
            <label for="startDate">Start Date</label>
            <input id="startDate" type="date" bind:value={bulkLeave.startDate} required disabled={loading} />
          </div>
          
          <div class="form-column">
            <label for="endDate">End Date</label>
            <input id="endDate" type="date" bind:value={bulkLeave.endDate} required disabled={loading} />
          </div>
        </div>
        
        <div class="form-group">
          <label for="notes">Notes (Optional)</label>
          <textarea 
            id="notes" 
            bind:value={bulkLeave.notes} 
            rows="2"
            disabled={loading}
            placeholder="Add any additional details here"
          ></textarea>
        </div>
        
        {#if $previewDates.length > 0}
          <div class="date-preview">
            <div class="preview-header">
              <span class="calendar-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </span>
              <span class="preview-count">{$previewDates.length} working day{$previewDates.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="date-list">
              {#each $previewDates as date}
                <span class="date-chip">{new Date(date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
              {/each}
            </div>
          </div>
        {/if}
      </div>
      
      <div class="modal-footer">
        <button 
          type="button" 
          class="cancel-button" 
          on:click={() => dispatch('close')}
          disabled={loading}
        >
          Cancel
        </button>
        <button 
          type="submit" 
          class="save-button" 
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  /* Apple-inspired styling */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: white;
    border-radius: 12px;
    width: 90%;
    max-width: 420px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: modalFadeIn 0.3s ease-out;
  }
  
  @keyframes modalFadeIn {
    from { 
      opacity: 0;
      transform: translateY(20px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #f0f0f0;
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #111;
  }

  .modal-content {
    padding: 16px 20px;
    max-height: 60vh;
    overflow-y: auto;
  }
  
  .modal-footer {
    padding: 12px 20px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    border-top: 1px solid #f0f0f0;
    background-color: #fafafa;
  }

  .form-row {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  .form-column {
    flex: 1;
  }

  .form-group {
    margin-bottom: 16px;
  }

  label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #555;
  }

  select, input, textarea {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
    background-color: #f9f9f9;
    transition: all 0.2s;
  }

  select:focus, input:focus, textarea:focus {
    outline: none;
    border-color: #0077ff;
    box-shadow: 0 0 0 2px rgba(0, 119, 255, 0.2);
    background-color: white;
  }
  
  textarea {
    resize: none;
    font-family: inherit;
  }

  .form-error {
    background: #fff1f0;
    border-left: 3px solid #ff4d4f;
    padding: 10px 12px;
    border-radius: 4px;
    margin-bottom: 16px;
    font-size: 13px;
    color: #cf1322;
  }
  
  .form-error p {
    margin: 0;
  }

  .date-preview {
    background-color: #f0f7ff;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 16px;
  }
  
  .preview-header {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
  }
  
  .calendar-icon {
    display: inline-flex;
    margin-right: 8px;
    color: #0077ff;
  }
  
  .preview-count {
    font-weight: 600;
    color: #0077ff;
    font-size: 14px;
  }

  .date-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-height: 80px; /* Add a max height */
    overflow-y: auto; /* Make it scrollable if there are many dates */
    padding: 4px;
  }

  .date-chip {
    background-color: #e6f4ff;
    padding: 3px 8px;
    border-radius: 12px;
    font-size: 12px;
    color: #0077ff;
    white-space: nowrap;
    margin-bottom: 2px;
  }
  
  .more-dates {
    background-color: #0077ff;
    color: white;
  }

  .close-button {
    background: none;
    border: none;
    cursor: pointer;
    color: #999;
    padding: 4px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
  }
  
  .close-button:hover {
    background-color: #f0f0f0;
    color: #666;
  }

  .cancel-button {
    background: #f0f0f0;
    color: #333;
    border: none;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .save-button {
    background: #0077ff;
    color: white;
    border: none;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .save-button:hover {
    background: #0066db;
  }

  .cancel-button:hover {
    background: #e4e4e4;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>