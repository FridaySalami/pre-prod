<script context="module" lang="ts">
  export type Project = {
    id: string;
    title: string;
    category: string;
    submitted_by: string;
    brief_description: string;
    detailed_description?: string;
    status: 'new' | 'under_review' | 'in_progress' | 'completed';
    deadline?: string;
    owner?: string;
    thumbs_up_count?: number;
    created_at: string;
    updated_at: string;
  };

  export type Comment = {
    id?: number;
    project_id: string;
    comment: string;
    created_by: string;
    created_at?: string;
  };
</script>

<script lang="ts">
  import { createEventDispatcher } from "svelte";
  export let project: Project;
  export let comments: Comment[] = [];

  const dispatch = createEventDispatcher();

  let editMode = false;

  // Local editable copies for project fields.
  let editedTitle = "";
  let editedCategory = "";
  let editedBrief = "";
  let editedDetailed = "";
  let editedDeadline = "";
  let editedOwner = "";

  let newComment = "";

  function enterEditMode() {
    editMode = true;
    editedTitle = project.title;
    editedCategory = project.category;
    editedBrief = project.brief_description;
    editedDetailed = project.detailed_description || "";
    editedDeadline = project.deadline ? project.deadline.split("T")[0] : "";
    editedOwner = project.owner || "";
  }

  function cancelEditMode() {
    editMode = false;
  }

  function handleSave() {
    const updatedProject = {
      ...project,
      title: editedTitle,
      category: editedCategory,
      brief_description: editedBrief,
      detailed_description: editedDetailed,
      deadline: editedDeadline,
      owner: editedOwner,
      updated_at: new Date().toISOString()
    };
    console.log("Dispatching update:", updatedProject);
    dispatch("update", { updatedProject });
    editMode = false;
  }

  function handleClose() {
    dispatch("close");
  }

  function handleThumbsUp() {
    dispatch("thumbsUp", { projectId: project.id });
  }

  function handleDelete() {
    if (confirm("Are you sure you want to delete this submission?")) {
      dispatch("delete", { projectId: project.id });
    }
  }

  function handleAddComment() {
    if (newComment.trim()) {
      dispatch("addComment", { projectId: project.id, comment: newComment.trim() });
      newComment = "";
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      handleClose();
    }
  }
</script>

