<!-- Add this new component for employee leave management -->
<!-- Create a new file called EmployeeLeaveModal.svelte -->

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  
  export let employee: {
    id: string;
    name: string;
    role: string;
  };
  export let date: Date;

  interface LeaveRequest {
    id: string;
    employee_id: string;
    leave_type_id: number;
    start_date: string;
    end_date: string;
    notes: string;
    status: string;
  }

  export let existingLeave: LeaveRequest | null = null;
  
  const dispatch = createEventDispatcher();
  let loading = false;
  let error: string | null = null;

  interface LeaveType {
    id: number;
    name: string;
    color: string;
  }

  let leaveTypes: LeaveType[] = [];
  
  let leaveRequest = {
    leaveTypeId: existingLeave?.leave_type_id || '' as string | number,
    startDate: formatApiDate(date),
    endDate: formatApiDate(date),
    notes: existingLeave?.notes || ''
  };
  
  function formatApiDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
  
  async function submitLeave() {
    if (!leaveRequest.leaveTypeId) {
      error = 'Please select a leave type';
      return;
    }
    
    if (!leaveRequest.startDate || !leaveRequest.endDate) {
      error = 'Please select start and end dates';
      return;
    }
    
    if (new Date(leaveRequest.endDate) < new Date(leaveRequest.startDate)) {
      error = 'End date cannot be before start date';
      return;
    }
    
    loading = true;
    error = null;
    
    try {
      let result;
      if (existingLeave) {
        // Update existing leave
        result = await supabase
          .from('leave_requests')
          .update({
            leave_type_id: leaveRequest.leaveTypeId,
            start_date: leaveRequest.startDate,
            end_date: leaveRequest.endDate,
            notes: leaveRequest.notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingLeave.id);
      } else {
        // Create new leave
        result = await supabase
          .from('leave_requests')
          .insert({
            employee_id: employee.id,
            leave_type_id: leaveRequest.leaveTypeId,
            start_date: leaveRequest.startDate,
            end_date: leaveRequest.endDate,
            status: 'approved', // Auto-approve for now
            notes: leaveRequest.notes
          });
      }
      
      if (result.error) {
        console.error("Supabase error:", result.error);
        throw new Error(`${result.error.message} (Code: ${result.error.code})`);
      }
      
      // Close modal and refresh calendar
      dispatch('saved');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save leave request';
      console.error("Full error:", err);
    } finally {
      loading = false;
    }
  }
  
  async function deleteLeave() {
    if (!existingLeave) return;
    
    if (!confirm('Are you sure you want to delete this leave request?')) {
      return;
    }
    
    loading = true;
    
    try {
      const { error: deleteError } = await supabase
        .from('leave_requests')
        .delete()
        .eq('id', existingLeave.id);
      
      if (deleteError) throw deleteError;
      
      dispatch('saved');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to delete leave request';
    } finally {
      loading = false;
    }
  }
  
  function initializeForm() {
    // Make explicit conversion to number if needed
    let defaultLeaveTypeId: number | string = '';
    
    if (leaveTypes.length > 0) {
      defaultLeaveTypeId = leaveTypes[0].id;
      console.log('Setting default leave type:', leaveTypes[0].name, 'with ID:', defaultLeaveTypeId);
    }
    
    leaveRequest = {
      leaveTypeId: existingLeave?.leave_type_id ?? defaultLeaveTypeId,
      startDate: existingLeave?.start_date || formatApiDate(date),
      endDate: existingLeave?.end_date || formatApiDate(date),
      notes: existingLeave?.notes || ''
    };
    
    console.log('Form initialized with leave type ID:', leaveRequest.leaveTypeId);
  }

  async function handleSupabaseAction<T>(
    action: Promise<{ data: T | null; error: any }>,
    errorMessage: string
  ): Promise<T | null> {
    try {
      const { data, error } = await action;
      if (error) throw error;
      return data;
    } catch (err) {
      error = err instanceof Error ? err.message : errorMessage;
      return null;
    }
  }

  async function loadLeaveTypes() {
    try {
      console.log('Fetching leave types from Supabase...');
      const { data, error: fetchError } = await supabase
        .from('leave_types')
        .select('*')
        .order('name');
      
      if (fetchError) {
        console.error('Supabase error:', fetchError);
        throw fetchError;
      }
      
      console.log('Leave types loaded raw:', data);
      leaveTypes = data || [];
      
      if (leaveTypes.length === 0) {
        console.warn('No leave types found in database. Please create some leave types.');
        // Don't set error here, just provide default leave types
        leaveTypes = [
          { id: -1, name: 'Vacation', color: '#10b981' },
          { id: -2, name: 'Sick Leave', color: '#ef4444' },
          { id: -3, name: 'Personal', color: '#6366f1' }
        ];
        console.log('Using default leave types:', leaveTypes);
      } else {
        console.log('Loaded leave types:', leaveTypes);
      }
    } catch (err) {
      console.error('Error loading leave types:', err);
      error = err instanceof Error ? err.message : 'Failed to load leave types';
    }
  }

  // Load leave types on mount
  import { onMount } from 'svelte';
  
  onMount(async () => {
    await loadLeaveTypes();
    // Only initialize form after leave types are loaded
    initializeForm();
  });

  $: console.log('leaveTypes updated:', leaveTypes);
</script>

<div class="modal" role="dialog" aria-labelledby="leave-modal-title">
  <div class="modal-header">
    <h2 id="leave-modal-title">{existingLeave ? 'Edit' : 'Add'} Leave for {employee.name}</h2>
    <button 
      class="close-button" 
      on:click={() => dispatch('close')}
      aria-label="Close modal"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>
  
  <div class="modal-content">
    {#if error}
      <div class="form-error">
        <p>{error}</p>
      </div>
    {/if}
    
    <form on:submit|preventDefault={submitLeave}>
      <div class="form-group">
        <label for="leaveType">Leave Type</label>
        <select 
          id="leaveType" 
          bind:value={leaveRequest.leaveTypeId} 
          required
          disabled={loading}
        >
          <option value="">Select Leave Type</option>
          {#each leaveTypes as type}
            <option value={type.id}>{type.name}</option>
          {/each}
        </select>
      </div>
      
      <div class="form-group">
        <label for="startDate">Start Date</label>
        <input 
          id="startDate" 
          type="date" 
          bind:value={leaveRequest.startDate} 
          required
          disabled={loading}
        />
      </div>
      
      <div class="form-group">
        <label for="endDate">End Date</label>
        <input 
          id="endDate" 
          type="date" 
          bind:value={leaveRequest.endDate} 
          required
          disabled={loading}
        />
      </div>
      
      <div class="form-group">
        <label for="notes">Notes (Optional)</label>
        <textarea 
          id="notes" 
          bind:value={leaveRequest.notes} 
          rows="3"
          disabled={loading}
          placeholder="Add any additional details here"
        ></textarea>
      </div>
      
      <div class="form-actions">
        {#if existingLeave}
          <button 
            type="button" 
            class="delete-button" 
            on:click={deleteLeave}
            disabled={loading}
          >
            Delete
          </button>
        {/if}
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
          {loading ? 'Saving...' : 'Save Leave'}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .modal-content {
    padding: 20px;
  }
  
  textarea {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
    resize: vertical;
    background-color: #f9fafb;
  }
  
  textarea:focus {
    outline: none;
    border-color: #35b07b;
    box-shadow: 0 0 0 3px rgba(53, 176, 123, 0.2);
    background-color: white;
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

  /* Add these missing styles */
  .modal {
    background: white;
    border-radius: 8px;
    width: 100%;
    max-width: 500px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: #4b5563;
  }

  select, input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 1rem;
    background-color: #f9fafb;
  }

  select:focus, input:focus {
    outline: none;
    border-color: #35b07b;
    box-shadow: 0 0 0 3px rgba(53, 176, 123, 0.2);
    background-color: white;
  }

  .form-error {
    background: #fee2e2;
    color: #b91c1c;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 16px;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
  }

  .close-button {
    background: none;
    border: none;
    cursor: pointer;
    color: #6b7280;
    padding: 4px;
  }

  .cancel-button {
    background: #f3f4f6;
    color: #4b5563;
    border: 1px solid #e5e7eb;
    padding: 8px 16px;
    font-size: 0.95rem;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .save-button {
    background: #10b981;
    color: white;
    border: none;
    padding: 8px 16px;
    font-size: 0.95rem;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .save-button:hover {
    background: #059669;
  }

  .cancel-button:hover {
    background: #e5e7eb;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>