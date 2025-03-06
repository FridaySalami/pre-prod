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
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import KanbanCard from '$lib/KanbanCard.svelte';

  export let title: string;
  export let projects: Project[] = [];

  const dispatch = createEventDispatcher();

  // State to track drag-over for visual feedback.
  let dragOver = false;

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  function handleDragEnter(event: DragEvent) {
    dragOver = true;
  }

  function handleDragLeave(event: DragEvent) {
    dragOver = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragOver = false;
    // Dispatch the original DragEvent in the detail.
    dispatch('drop', event);
  }
</script>

<div class="kanban-column {dragOver ? 'drag-over' : ''}" role="region"
     on:dragover={handleDragOver}
     on:dragenter={handleDragEnter}
     on:dragleave={handleDragLeave}
     on:drop={handleDrop}>
  <div class="column-header">
    <h2>{title} <span class="item-count">({projects.length})</span></h2>
  </div>
  <div class="cards">
    {#if projects.length === 0}
      <p class="empty-message">No projects here. Add one!</p>
    {:else}
      {#each projects as project (project.id)}
        <KanbanCard {project} on:open={(e) => dispatch('open', e.detail)} />
      {/each}
    {/if}
  </div>
</div>

<style>
  .kanban-column {
    background: linear-gradient(135deg, #f9f9f9, #ffffff);
    border: 1px solid #ccc;
    border-radius: 6px;
    padding: 4px;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 300px;
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }

  /* Highlight when a card is dragged over */
  .kanban-column.drag-over {
    background-color: #e6f7ff;
    border-color: #1890ff;
  }

  .column-header {
    position: sticky;
    top: 0;
    background: inherit;
    padding: 4px 8px;
    border-bottom: 1px solid #ccc;
    z-index: 1;
  }

  h2 {
    font-size: 0.9em;
    margin: 0;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .item-count {
    font-size: 0.8em;
    margin-left: 4px;
    color: #555;
  }

  .cards {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow-y: auto;
    padding: 4px;
  }

  .empty-message {
    font-size: 0.8em;
    color: #999;
    text-align: center;
    margin-top: 16px;
  }
</style>