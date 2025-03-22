<script lang="ts">
  import { onMount } from 'svelte';
  import KanbanColumn from '$lib/KanbanColumn.svelte';
  import ProjectDetailPanel from '$lib/ProjectDetailPanel.svelte';
  import NewProjectPanel from '$lib/NewProjectPanel.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { showToast } from '$lib/toastStore'; // Add this import


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
    user_has_liked?: boolean; // Add this flag
  };

  type Comment = {
    id?: number;
    project_id: string;
    comment: string;
    created_by: string;
    created_at?: string;
  };

  // Add this type definition
  type ProjectLike = {
    id?: string;
    project_id: string;
    user_email: string;
    created_at: string;
  };

  // Add a variable to track the current user's email
  let currentUserEmail = ""; // This will be set in onMount

  let projects: Project[] = [];
  let selectedProject: Project | null = null;
  let selectedComments: Comment[] = [];
  let showNewProjectPanel = false;

  // Define a proper type for Supabase responses
  type SupabaseResponse<T> = {
    data: T | null;
    error: Error | null;
  };

  // Fix the retry function to handle Supabase responses
  async function withRetry<T>(fn: () => Promise<SupabaseResponse<T>>, maxRetries = 3): Promise<SupabaseResponse<T>> {
    let retries = 0;
    
    while (true) {
      try {
        return await fn();
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          throw error;
        }
        console.log(`Operation failed, retrying (${retries}/${maxRetries})...`, error);
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
  }

  async function loadProjects() {
    const { data, error } = await withRetry(async () => {
      return await supabase
        .from("kaizen_projects")
        .select("*")
        .order('created_at', { ascending: false });
    });
    
    if (error) {
      console.error("Error loading projects:", error);
      showToast("Failed to load projects", "error");
    } else {
      projects = data || [];
      
      // If user is logged in, fetch their likes
      if (currentUserEmail) {
        const { data: likesData, error: likesError } = await supabase
          .from("project_likes")
          .select("project_id")
          .eq("user_email", currentUserEmail);
        
        if (!likesError && likesData) {
          const likedProjectIds = likesData.map(like => like.project_id);
          
          // Add a user_has_liked flag to each project
          projects = projects.map(project => ({
            ...project,
            user_has_liked: likedProjectIds.includes(project.id)
          }));
        }
      }
      
      console.log("Projects loaded:", projects);
    }
  }

  async function loadProjectsInBatches(batchSize = 50) {
    let allProjects: Project[] = [];
    let lastId: string | null = null;
    let hasMore = true;
    
    while (hasMore) {
      let query = supabase
        .from("kaizen_projects")
        .select("*")
        .order('created_at', { ascending: false })
        .limit(batchSize);
        
      if (lastId) {
        query = query.lt('id', lastId); // Use appropriate column for pagination
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error("Error loading projects batch:", error);
        break;
      }
      
      if (data && data.length > 0) {
        allProjects = [...allProjects, ...data];
        lastId = data[data.length - 1].id;
      }
      
      hasMore = data && data.length === batchSize;
    }
    
    return allProjects;
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

  // Add this to debug authentication issues
  async function checkAuthAndPermissions() {
    // Check auth state
    const { data: { session } } = await supabase.auth.getSession();
    console.log("Auth check - Session exists:", !!session);
    
    if (session) {
      console.log("User ID:", session.user.id);
      console.log("User email:", session.user.email);
      
      // Test select permission
      const { data: selectData, error: selectError } = await supabase
        .from("kaizen_projects")
        .select("id")
        .limit(1);
        
      console.log("Select test:", { data: selectData, error: selectError });
      
      // Test insert permission with small test
      const testId = 'test-' + Date.now();
      const { data: insertData, error: insertError } = await supabase
        .from("kaizen_projects")
        .insert({
          id: testId,
          title: "Test Permission",
          category: "Test",
          brief_description: "Testing permissions",
          status: "new",
          submitted_by: session.user.email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
        
      console.log("Insert test:", { data: insertData, error: insertError });
      
      // If insert succeeded, test update
      if (insertData && insertData.length > 0) {
        const { data: updateData, error: updateError } = await supabase
          .from("kaizen_projects")
          .update({ status: "under_review" })
          .eq("id", testId)
          .select();
          
        console.log("Update test:", { data: updateData, error: updateError });
        
        // Clean up test record
        await supabase
          .from("kaizen_projects")
          .delete()
          .eq("id", testId);
      }
    } else {
      console.log("No active session found");
    }
  }

  onMount(async () => {
    // Run auth check
    await checkAuthAndPermissions();
    
    // Get current user
    try {
      const { data: { session } } = await supabase.auth.getSession();
      currentUserEmail = session?.user?.email || "jackweston@gmail.com";
      console.log("User authenticated:", !!session, "Email:", currentUserEmail);
      
      // Test database connection with simpler query
      const { data, error } = await supabase
        .from("kaizen_projects")
        .select("id")
        .limit(1);
        
      if (error) {
        console.error("Database connection error:", error);
        showToast("Failed to connect to database. Check network connection.", "error");
      } else {
        console.log("Database connection successful. Data:", data);
        await loadProjects();
      }
    } catch (e) {
      console.error("Error during initialization:", e);
      showToast("Error initializing application", "error");
    }
  });

  $: newSubmissions = projects.filter(p => p.status === 'new');
  $: underReview = projects.filter(p => p.status === 'under_review');
  $: inProgress = projects.filter(p => p.status === 'in_progress');
  $: completed = projects.filter(p => p.status === 'completed');

  // Add this function to check UUID format
  function validateUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isValid = uuidRegex.test(id);
    if (!isValid) {
      console.error("Invalid UUID format:", id);
    }
    return isValid;
  }

  async function handleDrop(event: CustomEvent, targetStatus: Project["status"]) {
    const dragEvent: DragEvent = event.detail;
    dragEvent.preventDefault();
    const id = dragEvent.dataTransfer?.getData("text/plain");
    console.log("Dropped project id:", id, "to status:", targetStatus);
    
    if (!id || !validateUUID(id)) {
      console.error("Invalid or missing project ID");
      showToast("Invalid project ID", "error");
      return;
    }
    
    // Add debug call
    const debugResult = await debugOperation('handleDrop', { id, targetStatus });
    if (!debugResult.success) {
      showToast("Database connection issue detected", "error");
      return;
    }
    
    // Find the project in our local array
    const proj = projects.find(p => p.id === id);
    if (!proj) {
      console.error("Project not found in local data:", id);
      return;
    }
    
    // Apply update optimistically
    projects = projects.map(p => p.id === id ? { ...p, status: targetStatus } : p);
    
    try {
      // Log the original project state 
      console.log("Original project state:", proj);
      
      // Create an explicitly typed update object
      const updateData = {
        status: targetStatus,
        updated_at: new Date().toISOString()
      };
      
      console.log("Update payload:", updateData);
      
      // Update in Supabase
      const { data, error } = await supabase
        .from("kaizen_projects")
        .update(updateData)
        .eq("id", id)
        .select(); // Add .select() to return the updated record
      
      console.log("Raw update response:", { data, error });
      
      if (error) {
        console.error("Error updating project status:", error);
        showToast("Failed to update project status: " + error.message, "error");
        return;
      }
      
      // Verify the update worked with a separate query
      const { data: verifyData, error: verifyError } = await supabase
        .from("kaizen_projects")
        .select("*")
        .eq("id", id)
        .single();
        
      console.log("Verification query result:", { verifyData, verifyError });
      
      if (verifyError) {
        console.error("Error verifying update:", verifyError);
        showToast("Update may have failed", "error");
        return;
      }
      
      // Update local state with data from the server
      if (verifyData) {
        console.log("Updated project from server:", verifyData);
        projects = projects.map(p => p.id === id ? verifyData : p);
        showToast(`Project moved to ${targetStatus.replace('_', ' ')}`, "success");
      } else {
        console.error("No data returned from verification query");
        showToast("Update may have failed", "warning");
      }
    } catch (err) {
      console.error("Unexpected error during drag and drop:", err);
      showToast("An unexpected error occurred", "error");
      
      // If it fails, revert the optimistic update
      projects = projects.map(p => p.id === id ? proj : p);
      showToast("Failed to update project status", "error");
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
    const newProject = event.detail.newProject;
    console.log("Handling new project submit:", newProject);
    
    const projectToInsert = {
      title: newProject.title,
      category: newProject.category,
      submitted_by: newProject.submitted_by,
      brief_description: newProject.brief_description,
      status: 'new',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      thumbs_up_count: 0
    };

    const { data, error } = await supabase
      .from("kaizen_projects")
      .insert(projectToInsert)
      .select();
      
    if (error) {
      console.error("Error inserting new project:", error);
      showToast("Failed to create new project", "error");
    } else if (data && data.length > 0) {
      projects = [data[0], ...projects];
      showNewProjectPanel = false;
      console.log("New project added:", data[0]);
      showToast("New project created successfully!", "success");
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
      showToast("Failed to update project details", "error");
    } else {
      console.log("Project updated in Supabase:", data);
      projects = projects.map(p => p.id === updatedProject.id ? updatedProject : p);
      selectedProject = updatedProject;
      await fetchComments(updatedProject.id);
      showToast("Project updated successfully", "success");
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
      showToast("Failed to delete project", "error");
    } else {
      projects = projects.filter(p => p.id !== projectId);
      selectedProject = null;
      selectedComments = [];
      console.log("Project deleted:", projectId);
      showToast("Project deleted successfully", "success");
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
      showToast("Failed to add comment", "error");
    } else {
      console.log("Comment added:", data);
      // Refresh comments if the selectedProject is still open
      if (selectedProject) {
        await fetchComments(selectedProject.id);
        showToast("Comment added", "success");
      }
    }
  }

  // Add this function to check if user has already liked a project
  async function hasUserLikedProject(projectId: string): Promise<boolean> {
    if (!currentUserEmail) return false;
    
    const { data, error } = await supabase
      .from("project_likes")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_email", currentUserEmail)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 means not found, which is expected
      console.error("Error checking project like:", error);
      return false;
    }
    
    return !!data;
  }

  async function debugOperation(operation: string, payload: any) {
    try {
      console.log(`Starting ${operation} operation with payload:`, payload);
      
      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      console.log(`${operation} - Auth state:`, !!session);
      
      // Test a simple read first
      const { data: readData, error: readError } = await supabase
        .from("kaizen_projects")
        .select("id")
        .limit(1);
        
      console.log(`${operation} - Read test:`, { success: !readError, data: readData });
      
      if (readError) {
        console.error(`${operation} - Read error:`, readError);
        return { success: false, error: readError };
      }
      
      return { success: true };
    } catch (error) {
      console.error(`${operation} - Unexpected error:`, error);
      return { success: false, error };
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
    on:thumbsUp={async (e) => {
      const projectId = e.detail.projectId;
      console.log("Toggle thumbs up for project:", projectId);
      
      try {
        if (!currentUserEmail) {
          showToast("You need to be logged in to like projects", "error");
          return;
        }
        
        // Find the project in our local array
        const project = projects.find(p => p.id === projectId);
        if (!project) {
          console.error("Project not found:", projectId);
          return;
        }
        
        // Check if user has already liked this project
        const alreadyLiked = await hasUserLikedProject(projectId);
        
        if (alreadyLiked) {
          // User has already liked this project, so we'll remove the like
          const { error: deleteLikeError } = await supabase
            .from("project_likes")
            .delete()
            .eq("project_id", projectId)
            .eq("user_email", currentUserEmail);
          
          if (deleteLikeError) {
            console.error("Error removing like:", deleteLikeError);
            showToast("Failed to remove like", "error");
            return;
          }
          
          // Calculate new thumbs up count (decrease by 1)
          const currentCount = project.thumbs_up_count || 0;
          const newCount = Math.max(0, currentCount - 1); // Ensure not negative
          
          // Update in Supabase
          const { data, error } = await supabase
            .from("kaizen_projects")
            .update({ 
              thumbs_up_count: newCount,
              updated_at: new Date().toISOString()
            })
            .eq("id", projectId)
            .select();
          
          if (error) {
            console.error("Error updating thumbs up count:", error);
            showToast("Failed to update project", "error");
            return;
          }
          
          // Update local state
          const updatedProject = { 
            ...project, 
            thumbs_up_count: newCount,
            updated_at: new Date().toISOString(),
            user_has_liked: false // Add this flag for UI state
          };
          
          // Update in local array
          projects = projects.map(p => p.id === projectId ? updatedProject : p);
          
          // Update selected project if it's open
          if (selectedProject && selectedProject.id === projectId) {
            selectedProject = updatedProject;
          }
          
          showToast("You removed your like from this project", "info");
          
        } else {
          // User hasn't liked this project yet, so add the like
          const { error: addLikeError } = await supabase
            .from("project_likes")
            .insert({
              project_id: projectId,
              user_email: currentUserEmail,
              created_at: new Date().toISOString()
            });
          
          if (addLikeError) {
            console.error("Error adding like:", addLikeError);
            showToast("Failed to add like", "error");
            return;
          }
          
          // Calculate new thumbs up count
          const currentCount = project.thumbs_up_count || 0;
          const newCount = currentCount + 1;
          
          // Update in Supabase
          const { data, error } = await supabase
            .from("kaizen_projects")
            .update({ 
              thumbs_up_count: newCount,
              updated_at: new Date().toISOString()
            })
            .eq("id", projectId)
            .select();
          
          if (error) {
            console.error("Error updating thumbs up count:", error);
            showToast("Failed to update project", "error");
            return;
          }
          
          // Update local state
          const updatedProject = { 
            ...project, 
            thumbs_up_count: newCount,
            updated_at: new Date().toISOString(),
            user_has_liked: true // Add this flag for UI state
          };
          
          // Update in local array
          projects = projects.map(p => p.id === projectId ? updatedProject : p);
          
          // Update selected project if it's open
          if (selectedProject && selectedProject.id === projectId) {
            selectedProject = updatedProject;
          }
          
          showToast("You liked this project!", "success");
        }
        
      } catch (err) {
        console.error("Unexpected error during thumbs up toggle:", err);
        showToast("An unexpected error occurred", "error");
      }
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
    padding: 16px 24px; /* Match the card's horizontal padding from ShipmentChart */
  }
  
  .new-project-button {
    background-color: #004225;
    color: #fff;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    margin-bottom: 16px;
    font-size: 0.9em;
    font-weight: 500; /* Medium weight instead of bold, like in ShipmentChart */
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); /* Subtle shadow */
  }
  
  .new-project-button:hover {
    background: #006339; /* Slightly darker on hover for depth */
    transform: translateY(-1px); /* Subtle lift effect */
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  }
  
  .new-project-button:active {
    transform: translateY(0); /* Press effect */
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
  
  .kanban-columns {
    display: flex;
    gap: 16px; /* Increased from 8px for more spacing between columns */
    margin-bottom: 16px; /* Add bottom margin */
  }
</style>