<script context="module" lang="ts">
  export type Project = {
    id: string; // id as string
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

  export type Comment = {
    id?: number;
    project_id: string;
    comment: string;
    created_by: string;
    created_at?: string;
  };
</script>

<script lang="ts">
  import { createEventDispatcher } from "svelte";
  export let project: Project;
  export let comments: Comment[] = [];

  const dispatch = createEventDispatcher();

  let newComment: string = "";

  function handleClose() {
    dispatch("close");
  }

  function handleAddComment() {
    if (newComment.trim()) {
      dispatch("addComment", { projectId: project.id, comment: newComment.trim() });
      newComment = "";
    }
  }

  function handleThumbsUp() {
    dispatch("thumbsUp", { projectId: project.id });
  }

  function handleDelete() {
    if (confirm("Are you sure you want to delete this idea?")) {
      dispatch("delete", { projectId: project.id });
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      handleClose();
    }
  }
</script>

<div class="overlay" on:click={handleClose} role="button" tabindex="0" on:keydown={handleKeyDown}>
  <div class="detail-panel" role="dialog" aria-modal="true" on:click|stopPropagation>
    <button class="close-button" on:click={handleClose} aria-label="Close">×</button>
    <div class="project-header">
      <h2>{project.title}</h2>
      <p class="category">{project.category}</p>
      <p class="submitted">Submitted by: {project.submitted_by}</p>
    </div>
    <div class="project-details">
      <p class="section-title">Detailed Description</p>
      <p>{project.detailed_description || "No detailed description provided."}</p>
      {#if project.deadline}
        <p class="section-title">Deadline</p>
        <p>{project.deadline}</p>
      {/if}
      {#if project.owner}
        <p class="section-title">Owner</p>
        <p>{project.owner}</p>
      {/if}
      <div class="reactions">
        <button class="thumbs-up-button" on:click={handleThumbsUp}>👍 +1</button>
        <span class="thumbs-up-count">{project.thumbs_up_count || 0}</span>
      </div>
    </div>
    <div class="comments-section">
      <h3>Comments</h3>
      {#if comments.length > 0}
        <ul>
          {#each comments as comment (comment.id)}
            <li>{comment.comment} – <em>{comment.created_by}</em></li>
          {/each}
        </ul>
      {:else}
        <p>No comments yet.</p>
      {/if}
      <div class="add-comment">
        <input type="text" bind:value={newComment} placeholder="Add a comment..." aria-label="Add a comment" />
        <button on:click={handleAddComment} type="button">Submit</button>
      </div>
    </div>
    <div class="delete-section">
      <button class="delete-button" on:click={handleDelete} type="button">Delete Idea</button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    justify-content: flex-end;
    z-index: 1000;
  }
  
  .detail-panel {
    background: #fff;
    width: 33%;
    min-width: 300px;
    height: 100%;
    padding: 24px;
    overflow-y: auto;
    box-shadow: -4px 0 8px rgba(0, 0, 0, 0.2);
    position: relative;
  }
  
  .close-button {
    position: absolute;
    top: 16px;
    right: 16px;
    font-size: 2em;
    background: none;
    border: none;
    cursor: pointer;
    line-height: 1;
  }
  
  .project-header h2 {
    margin-top: 0;
  }
  
  .section-title {
    font-weight: bold;
    margin-top: 16px;
  }
  
  .reactions {
    margin-top: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .thumbs-up-button {
    background: #004225;
    color: #fff;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .thumbs-up-count {
    font-weight: bold;
  }
  
  .comments-section {
    margin-top: 24px;
  }
  
  .comments-section ul {
    list-style: none;
    padding: 0;
  }
  
  .comments-section li {
    margin-bottom: 8px;
    border-bottom: 1px solid #eee;
    padding-bottom: 4px;
  }
  
  .add-comment {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  
  .add-comment input {
    flex: 1;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .add-comment button {
    background: #004225;
    color: #fff;
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .delete-section {
    margin-top: 24px;
    text-align: center;
  }
  
  .delete-button {
    background: #d32f2f;
    color: #fff;
    border: none;
    padding: 10px 16px;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .delete-button:hover {
    background: #b71c1c;
  }
</style>