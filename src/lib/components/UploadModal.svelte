<script lang="ts">
	export let showModal = false;
	export let title = 'Import Data';
	export let description = 'Upload your CSV file.';
	export let expectedColumns: Array<{ name: string; description: string }> = [];
	export let acceptedFormats = '.csv';
	export let maxFileSize = '10MB';
	export let importLoading = false;
	export let importResult: any = null;
	export let selectedFile: FileList | null = null;

	// Event dispatchers
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	function closeModal() {
		showModal = false;
		dispatch('close');
	}

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		selectedFile = target.files;
		dispatch('fileSelected', { files: selectedFile });
	}

	function handleUpload() {
		dispatch('upload');
	}

	// Handle keyboard events
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeModal();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if showModal}
	<div class="modal-overlay" role="dialog" aria-labelledby="upload-modal-title" tabindex="-1">
		<div class="modal-content">
			<div class="modal-header">
				<h2 id="upload-modal-title">{title}</h2>
				<button class="close-btn" on:click={closeModal} aria-label="Close modal">
					<i class="material-icons">close</i>
				</button>
			</div>

			<div class="modal-body">
				<div class="import-info">
					<p>{description}</p>

					{#if expectedColumns.length > 0}
						<div class="column-info">
							<h3>Expected CSV Format</h3>
							<p>Your CSV file should contain the following columns:</p>
							<ul class="column-list">
								{#each expectedColumns as column}
									<li><strong>{column.name}</strong> - {column.description}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>

				<div class="file-upload">
					<input
						type="file"
						accept={acceptedFormats}
						on:change={handleFileChange}
						id="upload-file-input"
						class="file-input"
					/>
					<label for="upload-file-input" class="file-label">
						<i class="material-icons">upload_file</i>
						Choose CSV File
					</label>
					{#if selectedFile && selectedFile.length > 0}
						<div class="file-info">
							<i class="material-icons">description</i>
							{selectedFile[0].name}
							<span class="file-size">({(selectedFile[0].size / 1024 / 1024).toFixed(2)} MB)</span>
						</div>
					{/if}
					<p class="file-help">Max file size: {maxFileSize}</p>
				</div>

				{#if importResult}
					<div class="import-result {importResult.success ? 'success' : 'error'}">
						{#if importResult.success}
							<i class="material-icons">check_circle</i>
							<div>
								<strong>Import Successful!</strong>
								{#if importResult.imported !== undefined}
									<p>Imported: {importResult.imported}</p>
								{/if}
								{#if importResult.updated !== undefined}
									<p>Updated: {importResult.updated}</p>
								{/if}
								{#if importResult.total !== undefined}
									<p>Total: {importResult.total}</p>
								{/if}
								{#if importResult.duration !== undefined}
									<p>Duration: {importResult.duration}ms</p>
								{/if}
								{#if importResult.errors && importResult.errors.length > 0}
									<p class="warning">Warnings: {importResult.errors.length}</p>
									{#if importResult.errors.length <= 5}
										{#each importResult.errors as error}
											<p class="error-detail">{error}</p>
										{/each}
									{:else}
										{#each importResult.errors.slice(0, 3) as error}
											<p class="error-detail">{error}</p>
										{/each}
										<p class="error-detail">... and {importResult.errors.length - 3} more</p>
									{/if}
								{/if}
							</div>
						{:else}
							<i class="material-icons">error</i>
							<div>
								<strong>Import Failed</strong>
								<p>{importResult.error || importResult.message || 'Unknown error occurred'}</p>
								{#if importResult.errors && Array.isArray(importResult.errors)}
									{#each importResult.errors.slice(0, 5) as error}
										<p class="error-detail">{error}</p>
									{/each}
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div class="modal-footer">
				<button class="btn btn-secondary" on:click={closeModal}> Cancel </button>
				<button
					class="btn btn-primary"
					on:click={handleUpload}
					disabled={importLoading || !selectedFile || selectedFile.length === 0}
				>
					{#if importLoading}
						<i class="material-icons spinning">hourglass_empty</i>
						Importing...
					{:else}
						<i class="material-icons">upload</i>
						Import
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		backdrop-filter: blur(4px);
	}

	.modal-content {
		background: white;
		border-radius: 12px;
		box-shadow:
			0 20px 25px -5px rgba(0, 0, 0, 0.1),
			0 10px 10px -5px rgba(0, 0, 0, 0.04);
		max-width: 600px;
		width: 90%;
		max-height: 90vh;
		overflow-y: auto;
		animation: modal-appear 0.3s ease-out;
	}

	@keyframes modal-appear {
		from {
			opacity: 0;
			transform: scale(0.9) translateY(-20px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 24px 24px 0 24px;
		border-bottom: 1px solid #e5e7eb;
		margin-bottom: 24px;
	}

	.modal-header h2 {
		font-size: 1.5rem;
		font-weight: 600;
		color: #1f2937;
		margin: 0;
	}

	.close-btn {
		background: none;
		border: none;
		padding: 8px;
		border-radius: 8px;
		cursor: pointer;
		color: #6b7280;
		transition: all 0.2s;
	}

	.close-btn:hover {
		background: #f3f4f6;
		color: #374151;
	}

	.close-btn i {
		font-size: 24px;
	}

	.modal-body {
		padding: 0 24px;
	}

	.import-info {
		margin-bottom: 24px;
	}

	.import-info p {
		color: #6b7280;
		margin-bottom: 16px;
		line-height: 1.5;
	}

	.column-info {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 16px;
		margin-top: 16px;
	}

	.column-info h3 {
		font-size: 1rem;
		font-weight: 600;
		color: #1f2937;
		margin: 0 0 8px 0;
	}

	.column-info p {
		margin: 0 0 12px 0;
		color: #4b5563;
		font-size: 0.875rem;
	}

	.column-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.column-list li {
		padding: 4px 0;
		font-size: 0.875rem;
		color: #4b5563;
	}

	.column-list strong {
		color: #1f2937;
		font-family: 'Courier New', monospace;
		background: #f1f5f9;
		padding: 2px 4px;
		border-radius: 4px;
		font-size: 0.8rem;
	}

	.file-upload {
		margin-bottom: 24px;
	}

	.file-input {
		display: none;
	}

	.file-label {
		display: flex;
		align-items: center;
		gap: 8px;
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 8px;
		padding: 12px 16px;
		cursor: pointer;
		font-weight: 500;
		transition: all 0.2s;
		justify-content: center;
	}

	.file-label:hover {
		background: #2563eb;
		transform: translateY(-1px);
	}

	.file-label i {
		font-size: 20px;
	}

	.file-info {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 12px;
		padding: 12px 16px;
		background: #f0f9ff;
		border: 1px solid #bae6fd;
		border-radius: 8px;
		color: #0c4a6e;
	}

	.file-info i {
		color: #0284c7;
	}

	.file-size {
		color: #64748b;
		font-size: 0.875rem;
	}

	.file-help {
		margin-top: 8px;
		font-size: 0.875rem;
		color: #6b7280;
		text-align: center;
	}

	.import-result {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 16px;
		border-radius: 8px;
		margin-bottom: 24px;
	}

	.import-result.success {
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
		color: #15803d;
	}

	.import-result.error {
		background: #fef2f2;
		border: 1px solid #fecaca;
		color: #dc2626;
	}

	.import-result i {
		font-size: 24px;
		margin-top: 2px;
	}

	.import-result div {
		flex: 1;
	}

	.import-result strong {
		display: block;
		margin-bottom: 8px;
		font-weight: 600;
	}

	.import-result p {
		margin: 4px 0;
		font-size: 0.875rem;
	}

	.import-result .warning {
		color: #d97706;
	}

	.import-result .error-detail {
		font-size: 0.8rem;
		opacity: 0.8;
		margin-left: 8px;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		padding: 24px;
		border-top: 1px solid #e5e7eb;
		margin-top: 24px;
	}

	.btn {
		padding: 10px 20px;
		border-radius: 8px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		gap: 8px;
		border: none;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none !important;
	}

	.btn-secondary {
		background: #f3f4f6;
		color: #374151;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #e5e7eb;
	}

	.btn-primary {
		background: #3b82f6;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #2563eb;
		transform: translateY(-1px);
	}

	.spinning {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
