<script context="module" lang="ts">
  export type NoteData = {
    title: string;
    rootCause: string;
    details: string;
    actionPlan: string;
    comments: string[];
  };
</script>

<script lang="ts">
  import { createEventDispatcher } from "svelte";
  
  // Props:
  export let noteData: NoteData;
  // Mode can be "edit" or "view" (default "edit")
  export let mode: "edit" | "view" = "edit";
  // Optional user photo URL for view mode; if not provided or fails to load, fallback is used.
  export let userPhotoUrl: string = "";
  
  // Fallback silhouette image URL. Update this path as needed.
  const defaultPhoto = "/default-silhouette.png";

  const dispatch = createEventDispatcher();

  // Local editable copy of the note.
  let editedNote: NoteData = { ...noteData };
  
  // For view mode, local comment input
  let newComment = "";

  // Update local copy if noteData changes.
  $: if (noteData) {
    editedNote = { ...noteData };
  }

  function handleSave() {
    dispatch("updateNote", { updatedNote: editedNote });
  }

  function closePanel() {
    dispatch("close");
  }

  function addComment() {
    if (newComment.trim()) {
      editedNote.comments = [...editedNote.comments, newComment.trim()];
      newComment = "";
      dispatch("updateNote", { updatedNote: editedNote });
    }
  }
</script>

<div class="side-panel">
  <div class="panel-header">
    {#if mode === "edit"}
      <h2>Edit Metrics Note</h2>
    {:else}
      <h2>Review Metrics Note</h2>
    {/if}
    <button class="close-btn" on:click={closePanel} aria-label="Close">×</button>
  </div>

  {#if mode === "edit"}
    <div class="panel-content">
      <div class="field-group">
        <label for="note-title">Title:</label>
        <input id="note-title" type="text" bind:value={editedNote.title} />
      </div>
      <div class="field-group">
        <label for="note-rootCause">Root Cause:</label>
        <input id="note-rootCause" type="text" bind:value={editedNote.rootCause} />
      </div>
      <div class="field-group">
        <label for="note-details">Details:</label>
        <textarea id="note-details" bind:value={editedNote.details}></textarea>
      </div>
      <div class="field-group">
        <label for="note-actionPlan">Action Plan:</label>
        <textarea id="note-actionPlan" bind:value={editedNote.actionPlan}></textarea>
      </div>
    </div>
    <div class="panel-footer">
      <button class="save-btn" on:click={handleSave}>Save</button>
      <button class="cancel-btn" on:click={closePanel}>Cancel</button>
    </div>
  {:else}
    <!-- View Mode -->
    <div class="panel-content view-mode">
      <div class="note-display">
        <div class="note-header">
          <h3>{editedNote.title}</h3>
          <img 
            src={userPhotoUrl || defaultPhoto} 
            alt="User Photo" 
            class="user-photo" 
            on:error={(e) => e.currentTarget.src = defaultPhoto} />
        </div>
        <p><strong>Root Cause:</strong> {editedNote.rootCause}</p>
        <p><strong>Details:</strong></p>
        <div class="note-text">{editedNote.details}</div>
        <p><strong>Action Plan:</strong></p>
        <div class="note-text">{editedNote.actionPlan}</div>
      </div>
      <div class="comments-section">
        <h3>Comments</h3>
        {#if editedNote.comments.length > 0}
          <ul class="comments-list">
            {#each editedNote.comments as comment}
              <li>{comment}</li>
            {/each}
          </ul>
        {:else}
          <p>No comments yet.</p>
        {/if}
        <div class="add-comment-group">
          <input type="text" bind:value={newComment} placeholder="Add a comment..." />
          <button class="add-comment-btn" on:click={addComment}>Add Comment</button>
        </div>
      </div>
    </div>
    <div class="panel-footer view-mode-footer">
      <button class="close-btn" on:click={closePanel}>Close</button>
    </div>
  {/if}
</div>

<style>
  .side-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: 33%;
    min-width: 300px;
    height: 100%;
    background: #fff;
    box-shadow: -4px 0 8px rgba(0, 0, 0, 0.2);
    padding: 16px;
    z-index: 1100;
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #ddd;
    padding-bottom: 8px;
    margin-bottom: 8px;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 1.2em;
    color: #004225;
  }

  .close-btn {
    background: transparent;
    border: none;
    font-size: 1.5em;
    cursor: pointer;
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    margin-top: 16px;
  }

  .field-group {
    margin-bottom: 12px;
  }

  .field-group label {
    display: block;
    font-weight: bold;
    margin-bottom: 4px;
    font-size: 0.9em;
  }

  .field-group input,
  .field-group textarea {
    width: 100%;
    padding: 6px;
    font-size: 0.9em;
    border: 1px solid #ddd;
    border-radius: 4px;
  }

  /* Triple default height for Details and Action Plan textareas */
  #note-details,
  #note-actionPlan {
    min-height: 140px;
  }

  /* Styles for view mode */
  .view-mode .note-display {
    margin-bottom: 16px;
  }
  .view-mode .note-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .user-photo {
    width: 50px;
    height: 50px;
    object-fit: cover;
    border-radius: 50%;
    margin-left: 8px;
    border: 1px solid #ddd;
  }
  .view-mode .note-text {
    background-color: #F5F7FA;
    padding: 8px;
    border: 1px solid #E5E7EB;
    border-radius: 4px;
    margin-bottom: 12px;
  }
  .comments-section h3 {
    margin-bottom: 8px;
  }
  .comments-list {
    list-style: none;
    padding: 0;
    margin: 0 0 8px;
  }
  .comments-list li {
    padding: 4px 8px;
    border-bottom: 1px solid #eee;
  }
  .add-comment-group {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  .add-comment-group input {
    flex: 1;
    padding: 6px;
    font-size: 0.9em;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  .add-comment-btn {
    background-color: #004225;
    color: #fff;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9em;
  }
  .panel-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    border-top: 1px solid #ddd;
    padding-top: 8px;
  }
  .save-btn, .cancel-btn, .close-btn {
    background-color: #004225;
    color: #fff;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9em;
  }
  .cancel-btn {
    background-color: #aaa;
  }
  .save-btn:hover, .cancel-btn:hover, .close-btn:hover, .add-comment-btn:hover {
    opacity: 0.9;
  }
  /* Optional: additional footer style for view mode */
  .view-mode-footer {
    justify-content: flex-end;
  }
</style>