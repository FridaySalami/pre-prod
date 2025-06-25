<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { userSession } from '$lib/sessionStore';
	import type { Session } from '@supabase/supabase-js';
	import { supabase } from '$lib/supabaseClient';
	import { showToast } from '$lib/toastStore';
	import { fade, fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';

	// Authentication check
	let session = $state<Session | null | undefined>(undefined);
	const unsubscribe = userSession.subscribe((s) => {
		session = s;
	});

	onDestroy(() => {
		unsubscribe();
	});

	// Types
	interface ProcessStep {
		id: string;
		step_number?: number;
		name: string;
		description: string;
		responsible: string;
		time_minutes: number;
		issues: string | any[] | any;
		notes: string;
		created_at: string;
		updated_at?: string;
	}

	// State
	let processSteps: ProcessStep[] = [];

	let loading = false;
	let showNewStepModal = false;
	let showEditStepModal = false;
	let showDeleteConfirmModal = false;
	let deletingStepId = '';

	let searchTerm = '';
	let selectedResponsible = '';
	let selectedStatus = '';
	let sortBy = 'created_at';
	let sortOrder = 'desc';

	// View preferences
	let viewMode = 'cards'; // 'cards' or 'table'
	let showCompletedSteps = true;

	// Modal states
	let newStep = {
		name: '',
		description: '',
		responsible: '',
		time_minutes: 0,
		issues: '' as string | any[] | any,
		notes: ''
	};

	let editingStep: ProcessStep | null = null;

	// Constants
	const responsibleOptions = [
		'Any assigned',
		'Packer',
		'Warehouse Lead',
		'Manager',
		'Supervisor',
		'Team Lead',
		'Associate',
		'Warehouse Staff',
		'Customer Service',
		'IT Support',
		'Quality Control'
	];

	const statusOptions = ['Draft', 'In Review', 'Active', 'On Hold', 'Completed', 'Archived'];

	const sortOptions = [
		{ value: 'created_at', label: 'Date Created' },
		{ value: 'updated_at', label: 'Last Updated' },
		{ value: 'name', label: 'Name' },
		{ value: 'responsible', label: 'Responsible' },
		{ value: 'time_minutes', label: 'Time Required' }
	];

	// Computed
	const filteredSteps = $derived(
		processSteps
			.filter((step) => {
				const nameStr = typeof step.name === 'string' ? step.name : '';
				const descriptionStr = typeof step.description === 'string' ? step.description : '';
				const notesStr =
					typeof step.notes === 'string' ? step.notes : JSON.stringify(step.notes || '');

				// Handle issues search more intelligently
				let issuesStr = '';
				if (typeof step.issues === 'string') {
					issuesStr = step.issues;
				} else if (Array.isArray(step.issues)) {
					issuesStr = step.issues.map((issue) => String(issue)).join(' ');
				} else if (typeof step.issues === 'object' && step.issues !== null) {
					try {
						issuesStr = Object.values(step.issues)
							.map((issue) => {
								if (typeof issue === 'object' && issue !== null) {
									// Try to get description property or stringify
									const issueObj = issue as any;
									return issueObj.description || JSON.stringify(issue);
								}
								return String(issue);
							})
							.join(' ');
					} catch (e) {
						issuesStr = JSON.stringify(step.issues);
					}
				}

				const responsibleStr = typeof step.responsible === 'string' ? step.responsible : '';

				const matchesSearch =
					!searchTerm ||
					nameStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
					descriptionStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
					notesStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
					issuesStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
					responsibleStr.toLowerCase().includes(searchTerm.toLowerCase());
				const matchesResponsible = !selectedResponsible || step.responsible === selectedResponsible;

				return matchesSearch && matchesResponsible;
			})
			.sort((a, b) => {
				let aValue = a[sortBy as keyof ProcessStep];
				let bValue = b[sortBy as keyof ProcessStep];

				// Handle different data types
				if (typeof aValue === 'string' && typeof bValue === 'string') {
					return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
				} else if (typeof aValue === 'number' && typeof bValue === 'number') {
					return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
				} else {
					// Fallback to string comparison
					const aStr = String(aValue || '');
					const bStr = String(bValue || '');
					return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
				}
			})
	);

	const totalSteps = $derived(processSteps.length);
	const totalTime = $derived(processSteps.reduce((sum, step) => sum + (step.time_minutes || 0), 0));
	const stepsWithIssues = $derived(
		processSteps.filter((step) => step.issues && step.issues !== '').length
	);

	// Functions
	onMount(() => {
		// Async initialization function
		async function initializeAuth() {
			// Wait for session to be determined
			const sessionTimeout = new Promise((resolve) => setTimeout(() => resolve(null), 5000));

			let currentSession;
			try {
				const unsubscribePromise = new Promise<any>((resolve) => {
					const unsub = userSession.subscribe((s) => {
						if (s !== undefined) {
							currentSession = s;
							resolve(s);
							unsub();
						}
					});
				});

				await Promise.race([unsubscribePromise, sessionTimeout]);

				if (currentSession === null) {
					console.log('No session found, redirecting to login');
					goto('/login');
					return;
				}

				if (currentSession) {
					loadProcessSteps();
				}
			} catch (error) {
				console.error('Error during initialization:', error);
				goto('/login');
			}
		}

		// Call async initialization
		initializeAuth();

		// Add global keyboard listener for modal accessibility
		const handleKeydown = (event: KeyboardEvent) => handleGlobalKeydown(event);
		document.addEventListener('keydown', handleKeydown);

		// Return cleanup function
		return () => {
			document.removeEventListener('keydown', handleKeydown);
		};
	});

	async function loadProcessSteps() {
		try {
			loading = true;
			const { data, error } = await supabase.from('process_steps').select('*').order('created_at');

			if (error) {
				console.error('❌ Supabase error:', error);
				throw error;
			}

			processSteps = data || [];
		} catch (err) {
			console.error('❌ Error loading process steps:', err);
			showToast('Failed to load process steps', 'error');
		} finally {
			loading = false;
		}
	}

	async function createProcessStep() {
		try {
			const { data, error } = await supabase
				.from('process_steps')
				.insert({
					name: newStep.name,
					description: newStep.description,
					responsible: newStep.responsible,
					time_minutes: newStep.time_minutes,
					issues: newStep.issues,
					notes: newStep.notes
				})
				.select()
				.single();

			if (error) throw error;

			processSteps = [...processSteps, data];
			showNewStepModal = false;
			newStep = {
				name: '',
				description: '',
				responsible: '',
				time_minutes: 0,
				issues: '',
				notes: ''
			};
			showToast('Process step added successfully', 'success');
		} catch (err) {
			console.error('Error creating step:', err);
			showToast('Failed to create process step', 'error');
		}
	}

	async function updateProcessStep() {
		if (!editingStep) return;

		try {
			const { data, error } = await supabase
				.from('process_steps')
				.update({
					name: editingStep.name,
					description: editingStep.description,
					responsible: editingStep.responsible,
					time_minutes: editingStep.time_minutes,
					issues: editingStep.issues,
					notes: editingStep.notes
				})
				.eq('id', editingStep.id)
				.select()
				.single();

			if (error) throw error;

			processSteps = processSteps.map((step) => (step.id === editingStep!.id ? data : step));

			showEditStepModal = false;
			editingStep = null;
			showToast('Process step updated successfully', 'success');
		} catch (err) {
			console.error('Error updating step:', err);
			showToast('Failed to update process step', 'error');
		}
	}

	async function deleteProcessStep(stepId: string) {
		deletingStepId = stepId;
		showDeleteConfirmModal = true;
	}

	async function confirmDeleteStep() {
		if (!deletingStepId) return;

		try {
			const { error } = await supabase.from('process_steps').delete().eq('id', deletingStepId);

			if (error) throw error;

			processSteps = processSteps.filter((step) => step.id !== deletingStepId);
			showToast('Process step deleted successfully', 'success');
		} catch (err) {
			console.error('Error deleting step:', err);
			showToast('Failed to delete process step', 'error');
		} finally {
			showDeleteConfirmModal = false;
			deletingStepId = '';
		}
	}

	function openEditStep(step: ProcessStep) {
		editingStep = { ...step };
		showEditStepModal = true;
	}

	function getResponsibleColor(responsible: string) {
		const colors: Record<string, string> = {
			'Any assigned': 'bg-gray-100 text-gray-800',
			Packer: 'bg-green-100 text-green-800',
			'Warehouse Lead': 'bg-blue-100 text-blue-800',
			Manager: 'bg-purple-100 text-purple-800',
			Supervisor: 'bg-indigo-100 text-indigo-800',
			'Team Lead': 'bg-orange-100 text-orange-800',
			Associate: 'bg-pink-100 text-pink-800',
			'Warehouse Staff': 'bg-yellow-100 text-yellow-800',
			'Customer Service': 'bg-cyan-100 text-cyan-800',
			'IT Support': 'bg-red-100 text-red-800',
			'Quality Control': 'bg-emerald-100 text-emerald-800'
		};
		return colors[responsible] || 'bg-gray-100 text-gray-800';
	}

	function formatTime(minutes: number): string {
		if (minutes < 60) return `${minutes}m`;
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function toggleSort(field: string) {
		if (sortBy === field) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = field;
			sortOrder = 'asc';
		}
	}

	function clearFilters() {
		searchTerm = '';
		selectedResponsible = '';
		selectedStatus = '';
		sortBy = 'created_at';
		sortOrder = 'desc';
	}

	// Global keyboard handler for accessibility
	function handleGlobalKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (showNewStepModal) {
				showNewStepModal = false;
			} else if (showEditStepModal) {
				showEditStepModal = false;
			} else if (showDeleteConfirmModal) {
				showDeleteConfirmModal = false;
			}
		}
	}
