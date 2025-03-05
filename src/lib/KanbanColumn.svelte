<script context="module" lang="ts">
  export type Project = {
    id: string;  // id is a string (UUID)
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

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    // Dispatch the original DragEvent in the detail.
    dispatch('drop', event);
  }
</script>

<div class="kanban-column" role="region" on:dragover={handleDragOver} on:drop={handleDrop}>
  <h2>{title}</h2>
  <div class="cards">
    {#each projects as project (project.id)}
      <KanbanCard {project} on:open={(e) => dispatch('open', e.detail)} />
    {/each}
  </div>
</div>

<style>
  .kanban-column {
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 16px;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 400px;
  }
  
  h2 {
    font-size: 1.2em;
    margin-bottom: 16px;
    text-align: center;
  }
  
  .cards {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
  }
</style>