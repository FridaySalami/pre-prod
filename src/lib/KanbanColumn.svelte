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
    background: #ffffff;
    border: 1px solid #E5E7EB;
    border-radius: 10px; /* Match the card's rounded corners */
    padding: 8px;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 300px;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  /* Highlight when a card is dragged over */
  .kanban-column.drag-over {
    background-color: #f0f9f6; /* Lighter green tint matching our color scheme */
    border-color: #35b07b; /* Match green brand color */
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  }

  .column-header {
    position: sticky;
    top: 0;
    background: inherit;
    padding: 8px 12px;
    border-bottom: 1px solid #E5E7EB;
    z-index: 1;
    margin-bottom: 8px;
  }

  h2 {
    font-size: 1em;
    margin: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: 500; /* Medium weight instead of bold */
    color: #1f2937; /* Darker text for better contrast */
  }

  .item-count {
    font-size: 0.8em;
    margin-left: 6px;
    color: #6B7280; /* More subdued gray that matches our palette */
    font-weight: 400; /* Regular weight for the count */
  }

  .cards {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px; /* Increased from 4px for more spacing between cards */
    overflow-y: auto;
    padding: 4px 6px;
  }

  /* Add a styled scrollbar */
  .cards::-webkit-scrollbar {
    width: 6px;
  }

  .cards::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.03);
    border-radius: 3px;
  }

  .cards::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
  }

  .cards::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.15);
  }

  .empty-message {
    font-size: 0.85em;
    color: #9CA3AF; /* Lighter gray for placeholder text */
    text-align: center;
    margin-top: 24px;
    font-style: italic; /* Subtle italic style for empty state */
  }
</style>