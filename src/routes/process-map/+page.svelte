<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { goto } from '$app/navigation';
    import { supabase } from '$lib/supabaseClient';
    import { userSession } from '$lib/sessionStore';
    import { format } from 'date-fns';
  
    // Process map data structure
    interface Issue {
      id?: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
      status: 'open' | 'in-progress' | 'resolved';
    }

    interface ProcessStep {
      id?: string;  // Optional when creating new steps
      step_number: number;
      name: string;
      description: string;
      responsible: string;
      issues: Issue[];  // Changed from string to Issue[]
      notes: string;
      created_at?: string;
      updated_at?: string;
      version?: number;
      updated_by?: string;
    }
  
    // Process map state
    let processSteps: ProcessStep[] = [];
    let isLoading = true;
    let error = '';
    let session: any = undefined;
    let editingStep: ProcessStep | null = null;
    let isAddingNewStep = false;
    let newStep: ProcessStep = createEmptyStep();
    let searchQuery = '';
    let sortCriteria = 'step_number';
    let filteredSteps: ProcessStep[] = [];
  
    // Common responsible parties for dropdown
    const responsibleParties = [
      'Picker',
      'Packer',
      'Warehouse Lead',
      'Admin Staff',
      'Manager',
      'Other',
      'Any assigned',
    ];
  
    // Subscribe to auth state
    const unsubscribe = userSession.subscribe((s) => {
      session = s;
      // If user logs in and data isn't loaded yet, load it
      if (s && isLoading && processSteps.length === 0) {
        fetchProcessSteps();
      }
    });
  
    onMount(async () => {
      // Only load data if user is authenticated
      if (session === null) {
        goto('/login');
      } else if (session) {
        await fetchProcessSteps();
      }
    });

    onDestroy(() => {
      unsubscribe();
    });
  
    function createEmptyStep(): ProcessStep {
      return {
        step_number: processSteps.length + 1,
        name: '',
        description: '',
        responsible: '',
        issues: [],  // Now an empty array
        notes: ''
      };
    }

    function createEmptyIssue(): Issue {
      return {
        description: '',
        severity: 'medium',
        status: 'open'
      };
    }
    
    // Function to add a new issue to the currently editing step
    function addIssueToStep() {
      if (editingStep) {
        editingStep.issues = [...editingStep.issues, createEmptyIssue()];
      }
    }
    
    // Function to remove an issue from the step
    function removeIssue(index: number) {
      if (editingStep) {
        editingStep.issues = editingStep.issues.filter((_, i) => i !== index);
      }
    }
  
    // Fetch process steps from Supabase
    async function fetchProcessSteps() {
      try {
        isLoading = true;
        
        const { data, error: fetchError } = await supabase
          .from('process_steps')
          .select('*')
          .order('step_number', { ascending: true });
        
        if (fetchError) throw fetchError;
        
        processSteps = data?.map(step => {
          // Convert string issues to the new format if needed
          if (typeof step.issues === 'string' && step.issues.trim()) {
            return {
              ...step,
              issues: [{
                description: step.issues,
                severity: 'medium',
                status: 'open'
              }]
            };
          }
          // Ensure issues is always an array
          if (!Array.isArray(step.issues)) {
            return {
              ...step,
              issues: []
            };
          }
          return step;
        }) || [];
        
        filteredSteps = [...processSteps];
        
        // If no steps exist, prepare for first entry
        if (processSteps.length === 0) {
          isAddingNewStep = true;
        }
      } catch (err) {
        console.error('Error fetching process steps:', err);
        error = 'Failed to load process steps';
      } finally {
        isLoading = false;
      }
    }
  
    // Save a new process step
    async function saveNewStep() {
      try {
        if (!validateStep(newStep)) return;
        
        const { data, error: saveError } = await supabase
          .from('process_steps')
          .insert([{
            ...newStep,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select();
        
        if (saveError) throw saveError;
        
        processSteps = [...processSteps, data[0]];
        isAddingNewStep = false;
        newStep = createEmptyStep();
        
      } catch (err) {
        console.error('Error saving process step:', err);
        error = 'Failed to save process step';
      }
    }
  
    // Update an existing process step
    async function updateStep() {
      if (!editingStep) {
        error = 'No step is being edited';
        return;
      }
      
      // Extract the step to a new variable with guaranteed non-null type
      await updateExistingStep(editingStep);
    }
    
    // This function only gets called with a non-null step
    async function updateExistingStep(step: ProcessStep) {
      try {
        if (!validateStep(step)) return;
        
        // Now TypeScript knows step can't be null
        const { data, error: updateError } = await supabase
          .from('process_steps')
          .update({
            ...step,
            version: (step.version || 0) + 1,
            updated_by: session?.user?.email || 'Unknown',
            updated_at: new Date().toISOString()
          })
          .eq('id', step.id!)
          .select();
        
        cancelEdit();
        
      } catch (err) {
        console.error('Error updating process step:', err);
        error = 'Failed to update process step';
      }
    }
  
    // Delete a process step
    async function deleteStep(id: string) {
      if (!id || !confirm('Are you sure you want to delete this step?')) return;
      
      try {
        const { error: deleteError } = await supabase
          .from('process_steps')
          .delete()
          .eq('id', id);
        
        if (deleteError) throw deleteError;
        
        // Remove the step and renumber remaining steps
        processSteps = processSteps.filter(step => step.id !== id);
        await renumberSteps();
        
      } catch (err) {
        console.error('Error deleting process step:', err);
        error = 'Failed to delete process step';
      }
    }
  
    // Renumber steps after deletion or reordering
    async function renumberSteps() {
      try {
        // Update step numbers locally first
        processSteps = processSteps.map((step, index) => ({
          ...step,
          step_number: index + 1
        }));
        
        // Then update in database (could be optimized with batch operations)
        for (const step of processSteps) {
          await supabase
            .from('process_steps')
            .update({ step_number: step.step_number })
            .eq('id', step.id);
        }
      } catch (err) {
        console.error('Error renumbering steps:', err);
        error = 'Failed to renumber steps';
      }
    }
  
    // Move a step up or down
    async function moveStep(stepId: string, direction: 'up' | 'down') {
      // Only proceed if stepId is defined
      if (!stepId) return;
      
      const currentIndex = processSteps.findIndex(step => step.id === stepId);
      if (currentIndex === -1) return;
      
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      
      // Don't move beyond array bounds
      if (newIndex < 0 || newIndex >= processSteps.length) return;
      
      // Swap steps
      const stepsArray = [...processSteps];
      [stepsArray[currentIndex], stepsArray[newIndex]] = 
        [stepsArray[newIndex], stepsArray[currentIndex]];
      
      processSteps = stepsArray;
      await renumberSteps();
    }
  
    // Edit an existing step
    function editStep(step: ProcessStep) {
      // Ensure id exists before editing
      if (!step.id) {
        error = 'Cannot edit a step without an ID';
        return;
      }
      editingStep = { ...step };
    }
  
    // Cancel editing
    function cancelEdit() {
      editingStep = null;
    }
  
    // Cancel adding a new step
    function cancelAddNew() {
      isAddingNewStep = false;
      newStep = createEmptyStep();
    }
  
    // Validate step data
    function validateStep(step: ProcessStep): boolean {
      if (!step.name.trim()) {
        error = 'Step name is required';
        return false;
      }
      if (!step.responsible.trim()) {
        error = 'Responsible party is required';
        return false;
      }
      return true;
    }
  
    function filterSteps() {
      if (!searchQuery.trim()) {
        filteredSteps = processSteps;
        return;
      }
      
      const query = searchQuery.toLowerCase();
      filteredSteps = processSteps.filter(step => 
        step.name.toLowerCase().includes(query) || 
        step.description.toLowerCase().includes(query) ||
        step.responsible.toLowerCase().includes(query) ||
        step.issues.some(issue => issue.description.toLowerCase().includes(query)) ||
        step.notes.toLowerCase().includes(query)
      );
    }
    
    function sortSteps() {
      const isDesc = sortCriteria.startsWith('-');
      const field = isDesc ? sortCriteria.substring(1) : sortCriteria;
      
      filteredSteps = [...filteredSteps].sort((a: any, b: any) => {
        let valueA = a[field];
        let valueB = b[field];
        
        if (typeof valueA === 'string') {
          valueA = valueA.toLowerCase();
          valueB = valueB.toLowerCase();
        }
        
        if (valueA < valueB) return isDesc ? 1 : -1;
        if (valueA > valueB) return isDesc ? -1 : 1;
        return 0;
      });
    }
    
    // Make sure to initialize filteredSteps
    $: {
      filteredSteps = processSteps;
      filterSteps();
      sortSteps();
    }

    function printProcessMap() {
      window.print();
    }

    // Add this function
    async function duplicateStep(step: ProcessStep) {
      const newDuplicateStep: ProcessStep = {
        ...step,
        name: `${step.name} (Copy)`,
        step_number: processSteps.length + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Remove the ID so Supabase creates a new one
      delete newDuplicateStep.id;
      
      try {
        const { data, error } = await supabase
          .from('process_steps')
          .insert([newDuplicateStep])
          .select();
        
        if (error) throw error;
        
        processSteps = [...processSteps, data[0]];
        
      } catch (err) {
        console.error('Error duplicating step:', err);
        error = 'Failed to duplicate process step';
      }
    }

    // Add keyboard navigation handlers
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && editingStep) {
        cancelEdit();
      }
      
      if ((event.key === 'Enter' && event.ctrlKey) || (event.key === 'Enter' && event.metaKey)) {
        if (editingStep) updateStep();
        if (isAddingNewStep) saveNewStep();
      }
    }
  </script>
  
  <!-- Use the same session handling approach as dashboard -->
  {#if session === undefined}
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <p>Loading...</p>
    </div>
  {:else if session}
  <div class="process-map-container" on:keydown={handleKeyDown} role="region" aria-label="Process Map Editor">      <header class="process-map-header">
        <h1>Fulfilment Process Observation Map</h1>
        <p class="description">
          Track and analyze each step of the fulfillment process to identify bottlenecks and improvement opportunities.
        </p>
      </header>
    
      {#if error}
        <div class="error-banner">
          {error}
          <button on:click={() => error = ''} class="close-button">×</button>
        </div>
      {/if}
    
      {#if isLoading}
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Loading process map...</p>
        </div>
      {:else}
        <div class="process-map">
          <!-- Control buttons -->
          <div class="controls">
            <button 
              class="add-step-button" 
              on:click={() => {
                isAddingNewStep = true;
                newStep.step_number = processSteps.length + 1;
              }}
              disabled={isAddingNewStep}
            >
              Add New Process Step
            </button>
            <button class="print-button" on:click={printProcessMap}>
              Print Process Map
            </button>
          </div>
    
          <div class="filter-controls">
            <div class="search-box">
              <input 
                type="text" 
                bind:value={searchQuery} 
                placeholder="Search steps..." 
                on:input={filterSteps}
              />
            </div>
            
            <div class="sort-controls">
              <label>
                Sort by:
                <select bind:value={sortCriteria} on:change={sortSteps}>
                  <option value="step_number">Step Number</option>
                  <option value="responsible">Responsible Party</option>
                </select>
              </label>
            </div>
          </div>
    
          <!-- Process steps list -->
          <div class="process-steps">
            {#if processSteps.length === 0 && !isAddingNewStep}
              <p class="empty-state">No process steps defined yet. Add the first step to get started.</p>
            {:else}
              <!-- Steps table header - remove step number column -->
              <div class="process-step-header">
                <div class="step-name">Step</div>
                <div class="step-description">Description</div>
                <div class="step-responsible">Responsible</div>
                <div class="step-issues">Issues</div>
                <div class="step-notes">Notes</div>
                <div class="step-actions">Actions</div>
              </div>
    
              <!-- Process steps listing -->
              {#each filteredSteps as step (step.id)}
                {#if editingStep && editingStep.id === step.id}
                  <!-- Editing mode for existing step -->
                  <div class="process-step editing">
                    <div class="step-name">
                      <input type="text" bind:value={editingStep.name} placeholder="Step name" />
                    </div>
                    <div class="step-description">
                      <textarea bind:value={editingStep.description} placeholder="Describe this process step"></textarea>
                    </div>
                    <div class="step-responsible">
                      <select bind:value={editingStep.responsible}>
                        <option value="">Select</option>
                        {#each responsibleParties as party}
                          <option value={party}>{party}</option>
                        {/each}
                      </select>
                    </div>
                    <div class="step-issues">
                      <span class="field-label">Issues</span>
                      <div class="issues-container">
                        {#if editingStep.issues.length === 0}
                          <p class="no-issues">No issues reported</p>
                        {/if}
                        {#each editingStep.issues as issue, i}
                          <div class="issue-item">
                            <div class="issue-header">
                              <span>Issue #{i+1}</span>
                              <button 
                                class="remove-issue-btn" 
                                on:click={() => removeIssue(i)} 
                                title="Remove issue"
                              >×</button>
                            </div>
                            <textarea 
                              bind:value={issue.description} 
                              placeholder="Describe the issue"
                            ></textarea>
                            <div class="issue-controls">
                              <label>
                                Severity:
                                <select bind:value={issue.severity}>
                                  <option value="low">Low</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                </select>
                              </label>
                              <label>
                                Status:
                                <select bind:value={issue.status}>
                                  <option value="open">Open</option>
                                  <option value="in-progress">In Progress</option>
                                  <option value="resolved">Resolved</option>
                                </select>
                              </label>
                            </div>
                          </div>
                        {/each}
                        <button type="button" class="add-issue-btn" on:click={addIssueToStep}>
                          + Add Issue
                        </button>
                      </div>
                    </div>
                    <div class="step-notes">
                      <textarea bind:value={editingStep.notes} placeholder="Additional notes"></textarea>
                    </div>
                    <div class="step-actions">
                      <button class="action-button save" on:click={updateStep}>
                        Save
                      </button>
                      <button class="action-button cancel" on:click={cancelEdit}>
                        Cancel
                      </button>
                    </div>
                  </div>
                {:else}
                  <!-- View mode for step -->
                  <div class="process-step">
                    <div class="step-name">
                      {step.name}
                    </div>
                    <div class="step-description">
                      {step.description || '-'}
                    </div>
                    <div class="step-responsible">
                      {step.responsible || '-'}
                    </div>
                    <!-- Update the issues display structure -->
                    <div class="step-issues">
                      {#if step.issues.length === 0}
                        -
                      {:else}
                        <div class="issues-list">
                          {#each step.issues as issue, i}
                            <div class="issue-display" class:resolved={issue.status === 'resolved'}>
                              <div class="issue-header-row">
                                <div class="issue-badge" class:high={issue.severity === 'high'} class:medium={issue.severity === 'medium'} class:low={issue.severity === 'low'}>
                                  {issue.severity}
                                </div>
                                <div class="issue-status">{issue.status}</div>
                              </div>
                              <div class="issue-text">{issue.description}</div>
                            </div>
                          {/each}
                        </div>
                      {/if}
                    </div>
                    <div class="step-notes">
                      {step.notes || '-'}
                    </div>
                    <div class="step-actions">
                      <div class="tooltip">
                        <button class="action-button edit" on:click={() => editStep(step)}>
                          Edit
                        </button>
                        <span class="tooltip-text">Edit this process step's details</span>
                      </div>
                      <button class="action-button delete" on:click={() => step.id && deleteStep(step.id)}>
                        Delete
                      </button>
                      <button class="action-button duplicate" on:click={() => step.id && duplicateStep(step)}>
                        Copy
                      </button>
                      <div class="move-controls">
                        <button 
                          class="action-button move-up" 
                          on:click={() => step.id && moveStep(step.id, 'up')}
                          disabled={step.step_number <= 1}
                        >
                          ↑
                        </button>
                        <button 
                          class="action-button move-down" 
                          on:click={() => step.id && moveStep(step.id, 'down')}
                          disabled={step.step_number >= processSteps.length}
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  </div>
                {/if}
              {/each}
    
              <!-- New step form -->
              {#if isAddingNewStep}
                <div class="process-step new-step">
                  <div class="step-name">
                    <input type="text" bind:value={newStep.name} placeholder="Step name" />
                  </div>
                  <div class="step-description">
                    <textarea bind:value={newStep.description} placeholder="Describe this process step"></textarea>
                  </div>
                  <div class="step-responsible">
                    <select bind:value={newStep.responsible}>
                      <option value="">Select</option>
                      {#each responsibleParties as party}
                        <option value={party}>{party}</option>
                      {/each}
                    </select>
                  </div>
                  <!-- Issues section for new step -->
                  <div class="step-issues">
                    <span class="field-label">Issues</span>
                    <div class="issues-container">
                      {#if newStep.issues.length === 0}
                        <p class="no-issues">No issues reported</p>
                      {/if}
                      {#each newStep.issues as issue, i}
                        <div class="issue-item">
                          <div class="issue-header">
                            <span>Issue #{i+1}</span>
                            <button 
                              class="remove-issue-btn" 
                              on:click={() => {
                                newStep.issues = newStep.issues.filter((_, idx) => idx !== i);
                              }} 
                              type="button"
                              title="Remove issue"
                            >×</button>
                          </div>
                          <textarea 
                            bind:value={issue.description} 
                            placeholder="Describe the issue"
                          ></textarea>
                          <div class="issue-controls">
                            <label>
                              Severity:
                              <select bind:value={issue.severity}>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                              </select>
                            </label>
                            <label>
                              Status:
                              <select bind:value={issue.status}>
                                <option value="open">Open</option>
                                <option value="in-progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                              </select>
                            </label>
                          </div>
                        </div>
                      {/each}
                      <button type="button" class="add-issue-btn" on:click={() => {
                        newStep.issues = [...newStep.issues, createEmptyIssue()];
                      }}>
                        + Add Issue
                      </button>
                    </div>
                  </div>
                  <div class="step-notes">
                    <textarea bind:value={newStep.notes} placeholder="Additional notes"></textarea>
                  </div>
                  <div class="step-actions">
                    <button class="action-button save" on:click={saveNewStep}>
                      Save
                    </button>
                    <button class="action-button cancel" on:click={cancelAddNew}>
                      Cancel
                    </button>
                  </div>
                </div>
              {/if}
            {/if}
          </div>
          {#if !isAddingNewStep && processSteps.length > 0}
            <div class="bottom-controls">
              <button 
                class="add-step-button" 
                on:click={() => {
                  isAddingNewStep = true;
                  newStep.step_number = processSteps.length + 1;
                  // Scroll to where the new form will appear
                  setTimeout(() => {
                    const newStepForm = document.querySelector('.new-step');
                    if (newStepForm) {
                      newStepForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }, 100);
                }}
              >
                Add New Process Step
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <!-- When session is null, onMount should have redirected already -->
    <div class="loading-container">
      <p>Redirecting to login...</p>
    </div>
  {/if}
  
  <style>
    .process-map-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 24px;
    }
  
    .process-map-header {
      margin-bottom: 24px;
    }
  
    .process-map-header h1 {
      font-size: 1.9rem;
      font-weight: 500;
      color: #1d1d1f;
      margin: 0 0 8px 0;
      letter-spacing: -0.025em;
      line-height: 1.2;
    }
  
    .process-map-header .description {
      color: #86868b;
      font-size: 1rem;
      margin: 0;
    }
  
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 0;
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
  
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  
    .error-banner {
      background-color: #ffebee;
      color: #c62828;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  
    .close-button {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #c62828;
    }
  
    .controls {
      margin-bottom: 16px;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  
    .add-step-button, .print-button {
      background-color: #0071e3; /* Apple's blue */
      color: white;
      border: none;
      border-radius: 980px; /* More rounded for primary actions */
      padding: 8px 18px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
  
    .add-step-button:hover, .print-button:hover {
      background-color: #0077ED;
      transform: scale(1.01);
    }
  
    .add-step-button:disabled {
      background-color: #ccc;
      cursor: not-allowed;
    }

    .filter-controls {
      display: flex;
      justify-content: space-between;
      margin-bottom: 16px;
    }
  
    .search-box input {
      width: 200px;
      padding: 8px;
      border: 1px solid #d1d1d6;
      border-radius: 4px;
      font-size: 14px;
    }
  
    .sort-controls label {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  
    .sort-controls select {
      padding: 8px;
      border: 1px solid #d1d1d6;
      border-radius: 4px;
      font-size: 14px;
    }
  
    .empty-state {
      text-align: center;
      padding: 48px 0;
      color: #86868b;
      font-style: italic;
    }
  
    /* More Apple-like card styling */
    .process-steps {
      border: none; /* Remove border */
      border-radius: 12px; /* More rounded corners */
      overflow: hidden;
      margin-bottom: 24px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); /* Subtle shadow */
      background-color: #ffffff;
      transition: box-shadow 0.3s ease;
    }

    .process-steps:hover {
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
    }

    .process-step-header {
      background-color: #f5f5f7; /* Light gray header */
      font-weight: 500; /* Semi-bold instead of bold */
      letter-spacing: -0.01em; 
    }

    .process-step {
      transition: background-color 0.2s ease;
    }

    /* Subtle hover effect */
    .process-step:not(.editing):not(.new-step):hover {
      background-color: #f9f9fb;
    }
  
    .process-step-header,
    .process-step {
      display: grid;
      /* Adjust column widths */
      grid-template-columns: minmax(120px, 1fr) minmax(180px, 1.5fr) minmax(120px, 1fr) minmax(220px, 2fr) minmax(150px, 1fr) 150px;
      padding: 12px 16px;
      border-bottom: 1px solid #e5e5e5;
      align-items: start;
    }
  
    .process-step:last-child {
      border-bottom: none;
    }
  
    .process-step.editing, .process-step.new-step {
      background-color: #f0f7ff;
    }
    
    /* More Apple-like form controls */
    input, select, textarea {
      width: 100%;
      padding: 10px 12px; /* Slightly more padding */
      border: 1px solid #d2d2d7; /* Apple's border color */
      border-radius: 8px; /* More rounded */
      font-size: 14px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); /* Subtle depth */
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    input:focus, select:focus, textarea:focus {
      border-color: #0071e3; /* Apple blue for focus */
      box-shadow: 0 0 0 2px rgba(0, 113, 227, 0.15); /* Subtle focus ring */
      outline: none;
    }

    textarea {
      min-height: 80px;
      height: auto; /* Allow natural expansion */
      resize: vertical;
      line-height: 1.5;
      white-space: pre-wrap; /* Better handling of line breaks */
    }
  
    .step-description, 
    .step-issues, 
    .step-notes {
      overflow-wrap: break-word;
      word-wrap: break-word;
      word-break: normal; /* Change from break-word to normal to avoid hyphenation */
      hyphens: none; /* Disable hyphenation */
      white-space: pre-line; /* Preserve line breaks but wrap text */
      padding: 8px;
      line-height: 1.5;
      color: #424245;
    }
  
    .process-step:not(.editing):not(.new-step) .step-description, 
    .process-step:not(.editing):not(.new-step) .step-issues, 
    .process-step:not(.editing):not(.new-step) .step-notes {
      max-height: none; /* Remove height restriction */
      overflow-y: visible;
      padding-right: 5px;
    }
  
    .step-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }
  
    .action-button {
      padding: 6px 14px;
      border-radius: 980px; /* More rounded */
      border: none;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
  
    .action-button.edit {
      background-color: #f5f5f7;
      color: #1d1d1f;
    }
  
    .action-button.edit:hover {
      background-color: #e8e8ed;
      transform: scale(1.02);
    }
  
    .action-button.delete {
      background-color: rgba(255, 59, 48, 0.1); /* Apple red with transparency */
      color: #ff3b30; /* Apple red */
    }
  
    .action-button.delete:hover {
      background-color: rgba(255, 59, 48, 0.15);
      transform: scale(1.02);
    }
  
    .action-button.save {
      background-color: #0071e3; /* Apple blue */
      color: white;
    }
  
    .action-button.save:hover {
      background-color: #0077ed;
      transform: scale(1.02);
    }
  
    .action-button.cancel {
      background-color: #f5f5f7;
      color: #1d1d1f;
    }
  
    .action-button.cancel:hover {
      background-color: #e5e5e5;
    }
  
    .action-button.duplicate {
      background-color: #f5f5f7;
      color: #1d1d1f;
    }
  
    .action-button.duplicate:hover {
      background-color: #e8e8ed;
      transform: scale(1.02);
    }
  
    .move-controls {
      display: flex;
      gap: 4px;
    }
  
    .move-controls .action-button {
      padding: 4px 8px;
    }
  
    /* Responsive layout */
    @media (max-width: 1200px) {
      .process-step-header, .process-step {
        grid-template-columns: 1fr 1.5fr 1fr 2fr 1fr 120px;
      }
    }
  
    @media (max-width: 992px) {
      .process-map-container {
        padding: 16px;
      }
  
      .process-step-header, .process-step {
        display: block;
        padding: 12px;
      }
  
      .process-step-header {
        display: none;
      }
  
      .process-step {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
      }
  
      .step-name, .step-description, .step-responsible, 
      .step-issues, .step-notes {
        margin-bottom: 8px;
      }
    
      .step-name {
        font-weight: 600;
        font-size: 1rem;
      }
  
      /* Add labels before each field when in mobile view */
      .step-description::before { 
        content: 'Description: ';
        font-weight: 500;
      }
  
      .step-responsible::before { 
        content: 'Responsible: ';
        font-weight: 500;
      }
  
      .step-issues::before { 
        content: 'Issues: ';
        font-weight: 500;
      }
  
      .step-notes::before { 
        content: 'Notes: ';
        font-weight: 500;
      }
  
      .step-actions {
        margin-top: 12px;
        justify-content: flex-start;
      }

      .process-step {
        background-color: #ffffff;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        margin-bottom: 16px;
        padding: 16px;
      }
      
      /* Add more spacing between stacked fields */
      .step-name, .step-description, .step-responsible, 
      .step-issues, .step-notes {
        margin-bottom: 16px;
      }
      
      /* Make field labels more Apple-like */
      .step-description::before,
      .step-responsible::before,
      .step-issues::before,
      .step-notes::before {
        content: attr(data-label); /* Use data attributes instead of pseudo-elements */
        font-weight: 500;
        display: block;
        margin-bottom: 4px;
        color: #86868b; /* Apple's secondary text color */
        font-size: 0.9rem;
      }

      /* Add this to improve mobile view */
      .process-step > div:not(:last-child) {
        border-bottom: 1px solid #e5e5e5;
        padding-bottom: 16px;
        margin-bottom: 16px;
      }
      
      .process-step {
        padding: 20px;
      }
    }

    @media print {
      .controls, .filter-controls, .step-actions, .move-controls, .error-banner {
        display: none;
      }
      
      .process-map-container {
        padding: 0;
      }
      
      .process-step-header, .process-step {
        page-break-inside: avoid;
      }
    }

    /* Styles for multiple issues */
    .issues-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .issue-item {
      border: none;
      border-radius: 8px;
      padding: 12px;
      background-color: #f5f5f7; /* Light gray background */
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      animation: fadeIn 0.3s ease;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .issue-item:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .issue-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-weight: 500;
    }

    .remove-issue-btn {
      background: none;
      border: none;
      color: #c62828;
      font-size: 18px;
      cursor: pointer;
      line-height: 1;
    }

    .issue-controls {
      display: flex;
      gap: 12px;
      margin-top: 8px;
    }

    .issue-controls label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
    }

    .issue-controls select {
      padding: 4px;
      height: auto;
    }

    .add-issue-btn {
      background-color: #f5f5f7;
      border: 1px dashed #d1d1d6;
      color: #007aff;
      padding: 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      text-align: center;
      margin-top: 4px;
    }

    .add-issue-btn:hover {
      background-color: #e5e5e5;
    }

    .no-issues {
      font-style: italic;
      color: #86868b;
      margin: 0;
      font-size: 14px;
    }

    /* Styles for viewing issues */
    .issues-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .issue-display {
      border: none;
      border-radius: 8px;
      padding: 12px;
      background-color: #f5f5f7;
      margin-bottom: 8px;
      animation: fadeIn 0.3s ease;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .issue-display:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .issue-display.resolved {
      opacity: 0.7;
      text-decoration: line-through;
    }

    .issue-badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 980px; /* Very rounded like Apple tags */
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .issue-badge.high {
      background-color: rgba(255, 59, 48, 0.15); /* Apple red with transparency */
      color: #ff3b30;
    }

    .issue-badge.medium {
      background-color: rgba(255, 149, 0, 0.15); /* Apple orange with transparency */
      color: #ff9500;
    }

    .issue-badge.low {
      background-color: rgba(52, 199, 89, 0.15); /* Apple green with transparency */
      color: #34c759;
    }

    .issue-text {
      width: 100%;  /* Full width for text */
      white-space: pre-wrap; /* Preserve line breaks and spaces */
      margin: 4px 0;
    }

    .issue-status {
      font-size: 11px;
      opacity: 0.7;
    }

    .field-label {
      display: block;
      font-weight: 500;
      margin-bottom: 8px;
    }

    /* Remove max-height and overflow restrictions for issues */
    .process-step:not(.editing):not(.new-step) .step-issues {
      max-height: none;  /* Remove the height limit */
      overflow-y: visible; /* Don't add scroll */
    }

    /* Add this to ensure the row expands to fit content */
    .process-step {
      min-height: max-content;
      height: auto;
      transition: all 0.3s ease;
    }

    /* Adjust issue display for better readability */
    .issue-header-row {
      display: flex;
      width: 100%;
      justify-content: space-between;
      align-items: center;
    }

    .process-step.editing, .process-step.new-step {
      animation: highlight 1s ease;
    }

    @keyframes highlight {
      0% { background-color: rgba(0, 113, 227, 0.15); }
      100% { background-color: #f0f7ff; }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Fix for vertical alignment in grid cells */
    .process-step-header > div,
    .process-step > div {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: flex-start;
      padding-top: 8px;
      padding-bottom: 8px;
    }

    /* Ensure all cell content starts at the same vertical position */
    .step-name, 
    .step-description, 
    .step-responsible, 
    .step-issues, 
    .step-notes {
      margin-top: 0;
      margin-bottom: 0;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
    }

    /* Ensure the issues text aligns with other text */
    .issue-display {
      margin-bottom: 8px;
      margin-top: 0;
      padding: 8px; /* Reduce padding to make vertical alignment better */
    }

    /* First issue should start at same position as text in other columns */
    .issues-list {
      margin-top: 0;
    }

    /* Fix text vertical alignment */
    .process-step:not(.editing):not(.new-step) .step-description,
    .process-step:not(.editing):not(.new-step) .step-responsible,
    .process-step:not(.editing):not(.new-step) .step-notes {
      padding-top: 0;
    }

    .bottom-controls {
      display: flex;
      justify-content: center;
      margin-top: 24px;
      margin-bottom: 32px;
    }

    .bottom-controls .add-step-button {
      padding: 10px 20px;
      font-size: 15px;
    }

    /* Hide the bottom button in print view */
    @media print {
      .bottom-controls {
        display: none;
      }
    }

    /* Add tooltip styles */
    .tooltip {
      position: relative;
      display: inline-block;
    }

    .tooltip .tooltip-text {
      visibility: hidden;
      width: 200px;
      background-color: #1d1d1f;
      color: #fff;
      text-align: center;
      border-radius: 6px;
      padding: 8px;
      position: absolute;
      z-index: 1;
      bottom: 125%;
      left: 50%;
      margin-left: -100px;
      opacity: 0;
      transition: opacity 0.3s;
      font-size: 12px;
      pointer-events: none;
    }

    .tooltip:hover .tooltip-text {
      visibility: visible;
      opacity: 0.9;
    }

    /* Enhance animations */
    .process-steps {
      transition: box-shadow 0.3s ease;
    }

    .process-steps:hover {
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
    }

    .issue-item, .issue-display {
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .issue-item:hover, .issue-display:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    /* Add animation for saving/deleting */
    @keyframes pulse {
      0% { opacity: 0.6; }
      50% { opacity: 1; }
      100% { opacity: 0.6; }
    }

    /* Improve form layout */
    .process-step.editing .step-name,
    .process-step.editing .step-description,
    .process-step.editing .step-responsible,
    .process-step.editing .step-issues,
    .process-step.editing .step-notes {
      padding: 12px;
      background-color: rgba(255, 255, 255, 0.8);
      border-radius: 8px;
      transition: all 0.2s ease;
    }

    .process-step.editing .field-label {
      color: #0071e3;
      font-size: 0.85rem;
      margin-bottom: 6px;
      font-weight: 500;
    }
  </style>