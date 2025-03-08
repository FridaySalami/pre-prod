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
  // The NoteData type is now available in this instance script.
  export let noteData: NoteData;

  const dispatch = createEventDispatcher();

  // Local editable copy of the note.
  let editedNote: NoteData = { ...noteData };

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
</script>

<div class="side-panel">
  <div class="panel-header">
    <h2>Metrics Notes</h2>
    <button class="close-btn" on:click={closePanel} aria-label="Close">×</button>
  </div>
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

  .panel-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    border-top: 1px solid #ddd;
    padding-top: 8px;
  }

  .save-btn, .cancel-btn {
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

  .save-btn:hover, .cancel-btn:hover {
    opacity: 0.9;
  }
</style>