<script context="module" lang="ts">
  export type NewProject = {
    title: string;
    category: string;
    submitted_by: string;
    brief_description: string;
  };
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  
  const dispatch = createEventDispatcher();

  let title = "";
  let category = "";
  let submitted_by = "";
  let brief_description = "";
  let submitting = false;

  // Get the current user email on mount
  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email) {
      submitted_by = session.user.email;
    } else {
      // Fallback if not authenticated
      submitted_by = "anonymous@user.com";
    }
  });

  async function handleSubmit() {
    if (title && category && submitted_by && brief_description) {
      submitting = true;
      const newProject = { title, category, submitted_by, brief_description };
      console.log("Dispatching submit event with:", newProject);
      dispatch("submit", { newProject });
      submitting = false;
    } else {
      console.log("Missing fields; form not submitted.");
    }
  }

  function handleClose() {
    dispatch("close");
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      handleClose();
    }
  }
</script>

<div 
  class="overlay" 
  on:click={handleClose} 
  on:keydown={handleKeyDown}
  role="presentation"
>
  <div 
    class="new-project-panel" 
    role="dialog" 
    aria-modal="true" 
    aria-labelledby="panel-title"
    on:click|stopPropagation
  >
    <header>
      <h2 id="panel-title">Submit New Improvement</h2>
      <button class="close-button" on:click={handleClose} aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.5 3.5L3.5 12.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M3.5 3.5L12.5 12.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </header>
    
    <form on:submit|preventDefault={handleSubmit}>
      <div class="form-group">
        <label for="title-input">Title</label>
        <input 
          id="title-input"
          type="text" 
          bind:value={title} 
          required 
          placeholder="Enter a clear, concise title"
        />
      </div>
      
      <div class="form-group">
        <label for="category-select">Category</label>
        <select 
          id="category-select"
          bind:value={category} 
          required
        >
          <option value="" disabled>Select category</option>
          <option value="5S & Organization">5S & Organization</option>
          <option value="Inventory Accuracy & Cycle Counting">Inventory Accuracy & Cycle Counting</option>
          <option value="Equipment Maintenance & Reliability">Equipment Maintenance & Reliability</option>
          <option value="Layout & Space Optimization">Layout & Space Optimization</option>
          <option value="Safety & Ergonomics">Safety & Ergonomics</option>
          <option value="Process Efficiency & Workflow">Process Efficiency & Workflow</option>
          <option value="Quality Improvement">Quality Improvement</option>
          <option value="Technology & Automation">Technology & Automation</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="submitted-by-input">Submitted By</label>
        <!-- Make the input read-only and add visual indication -->
        <div class="readonly-field">
          <span class="user-email">{submitted_by}</span>
          <svg class="lock-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 10H17V7C17 4.24 14.76 2 12 2C9.24 2 7 4.24 7 7V10H5C3.9 10 3 10.9 3 12V20C3 21.1 3.9 22 5 22H19C20.1 22 21 21.1 21 20V12C21 10.9 20.1 10 19 10ZM12 17C10.9 17 10 16.1 10 15C10 13.9 10.9 13 12 13C13.1 13 14 13.9 14 15C14 16.1 13.1 17 12 17ZM15 10H9V7C9 5.34 10.34 4 12 4C13.66 4 15 5.34 15 7V10Z" fill="currentColor"/>
          </svg>
          <!-- Hidden input for form submission -->
          <input 
            id="submitted-by-input"
            type="hidden" 
            bind:value={submitted_by} 
            required 
          />
        </div>
      </div>
      
      <div class="form-group">
        <label for="description-textarea">Brief Description</label>
        <textarea 
          id="description-textarea"
          bind:value={brief_description} 
          required
          placeholder="Describe the improvement opportunity..."
          rows="4"
        ></textarea>
      </div>
      
      <div class="form-actions">
        <button 
          type="button" 
          class="cancel-button" 
          on:click={handleClose}
        >
          Cancel
        </button>
        <button 
          type="submit" 
          class="submit-button" 
          disabled={submitting}
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  /* Previous styles remain the same */
  
  /* Add new styles for the read-only email field */
  .readonly-field {
    display: flex;
    align-items: center;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid #d1d1d6;
    background-color: #f0f0f3;
    font-size: 0.9rem;
    color: #666;
    gap: 8px;
  }
  
  .user-email {
    flex: 1;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .lock-icon {
    width: 16px;
    height: 16px;
    color: #8e8e93;
    flex-shrink: 0;
  }
  
  /* Apple-inspired styling */
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: flex-end;
    z-index: 1000;
    transition: opacity 0.2s ease;
  }
  
  .new-project-panel {
    background: #ffffff;
    width: 33%;
    min-width: 360px;
    height: 100%;
    overflow-y: auto;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.15);
    position: relative;
    display: flex;
    flex-direction: column;
  }
  
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    background: #f8f8f8;
    border-bottom: 1px solid #e6e6e6;
    position: sticky;
    top: 0;
    z-index: 1;
  }
  
  h2 {
    font-size: 1.2rem;
    font-weight: 500;
    color: #333;
    margin: 0;
  }
  
  .close-button {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    transition: background-color 0.2s ease;
  }
  
  .close-button:hover {
    background-color: #e6e6e6;
  }
  
  form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    flex: 1;
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  label {
    font-size: 0.85rem;
    font-weight: 500;
    color: #333;
  }
  
  input, select, textarea {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid #d1d1d6;
    background-color: #f8f8fa;
    font-size: 0.9rem;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  
  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: #007aff;
    box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2);
  }
  
  input::placeholder, textarea::placeholder {
    color: #999;
  }
  
  select {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    background-size: 16px;
    padding-right: 36px;
  }
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 8px;
  }
  
  button {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .cancel-button {
    background-color: transparent;
    color: #007aff;
    border: none;
  }
  
  .cancel-button:hover {
    background-color: rgba(0, 122, 255, 0.1);
  }
  
  .submit-button {
    background-color: #007aff;
    color: white;
    border: none;
  }
  
  .submit-button:hover {
    background-color: #0062cc;
  }
  
  .submit-button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
  
  textarea {
    resize: vertical;
    min-height: 100px;
  }
  
  /* Animation */
  @keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  
  .new-project-panel {
    animation: slideIn 0.3s ease forwards;
  }
  
  /* Media queries for responsiveness */
  @media (max-width: 768px) {
    .new-project-panel {
      width: 80%;
    }
  }
  
  @media (max-width: 480px) {
    .new-project-panel {
      width: 100%;
    }
    
    .form-actions {
      flex-direction: column-reverse;
    }
    
    button {
      width: 100%;
    }
  }
</style>