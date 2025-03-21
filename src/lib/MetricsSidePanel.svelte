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
  // Mode can be "edit" or "view" (default "view" now instead of "edit")
  export let mode: "edit" | "view" = "view";
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
    // Switch back to view mode after saving
    mode = "view";
  }

  function switchToEditMode() {
    mode = "edit";
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
  
  // Error handler for user photo image
  function handleImageError(e: Event) {
    (e.currentTarget as HTMLImageElement).src = defaultPhoto;
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
          <div class="header-right">
            <button class="edit-btn" on:click={switchToEditMode} aria-label="Edit">
              <i class="material-icons">edit</i>
            </button>
            <img 
              src={userPhotoUrl || defaultPhoto} 
              alt=""
              class="user-photo" 
              on:error={handleImageError} />
          </div>
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
    min-width: 360px; /* Slightly increased for better layout */
    height: 100%;
    background: #fff;
    box-shadow: -2px 0 20px rgba(0, 0, 0, 0.1); /* More subtle shadow */
    z-index: 1100;
    display: flex;
    flex-direction: column;
    border-left: 1px solid #E5E7EB; /* Consistent border color */
    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #E5E7EB; /* Consistent border color */
    padding: 16px 20px; /* More padding */
    height: 64px; /* Match header height */
    background: linear-gradient(90deg, #004225 0%, #006644 100%); /* Match header gradient */
    color: white;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 1.1em;
    font-weight: 500; /* Medium weight instead of bold */
    color: white;
    letter-spacing: -0.01em; /* Apple-like letter spacing */
  }

  .close-btn {
    background: transparent;
    border: none;
    font-size: 1.25em;
    color: white;
    cursor: pointer;
    width: 55px; /* New width to avoid bleeding */
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.2s ease;
  }

  .close-btn:hover {
    background-color: rgba(255, 255, 255, 0.15);
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .field-group {
    margin-bottom: 16px; /* Increased from 12px */
  }

  .field-group label {
    display: block;
    font-weight: 500; /* Medium weight instead of bold */
    margin-bottom: 6px; /* Increased from 4px */
    font-size: 0.85em;
    color: #4B5563; /* More subtle label color */
  }

  .field-group input,
  .field-group textarea,
  .add-comment-group input {
    width: 100%;
    padding: 10px 12px; /* Increased padding */
    font-size: 0.9em;
    border: 1px solid #E5E7EB; /* Lighter border */
    border-radius: 6px; /* More rounded corners */
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    background-color: #F9FAFB; /* Subtle background */
    color: #1F2937; /* Darker text for better contrast */
  }

  .field-group input:focus,
  .field-group textarea:focus,
  .add-comment-group input:focus {
    outline: none;
    border-color: #35b07b; /* Brand green */
    box-shadow: 0 0 0 3px rgba(53, 176, 123, 0.15); /* Subtle focus ring */
  }

  /* Triple default height for Details and Action Plan textareas */
  #note-details,
  #note-actionPlan {
    min-height: 120px;
    line-height: 1.5;
  }

  /* Styles for view mode */
  .view-mode .note-display {
    margin-bottom: 24px; /* Increased from 16px */
    border-bottom: 1px solid #F3F4F6; /* Subtle divider */
    padding-bottom: 16px;
  }
  
  .view-mode .note-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px; /* Added margin */
  }
  
  .view-mode .note-header h3 {
    font-size: 1.1em;
    font-weight: 500; /* Medium weight instead of bold */
    color: #1F2937;
    margin: 0;
    letter-spacing: -0.01em; /* Apple-like spacing */
  }
  
  .user-photo {
    width: 40px; /* Slightly smaller */
    height: 40px;
    object-fit: cover;
    border-radius: 50%;
    margin-left: 8px;
    border: 1px solid #E5E7EB; /* Lighter border */
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); /* Subtle shadow */
  }
  
  .view-mode p {
    margin: 0 0 8px;
    font-size: 0.9em;
    color: #4B5563;
    line-height: 1.5;
  }
  
  .view-mode p strong {
    font-weight: 500; /* Medium weight instead of bold */
    color: #1F2937; /* Darker color */
  }
  
  .view-mode .note-text {
    background-color: #F9FAFB; /* Lighter background */
    padding: 12px; /* Increased padding */
    border: 1px solid #E5E7EB; /* Lighter border */
    border-radius: 6px; /* More rounded corners */
    margin-bottom: 16px; /* Increased margin */
    font-size: 0.9em;
    line-height: 1.5;
    color: #1F2937;
  }
  
  .comments-section h3 {
    margin: 0 0 12px; /* Increased from 8px */
    font-size: 1em;
    font-weight: 500; /* Medium weight instead of bold */
    color: #1F2937;
    letter-spacing: -0.01em; /* Apple-like letter spacing */
  }
  
  .comments-list {
    list-style: none;
    padding: 0;
    margin: 0 0 16px; /* Increased from 8px */
  }
  
  .comments-list li {
    padding: 8px 12px; /* Increased padding */
    border-bottom: 1px solid #F3F4F6; /* Lighter border */
    font-size: 0.9em;
    line-height: 1.5;
    color: #4B5563;
  }
  
  .add-comment-group {
    display: flex;
    gap: 8px;
    margin-top: 12px; /* Increased from 8px */
  }
  
  .add-comment-btn {
    background-color: #004225;
    color: #fff;
    border: none;
    padding: 10px 16px; /* Increased padding */
    border-radius: 6px; /* More rounded corners */
    cursor: pointer;
    font-size: 0.9em;
    font-weight: 500; /* Medium weight instead of bold */
    transition: background-color 0.2s ease, transform 0.1s ease;
  }
  
  .add-comment-btn:hover {
    background-color: #006339; /* Slightly darker on hover */
    transform: translateY(-1px);
  }
  
  .add-comment-btn:active {
    transform: translateY(0);
  }
  
  .panel-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px; /* Increased from 8px */
    border-top: 1px solid #E5E7EB; /* Lighter border */
    padding: 16px 20px; /* Increased padding */
    background-color: #F9FAFB; /* Subtle background */
  }
  
  .save-btn, 
  .cancel-btn, 
  .panel-footer .close-btn {
    background-color: #004225;
    color: #fff;
    border: none;
    padding: 10px 16px; /* Increased padding */
    border-radius: 6px; /* More rounded corners */
    cursor: pointer;
    font-size: 0.9em;
    font-weight: 500; /* Medium weight instead of bold */
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); /* Subtle shadow */
  }
  
  .panel-footer .close-btn {
    color: #fff; /* Override the close button in the header */
    background-color: #004225;
  }
  
  .cancel-btn {
    background-color: #F3F4F6; /* Lighter background */
    color: #4B5563; /* Darker text */
    border: 1px solid #E5E7EB; /* Add border */
  }
  
  .save-btn:hover, 
  .panel-footer .close-btn:hover {
    background-color: #006339; /* Slightly darker on hover */
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  }
  
  .cancel-btn:hover {
    background-color: #E5E7EB;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .save-btn:active, 
  .cancel-btn:active, 
  .panel-footer .close-btn:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
  
  /* Optional: Scrollbar styling for a more refined look */
  .panel-content::-webkit-scrollbar {
    width: 8px;
  }
  
  .panel-content::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.03);
    border-radius: 4px;
  }
  
  .panel-content::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
  }
  
  .panel-content::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.15);
  }
  
  /* Ensure view mode footer button is right-aligned */
  .view-mode-footer {
    justify-content: flex-end;
  }

  /* New styles for the edit button and header-right */
  .header-right {
    display: flex;
    align-items: center;
  }
  
  .edit-btn {
    background-color: transparent;
    color: #4B5563;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    margin-right: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  
  .edit-btn i {
    font-size: 18px;
  }
  
  .edit-btn:hover {
    background-color: rgba(0, 66, 37, 0.1);
    color: #004225;
    transform: translateY(-1px);
  }
  
  .edit-btn:active {
    transform: translateY(0);
  }
</style>