<div class="overlay" on:click={handleClose} role="presentation" on:keydown={handleKeyDown}>
  <div class="detail-panel" role="dialog" aria-modal="true" on:click|stopPropagation>
    <div class="panel-header">
      {#if !editMode}
        <h2>{project.title}</h2>
        <button class="action-button edit-button" on:click={enterEditMode}>Edit</button>
      {:else}
        <h2>Edit Submission</h2>
        <div class="edit-actions">
          <button class="action-button save-button" on:click={handleSave}>Save</button>
          <button class="action-button cancel-button" on:click={cancelEditMode}>Cancel</button>
        </div>
      {/if}
      <button class="action-button close-button" on:click={handleClose} aria-label="Close">×</button>
    </div>

    <div class="project-info">
      <div class="field-group">
        {#if !editMode}
          <strong>Title:</strong>
          <p class="field-value read-only">{project.title}</p>
        {:else}
          <label for="title-input">Title:</label>
          <input id="title-input" type="text" bind:value={editedTitle} />
        {/if}
      </div>

      <div class="field-group">
        {#if !editMode}
          <strong>Category:</strong>
          <p class="field-value read-only">{project.category}</p>
        {:else}
          <label for="category-select">Category:</label>
          <select id="category-select" bind:value={editedCategory}>
            <option value="5S & Organization">5S & Organization</option>
            <option value="Inventory Accuracy & Cycle Counting">Inventory Accuracy & Cycle Counting</option>
            <option value="Equipment Maintenance & Reliability">Equipment Maintenance & Reliability</option>
            <option value="Layout & Space Optimization">Layout & Space Optimization</option>
            <option value="Safety & Ergonomics">Safety & Ergonomics</option>
            <option value="Process Efficiency & Workflow">Process Efficiency & Workflow</option>
            <option value="Quality Improvement">Quality Improvement</option>
            <option value="Technology & Automation">Technology & Automation</option>
          </select>
        {/if}
      </div>

      <div class="field-group">
        <strong>Submitted By:</strong>
        <p class="field-value read-only">{project.submitted_by}</p>
      </div>

      <div class="field-group">
        {#if !editMode}
          <strong>Brief Description:</strong>
          <p class="field-value read-only">{project.brief_description}</p>
        {:else}
          <label for="brief-textarea">Brief Description:</label>
          <textarea id="brief-textarea" bind:value={editedBrief}></textarea>
        {/if}
      </div>

      <div class="field-group">
        {#if !editMode}
          <strong>Detailed Description:</strong>
          <p class="field-value read-only">{project.detailed_description || "N/A"}</p>
        {:else}
          <label for="detailed-textarea">Detailed Description:</label>
          <textarea id="detailed-textarea" bind:value={editedDetailed}></textarea>
        {/if}
      </div>

      <div class="field-group">
        {#if !editMode}
          <strong>Due Date:</strong>
          <p class="field-value read-only">
            {project.deadline ? project.deadline.split("T")[0] : "N/A"}
          </p>
        {:else}
          <label for="due-date">Due Date:</label>
          <input id="due-date" type="date" bind:value={editedDeadline} />
        {/if}
      </div>

      <div class="field-group">
        {#if !editMode}
          <strong>Owner:</strong>
          <p class="field-value read-only">{project.owner || "N/A"}</p>
        {:else}
          <label for="owner-input">Owner:</label>
          <input id="owner-input" type="text" bind:value={editedOwner} />
        {/if}
      </div>
    </div>

    <div class="reactions-comments">
      <div class="reactions">
        <button class="action-button thumbs-up-button" on:click={handleThumbsUp}>👍 +1</button>
        <span class="thumbs-up-count">{project.thumbs_up_count || 0}</span>
      </div>

      <div class="comments-section">
        <h3>Comments</h3>
        {#if comments.length > 0}
          <ul>
            {#each comments as comment (comment.id)}
              <li>{comment.comment} – <em>{comment.created_by}</em></li>
            {/each}
          </ul>
        {:else}
          <p>No comments yet.</p>
        {/if}
        <div class="new-comment">
          <input type="text" placeholder="Add a comment..." bind:value={newComment} />
          <button class="action-button" on:click={handleAddComment}>Add</button>
        </div>
      </div>
    </div>
    
    <div class="delete-section">
      <button class="action-button delete-button" on:click={handleDelete} type="button">Delete Submission</button>
    </div>
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

  .detail-panel {
    background: #fff;
    width: 33%;
    min-width: 300px;
    height: 100%;
    padding: 4px;
    overflow-y: auto;
    box-shadow: -4px 0 8px rgba(0, 0, 0, 0.2);
    position: relative;
    font-size: 0.85em;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #ccc;
    padding: 2px 4px;
    margin-bottom: 4px;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 1.1em;
  }

  .action-button {
    background-color: #004225;
    color: #fff;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9em;
  }
  
  .action-button:hover {
    opacity: 0.9;
  }
  
  .edit-actions {
    display: flex;
    gap: 4px;
  }

  .close-button {
    font-size: 1.3em;
  }

  .project-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    margin-bottom: 2px;
  }

  .field-group label {
    font-weight: bold;
    margin-bottom: 1px;
    font-size: 0.9em;
  }

  .field-value {
    padding: 2px 4px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: inherit;
  }

  .read-only {
    opacity: 1;
    color: #000;
    background: #fff;
    border: 1px solid #ddd;
  }

  input[type="text"],
  input[type="date"],
  select,
  textarea {
    padding: 2px 4px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.85em;
  }

  .reactions-comments {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 4px;
  }

  .reactions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .thumbs-up-button {
    padding: 2px 4px;
    font-size: 0.85em;
  }

  .thumbs-up-count {
    font-weight: bold;
  }

  .comments-section {
    margin-top: 2px;
  }

  .comments-section ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .comments-section li {
    border-bottom: 1px solid #ddd;
    padding: 2px 0;
    font-size: 0.8em;
  }

  .new-comment {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }

  .new-comment input {
    flex: 1;
    padding: 2px 4px;
    font-size: 0.85em;
    border: 1px solid #ddd;
    border-radius: 4px;
  }

  .delete-section {
    margin-top: 2px;
    text-align: center;
  }

  .delete-button {
    padding: 4px 8px;
    font-size: 0.85em;
  }
</style>