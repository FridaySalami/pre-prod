<script lang="ts">
  import { onMount } from 'svelte';
  import KanbanColumn from '$lib/KanbanColumn.svelte';
  import ProjectDetailPanel from '$lib/ProjectDetailPanel.svelte';
  import NewProjectPanel from '$lib/NewProjectPanel.svelte';
  import { supabase } from '$lib/supabaseClient';

  // Update the Project type: id is a string (UUID)
  type Project = {
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

  let projects: Project[] = [];

  async function loadProjects() {
    const { data, error } = await supabase
      .from("kaizen_projects")
      .select("*")
      .order('created_at', { ascending: false });
    if (error) {
      console.error("Error loading projects:", error);
    } else {
      projects = data || [];
      console.log("Projects loaded:", projects);
    }
  }

  onMount(async () => {
    await loadProjects();
  });

  // Reactive filtering into columns.
  $: newSuggestions = projects.filter(p => p.status === 'new');
  $: underReview = projects.filter(p => p.status === 'under_review');
  $: inProgress = projects.filter(p => p.status === 'in_progress');
  $: completed = projects.filter(p => p.status === 'completed');

  // Drop handler: remove Number conversion, compare string id.
  async function handleDrop(event: CustomEvent, targetStatus: Project["status"]) {
    const dragEvent: DragEvent = event.detail;
    dragEvent.preventDefault();
    const id = dragEvent.dataTransfer?.getData("text/plain");
    console.log("Dropped project id:", id, "to status:", targetStatus);
    if (id) {
      const project = projects.find(p => p.id === id);
      if (project) {
        project.status = targetStatus;
        projects = [...projects]; // Force reactivity.
        const { data, error } = await supabase
          .from("kaizen_projects")
          .update({ status: targetStatus, updated_at: new Date().toISOString() })
          .eq("id", project.id);
        if (error) {
          console.error("Error updating project status:", error);
        } else {
          console.log("Project status updated in Supabase:", data);
        }
      }
    }
  }

  // Handle opening a project detail.
  let selectedProject: Project | null = null;
  function handleOpen(event: CustomEvent) {
    selectedProject = event.detail.project;
  }
  function closeDetailPanel() {
    selectedProject = null;
  }

  // New project submission panel state.
  let showNewProjectPanel = false;
  function openNewProjectForm() {
    showNewProjectPanel = true;
  }
  function closeNewProjectPanel() {
    showNewProjectPanel = false;
  }
  
  async function handleNewProjectSubmit(event: CustomEvent) {
    const newProjectData = event.detail.newProject;
    console.log("Handling new project submit:", newProjectData);
    const { data, error } = await supabase
      .from("kaizen_projects")
      .insert({
        ...newProjectData,
        status: "new",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();
    if (error) {
      console.error("Error inserting new project:", error);
    } else if (data && data.length > 0) {
      projects = [data[0], ...projects];
      showNewProjectPanel = false;
      console.log("New project added:", data[0]);
    }
  }

  // Handle deletion of a project.
  async function handleDelete(event: CustomEvent) {
    const projectId = event.detail.projectId;
    const { error } = await supabase
      .from("kaizen_projects")
      .delete()
      .eq("id", projectId);
    if (error) {
      console.error("Error deleting project:", error);
    } else {
      projects = projects.filter(p => p.id !== projectId);
      selectedProject = null;
      console.log("Project deleted:", projectId);
    }
  }
</script>

<div class="kanban-board">
  <button class="new-project-button" on:click={openNewProjectForm}>
    Submit New Idea
  </button>

  <div class="kanban-columns">
    <KanbanColumn
      title="New Suggestions"
      projects={newSuggestions}
      on:drop={(e) => handleDrop(e, 'new')}
      on:open={handleOpen}
    />
    <KanbanColumn
      title="Under Review"
      projects={underReview}
      on:drop={(e) => handleDrop(e, 'under_review')}
      on:open={handleOpen}
    />
    <KanbanColumn
      title="In Progress"
      projects={inProgress}
      on:drop={(e) => handleDrop(e, 'in_progress')}
      on:open={handleOpen}
    />
    <KanbanColumn
      title="Completed"
      projects={completed}
      on:drop={(e) => handleDrop(e, 'completed')}
      on:open={handleOpen}
    />
  </div>
</div>

{#if selectedProject}
  <ProjectDetailPanel
    project={selectedProject}
    on:close={closeDetailPanel}
    on:addComment={(e: CustomEvent) => {
      console.log("Add comment", e.detail);
      // TODO: Update project comments in Supabase.
    }}
    on:thumbsUp={(e: CustomEvent) => {
      console.log("Thumbs up", e.detail);
      // TODO: Update thumbs up count in Supabase.
    }}
    on:delete={handleDelete}
  />
{/if}

{#if showNewProjectPanel}
  <NewProjectPanel
    on:close={closeNewProjectPanel}
    on:submit={handleNewProjectSubmit}
  />
{/if}

<style>
  .kanban-board {
    padding: 16px;
  }
  
  .new-project-button {
    background-color: #004225;
    color: #fff;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    margin-bottom: 16px;
  }
  
  .kanban-columns {
    display: flex;
    gap: 16px;
  }
</style>