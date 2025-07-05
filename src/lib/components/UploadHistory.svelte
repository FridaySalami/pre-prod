<script lang="ts">
	import { onMount } from 'svelte';
	import type { UploadRecord } from '$lib/services/uploadHistoryService.js';

	export let show: boolean = false;
	export let userId: string | undefined = undefined;

	let uploads: UploadRecord[] = [];
	let loading = false;
	let error = '';
	let currentPage = 0;
	let totalRecords = 0;
	let pageSize = 20;
	let filters = {
		fileType: '',
		status: ''
	};

	$: totalPages = Math.ceil(totalRecords / pageSize);
	$: hasNextPage = currentPage < totalPages - 1;
	$: hasPrevPage = currentPage > 0;

	async function loadUploads() {
		loading = true;
		error = '';

		try {
			const params = new URLSearchParams({
				limit: pageSize.toString(),
				offset: (currentPage * pageSize).toString()
			});

			if (filters.fileType) params.append('fileType', filters.fileType);
			if (filters.status) params.append('status', filters.status);
			if (userId) params.append('userId', userId);

			const response = await fetch(`/api/upload-history?${params}`);
			const data = await response.json();

			if (data.success) {
				uploads = data.records;
				totalRecords = data.total;
			} else {
				error = data.error || 'Failed to load upload history';
			}
		} catch (err) {
			error = 'Failed to load upload history';
			console.error('Error loading uploads:', err);
		} finally {
			loading = false;
		}
	}

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function formatDuration(startTime: string, endTime?: string): string {
		if (!endTime) return 'In progress...';

		const start = new Date(startTime);
		const end = new Date(endTime);
		const duration = end.getTime() - start.getTime();

		const seconds = Math.floor(duration / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);

		if (hours > 0) {
			return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
		} else if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`;
		} else {
			return `${seconds}s`;
		}
	}

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'completed':
				return 'status-success';
			case 'error':
				return 'status-error';
			case 'cancelled':
				return 'status-cancelled';
			case 'processing':
				return 'status-processing';
			default:
				return 'status-unknown';
		}
	}

	function getFileTypeDisplay(fileType: string): string {
		switch (fileType) {
			case 'inventory':
				return 'Inventory';
			case 'amazon_listings':
				return 'Amazon Listings';
			case 'sage_reports':
				return 'Sage Reports';
			case 'linnworks_composition':
				return 'Linnworks Composition';
			default:
				return fileType;
		}
	}

	function nextPage() {
		if (hasNextPage) {
			currentPage++;
			loadUploads();
		}
	}

	function prevPage() {
		if (hasPrevPage) {
			currentPage--;
			loadUploads();
		}
	}

	function applyFilters() {
		currentPage = 0;
		loadUploads();
	}

	function clearFilters() {
		filters.fileType = '';
		filters.status = '';
		currentPage = 0;
		loadUploads();
	}

	function close() {
		show = false;
	}

	onMount(() => {
		if (show) {
			loadUploads();
		}
	});

	$: if (show) {
		loadUploads();
	}
</script>

{#if show}
	<div class="upload-history-overlay" role="dialog" aria-modal="true">
		<div class="upload-history-modal">
			<div class="upload-history-header">
				<h3>Upload History</h3>
				<button class="close-button" on:click={close} aria-label="Close">
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<div class="upload-history-content">
				<!-- Filters -->
				<div class="filters">
					<div class="filter-group">
						<label for="fileType">File Type:</label>
						<select id="fileType" bind:value={filters.fileType} on:change={applyFilters}>
							<option value="">All Types</option>
							<option value="inventory">Inventory</option>
							<option value="amazon_listings">Amazon Listings</option>
							<option value="sage_reports">Sage Reports</option>
							<option value="linnworks_composition">Linnworks Composition</option>
						</select>
					</div>

					<div class="filter-group">
						<label for="status">Status:</label>
						<select id="status" bind:value={filters.status} on:change={applyFilters}>
							<option value="">All Statuses</option>
							<option value="completed">Completed</option>
							<option value="processing">Processing</option>
							<option value="error">Error</option>
							<option value="cancelled">Cancelled</option>
						</select>
					</div>

					<button class="clear-filters-btn" on:click={clearFilters}>Clear Filters</button>
				</div>

				<!-- Loading/Error States -->
				{#if loading}
					<div class="loading">Loading upload history...</div>
				{:else if error}
					<div class="error">
						{error}
						<button on:click={loadUploads}>Retry</button>
					</div>
				{:else if uploads.length === 0}
					<div class="empty">No uploads found</div>
				{:else}
					<!-- Upload List -->
					<div class="upload-list">
						{#each uploads as upload}
							<div class="upload-item">
								<div class="upload-main">
									<div class="upload-info">
										<div class="file-name">{upload.file_name}</div>
										<div class="file-meta">
											<span class="file-type">{getFileTypeDisplay(upload.file_type)}</span>
											<span class="file-size">{formatFileSize(upload.file_size)}</span>
											<span class="record-count"
												>{upload.total_records.toLocaleString()} records</span
											>
										</div>
									</div>

									<div class="upload-status">
										<span class="status-badge {getStatusBadgeClass(upload.status)}">
											{upload.status}
										</span>
									</div>
								</div>

								<div class="upload-details">
									<div class="progress-info">
										{#if upload.status === 'completed'}
											<span class="success-info">
												✓ {upload.imported_records} imported, {upload.updated_records} updated
											</span>
										{:else if upload.status === 'error'}
											<span class="error-info">
												✗ {upload.error_message || 'Upload failed'}
											</span>
										{:else if upload.status === 'processing'}
											<span class="processing-info">
												⟳ {upload.processed_records} / {upload.total_records} processed
											</span>
										{:else}
											<span class="cancelled-info"> ⊘ Upload cancelled </span>
										{/if}
									</div>

									<div class="time-info">
										<span class="start-time">
											Started: {new Date(upload.started_at).toLocaleString()}
										</span>
										{#if upload.completed_at}
											<span class="duration">
												Duration: {formatDuration(upload.started_at, upload.completed_at)}
											</span>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>

					<!-- Pagination -->
					<div class="pagination">
						<div class="pagination-info">
							Showing {currentPage * pageSize + 1} - {Math.min(
								(currentPage + 1) * pageSize,
								totalRecords
							)} of {totalRecords} uploads
						</div>

						<div class="pagination-controls">
							<button on:click={prevPage} disabled={!hasPrevPage} class="pagination-btn">
								Previous
							</button>

							<span class="page-info">
								Page {currentPage + 1} of {totalPages}
							</span>

							<button on:click={nextPage} disabled={!hasNextPage} class="pagination-btn">
								Next
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.upload-history-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.upload-history-modal {
		background: white;
		border-radius: 8px;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
		max-width: 800px;
		width: 90%;
		max-height: 90vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.upload-history-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px;
		border-bottom: 1px solid #eee;
	}

	.upload-history-header h3 {
		margin: 0;
		font-size: 1.2rem;
		font-weight: 600;
	}

	.close-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		color: #666;
		transition: background-color 0.2s;
	}

	.close-button:hover {
		background: #f0f0f0;
	}

	.upload-history-content {
		flex: 1;
		overflow-y: auto;
		padding: 20px;
	}

	.filters {
		display: flex;
		gap: 15px;
		align-items: end;
		margin-bottom: 20px;
		padding-bottom: 15px;
		border-bottom: 1px solid #eee;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.filter-group label {
		font-size: 0.9rem;
		font-weight: 500;
		color: #374151;
	}

	.filter-group select {
		padding: 6px 10px;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-size: 0.9rem;
	}

	.clear-filters-btn {
		padding: 6px 12px;
		background: #f3f4f6;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: background-color 0.2s;
	}

	.clear-filters-btn:hover {
		background: #e5e7eb;
	}

	.loading,
	.error,
	.empty {
		text-align: center;
		padding: 40px;
		color: #6b7280;
	}

	.error {
		color: #dc2626;
	}

	.error button {
		margin-left: 10px;
		padding: 4px 8px;
		background: #dc2626;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.upload-list {
		display: flex;
		flex-direction: column;
		gap: 15px;
	}

	.upload-item {
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		padding: 15px;
		background: white;
	}

	.upload-main {
		display: flex;
		justify-content: space-between;
		align-items: start;
		margin-bottom: 10px;
	}

	.upload-info {
		flex: 1;
	}

	.file-name {
		font-weight: 600;
		color: #111827;
		margin-bottom: 5px;
	}

	.file-meta {
		display: flex;
		gap: 15px;
		font-size: 0.85rem;
		color: #6b7280;
	}

	.upload-status {
		flex-shrink: 0;
	}

	.status-badge {
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.status-success {
		background: #d1fae5;
		color: #047857;
	}

	.status-error {
		background: #fee2e2;
		color: #dc2626;
	}

	.status-processing {
		background: #dbeafe;
		color: #2563eb;
	}

	.status-cancelled {
		background: #f3f4f6;
		color: #6b7280;
	}

	.upload-details {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.85rem;
	}

	.progress-info {
		flex: 1;
	}

	.success-info {
		color: #047857;
	}

	.error-info {
		color: #dc2626;
	}

	.processing-info {
		color: #2563eb;
	}

	.cancelled-info {
		color: #6b7280;
	}

	.time-info {
		display: flex;
		flex-direction: column;
		align-items: end;
		gap: 2px;
		color: #6b7280;
	}

	.pagination {
		margin-top: 20px;
		padding-top: 15px;
		border-top: 1px solid #eee;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.pagination-info {
		font-size: 0.9rem;
		color: #6b7280;
	}

	.pagination-controls {
		display: flex;
		align-items: center;
		gap: 15px;
	}

	.pagination-btn {
		padding: 6px 12px;
		border: 1px solid #d1d5db;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: background-color 0.2s;
	}

	.pagination-btn:hover:not(:disabled) {
		background: #f9fafb;
	}

	.pagination-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.page-info {
		font-size: 0.9rem;
		color: #374151;
	}
</style>
