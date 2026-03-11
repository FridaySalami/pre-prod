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
		user_has_liked?: boolean;
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
	import { createEventDispatcher } from 'svelte';
	export let project: Project;
	export let comments: Comment[] = [];

	const dispatch = createEventDispatcher();

	let editMode = false;

	// Local editable copies for project fields
	let editedTitle = '';
	let editedCategory = '';
	let editedBrief = '';
	let editedDetailed = '';
	let editedDeadline = '';
	let editedOwner = '';

	let newComment = '';

	function enterEditMode() {
		editMode = true;
		editedTitle = project.title;
		editedCategory = project.category;
		editedBrief = project.brief_description;
		editedDetailed = project.detailed_description || '';
		editedDeadline = project.deadline ? project.deadline.split('T')[0] : '';
		editedOwner = project.owner || '';
	}

	function cancelEditMode() {
		editMode = false;
	}

	function handleSave() {
		const updatedProject = {
			...project,
			title: editedTitle,
			category: editedCategory,
			brief_description: editedBrief,
			detailed_description: editedDetailed,
			deadline: editedDeadline,
			owner: editedOwner,
			updated_at: new Date().toISOString()
		};
		console.log('Dispatching update:', updatedProject);
		dispatch('update', { updatedProject });
		editMode = false;
	}

	function handleClose() {
		dispatch('close');
	}

	function handleThumbsUp() {
		dispatch('thumbsUp', { projectId: project.id });
	}

	function handleDelete() {
		if (confirm('Are you sure you want to delete this submission?')) {
			dispatch('delete', { projectId: project.id });
		}
	}

	function handleAddComment() {
		if (newComment.trim()) {
			dispatch('addComment', { projectId: project.id, comment: newComment.trim() });
			newComment = '';
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			handleClose();
		}
	}

	function handleCommentKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleAddComment();
		}
	}

	// Format the date nicely for display
	function formatDate(dateString: string | undefined) {
		if (!dateString) return 'Not set';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	// Format the date and time
	function formatDateTime(dateString: string | undefined) {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<!-- Fix accessibility issues with proper roles and attributes -->
<div class="overlay" on:click={handleClose} on:keydown={handleKeyDown} role="presentation">
	<div
		class="detail-panel"
		on:click|stopPropagation
		on:keydown|stopPropagation
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-labelledby="project-title"
	>
		<header class="panel-header">
			{#if !editMode}
				<h2 id="project-title">{project.title}</h2>
				<div class="header-actions">
					<button
						class="icon-button edit-button"
						on:click={enterEditMode}
						aria-label="Edit project"
					>
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M16.474 5.408L18.592 7.526L7.526 18.592L5.408 16.474L16.474 5.408ZM3 17.25L7 18L6.25 14.5L3 17.25ZM20.71 4.04C21.1 3.65 21.1 3 20.71 2.61L18.39 0.29C18 -0.1 17.35 -0.1 16.96 0.29L15 2.25L18.75 6L20.71 4.04Z"
								fill="currentColor"
							/>
						</svg>
					</button>
				</div>
			{:else}
				<h2 id="project-title">Edit Submission</h2>
				<div class="header-actions">
					<button class="text-button cancel-button" on:click={cancelEditMode}>Cancel</button>
					<button class="text-button save-button" on:click={handleSave}>Save</button>
				</div>
			{/if}
			<button class="icon-button close-button" on:click={handleClose} aria-label="Close panel">
				<svg
					width="16"
					height="16"
					viewBox="0 0 16 16"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M12.5 3.5L3.5 12.5"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
					<path
						d="M3.5 3.5L12.5 12.5"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
				</svg>
			</button>
		</header>

		<div class="panel-content">
			<div class="project-meta">
				<div class="meta-item">
					<span class="status-badge status-{project.status}"
						>{project.status.replace('_', ' ')}</span
					>
					<span class="date-info">Created {formatDate(project.created_at)}</span>
				</div>
			</div>

			<div class="project-info">
				<div class="field-group">
					{#if !editMode}
						<h3>Title</h3>
						<p class="field-value">{project.title}</p>
					{:else}
						<label for="title-input">Title</label>
						<input id="title-input" type="text" bind:value={editedTitle} />
					{/if}
				</div>

				<div class="field-group">
					{#if !editMode}
						<h3>Category</h3>
						<p class="field-value">{project.category}</p>
					{:else}
						<label for="category-select">Category</label>
						<select id="category-select" bind:value={editedCategory}>
							<option value="5S & Organization">5S & Organization</option>
							<option value="Inventory Accuracy & Cycle Counting"
								>Inventory Accuracy & Cycle Counting</option
							>
							<option value="Equipment Maintenance & Reliability"
								>Equipment Maintenance & Reliability</option
							>
							<option value="Layout & Space Optimization">Layout & Space Optimization</option>
							<option value="Safety & Ergonomics">Safety & Ergonomics</option>
							<option value="Process Efficiency & Workflow">Process Efficiency & Workflow</option>
							<option value="Quality Improvement">Quality Improvement</option>
							<option value="Technology & Automation">Technology & Automation</option>
						</select>
					{/if}
				</div>

				<div class="field-group">
					<h3>Submitted By</h3>
					<p class="field-value">{project.submitted_by}</p>
				</div>

				<div class="field-group">
					{#if !editMode}
						<h3>Brief Description</h3>
						<p class="field-value description">{project.brief_description}</p>
					{:else}
						<label for="brief-textarea">Brief Description</label>
						<textarea id="brief-textarea" bind:value={editedBrief}></textarea>
					{/if}
				</div>

				<div class="field-group">
					{#if !editMode}
						<h3>Detailed Description</h3>
						<p class="field-value description">
							{project.detailed_description || 'No detailed description provided.'}
						</p>
					{:else}
						<label for="detailed-textarea">Detailed Description</label>
						<textarea
							id="detailed-textarea"
							bind:value={editedDetailed}
							placeholder="Add detailed description here..."
						></textarea>
					{/if}
				</div>

				<div class="field-group-row">
					<div class="field-group">
						{#if !editMode}
							<h3>Due Date</h3>
							<p class="field-value">
								{project.deadline ? formatDate(project.deadline) : 'Not set'}
							</p>
						{:else}
							<label for="due-date">Due Date</label>
							<input id="due-date" type="date" bind:value={editedDeadline} />
						{/if}
					</div>

					<div class="field-group">
						{#if !editMode}
							<h3>Owner</h3>
							<p class="field-value">{project.owner || 'Not assigned'}</p>
						{:else}
							<label for="owner-input">Owner</label>
							<input
								id="owner-input"
								type="text"
								bind:value={editedOwner}
								placeholder="Assign an owner"
							/>
						{/if}
					</div>
				</div>
			</div>

			<div class="divider"></div>

			<div class="reactions-section">
				<button
					class="reaction-button {project.user_has_liked ? 'liked' : ''}"
					on:click={() => dispatch('thumbsUp', { projectId: project.id })}
					aria-label={project.user_has_liked ? 'Remove like' : 'Like this project'}
					aria-pressed={project.user_has_liked ? 'true' : 'false'}
				>
					<svg
						class="like-icon"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M2 20H4V10H2V20ZM22 10C22 9.45 21.55 9 21 9H14.69L15.64 3.43L15.67 3.11C15.67 2.7 15.5 2.32 15.23 2.05L14.17 1L7.59 7.59C7.22 7.95 7 8.45 7 9V18C7 19.1 7.9 20 9 20H18C18.83 20 19.54 19.5 19.84 18.78L21.86 12.73C21.95 12.5 22 12.26 22 12V10.08L22 10Z"
							fill="currentColor"
						/>
					</svg>
					<span class="like-count">{project.thumbs_up_count || 0}</span>
				</button>
			</div>

			<div class="comments-section">
				<h3>Comments</h3>

				{#if comments.length > 0}
					<ul class="comment-list">
						{#each comments as comment (comment.id)}
							<li class="comment-item">
								<div class="comment-header">
									<span class="comment-author">{comment.created_by}</span>
									{#if comment.created_at}
										<span class="comment-time">{formatDateTime(comment.created_at)}</span>
									{/if}
								</div>
								<p class="comment-text">{comment.comment}</p>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="no-comments">No comments yet</p>
				{/if}

				<div class="comment-input">
					<input
						type="text"
						placeholder="Add a comment..."
						bind:value={newComment}
						on:keydown={handleCommentKeyDown}
						aria-label="Add a comment"
					/>
					<button
						class="text-button comment-button"
						on:click={handleAddComment}
						disabled={!newComment.trim()}
					>
						Comment
					</button>
				</div>
			</div>
		</div>

		<footer class="panel-footer">
			<button class="text-button delete-button" on:click={handleDelete} type="button"
				>Delete Submission</button
			>
		</footer>
	</div>
</div>

<style>
	/* Apple-inspired styling */

	/* Layout */
	.overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.3);
		backdrop-filter: blur(4px);
		display: flex;
		justify-content: flex-end;
		z-index: 1000;
	}

	.detail-panel {
		background: #ffffff;
		width: 33%;
		min-width: 360px;
		max-width: 480px;
		height: 100%;
		display: flex;
		flex-direction: column;
		box-shadow: 0 0 20px rgba(0, 0, 0, 0.15);
		animation: slideIn 0.3s ease forwards;
	}

	@keyframes slideIn {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	/* Header */
	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px;
		border-bottom: 1px solid #e6e6e6;
		background-color: #f8f8f8;
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.panel-header h2 {
		font-size: 16px;
		font-weight: 500;
		color: #333;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 70%;
	}

	.header-actions {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	/* Content area */
	.panel-content {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	/* Project metadata */
	.project-meta {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		color: #666;
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.status-badge {
		display: inline-block;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 11px;
		text-transform: capitalize;
		font-weight: 500;
	}

	.status-new {
		background-color: #e3f2fd;
		color: #1976d2;
	}

	.status-under_review {
		background-color: #fff3e0;
		color: #e65100;
	}

	.status-in_progress {
		background-color: #e8f5e9;
		color: #2e7d32;
	}

	.status-completed {
		background-color: #f1f1f1;
		color: #616161;
	}

	.date-info {
		color: #666;
	}

	/* Form styling */
	.project-info {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.field-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.field-group-row {
		display: flex;
		gap: 16px;
	}

	.field-group-row .field-group {
		flex: 1;
	}

	h3 {
		font-size: 12px;
		font-weight: 600;
		color: #666;
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.field-value {
		font-size: 14px;
		line-height: 1.4;
		color: #333;
		margin: 0;
		word-break: break-word;
	}

	.field-value.description {
		white-space: pre-line;
	}

	label {
		font-size: 12px;
		font-weight: 600;
		color: #666;
		margin-bottom: 4px;
	}

	input,
	select,
	textarea {
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans',
			'Helvetica Neue', sans-serif;
		padding: 8px 12px;
		border-radius: 6px;
		border: 1px solid #d1d1d6;
		background-color: #f8f8fa;
		font-size: 14px;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: #007aff;
		box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2);
	}

	select {
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 8px center;
		background-size: 16px;
		padding-right: 32px;
	}

	textarea {
		resize: vertical;
		min-height: 80px;
		line-height: 1.4;
	}

	/* Divider */
	.divider {
		height: 1px;
		background-color: #e6e6e6;
		margin: 0;
	}

	/* Reactions */
	.reactions-section {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.reaction-button {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		background-color: #f1f1f1;
		border: none;
		border-radius: 16px;
		font-size: 14px;
		color: #666;
		cursor: pointer;
		transition: background-color 0.2s ease;
	}

	.reaction-button:hover {
		background-color: #e1e1e1;
	}

	.reaction-button.liked {
		background-color: #e1f5fe;
		color: #0288d1;
	}

	.reaction-button .like-icon {
		opacity: 0.8;
		transition: transform 0.2s ease;
	}

	.reaction-button:hover .like-icon {
		transform: scale(1.1);
	}

	.reaction-button.liked .like-icon {
		opacity: 1;
	}

	.like-count {
		font-weight: 500;
		min-width: 16px;
		text-align: center;
	}

	/* Comments */
	.comments-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.comment-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.comment-item {
		padding: 12px;
		background-color: #f8f8f8;
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.comment-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}

	.comment-author {
		font-weight: 600;
		font-size: 12px;
		color: #333;
	}

	.comment-time {
		font-size: 11px;
		color: #666;
	}

	.comment-text {
		margin: 0;
		font-size: 14px;
		line-height: 1.4;
		color: #333;
	}

	.no-comments {
		color: #666;
		font-size: 14px;
		font-style: italic;
	}

	.comment-input {
		display: flex;
		gap: 8px;
		margin-top: 8px;
	}

	.comment-input input {
		flex: 1;
	}

	/* Footer */
	.panel-footer {
		padding: 16px;
		border-top: 1px solid #e6e6e6;
		display: flex;
		justify-content: center;
	}

	/* Buttons */
	.icon-button {
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 50%;
		width: 32px;
		height: 32px;
		color: #666;
		cursor: pointer;
		transition: background-color 0.2s ease;
	}

	.icon-button:hover {
		background-color: rgba(0, 0, 0, 0.05);
	}

	.close-button {
		color: #888;
	}

	.edit-button {
		color: #007aff;
	}

	.text-button {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		background: transparent;
		border: none;
	}

	.save-button {
		background-color: #007aff;
		color: white;
	}

	.save-button:hover {
		background-color: #0062cc;
	}

	.cancel-button {
		color: #007aff;
	}

	.cancel-button:hover {
		background-color: rgba(0, 122, 255, 0.1);
	}

	.comment-button {
		color: white;
		background-color: #007aff;
	}

	.comment-button:hover:not(:disabled) {
		background-color: #0062cc;
	}

	.comment-button:disabled {
		background-color: #ccc;
		cursor: not-allowed;
	}

	.delete-button {
		color: #ff3b30;
	}

	.delete-button:hover {
		background-color: rgba(255, 59, 48, 0.1);
	}

	/* Media queries for responsiveness */
	@media (max-width: 768px) {
		.detail-panel {
			width: 50%;
		}
	}

	@media (max-width: 480px) {
		.detail-panel {
			width: 100%;
			max-width: none;
		}

		.field-group-row {
			flex-direction: column;
			gap: 16px;
		}
	}
</style>
