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

  export let project: Project;

  const dispatch = createEventDispatcher();
  
  let expanded = false;

  function toggleExpand(event: MouseEvent) {
    event.stopPropagation();
    expanded = !expanded;
  }

  function handleCardClick() {
    dispatch('open', { project });
  }

  function handleDragStart(event: DragEvent) {
    event.dataTransfer?.setData('text/plain', project.id);
  }

  // Mapping of categories to colors.
  const categoryColors: Record<string, string> = {
    "5s & organization": "#e0f7fa",                      // Light blue/turquoise
    "inventory accuracy & cycle counting": "#e8f5e9",    // Light green
    "equipment maintenance & reliability": "#fff3e0",    // Light orange
    "layout & space optimization": "#d1c4e9",            // Light purple
    "safety & ergonomics": "#ffcdd2",                    // Soft red
    "process efficiency & workflow": "#fff9c4",          // Light yellow
    "quality improvement": "#b2dfdb",                    // Soft teal
    "technology & automation": "#b2ebf2"                 // Light cyan
  };

  function categoryColor(category: string): string {
    const normalized = category.toLowerCase();
    return categoryColors[normalized] || "#f0f0f0";
  }
</script>

<div
  class="kanban-card"
  draggable="true"
  on:dragstart={handleDragStart}
  on:click={handleCardClick}
  role="button"
  tabindex="0"
  on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(); } }}
  style="background-color: {categoryColor(project.category)}"
>
  <div class="card-header">
    <h3>{project.title}</h3>
    <button class="toggle-button" on:click={toggleExpand} aria-label="Toggle details">
      {#if expanded}−{:else}+{/if}
    </button>
  </div>
  <p class="category">{project.category}</p>
  {#if expanded}
    <p class="submitted">By: {project.submitted_by}</p>
    <p class="brief">{project.brief_description}</p>
  {/if}
  {#if project.thumbs_up_count}
    <div class="reactions">
      <span class="thumbs-up">👍</span>
      <span class="count">{project.thumbs_up_count}</span>
    </div>
  {/if}
</div>

<style>
  .kanban-card {
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    position: relative;
    font-size: 0.85em;
  }

  .kanban-card:hover {
    transform: scale(1.02);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h3 {
    margin: 0;
    font-size: 1em;
  }

  .toggle-button {
    background: none;
    border: none;
    font-size: 1.2em;
    cursor: pointer;
    width: 24px;
    height: 24px;
    line-height: 24px;
    text-align: center;
    padding: 0;
  }

  .category {
    font-size: 0.8em;
    margin: 2px 0;
    font-weight: bold;
  }

  .submitted,
  .brief {
    font-size: 0.75em;
    margin: 2px 0;
  }

  .reactions {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.75em;
    margin-top: 4px;
  }

  .thumbs-up {
    font-size: 1em;
  }

  .count {
    font-weight: bold;
  }
</style>