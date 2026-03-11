<script context="module" lang="ts">
  // Move type-only exports to the module context
  export type NoteData = {
    title: string;
    rootCause: string;
    details: string;
    actionPlan: string;
    comments: string[];
  };
</script>

<script lang="ts">
  // Props for modal display and note data
  export let showModal: boolean;
  export let metricName: string;
  export let noteData: NoteData;
  export let isEditMode: boolean;

  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();

  // Local bindings for editing note fields
  let noteTitle = noteData.title;
  let noteRootCause = noteData.rootCause;
  let noteDetails = noteData.details;
  let noteActionPlan = noteData.actionPlan;
  let newComment = "";

  function save() {
    dispatch("save", {
      title: noteTitle,
      rootCause: noteRootCause,
      details: noteDetails,
      actionPlan: noteActionPlan
    });
  }
  
  function addComment() {
    if (newComment.trim()) {
      dispatch("addComment", newComment.trim());
      newComment = "";
    }
  }
  
  function close() {
    dispatch("close");
  }
  
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      close();
    }
  }
</script>

{#if showModal}
  <div class="modal-overlay"
       on:click={close}
       role="button"
       tabindex="0"
       on:keydown={handleKeyDown}>
    <div class="modal-content"
         role="dialog"
         aria-modal="true"
         on:click|stopPropagation
         on:keydown={handleKeyDown}>
      {#if isEditMode}
        <h2>Edit Note for {metricName} Total</h2>
        <label>
          Title:
          <input type="text" bind:value={noteTitle} />
        </label>
        <label>
          Root Cause:
          <input type="text" bind:value={noteRootCause} />
        </label>
        <label>
          Details:
          <textarea bind:value={noteDetails}></textarea>
        </label>
        <label>
          Action Plan:
          <textarea bind:value={noteActionPlan}></textarea>
        </label>
        <div class="modal-buttons">
          <button type="button" on:click={save}>Save Note</button>
          <button type="button" on:click={close}>Cancel</button>
        </div>
      {:else}
        <h2>Note for {metricName} Total</h2>
        <p><strong>Title:</strong> {noteData.title}</p>
        <p><strong>Root Cause:</strong> {noteData.rootCause}</p>
        <p><strong>Details:</strong> {noteData.details}</p>
        <p><strong>Action Plan:</strong> {noteData.actionPlan}</p>
        <div class="comments-section">
          <h3>Comments</h3>
          {#if noteData.comments.length}
            <ul class="comments-list">
              {#each noteData.comments as comment}
                <li>{comment}</li>
              {/each}
            </ul>
          {:else}
            <p>No comments yet.</p>
          {/if}
          <label>
            Add Comment:
            <input type="text" bind:value={newComment} placeholder="Type your comment..." />
          </label>
          <button type="button" class="add-comment" on:click={addComment}>Add Comment</button>
        </div>
        <div class="modal-buttons">
          <button type="button" on:click={() => dispatch("toggleEditMode")}>Edit Note</button>
          <button type="button" on:click={close}>Close</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .modal-content {
    background: #fff;
    padding: 24px;
    border-radius: 12px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  .modal-content h2 {
    margin-top: 0;
    font-size: 1.5em;
  }
  .modal-content label {
    display: block;
    margin: 12px 0 4px;
    font-size: 0.9em;
    color: #555;
  }
  .modal-content input[type="text"],
  .modal-content textarea {
    width: 100%;
    padding: 10px;
    font-size: 0.95em;
    border: 1px solid #E5E7EB;
    border-radius: 6px;
    margin-bottom: 12px;
  }
  .modal-content textarea {
    resize: vertical;
    min-height: 80px;
  }
  .modal-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
  .modal-buttons button {
    background: #004225;
    border: none;
    color: #fff;
    padding: 8px 16px;
    font-size: 0.95em;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.2s ease;
  }
  .modal-buttons button:hover {
    background: #35b07b;
  }
  .comments-section {
    margin-top: 16px;
    font-size: 0.9em;
    color: #555;
  }
  .comments-section h3 {
    margin: 0 0 8px;
    font-size: 1em;
  }
  .comments-list {
    list-style: none;
    padding: 0;
    margin: 0 0 8px;
    max-height: 150px;
    overflow-y: auto;
    border: 1px solid #E5E7EB;
    border-radius: 6px;
  }
  .comments-list li {
    padding: 6px 12px;
    border-bottom: 1px solid #f0f0f0;
  }
  .comments-list li:last-child {
    border-bottom: none;
  }
  .add-comment {
    background: #004225;
    border: none;
    color: #fff;
    padding: 8px 16px;
    font-size: 0.9em;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.2s ease;
  }
  .add-comment:hover {
    background: #35b07b;
  }
</style>