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
  const dispatch = createEventDispatcher();

  let title = "";
  let category = "";
  let submitted_by = "";
  let brief_description = "";
  let submitting = false;

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

<div class="overlay" on:click={handleClose} role="button" tabindex="0" on:keydown={handleKeyDown}>
  <div class="new-project-panel" role="dialog" aria-modal="true" on:click|stopPropagation>
    <button class="close-button" on:click={handleClose} aria-label="Close">×</button>
    <h2>Submit New Idea</h2>
    <form on:submit|preventDefault={handleSubmit}>
      <label>
        Title:
        <input type="text" bind:value={title} required />
      </label>
      <label>
        Category:
        <select bind:value={category} required>
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
      </label>
      <label>
        Submitted By:
        <input type="text" bind:value={submitted_by} required />
      </label>
      <label>
        Brief Description:
        <textarea bind:value={brief_description} required></textarea>
      </label>
      <div class="form-buttons">
        <button type="submit" disabled={submitting}>Submit</button>
        <button type="button" on:click={handleClose}>Cancel</button>
      </div>
    </form>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    justify-content: flex-end;
    z-index: 1000;
  }
  
  .new-project-panel {
    background: #fff;
    width: 33%;
    min-width: 300px;
    height: 100%;
    padding: 16px;
    overflow-y: auto;
    box-shadow: -4px 0 8px rgba(0, 0, 0, 0.2);
    position: relative;
    font-size: 0.9em;
  }
  
  .close-button {
    position: absolute;
    top: 8px;
    right: 8px;
    font-size: 2em;
    background: none;
    border: none;
    cursor: pointer;
  }
  
  form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 24px;
  }
  
  label {
    display: flex;
    flex-direction: column;
    font-size: 0.9em;
  }
  
  input[type="text"],
  select,
  textarea {
    padding: 6px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .form-buttons {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  
  button[type="submit"] {
    background: #004225;
    color: #fff;
    border: none;
    padding: 8px;
    border-radius: 4px;
    cursor: pointer;
  }
  
  button[type="button"] {
    background: #ccc;
    color: #333;
    border: none;
    padding: 8px;
    border-radius: 4px;
    cursor: pointer;
  }
</style>