</script>

<svelte:head>
	<title>Process Steps - Pre-Prod Dashboard</title>
</svelte:head>

<!-- Authentication check wrapper -->
{#if session === undefined}
	<div class="loading-container">
		<div class="loading-spinner"></div>
		<p>Loading...</p>
	</div>
{:else if session}
	<main class="process-map-container">
		<!-- Enhanced Header with Statistics -->
		<div class="process-map-header">
			<div class="header-content">
				<div class="title-section">
					<h1>Process Steps Management</h1>
					<p>Comprehensive workflow documentation and process optimization</p>
				</div>

				<div class="header-stats">
					<div class="stat-card">
						<div class="stat-value">{totalSteps}</div>
						<div class="stat-label">Total Steps</div>
					</div>
					<div class="stat-card">
						<div class="stat-value">{formatTime(totalTime)}</div>
						<div class="stat-label">Total Time</div>
					</div>
					<div class="stat-card">
						<div class="stat-value">{stepsWithIssues}</div>
						<div class="stat-label">With Issues</div>
					</div>
				</div>

				<div class="header-actions">
					<button class="btn btn-primary" on:click={() => (showNewStepModal = true)}>
						<span class="material-icons">add</span>
						New Process Step
					</button>
				</div>
			</div>
		</div>

		<div class="process-content">
			<!-- Enhanced Controls -->
			<div class="process-controls">
				<div class="controls-section">
					<div class="search-filters">
						<div class="search-box">
							<span class="material-icons">search</span>
							<input
								type="text"
								placeholder="Search process steps..."
								bind:value={searchTerm}
								class="search-input"
							/>
							{#if searchTerm}
								<button class="clear-search" on:click={() => (searchTerm = '')}>
									<span class="material-icons">close</span>
								</button>
							{/if}
						</div>

						<select bind:value={selectedResponsible} class="filter-select">
							<option value="">All Responsible</option>
							{#each responsibleOptions as responsible}
								<option value={responsible}>{responsible}</option>
							{/each}
						</select>

						<select bind:value={sortBy} class="filter-select">
							<option value="">Sort by...</option>
							{#each sortOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>

						<button
							class="btn btn-icon {sortOrder === 'asc' ? 'sort-asc' : 'sort-desc'}"
							on:click={() => (sortOrder = sortOrder === 'asc' ? 'desc' : 'asc')}
							title="Toggle sort order"
						>
							<span class="material-icons">
								{sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
							</span>
						</button>

						{#if searchTerm || selectedResponsible || selectedStatus}
							<button class="btn btn-secondary btn-sm" on:click={clearFilters}>
								<span class="material-icons">clear</span>
								Clear Filters
							</button>
						{/if}
					</div>

					<div class="view-controls">
						<div class="view-toggle">
							<button
								class="view-btn {viewMode === 'cards' ? 'active' : ''}"
								on:click={() => (viewMode = 'cards')}
								title="Card view"
							>
								<span class="material-icons">view_module</span>
							</button>
							<button
								class="view-btn {viewMode === 'table' ? 'active' : ''}"
								on:click={() => (viewMode = 'table')}
								title="Table view"
							>
								<span class="material-icons">table_rows</span>
							</button>
						</div>

						<button class="btn btn-primary" on:click={() => (showNewStepModal = true)}>
							<span class="material-icons">add</span>
							Add Step
						</button>
					</div>
				</div>

				<!-- Results Summary -->
				{#if filteredSteps.length !== totalSteps}
					<div class="results-summary">
						<span class="results-text">
							Showing {filteredSteps.length} of {totalSteps} process steps
						</span>
					</div>
				{/if}
			</div>

			<!-- Enhanced Process Steps Display -->
			{#if viewMode === 'cards'}
				<div class="process-steps-grid">
					{#if loading}
						<div class="loading-state">
							<div class="spinner"></div>
							<p>Loading process steps...</p>
						</div>
					{:else if filteredSteps.length === 0}
						<div class="empty-state">
							<div class="empty-icon">
								<span class="material-icons">assignment</span>
							</div>
							<h3>No Process Steps Found</h3>
							<p>
								{#if searchTerm || selectedResponsible}
									Try adjusting your filters or search terms.
								{:else}
									Get started by creating your first process step.
								{/if}
							</p>
							<div class="empty-actions">
								{#if searchTerm || selectedResponsible}
									<button class="btn btn-secondary" on:click={clearFilters}> Clear Filters </button>
								{/if}
								<button class="btn btn-primary" on:click={() => (showNewStepModal = true)}>
									<span class="material-icons">add</span>
									Add First Step
								</button>
							</div>
						</div>
					{:else}
						{#each filteredSteps as step, index (step.id)}
							<div
								class="process-step-card"
								animate:flip={{ duration: 300 }}
								in:fly={{ y: 20, duration: 300, delay: index * 50 }}
								out:fade={{ duration: 200 }}
							>
								<div class="card-header">
									<div class="step-number">{index + 1}</div>
									<div class="card-actions">
										<button
											class="action-btn edit"
											on:click={() => openEditStep(step)}
											title="Edit Step"
										>
											<span class="material-icons">edit</span>
										</button>
										<button
											class="action-btn delete"
											on:click={() => deleteProcessStep(step.id)}
											title="Delete Step"
										>
											<span class="material-icons">delete</span>
										</button>
									</div>
								</div>

								<div class="card-content">
									<h3 class="step-title">{step.name}</h3>

									<div class="step-meta">
										<span class="responsible-badge {getResponsibleColor(step.responsible)}">
											<span class="material-icons">person</span>
											{step.responsible}
										</span>
										{#if step.time_minutes > 0}
											<span class="time-badge">
												<span class="material-icons">schedule</span>
												{formatTime(step.time_minutes)}
											</span>
										{/if}
										<span class="date-badge">
											<span class="material-icons">calendar_today</span>
											{formatDate(step.created_at)}
										</span>
									</div>

									{#if step.description}
										<p class="step-description">{step.description}</p>
									{/if}

									{#if step.notes}
										<div class="step-notes">
											<div class="notes-header">
												<span class="material-icons">notes</span>
												<strong>Notes</strong>
											</div>
											<p>{step.notes}</p>
										</div>
									{/if}

									{#if step.issues}
										<div class="step-issues">
											<div class="issues-header">
												<span class="material-icons">warning</span>
												<strong
													>Issues ({step.issues
														? Array.isArray(step.issues)
															? step.issues.length
															: Object.keys(step.issues).length
														: 0})</strong
												>
											</div>

											<div class="issues-list">
												{#if typeof step.issues === 'string'}
													<div class="issue-item simple">
														<div class="issue-content">{step.issues}</div>
													</div>
												{:else if Array.isArray(step.issues)}
													{#each step.issues as issue, i}
														<div class="issue-item" class:expanded={i < 3}>
															{#if typeof issue === 'object' && issue !== null}
																{@const issueObj = issue as {
																	status?: string;
																	severity?: string;
																	description?: string;
																	title?: string;
																	[key: string]: any;
																}}
																<div class="issue-header">
																	{#if issueObj.status}
																		<span
																			class="issue-status status-{issueObj.status.toLowerCase()}"
																			>{issueObj.status}</span
																		>
																	{/if}
																	{#if issueObj.severity}
																		<span
																			class="issue-severity severity-{issueObj.severity.toLowerCase()}"
																			>{issueObj.severity}</span
																		>
																	{/if}
																</div>
																<div class="issue-content">
																	{issueObj.description || issueObj.title || JSON.stringify(issue)}
																</div>
															{:else}
																<div class="issue-content">{String(issue)}</div>
															{/if}
														</div>
													{/each}
												{:else if typeof step.issues === 'object' && step.issues !== null}
													{#each Object.entries(step.issues) as [key, value], i}
														<div class="issue-item" class:expanded={i < 3}>
															{#if typeof value === 'object' && value !== null}
																{@const issueObj = value as {
																	status?: string;
																	severity?: string;
																	description?: string;
																	[key: string]: any;
																}}
																<div class="issue-header">
																	<span class="issue-status {issueObj.status || 'open'}"
																		>{issueObj.status || 'Open'}</span
																	>
																	{#if issueObj.severity}
																		<span class="issue-severity {issueObj.severity}"
																			>{issueObj.severity}</span
																		>
																	{/if}
																</div>
																<div class="issue-content">
																	{issueObj.description || String(value)}
																</div>
															{:else}
																<div class="issue-content">{String(value)}</div>
															{/if}
														</div>
													{/each}
												{/if}
											</div>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					{/if}
				</div>
			{:else}
				<!-- Table View -->
				<div class="process-table-container">
					<table class="process-table">
						<thead>
							<tr>
								<th class="sortable" on:click={() => toggleSort('name')}>
									Name
									{#if sortBy === 'name'}
										<span class="material-icons sort-icon">
											{sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
										</span>
									{/if}
								</th>
								<th class="sortable" on:click={() => toggleSort('responsible')}>
									Responsible
									{#if sortBy === 'responsible'}
										<span class="material-icons sort-icon">
											{sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
										</span>
									{/if}
								</th>
								<th class="sortable" on:click={() => toggleSort('time_minutes')}>
									Time
									{#if sortBy === 'time_minutes'}
										<span class="material-icons sort-icon">
											{sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
										</span>
									{/if}
								</th>
								<th>Issues</th>
								<th class="sortable" on:click={() => toggleSort('created_at')}>
									Created
									{#if sortBy === 'created_at'}
										<span class="material-icons sort-icon">
											{sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
										</span>
									{/if}
								</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredSteps as step (step.id)}
								<tr class="table-row" transition:fade={{ duration: 200 }}>
									<td class="name-cell">
										<div class="name-content">
											<strong>{step.name}</strong>
											{#if step.description}
												<p class="description-preview">
													{step.description.slice(0, 100)}{step.description.length > 100
														? '...'
														: ''}
												</p>
											{/if}
										</div>
									</td>
									<td>
										<span class="responsible-badge {getResponsibleColor(step.responsible)}">
											{step.responsible}
										</span>
									</td>
									<td class="time-cell">
										{#if step.time_minutes > 0}
											<span class="time-value">{formatTime(step.time_minutes)}</span>
										{:else}
											<span class="no-time">-</span>
										{/if}
									</td>
									<td class="issues-cell">
										{#if step.issues && step.issues !== ''}
											<div class="issues-indicator">
												<span class="material-icons">warning</span>
												<span class="issues-count">
													{Array.isArray(step.issues)
														? step.issues.length
														: typeof step.issues === 'object'
															? Object.keys(step.issues).length
															: '1'}
												</span>
											</div>
										{:else}
											<span class="no-issues">None</span>
										{/if}
									</td>
									<td class="date-cell">
										{formatDate(step.created_at)}
									</td>
									<td class="actions-cell">
										<div class="table-actions">
											<button
												class="action-btn edit"
												on:click={() => openEditStep(step)}
												title="Edit"
											>
												<span class="material-icons">edit</span>
											</button>
											<button
												class="action-btn delete"
												on:click={() => deleteProcessStep(step.id)}
												title="Delete"
											>
												<span class="material-icons">delete</span>
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>

					{#if loading}
						<div class="table-loading">
							<div class="spinner"></div>
							<p>Loading process steps...</p>
						</div>
					{:else if filteredSteps.length === 0}
						<div class="table-empty">
							<div class="empty-icon">
								<span class="material-icons">assignment</span>
							</div>
							<h3>No Process Steps Found</h3>
							<p>
								{#if searchTerm || selectedResponsible}
									Try adjusting your filters or search terms.
								{:else}
									Get started by creating your first process step.
								{/if}
							</p>
							<div class="empty-actions">
								{#if searchTerm || selectedResponsible}
									<button class="btn btn-secondary" on:click={clearFilters}> Clear Filters </button>
								{/if}
								<button class="btn btn-primary" on:click={() => (showNewStepModal = true)}>
									<span class="material-icons">add</span>
									Add First Step
								</button>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</main>

	<!-- New Step Modal -->
	{#if showNewStepModal}
		<div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="new-step-title">
			<div class="modal" role="document">
				<div class="modal-header">
					<h2 id="new-step-title">Add Process Step</h2>
					<button
						class="close-btn"
						on:click={() => (showNewStepModal = false)}
						aria-label="Close modal"
					>
						<span class="material-icons">close</span>
					</button>
				</div>

				<form on:submit|preventDefault={createProcessStep} class="modal-content">
					<div class="form-group">
						<label for="step-name">Step Name *</label>
						<input
							id="step-name"
							type="text"
							bind:value={newStep.name}
							required
							placeholder="Enter step name"
						/>
					</div>

					<div class="form-group">
						<label for="step-description">Description *</label>
						<textarea
							id="step-description"
							bind:value={newStep.description}
							required
							placeholder="Describe what needs to be done in this step"
							rows="3"
						></textarea>
					</div>

					<div class="form-group">
						<label for="step-responsible">Responsible *</label>
						<select id="step-responsible" bind:value={newStep.responsible} required>
							<option value="">Select responsible person/role</option>
							{#each responsibleOptions as responsible}
								<option value={responsible}>{responsible}</option>
							{/each}
						</select>
					</div>

					<div class="form-group">
						<label for="step-time">Time (minutes)</label>
						<input
							id="step-time"
							type="number"
							bind:value={newStep.time_minutes}
							min="0"
							placeholder="Estimated time in minutes"
						/>
					</div>

					<div class="form-group">
						<label for="step-notes">Notes</label>
						<textarea
							id="step-notes"
							bind:value={newStep.notes}
							placeholder="Additional notes or instructions"
							rows="3"
						></textarea>
					</div>

					<div class="form-group">
						<label for="step-issues">Issues</label>
						<textarea
							id="step-issues"
							bind:value={newStep.issues}
							placeholder="Known issues or problems"
							rows="3"
						></textarea>
					</div>

					<div class="modal-actions">
						<button
							type="button"
							class="btn btn-secondary"
							on:click={() => (showNewStepModal = false)}
						>
							Cancel
						</button>
						<button type="submit" class="btn btn-primary"> Add Step </button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- Edit Step Modal -->
	{#if showEditStepModal && editingStep}
		<div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-step-title">
			<div class="modal" role="document">
				<div class="modal-header">
					<h2 id="edit-step-title">Edit Process Step</h2>
					<button
						class="close-btn"
						on:click={() => (showEditStepModal = false)}
						aria-label="Close modal"
					>
						<span class="material-icons">close</span>
					</button>
				</div>

				<form on:submit|preventDefault={updateProcessStep} class="modal-content">
					<div class="form-group">
						<label for="edit-step-name">Step Name *</label>
						<input
							id="edit-step-name"
							type="text"
							bind:value={editingStep.name}
							required
							placeholder="Enter step name"
						/>
					</div>

					<div class="form-group">
						<label for="edit-step-description">Description *</label>
						<textarea
							id="edit-step-description"
							bind:value={editingStep.description}
							required
							placeholder="Describe what needs to be done in this step"
							rows="3"
						></textarea>
					</div>

					<div class="form-group">
						<label for="edit-step-responsible">Responsible *</label>
						<select id="edit-step-responsible" bind:value={editingStep.responsible} required>
							<option value="">Select responsible person/role</option>
							{#each responsibleOptions as responsible}
								<option value={responsible}>{responsible}</option>
							{/each}
						</select>
					</div>

					<div class="form-group">
						<label for="edit-step-time">Time (minutes)</label>
						<input
							id="edit-step-time"
							type="number"
							bind:value={editingStep.time_minutes}
							min="0"
							placeholder="Estimated time in minutes"
						/>
					</div>

					<div class="form-group">
						<label for="edit-step-notes">Notes</label>
						<textarea
							id="edit-step-notes"
							bind:value={editingStep.notes}
							placeholder="Additional notes or instructions"
							rows="3"
						></textarea>
					</div>

					<div class="form-group">
						<label for="edit-step-issues">Issues</label>
						<textarea
							id="edit-step-issues"
							bind:value={editingStep.issues}
							placeholder="Known issues or problems"
							rows="3"
						></textarea>
					</div>

					<div class="modal-actions">
						<button
							type="button"
							class="btn btn-secondary"
							on:click={() => (showEditStepModal = false)}
						>
							Cancel
						</button>
						<button type="submit" class="btn btn-primary"> Update Step </button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- Delete Confirmation Modal -->
	{#if showDeleteConfirmModal}
		<div
			class="modal-overlay"
			role="dialog"
			aria-modal="true"
			aria-labelledby="delete-confirm-title"
		>
			<div class="modal modal-small" role="document">
				<div class="modal-header danger">
					<div class="modal-title-section">
						<span class="material-icons danger-icon">warning</span>
						<h2 id="delete-confirm-title">Confirm Deletion</h2>
					</div>
					<button
						class="close-btn"
						on:click={() => (showDeleteConfirmModal = false)}
						aria-label="Close modal"
					>
						<span class="material-icons">close</span>
					</button>
				</div>

				<div class="modal-content">
					<p>Are you sure you want to delete this process step? This action cannot be undone.</p>

					{#if deletingStepId}
						{@const stepToDelete = processSteps.find((s) => s.id === deletingStepId)}
						{#if stepToDelete}
							<div class="delete-preview">
								<strong>Step:</strong>
								{stepToDelete.name}
							</div>
						{/if}
					{/if}

					<div class="modal-actions">
						<button
							type="button"
							class="btn btn-secondary"
							on:click={() => (showDeleteConfirmModal = false)}
						>
							Cancel
						</button>
						<button type="button" class="btn btn-danger" on:click={confirmDeleteStep}>
							<span class="material-icons">delete</span>
							Delete Step
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
{:else}
	<!-- When session is null, onMount should have redirected already -->
	<div class="loading-container">
		<p>Redirecting to login...</p>
	</div>
{/if}

<style>
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		color: #1d1d1f;
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(0, 122, 255, 0.1);
		border-radius: 50%;
		border-top-color: #007aff;
		animation: spin 1s ease-in-out infinite;
		margin-bottom: 16px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Base Styles */
	.process-map-container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
		min-height: 100vh;
		background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
	}

	/* Enhanced Header */
	.process-map-header {
		background: white;
		border-radius: 16px;
		padding: 2rem;
		margin-bottom: 2rem;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
		border: 1px solid #e2e8f0;
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 2rem;
		flex-wrap: wrap;
	}

	.title-section h1 {
		font-size: 2.25rem;
		font-weight: 800;
		color: #1a202c;
		margin: 0 0 0.5rem 0;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.title-section p {
		color: #64748b;
		font-size: 1.1rem;
		margin: 0;
	}

	/* Statistics Cards */
	.header-stats {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.stat-card {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		padding: 1rem 1.5rem;
		border-radius: 12px;
		text-align: center;
		min-width: 100px;
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
	}

	.stat-value {
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1;
	}

	.stat-label {
		font-size: 0.75rem;
		opacity: 0.9;
		margin-top: 0.25rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	/* Enhanced Controls */
	.process-content {
		background: white;
		border-radius: 16px;
		overflow: hidden;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
		border: 1px solid #e2e8f0;
	}

	.process-controls {
		padding: 1.5rem;
		border-bottom: 1px solid #e2e8f0;
		background: #f8fafc;
	}

	.controls-section {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.search-filters {
		display: flex;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap;
		flex: 1;
		min-width: 300px;
	}

	.search-box {
		position: relative;
		display: flex;
		align-items: center;
		flex: 1;
		max-width: 400px;
	}

	.search-box .material-icons {
		position: absolute;
		left: 0.75rem;
		color: #64748b;
		font-size: 1.25rem;
		z-index: 2;
	}

	.search-input {
		padding: 0.75rem 3rem 0.75rem 2.5rem;
		border: 2px solid #e2e8f0;
		border-radius: 12px;
		width: 100%;
		font-size: 0.95rem;
		transition: all 0.2s ease;
		background: white;
	}

	.search-input:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}

	.clear-search {
		position: absolute;
		right: 0.5rem;
		background: none;
		border: none;
		color: #64748b;
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
		z-index: 2;
	}

	.clear-search:hover {
		background: #f1f5f9;
		color: #374151;
	}

	.filter-select {
		padding: 0.75rem 1rem;
		border: 2px solid #e2e8f0;
		border-radius: 12px;
		background: white;
		font-size: 0.95rem;
		color: #374151;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.filter-select:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}

	.view-controls {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.view-toggle {
		display: flex;
		background: #e2e8f0;
		border-radius: 12px;
		padding: 0.25rem;
	}

	.view-btn {
		background: none;
		border: none;
		padding: 0.5rem;
		border-radius: 8px;
		cursor: pointer;
		color: #64748b;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.view-btn.active,
	.view-btn:hover {
		background: white;
		color: #667eea;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.results-summary {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e2e8f0;
	}

	.results-text {
		color: #64748b;
		font-size: 0.9rem;
	}

	/* Enhanced Button Styles */
	.btn {
		padding: 0.75rem 1.5rem;
		border-radius: 12px;
		border: none;
		cursor: pointer;
		font-weight: 600;
		font-size: 0.95rem;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		position: relative;
		overflow: hidden;
	}

	.btn::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
		transition: left 0.5s;
	}

	.btn:hover::before {
		left: 100%;
	}

	.btn-primary {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
	}

	.btn-primary:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
	}

	.btn-secondary {
		background: #f8fafc;
		color: #374151;
		border: 2px solid #e2e8f0;
	}

	.btn-secondary:hover {
		background: #f1f5f9;
		border-color: #cbd5e1;
		transform: translateY(-1px);
	}

	.btn-danger {
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
		color: white;
		box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
	}

	.btn-danger:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
	}

	.btn-icon {
		padding: 0.5rem;
		min-width: 40px;
		height: 40px;
		justify-content: center;
	}

	.btn-sm {
		padding: 0.5rem 1rem;
		font-size: 0.85rem;
	}

	/* Card Grid Layout */
	.process-steps-grid {
		padding: 2rem;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
		gap: 1.5rem;
	}

	.process-step-card {
		background: white;
		border: 2px solid #e2e8f0;
		border-radius: 16px;
		overflow: hidden;
		transition: all 0.3s ease;
		position: relative;
	}

	.process-step-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 12px 28px rgba(0, 0, 0, 0.12);
		border-color: #667eea;
	}

	.card-header {
		background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
		padding: 1rem 1.5rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid #e2e8f0;
	}

	.step-number {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 1rem;
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
	}

	.card-actions {
		display: flex;
		gap: 0.5rem;
	}

	.card-content {
		padding: 1.5rem;
	}

	.step-title {
		font-size: 1.25rem;
		font-weight: 700;
		color: #1a202c;
		margin: 0 0 1rem 0;
		line-height: 1.3;
	}

	.step-meta {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}

	.responsible-badge {
		padding: 0.5rem 1rem;
		border-radius: 20px;
		font-size: 0.85rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		white-space: nowrap;
	}

	.responsible-badge .material-icons {
		font-size: 1rem;
	}

	.time-badge,
	.date-badge {
		background: #f1f5f9;
		color: #64748b;
		padding: 0.5rem 1rem;
		border-radius: 20px;
		font-size: 0.85rem;
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.time-badge .material-icons,
	.date-badge .material-icons {
		font-size: 1rem;
	}

	.step-description {
		color: #4b5563;
		line-height: 1.6;
		margin: 0 0 1rem 0;
	}

	.step-notes {
		background: #f0f9ff;
		border: 1px solid #bae6fd;
		border-radius: 12px;
		padding: 1rem;
		margin: 1rem 0;
	}

	.notes-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #0369a1;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}

	.step-notes p {
		color: #0c4a6e;
		margin: 0;
		line-height: 1.5;
	}

	/* Enhanced Issues Section */
	.step-issues {
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 12px;
		padding: 1rem;
		margin-top: 1rem;
	}

	.issues-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #dc2626;
		font-weight: 600;
		margin-bottom: 0.75rem;
	}

	.issues-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.issue-item {
		background: white;
		border: 1px solid #fecaca;
		border-radius: 8px;
		padding: 0.75rem;
		border-left: 4px solid #dc2626;
		transition: all 0.2s ease;
	}

	.issue-item:hover {
		box-shadow: 0 2px 8px rgba(220, 38, 38, 0.1);
	}

	.issue-item.simple {
		border-left-color: #f59e0b;
	}

	.issue-header {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		flex-wrap: wrap;
	}

	.issue-status,
	.issue-severity {
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: capitalize;
	}

	/* Status Colors */
	.issue-status.open,
	.status-open {
		background: #fef2f2;
		color: #dc2626;
		border: 1px solid #fecaca;
	}

	.issue-status.closed,
	.issue-status.resolved,
	.status-closed,
	.status-resolved {
		background: #f0fdf4;
		color: #16a34a;
		border: 1px solid #bbf7d0;
	}

	.issue-status.in-progress,
	.issue-status.pending,
	.status-in-progress,
	.status-pending {
		background: #eff6ff;
		color: #2563eb;
		border: 1px solid #bfdbfe;
	}

	.issue-status.blocked,
	.status-blocked {
		background: #fefce8;
		color: #ca8a04;
		border: 1px solid #fde68a;
	}

	/* Severity Colors */
	.issue-severity.low,
	.severity-low {
		background: #f0fdf4;
		color: #16a34a;
		border: 1px solid #bbf7d0;
	}

	.issue-severity.medium,
	.severity-medium {
		background: #fefce8;
		color: #ca8a04;
		border: 1px solid #fde68a;
	}

	.issue-severity.high,
	.issue-severity.critical,
	.severity-high,
	.severity-critical {
		background: #fef2f2;
		color: #dc2626;
		border: 1px solid #fecaca;
	}

	.issue-content {
		color: #7f1d1d;
		line-height: 1.5;
		font-size: 0.9rem;
	}

	/* Action Buttons */
	.action-btn {
		background: white;
		border: 2px solid #e2e8f0;
		border-radius: 8px;
		padding: 0.5rem;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		color: #64748b;
	}

	.action-btn:hover {
		background: #f8fafc;
		border-color: #cbd5e1;
		transform: translateY(-2px);
	}

	.action-btn.edit:hover {
		background: #eff6ff;
		border-color: #2563eb;
		color: #2563eb;
	}

	.action-btn.delete:hover {
		background: #fef2f2;
		border-color: #dc2626;
		color: #dc2626;
	}

	/* Table Styles */
	.process-table-container {
		padding: 0;
		overflow-x: auto;
	}

	.process-table {
		width: 100%;
		border-collapse: collapse;
		background: white;
	}

	.process-table th {
		background: #f8fafc;
		padding: 1rem;
		text-align: left;
		font-weight: 600;
		color: #374151;
		border-bottom: 2px solid #e2e8f0;
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.process-table td {
		padding: 1rem;
		border-bottom: 1px solid #f1f5f9;
		vertical-align: top;
	}

	.sortable {
		cursor: pointer;
		user-select: none;
		position: relative;
		transition: all 0.2s ease;
	}

	.sortable:hover {
		background: #f1f5f9;
	}

	.sort-icon {
		font-size: 1rem;
		margin-left: 0.5rem;
		color: #667eea;
	}

	.table-row {
		transition: all 0.2s ease;
	}

	.table-row:hover {
		background: #f8fafc;
	}

	.name-cell {
		min-width: 250px;
	}

	.name-content strong {
		display: block;
		color: #1a202c;
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.description-preview {
		color: #64748b;
		font-size: 0.85rem;
		line-height: 1.4;
		margin: 0;
	}

	.time-cell {
		text-align: center;
		min-width: 80px;
	}

	.time-value {
		background: #f0f9ff;
		color: #0369a1;
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-weight: 500;
		font-size: 0.85rem;
	}

	.no-time {
		color: #9ca3af;
	}

	.issues-cell {
		text-align: center;
		min-width: 100px;
	}

	.issues-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		color: #dc2626;
		background: #fef2f2;
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.85rem;
		font-weight: 500;
	}

	.issues-indicator .material-icons {
		font-size: 1rem;
	}

	.no-issues {
		color: #16a34a;
		font-weight: 500;
	}

	.date-cell {
		color: #64748b;
		font-size: 0.85rem;
		min-width: 100px;
	}

	.actions-cell {
		min-width: 120px;
	}

	.table-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: center;
	}

	.table-loading,
	.table-empty {
		text-align: center;
		padding: 4rem 2rem;
		color: #64748b;
	}

	/* Enhanced States */
	.loading-state,
	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		color: #64748b;
	}

	.empty-icon {
		margin-bottom: 1.5rem;
	}

	.empty-icon .material-icons {
		font-size: 4rem;
		color: #cbd5e1;
	}

	.empty-state h3 {
		font-size: 1.5rem;
		margin: 0 0 1rem 0;
		color: #374151;
		font-weight: 600;
	}

	.empty-state p {
		margin: 0 0 2rem 0;
		line-height: 1.6;
	}

	.empty-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.spinner {
		width: 3rem;
		height: 3rem;
		border: 3px solid #f1f5f9;
		border-top: 3px solid #667eea;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 1.5rem;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Enhanced Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
		backdrop-filter: blur(4px);
	}

	.modal {
		background: white;
		border-radius: 16px;
		width: 100%;
		max-width: 600px;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		transform: scale(0.95);
		animation: modalEnter 0.2s ease-out forwards;
	}

	.modal-small {
		max-width: 400px;
	}

	@keyframes modalEnter {
		to {
			transform: scale(1);
		}
	}

	.modal-header {
		padding: 1.5rem 2rem;
		border-bottom: 1px solid #e5e7eb;
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: #f8fafc;
	}

	.modal-header.danger {
		background: #fef2f2;
		border-bottom-color: #fecaca;
	}

	.modal-title-section {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.danger-icon {
		color: #dc2626;
		font-size: 1.5rem;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: #1f2937;
	}

	.modal-header.danger h2 {
		color: #dc2626;
	}

	.close-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.5rem;
		color: #6b7280;
		border-radius: 8px;
		transition: all 0.2s ease;
	}

	.close-btn:hover {
		color: #374151;
		background: #f3f4f6;
	}

	.modal-content {
		padding: 2rem;
	}

	.delete-preview {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 1rem;
		margin: 1rem 0;
		color: #374151;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 600;
		color: #374151;
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		width: 100%;
		padding: 0.75rem 1rem;
		border: 2px solid #e2e8f0;
		border-radius: 12px;
		font-size: 0.95rem;
		transition: all 0.2s ease;
		background: white;
	}

	.form-group input:focus,
	.form-group select:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}

	.form-group textarea {
		resize: vertical;
		min-height: 100px;
		font-family: inherit;
	}

	.modal-actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid #e5e7eb;
	}

	/* Responsive Design */
	@media (max-width: 1024px) {
		.process-steps-grid {
			grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
			gap: 1rem;
		}

		.header-content {
			flex-direction: column;
			align-items: stretch;
		}

		.header-stats {
			justify-content: center;
		}

		.controls-section {
			flex-direction: column;
			align-items: stretch;
		}

		.search-filters {
			flex-direction: column;
			align-items: stretch;
		}

		.view-controls {
			justify-content: space-between;
		}
	}

	@media (max-width: 768px) {
		.process-map-container {
			padding: 1rem;
		}

		.process-steps-grid {
			grid-template-columns: 1fr;
			padding: 1rem;
		}

		.header-content {
			text-align: center;
		}

		.title-section h1 {
			font-size: 1.75rem;
		}

		.stat-card {
			min-width: 80px;
			padding: 0.75rem 1rem;
		}

		.stat-value {
			font-size: 1.5rem;
		}

		.modal {
			margin: 0.5rem;
			max-width: none;
		}

		.modal-content {
			padding: 1.5rem;
		}

		.modal-actions {
			flex-direction: column-reverse;
		}

		.btn {
			justify-content: center;
		}

		.process-table-container {
			font-size: 0.85rem;
		}

		.process-table th,
		.process-table td {
			padding: 0.75rem 0.5rem;
		}
	}

	@media (max-width: 480px) {
		.title-section h1 {
			font-size: 1.5rem;
		}

		.header-stats {
			justify-content: space-between;
		}

		.stat-card {
			flex: 1;
			min-width: 0;
		}

		.search-box {
			max-width: none;
		}

		.step-meta {
			flex-direction: column;
			align-items: flex-start;
		}

		.responsible-badge,
		.time-badge,
		.date-badge {
			font-size: 0.8rem;
		}
	}

	/* Print Styles */
	@media print {
		.process-map-container {
			background: white;
			padding: 0;
		}

		.header-actions,
		.view-controls,
		.card-actions,
		.action-btn,
		.table-actions {
			display: none !important;
		}

		.process-step-card {
			break-inside: avoid;
			box-shadow: none;
			border: 1px solid #ccc;
		}
	}

	/* Dark mode support (optional) */
	@media (prefers-color-scheme: dark) {
		.process-map-container {
			background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
		}

		.process-map-header,
		.process-content {
			background: #1e293b;
			border-color: #334155;
		}

		.title-section h1,
		.step-title,
		.modal-header h2 {
			color: #f8fafc;
		}

		.title-section p,
		.results-text {
			color: #94a3b8;
		}

		.process-step-card {
			background: #1e293b;
			border-color: #334155;
		}

		.card-header {
			background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
		}

		.step-description,
		.issue-content {
			color: #cbd5e1;
		}
	}
</style>
