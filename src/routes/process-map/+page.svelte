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
    let session: any = undefined; // Consider creating a proper Session interface
    let editingStep: ProcessStep | null = null;
    let isAddingNewStep = false;
    let newStep: ProcessStep = createEmptyStep();
    let searchQuery = '';
    let sortCriteria = 'step_number';
    let filteredSteps: ProcessStep[] = [];
    let activeStepId: string | null = null;
  
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
        
        // Add proper error handling with type checking
        if (fetchError) {
          console.error('Supabase error:', fetchError);
          throw fetchError;
        }
        
        // Use more precise typing and null coalescing
        processSteps = (data ?? []).map(step => {
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
        
        // Select the first step by default if not adding/editing a step
        if (processSteps.length > 0 && !isAddingNewStep && !editingStep) {
          activeStepId = processSteps[0]?.id ?? null;
        } else if (processSteps.length === 0) {
          // If no steps exist, prepare for first entry
          isAddingNewStep = true;
        }
      } catch (err) {
        // Type the error properly
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('Error fetching process steps:', errorMessage);
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
  
    // Instead of updating steps one by one
    async function renumberSteps() {
      try {
        // Update step numbers locally first
        processSteps = processSteps.map((step, index) => ({
          ...step,
          step_number: index + 1
        }));
        
        // Prepare batch update
        const updates = processSteps.map(step => ({
          id: step.id,
          step_number: step.step_number
        }));
        
        // Send a single batch update
        const { error } = await supabase.rpc('update_step_numbers', { updates });
        
        if (error) throw error;
      } catch (err) {
        console.error('Error renumbering steps:', err);
        error = 'Failed to renumber steps';
      }
    }
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
      if (!step) {
        error = 'Invalid step data';
        return false;
      }
      
      if (!step.name?.trim()) {
        error = 'Step name is required';
        return false;
      }
      
      if (!step.responsible?.trim()) {
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
    // When loading steps, select the first one
    $: if (processSteps.length > 0 && !activeStepId && !isAddingNewStep && !editingStep) {
      activeStepId = processSteps[0]?.id ?? null;
    }

    // Update filtered steps when search changes and maintain active selection
    $: {
      filterSteps();
      sortSteps();
      // If active step is filtered out, select first visible step
      if (activeStepId && !filteredSteps.some(step => step.id === activeStepId)) {
        activeStepId = filteredSteps.length > 0 ? filteredSteps[0]?.id ?? null : null;
      }
    }

    // Instead of recalculating on every change
    let prevSearchQuery = '';
    let prevSortCriteria = '';
    $: {
      if (searchQuery !== prevSearchQuery) {
        prevSearchQuery = searchQuery;
        filterSteps();
      }
      if (sortCriteria !== prevSortCriteria) {
        prevSortCriteria = sortCriteria;
        sortSteps();
      }
    }
  </script>
  
{#if session === undefined}
  <div class="loading-container">
    <div class="loading-spinner"></div>
    <p>Loading...</p>
  </div>
{:else if session}
  <div class="process-map-container" on:keydown={handleKeyDown} role="region" aria-label="Process Map Editor">
    <header class="process-map-header">
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
      <div class="process-map-layout">
        <!-- Step tabs sidebar -->
        <div class="step-tabs">
          <!-- Your existing step-tabs code... -->
          {#if filteredSteps.length === 0 && !isAddingNewStep}
            <p class="empty-state">No process steps defined yet.</p>
          {:else}
            <ul>
              <!-- Step list items -->
              {#each filteredSteps as step (step.id)}
              <li 
                class:active={activeStepId === step?.id}
                class:has-issues={step?.issues?.length > 0}
                class:high-priority={step?.issues?.some(issue => issue?.severity === 'high' && issue?.status !== 'resolved')}
                on:click={() => {
                  if (step?.id) activeStepId = step.id;
                  isAddingNewStep = false;
                }}
              >
                <!-- Make the step name take full width -->
                <span class="step-tab-name">{step.name}</span>
              </li>
            {/each}            
              <!-- "Add step" tab at the bottom of the list -->
              <li class="add-step-tab" on:click={() => {
                isAddingNewStep = true;
                newStep.step_number = processSteps.length + 1;
                activeStepId = null;
              }}>
                <span class="add-icon">+</span>
                <span>Add New Step</span>
              </li>
            </ul>
          {/if}
        </div>
        
        <!-- Add this content area -->
        <div class="step-content">
          {#if isAddingNewStep}
            <!-- New step form -->
            <div class="step-document new-step">
              <h2>Add New Process Step</h2>
              
              <form on:submit|preventDefault={saveNewStep}>
                <div class="form-section">
                  <label for="stepName">Step Name</label>
                  <input type="text" id="stepName" bind:value={newStep.name} placeholder="Enter step name" required />
                </div>
                
                <div class="form-section">
                  <label for="stepDescription">Description</label>
                  <textarea id="stepDescription" bind:value={newStep.description} placeholder="Describe this process step"></textarea>
                </div>
                
                <div class="form-section">
                  <label for="stepResponsible">Responsible Party</label>
                  <select id="stepResponsible" bind:value={newStep.responsible} required>
                    <option value="">Select responsible party</option>
                    {#each responsibleParties as party}
                      <option value={party}>{party}</option>
                    {/each}
                  </select>
                </div>
                
                <div class="form-section">
                  <label>Issues</label>
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
                
                <div class="form-section">
                  <label for="stepNotes">Notes</label>
                  <textarea id="stepNotes" bind:value={newStep.notes} placeholder="Additional notes"></textarea>
                </div>
                
                <div class="form-actions">
                  <button type="button" class="cancel-button" on:click={cancelAddNew}>
                    Cancel
                  </button>
                  <button type="submit" class="save-button">
                    Save New Step
                  </button>
                </div>
              </form>
            </div>
          {:else if editingStep}
            <!-- Edit step form -->
            <div class="step-document editing">
              <h2>Edit Process Step</h2>
              
              <form on:submit|preventDefault={updateStep}>
                <div class="form-section">
                  <label for="editStepName">Step Name</label>
                  <input type="text" id="editStepName" bind:value={editingStep.name} placeholder="Enter step name" required />
                </div>
                
                <div class="form-section">
                  <label for="editStepDescription">Description</label>
                  <textarea id="editStepDescription" bind:value={editingStep.description} placeholder="Describe this process step"></textarea>
                </div>
                
                <div class="form-section">
                  <label for="editStepResponsible">Responsible Party</label>
                  <select id="editStepResponsible" bind:value={editingStep.responsible} required>
                    <option value="">Select responsible party</option>
                    {#each responsibleParties as party}
                      <option value={party}>{party}</option>
                    {/each}
                  </select>
                </div>
                
                <div class="form-section">
                  <label>Issues</label>
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
                            on:click={() => {
                              if (editingStep) {
                                editingStep.issues = editingStep.issues.filter((_, idx) => idx !== i);
                              }
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
                    <button type="button" class="add-issue-btn" on:click={addIssueToStep}>
                      + Add Issue
                    </button>
                  </div>
                </div>
                
                <div class="form-section">
                  <label for="editStepNotes">Notes</label>
                  <textarea id="editStepNotes" bind:value={editingStep.notes} placeholder="Additional notes"></textarea>
                </div>
                
                <div class="form-actions">
                  <button type="button" class="action-button cancel" on:click={cancelEdit}>
                    Cancel
                  </button>
                  <button type="submit" class="action-button save">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          {:else if activeStepId}
            <!-- View step details -->
            {#each processSteps.filter(step => step.id === activeStepId) as activeStep}
              <div class="step-document viewing">
                <div class="document-header">
                  <!-- Optionally include step number in title -->
                  <h2><!-- {activeStep.step_number}: -->{activeStep.name}</h2>
                  <div class="step-actions">
                    <button class="action-button edit" on:click={() => editStep(activeStep)}>Edit</button>
                    <button class="action-button delete" on:click={() => activeStep.id && deleteStep(activeStep.id)}>Delete</button>
                    <button class="action-button duplicate" on:click={() => duplicateStep(activeStep)}>Copy</button>
                  </div>
                </div>
                
                <div class="document-section">
                  <h3>Description</h3>
                  <p>{activeStep.description || 'No description provided'}</p>
                </div>
                
                <div class="document-section">
                  <h3>Responsible Party</h3>
                  <p>{activeStep.responsible || 'Not assigned'}</p>
                </div>
                
                <div class="document-section">
                  <h3>Issues</h3>
                  {#if activeStep.issues.length === 0}
                    <p class="no-issues">No issues reported</p>
                  {:else}
                    <div class="issues-list">
                      {#each activeStep.issues as issue, i}
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
                
                <div class="document-section">
                  <h3>Notes</h3>
                  <p>{activeStep.notes || 'No additional notes'}</p>
                </div>
                
                <div class="document-footer">
                  <div class="step-move-controls">
                    <button 
                      class="action-button move-up" 
                      on:click={() => activeStep.id && moveStep(activeStep.id, 'up')}
                      disabled={activeStep.step_number <= 1}
                    >
                      Move Up
                    </button>
                    <button 
                      class="action-button move-down" 
                      on:click={() => activeStep.id && moveStep(activeStep.id, 'down')}
                      disabled={activeStep.step_number >= processSteps.length}
                    >
                      Move Down
                    </button>
                  </div>
                </div>
              </div>
            {:else}
              <!-- If activeStepId is set but step not found -->
              <div class="no-selection">
                <p>Selected step not found. It may have been deleted.</p>
              </div>
            {/each}
          {:else}
            <!-- Nothing selected state -->
            <div class="no-selection">
              <p>Select a step from the left to view details or add a new step.</p>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{:else}
  <div class="not-authenticated">
    <p>Please log in to access the Process Map.</p>
    <a href="/login" class="login-button">Go to Login</a>
  </div>
{/if}
  
<style>
  :root {
    --apple-blue: #0071e3;
    --apple-red: #ff3b30;
    --apple-green: #34c759;
    --apple-orange: #ff9500;
    --apple-gray-1: #f5f5f7;
    --apple-gray-2: #e8e8ed;
    --apple-gray-3: #d2d2d7;
    --apple-text: #1d1d1f;
    --apple-text-secondary: #86868b;
  }

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
  width: 20px;
  height: 20px;
  border: 2px solid rgba(0, 113, 227, 0.15);
  border-radius: 50%;
  border-top-color: var(--apple-blue);
  animation: spin 0.8s linear infinite;
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

  .empty-state {
    text-align: center;
    padding: 48px 0;
    color: #86868b;
    font-style: italic;
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
  background-color: #f5f5f7;
  padding: 16px;
  margin-bottom: 12px;
  border-radius: 8px;
  border-left: 3px solid transparent;
}

.issue-display.resolved {
  opacity: 0.7;
  background-color: #f8f8f8;
}

.issue-text {
  margin-top: 12px;
  white-space: pre-wrap;
}

  .issue-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .issue-badge.high {
    background-color: rgba(255, 59, 48, 0.1); /* More subtle */
    color: #ff3b30; /* Apple red */
  }

  .issue-badge.medium {
    background-color: rgba(255, 149, 0, 0.1);
    color: #ff9500; /* Apple orange */
  }

  .issue-badge.low {
    background-color: rgba(52, 199, 89, 0.1);
    color: #34c759; /* Apple green */
  }

  .issue-status {
    font-size: 11px;
    font-weight: 500;
    color: #86868b; /* Apple gray */
    text-transform: capitalize;
  }

  .issue-header-row {
    display: flex;
    width: 100%;
    justify-content: space-between;
    align-items: center;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes highlight {
    0% { background-color: rgba(0, 113, 227, 0.15); }
    100% { background-color: #f0f7ff; }
  }

  /* Issue form editor */
  .issue-item {
    border: none;
    background-color: #f5f5f7;
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 10px;
  }

  .issue-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .issue-header span {
    font-size: 13px;
    font-weight: 500;
    color: #1d1d1f;
  }

  .add-issue-btn {
    background-color: transparent;
    color: #0071e3; /* Apple blue */
    border: 1px dashed #d1d1d6;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 500;
    width: 100%;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  /* Two-column layout - KEEP THESE */
  .process-map-layout {
    display: flex;
    gap: 16px; /* Apple uses tighter gaps */
    margin-top: 24px;
    height: calc(100vh - 220px);
    min-height: 500px;
  }

  /* Step tabs sidebar */
  .step-tabs {
    width: 250px;
    flex-shrink: 0;
    background: #f5f5f7;
    border-radius: 10px; /* Apple uses more consistent rounding now */
    overflow-y: auto;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); /* More subtle shadows */
    border: 1px solid rgba(0, 0, 0, 0.05); /* Very subtle border */
  }

  .step-tabs ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  /* Apple-style list items */
  .step-tabs li {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  position: relative;
  transition: all 0.2s ease;
  cursor: pointer; /* Explicitly set cursor to pointer */
}

.step-tabs li + li {
  border-top: 1px solid rgba(255, 255, 255, 0.7);
}

  /* Apple-style active states */
  .step-tabs li.active {
    background-color: rgba(0, 113, 227, 0.1); /* More subtle blue */
    color: #0071e3; /* Apple blue */
    font-weight: 500;
    border-left: 3px solid #0071e3;
  }

  /* More subtle hover states */
  .step-tabs li:hover:not(.active) {
    background-color: rgba(0, 0, 0, 0.02);
  }

  /* Issues indicators */
  .step-tabs li.has-issues {
    border-left: 3px solid #0087d0; 
  }

  .step-tabs li.high-priority {
    border-left: 3px solid #ff3b30; /* Apple red */
  }

  .step-tab-name {
  position: relative;
  flex: 1;
  white-space: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.3;
  font-size: 13px;
  padding-left: 4px;
  cursor: pointer; /* Change cursor to pointer */
  user-select: none; /* Prevent text selection */
  -webkit-user-select: none; /* For Safari */
  -moz-user-select: none; /* For Firefox */
  -ms-user-select: none; /* For older versions of Edge */
}

  .add-step-tab {
    color: #0071e3;
    font-weight: 500;
    border-left: none !important;
  }

  .add-icon {
    margin-right: 8px;
    font-weight: 500;
    font-size: 16px;
  }

  .step-content {
    flex: 1;
    overflow-y: auto;
    background: white;
    border-radius: 10px; /* Apple uses more consistent rounding now */
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); /* More subtle shadows */
    border: 1px solid rgba(0, 0, 0, 0.05); /* Very subtle border */
  }

  .step-document {
    padding: 24px;
    max-width: 800px; /* Limit width for better readability */
    margin: 0 auto;
    animation: fadeIn 0.3s ease;
  }

  .document-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e5e5e5;
  }

  .document-header h2 {
  margin: 0;
  font-size: 30px; /* Reduced from 2.2rem which was too large */
  color: #1d1d1f;
  font-weight: 500;
}

  .document-section {
    margin-bottom: 22px;
  }

  .document-section + .document-section {
  margin-top: 24px;
}

  .document-section h3 {
    font-size: 15px;
    font-weight: 500;
    color: #1d1d1f;
    margin-bottom: 10px;
  }

  .document-section p {
    font-size: 14px;
    line-height: 1.5;
    color: #424245;
  }

  .document-footer {
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid #e5e5e5;
  }

  /* Form sections */
  .form-section {
    margin-bottom: 20px;
  }

  .form-section label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: #1d1d1f;
  }

  .form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid #e5e5e5;
}

  /* No selection state */
  .no-selection {
    display: flex;
    height: 100%;
    align-items: center;
    justify-content: center;
    color: #86868b;
    text-align: center;
    padding: 24px;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .process-map-layout {
      flex-direction: column;
      height: auto;
      min-height: 0;
    }
    
    .step-tabs {
      width: 100%;
      max-height: 250px;
    }
    
    .document-header {
      flex-direction: column;
      align-items: flex-start;
    }
    
    .document-header h2 {
      margin-bottom: 16px;
    }
    
    .step-actions {
      width: 100%;
      display: flex;
      gap: 8px;
      justify-content: flex-start;
    }
    
    .form-actions {
      flex-direction: column;
    }
    
    .form-actions button {
      width: 100%;
    }
  }
  /* Print styles */
  @media print {
    .step-actions,.error-banner, .step-tabs {
      display: none;
    }
    
    .process-map-container {
      padding: 0;
    }
    
    .step-document {
      page-break-inside: avoid;
    }
    
    .process-map-layout {
      display: block;
    }
  }

  /* Standardize all buttons with Apple's SF Pro aesthetic */
  button {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-weight: 500;
    transition: all 0.2s ease;
    border: none;
    border-radius: 6px; /* Apple uses more subtle rounding in SF Symbols and macOS */
  }

  /* Primary buttons (Save, Add, etc) */
  .action-button.save, .save-button {
    background-color: #0071e3; /* Apple's signature blue */
    color: white;
    padding: 8px 16px;
    font-size: 13px;
    border-radius: 6px;
  }

  /* Secondary buttons (Cancel, Edit) */
  .action-button.cancel, .cancel-button {
    background-color: #f5f5f7; /* Apple's light gray */
    color: #1d1d1f;
    padding: 8px 16px;
    font-size: 13px;
    border-radius: 6px;
  }

  /* Other action buttons */
  .action-button.edit, .action-button.duplicate {
    background-color: #f5f5f7;
    color: #1d1d1f;
    padding: 6px 14px;
    font-size: 13px;
    border-radius: 6px;
  }

  /* Danger button */
  .action-button.delete {
    background-color: #fff1f0; /* Lighter red background */
    color: #ff3b30; /* Apple red */
    padding: 6px 14px;
    font-size: 13px;
    border-radius: 6px;
  }

  /* Movement buttons */
  .action-button.move-up, .action-button.move-down {
    background-color: #f5f5f7;
    color: #1d1d1f;
    padding: 6px 12px;
    font-size: 13px;
    border-radius: 6px;
  }

  .action-button.move-up:disabled, .action-button.move-down:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Form controls with Apple-like styling */
  input, select, textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #d2d2d7; /* Apple's border color */
    border-radius: 6px;
    font-size: 14px;
    color: #1d1d1f;
    background-color: #ffffff;
    transition: all 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  }

  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: #0071e3;
    box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.15); /* Apple's focus ring effect */
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  /* Apple-style labels */
  label {
    font-size: 13px;
    font-weight: 500;
    color: #1d1d1f;
    margin-bottom: 6px;
    display: block;
  }

  /* Dropdown styling */
  select {
    appearance: none;
    background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2212%22%20height%3D%227%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M%201%201%20l%205%205%20l%205%20-5%22%20stroke%3D%22%23666%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    padding-right: 30px;
  }

  /* Apple-style cards and containers */
  .step-tabs, .step-content, .issue-display, .issue-item {
    border-radius: 10px; /* Apple uses more consistent rounding now */
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); /* More subtle shadows */
    border: 1px solid rgba(0, 0, 0, 0.05); /* Very subtle border */
  }

  .process-map-layout {
    gap: 16px; /* Apple uses tighter gaps */
  }

  .step-document {
    padding: 24px;
    max-width: 800px; /* Limit width for better readability */
    margin: 0 auto;
  }

  .document-section {
    margin-bottom: 22px;
  }

  .document-section h3 {
  font-size: 15px;
  font-weight: 600; /* Slightly bolder */
  color: #1d1d1f;
  margin-bottom: 8px;
  position: relative;
  padding-bottom: 8px;
}

.document-section h3::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  width: 32px;
  height: 2px;
  background-color: #e5e5e5;
}

  .document-section p {
    font-size: 14px;
    line-height: 1.5;
    color: #424245;
  }

  /* Global typography */
  * {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif;
  }

  /* Headings */
  h1 {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 28px;
    font-weight: 600;
    color: #1d1d1f;
    letter-spacing: -0.015em;
    line-height: 1.2;
  }

  h2 {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 22px;
    font-weight: 600;
    color: #1d1d1f;
    letter-spacing: -0.01em;
  }

  h3 {
    font-size: 17px;
    font-weight: 600;
    color: #1d1d1f;
  }

  p {
    font-size: 14px;
    line-height: 1.5;
    color: #424245;
  }

  /* Subtle animations */
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Apply animations to key elements */
  .step-document {
    animation: fadeIn 0.3s ease;
  }

  /* Form field focus effect */
  input:focus, textarea:focus, select:focus {
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  /* Button press effect */
  button:active {
    transform: scale(0.98);
  }
</style>