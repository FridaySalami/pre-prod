<script lang="ts">
  import { onMount } from 'svelte';
  import KanbanColumn from '$lib/KanbanColumn.svelte';
  import ProjectDetailPanel from '$lib/ProjectDetailPanel.svelte';
  import NewProjectPanel from '$lib/NewProjectPanel.svelte';
  import { supabase } from '$lib/supabaseClient';

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

  type Comment = {
    id?: number;
    project_id: string;
    comment: string;
    created_by: string;
    created_at?: string;
  };

  let projects: Project[] = [];
  let selectedProject: Project | null = null;
  let selectedComments: Comment[] = [];
  let showNewProjectPanel = false;

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

  async function fetchComments(projectId: string) {
    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Error fetching comments:", error);
    } else {
      selectedComments = data || [];
      console.log("Comments for project", projectId, ":", selectedComments);
    }
  }

  onMount(async () => {
    await loadProjects();
  });

  $: newSubmissions = projects.filter(p => p.status === 'new');
  $: underReview = projects.filter(p => p.status === 'under_review');
  $: inProgress = projects.filter(p => p.status === 'in_progress');
  $: completed = projects.filter(p => p.status === 'completed');

  async function handleDrop(event: CustomEvent, targetStatus: Project["status"]) {
    const dragEvent: DragEvent = event.detail;
    dragEvent.preventDefault();
    const id = dragEvent.dataTransfer?.getData("text/plain");
    console.log("Dropped project id:", id, "to status:", targetStatus);
    if (id) {
      const proj = projects.find(p => p.id === id);
      if (proj) {
        proj.status = targetStatus;
        projects = [...projects];
        const { data, error } = await supabase
          .from("kaizen_projects")
          .update({ status: targetStatus, updated_at: new Date().toISOString() })
          .eq("id", proj.id);
        if (error) {
          console.error("Error updating project status:", error);
        } else {
          console.log("Project status updated:", data);
        }
      }
    }
  }

  async function handleOpen(event: CustomEvent) {
    selectedProject = event.detail.project;
    if (selectedProject) {
      await fetchComments(selectedProject.id);
    }
  }
  function closeDetailPanel() {
    selectedProject = null;
    selectedComments = [];
  }

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

  async function handleUpdateProject(event: CustomEvent) {
    const { updatedProject } = event.detail;
    console.log("Updating project:", updatedProject);
    const { data, error } = await supabase
      .from("kaizen_projects")
      .update({
        title: updatedProject.title,
        category: updatedProject.category,
        brief_description: updatedProject.brief_description,
        detailed_description: updatedProject.detailed_description,
        deadline: updatedProject.deadline,
        owner: updatedProject.owner,
        updated_at: updatedProject.updated_at
      })
      .eq("id", updatedProject.id);
    if (error) {
      console.error("Error updating project:", error);
    } else {
      console.log("Project updated in Supabase:", data);
      projects = projects.map(p => p.id === updatedProject.id ? updatedProject : p);
      selectedProject = updatedProject;
      await fetchComments(updatedProject.id);
    }
  }

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
      selectedComments = [];
      console.log("Project deleted:", projectId);
    }
  }

  async function handleAddComment(event: CustomEvent) {
    const { projectId, comment } = event.detail;
    console.log("Adding comment:", comment, "for project:", projectId);
    const { data, error } = await supabase
      .from("comments")
      .insert({
        project_id: projectId,
        comment: comment,
        created_by: "jackweston@gmail.com",
        created_at: new Date().toISOString()
      })
      .select();
    if (error) {
      console.error("Error adding comment:", error);
    } else {
      console.log("Comment added:", data);
      // Refresh comments if the selectedProject is still open
      if (selectedProject) {
        await fetchComments(selectedProject.id);
      }
    }
  }
</script>

<div class="kanban-board">
  <button class="new-project-button" on:click={openNewProjectForm}>
    Submit New
  </button>

  <div class="kanban-columns">
    <KanbanColumn
      title="New Submissions"
      projects={newSubmissions}
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
    comments={selectedComments}
    on:close={closeDetailPanel}
    on:update={handleUpdateProject}
    on:thumbsUp={(e) => {
      console.log("Thumbs up", e.detail);
      // TODO: Update thumbs-up count in Supabase.
    }}
    on:delete={handleDelete}
    on:addComment={handleAddComment}
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
    padding: 8px;
  }
  
  .new-project-button {
    background-color: #004225;
    color: #fff;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    margin-bottom: 8px;
    font-size: 0.9em;
  }
  
  .kanban-columns {
    display: flex;
    gap: 8px;
  }
</style>