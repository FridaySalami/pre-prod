<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import UploadModal from '$lib/components/UploadModal.svelte';
	import AdminPageHeader from '$lib/components/AdminPageHeader.svelte';
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';

	let loading = true;
	let error = '';
	let fileList: any[] = [];
	let mappingList: any[] = [];
	let stats: any = null;
	let currentPage = 1;
	let totalPages = 1;
	let totalMappings = 0;
	let pageSize = 50;
	let activeTab = 'files'; // 'files' or 'mappings'

	// Search and filters
	let searchTerm = '';
	let statusFilter = '';
	let channelFilter = '';

	// Import modal
	let showImportModal = false;
	let importLoading = false;
	let importResult: any = null;
	let importFile: FileList | null = null;

	// Expected columns for SKU-ASIN mapping

	// Expected columns for SKU-ASIN mapping
	const expectedColumns = [
		{ name: 'seller-sku', description: 'Unique seller SKU' },
		{ name: 'item-name', description: 'Product name or title' },
		{ name: 'asin1', description: 'Primary ASIN' },
		{ name: 'asin2', description: 'Secondary ASIN (optional)' },
		{ name: 'asin3', description: 'Tertiary ASIN (optional)' },
		{ name: 'price', description: 'Product price' },
		{ name: 'quantity', description: 'Available quantity' },
		{ name: 'fulfillment-channel', description: 'Fulfillment channel (FBA, FBM, etc.)' },
		{ name: 'merchant-shipping-group', description: 'Merchant shipping group' },
		{ name: 'status', description: 'Product status' }
	];

	onMount(() => {
		if (activeTab === 'files') {
			loadFileList();
		} else {
			loadMappings();
		}
		loadStats();
	});

	async function loadFileList() {
		try {
			loading = true;
			error = '';

			const response = await fetch('/api/sku-asin-mapping');
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();
			if (result.success) {
				fileList = result.files || [];
			} else {
				throw new Error(result.error || 'Failed to load files');
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
			console.error('Error loading file list:', err);
		} finally {
			loading = false;
		}
	}

	async function loadMappings() {
		try {
			loading = true;
			error = '';

			const params = new URLSearchParams({
				page: currentPage.toString(),
				limit: pageSize.toString(),
				type: 'mappings',
				...(searchTerm && { search: searchTerm }),
				...(statusFilter && { status: statusFilter }),
				...(channelFilter && { fulfillmentChannel: channelFilter })
			});

			const response = await fetch(`/api/sku-asin-mapping?${params}`);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();

			if (result.success) {
				mappingList = result.mappings || [];
				totalMappings = result.totalMappings || 0;
				totalPages = result.totalPages || 1;
			} else {
				throw new Error(result.error || 'Failed to load mappings');
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
			console.error('Error loading mappings:', err);
		} finally {
			loading = false;
		}
	}

	async function loadStats() {
		try {
			const response = await fetch('/api/sku-asin-mapping', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ action: 'stats' })
			});

			if (response.ok) {
				stats = await response.json();
			}
		} catch (err) {
			console.error('Error loading stats:', err);
		}
	}

	async function handleImport() {
		if (!importFile || importFile.length === 0) {
			importResult = {
				success: false,
				error: 'Please select a CSV file to import'
			};
			return;
		}

		importLoading = true;
		importResult = null;

		try {
			const formData = new FormData();
			formData.append('file', importFile[0]);

			const response = await fetch('/api/sku-asin-mapping/upload', {
				method: 'POST',
				body: formData
			});

			importResult = await response.json();

			if (importResult.success) {
				await loadFileList();
				await loadStats();
				importFile = null;
			}
		} catch (err) {
			importResult = {
				success: false,
				error: err instanceof Error ? err.message : 'Unknown error'
			};
		} finally {
			importLoading = false;
		}
	}

	function handleFileSelected(event: CustomEvent) {
		importFile = event.detail.files;
	}

	function handleModalClose() {
		showImportModal = false;
		importResult = null;
	}

	async function handleClearData() {
		if (
			!confirm('Are you sure you want to clear all SKU-ASIN mapping files? This cannot be undone.')
		) {
			return;
		}

		try {
			loading = true;
			const response = await fetch('/api/sku-asin-mapping', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ action: 'clear' })
			});

			const result = await response.json();

			if (result.success) {
				await loadFileList();
				await loadStats();
				alert(`Successfully cleared ${result.deleted} files`);
			} else {
				alert('Failed to clear files: ' + result.error);
			}
		} catch (err) {
			console.error('Error clearing data:', err);
			alert('Failed to clear files');
		} finally {
			loading = false;
		}
	}

	function formatDate(dateString: string) {
		if (!dateString) return '';
		return new Date(dateString).toLocaleDateString();
	}

	function formatFileSize(bytes: number) {
		if (!bytes) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function switchTab(tab: string) {
		activeTab = tab;
		if (tab === 'files') {
			loadFileList();
		} else {
			loadMappings();
		}
	}

	async function handleSearch() {
		if (activeTab === 'files') {
			loadFileList();
		} else {
			currentPage = 1;
			loadMappings();
		}
	}

	function handlePageChange(page: number) {
		currentPage = page;
		loadMappings();
	}
</script>

<svelte:head>
	<title>SKU-ASIN Mapping | Pricer</title>
</svelte:head>

<div class="mapping-container">
	<AdminPageHeader
		title="SKU-ASIN Mapping"
		description="Manage SKU to ASIN mappings and product information"
		showClearButton={true}
		showImportButton={true}
		showDownloadButton={false}
		onClear={handleClearData}
		onImport={() => (showImportModal = true)}
	/>

	<Breadcrumb currentPage="SKU-ASIN Mapping" />

	<div class="tabs">
		<button
			class="tab-btn {activeTab === 'files' ? 'active' : ''}"
			on:click={() => switchTab('files')}
		>
			Files
		</button>
		<button
			class="tab-btn {activeTab === 'mappings' ? 'active' : ''}"
			on:click={() => switchTab('mappings')}
		>
			Mappings
		</button>
	</div>

	{#if stats}
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-value">{stats.totalFiles || 0}</div>
				<div class="stat-label">Files</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{formatFileSize(stats.files?.totalSize || 0)}</div>
				<div class="stat-label">Total Size</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{stats.totalMappings || 0}</div>
				<div class="stat-label">Mappings</div>
			</div>
		</div>
	{/if}

	<div class="controls">
		{#if activeTab === 'mappings'}
			<div class="filters">
				<div class="search-group">
					<input
						type="text"
						placeholder="Search by SKU, name, or ASIN..."
						bind:value={searchTerm}
						on:keyup={(e) => e.key === 'Enter' && handleSearch()}
					/>
					<button on:click={handleSearch}>Search</button>
				</div>
				<div class="filter-group">
					<select bind:value={statusFilter} on:change={handleSearch}>
						<option value="">All Statuses</option>
						<option value="active">Active</option>
						<option value="inactive">Inactive</option>
					</select>
					<select bind:value={channelFilter} on:change={handleSearch}>
						<option value="">All Channels</option>
						<option value="FBA">FBA</option>
						<option value="FBM">FBM</option>
					</select>
				</div>
			</div>
		{/if}
		<div class="actions">
			<button class="import-btn" on:click={() => (showImportModal = true)}>Upload CSV File</button>
			<button class="clear-btn" on:click={handleClearData}>Clear All Data</button>
		</div>
	</div>

	{#if error}
		<div class="error-message">
			<i class="material-icons-outlined">error</i>
			<span>{error}</span>
		</div>
	{/if}

	{#if loading}
		<div class="loading">
			<i class="material-icons-outlined spinning">refresh</i>
			<span>Loading data...</span>
		</div>
	{:else if activeTab === 'files' && fileList.length === 0}
		<div class="empty-state">
			<i class="material-icons-outlined">upload_file</i>
			<h3>No files uploaded</h3>
			<p>Upload your SKU-ASIN mapping CSV file to get started.</p>
		</div>
	{:else if activeTab === 'mappings' && mappingList.length === 0}
		<div class="empty-state">
			<i class="material-icons-outlined">table_chart</i>
			<h3>No mappings found</h3>
			<p>Upload a CSV file with SKU-ASIN mappings to see data here.</p>
		</div>
	{:else if activeTab === 'files'}
		<div class="table-container">
			<div class="table-header">
				<h3>Uploaded Files ({fileList.length})</h3>
			</div>

			<div class="table-wrapper">
				<table class="file-table">
					<thead>
						<tr>
							<th>Filename</th>
							<th>Size</th>
							<th>Upload Date</th>
							<th>Status</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each fileList as file}
							<tr>
								<td class="filename-cell">
									<span class="filename">{file.filename}</span>
								</td>
								<td class="size-cell">
									<span class="size">{formatFileSize(file.file_size)}</span>
								</td>
								<td class="date-cell">
									<span class="date">{formatDate(file.upload_date)}</span>
								</td>
								<td class="status-cell">
									<span class="status status-{file.status}">{file.status}</span>
								</td>
								<td class="actions-cell">
									<button class="action-btn download-btn" title="Download">
										<i class="material-icons-outlined">download</i>
									</button>
									<button class="action-btn delete-btn" title="Delete">
										<i class="material-icons-outlined">delete</i>
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{:else if activeTab === 'mappings'}
		<div class="table-container">
			<div class="table-header">
				<h3>SKU-ASIN Mappings</h3>
				<div class="pagination-info">
					Showing {(currentPage - 1) * pageSize + 1} - {Math.min(
						currentPage * pageSize,
						totalMappings
					)} of {totalMappings} mappings
				</div>
			</div>

			<div class="table-wrapper">
				<table class="mapping-table">
					<thead>
						<tr>
							<th>Seller SKU</th>
							<th>Item Name</th>
							<th>ASINs</th>
							<th>Price</th>
							<th>Quantity</th>
							<th>Fulfillment</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{#each mappingList as mapping}
							<tr>
								<td class="sku-cell">
									<span class="sku">{mapping.seller_sku}</span>
								</td>
								<td class="name-cell">
									<span class="item-name">{mapping.item_name}</span>
								</td>
								<td class="asin-cell">
									<div class="asins">
										{#if mapping.asin1}<div>Primary: {mapping.asin1}</div>{/if}
										{#if mapping.asin2}<div>Secondary: {mapping.asin2}</div>{/if}
										{#if mapping.asin3}<div>Tertiary: {mapping.asin3}</div>{/if}
									</div>
								</td>
								<td class="price-cell">
									<span class="price">{mapping.price ? `£${mapping.price.toFixed(2)}` : '-'}</span>
								</td>
								<td class="quantity-cell">
									<span class="quantity">{mapping.quantity || '-'}</span>
								</td>
								<td class="fulfillment-cell">
									<span class="fulfillment">{mapping.fulfillment_channel || '-'}</span>
								</td>
								<td class="status-cell">
									<span class="status status-{mapping.status || 'active'}"
										>{mapping.status || 'active'}</span
									>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			{#if totalPages > 1}
				<div class="pagination">
					<button disabled={currentPage === 1} on:click={() => handlePageChange(1)}> First </button>
					<button disabled={currentPage === 1} on:click={() => handlePageChange(currentPage - 1)}>
						Prev
					</button>

					{#each Array(Math.min(5, totalPages)) as _, i}
						{@const pageNum =
							currentPage <= 3
								? i + 1
								: currentPage >= totalPages - 2
									? totalPages - 4 + i
									: currentPage - 2 + i}
						{#if pageNum > 0 && pageNum <= totalPages}
							<button
								class={currentPage === pageNum ? 'active' : ''}
								on:click={() => handlePageChange(pageNum)}
							>
								{pageNum}
							</button>
						{/if}
					{/each}

					<button
						disabled={currentPage === totalPages}
						on:click={() => handlePageChange(currentPage + 1)}
					>
						Next
					</button>
					<button
						disabled={currentPage === totalPages}
						on:click={() => handlePageChange(totalPages)}
					>
						Last
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>

<UploadModal
	showModal={showImportModal}
	title="Upload SKU-ASIN Mapping CSV"
	description="Upload your SKU-ASIN mapping CSV file. The file will be stored in Supabase for lookup operations."
	{expectedColumns}
	maxFileSize="50MB"
	{importLoading}
	{importResult}
	bind:selectedFile={importFile}
	on:fileSelected={handleFileSelected}
	on:upload={handleImport}
	on:close={handleModalClose}
/>

<style>
	.mapping-container {
		min-height: calc(100vh - 140px);
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 16px;
		margin-bottom: 20px;
	}

	.stat-card {
		background: white;
		padding: 20px;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		text-align: center;
	}

	.stat-value {
		font-size: 28px;
		font-weight: bold;
		color: #333;
		margin-bottom: 8px;
	}

	.stat-label {
		font-size: 14px;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.controls {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 16px;
		background: white;
		padding: 20px;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.filters {
		display: flex;
		flex-direction: column;
		gap: 12px;
		flex: 1;
	}

	.search-group {
		display: flex;
		gap: 8px;
	}

	.search-group input {
		flex: 1;
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
	}

	.filter-group {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.filter-group select {
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
		background: white;
	}

	.actions {
		display: flex;
		gap: 8px;
	}

	.import-btn {
		background: #007bff;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
	}

	.import-btn:hover {
		background: #0056b3;
	}

	.clear-btn {
		background: #dc3545;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
	}

	.clear-btn:hover {
		background: #c82333;
	}

	.error-message {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #dc3545;
		background: #f8d7da;
		padding: 12px;
		border-radius: 4px;
		border: 1px solid #f5c6cb;
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 40px;
		color: #666;
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

	.empty-state {
		text-align: center;
		padding: 60px 20px;
		color: #666;
	}

	.empty-state i {
		font-size: 48px;
		margin-bottom: 16px;
		color: #ccc;
	}

	.empty-state h3 {
		margin-bottom: 8px;
		color: #333;
	}

	.table-container {
		background: white;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		overflow: hidden;
	}

	.table-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		border-bottom: 1px solid #eee;
	}

	.table-header h3 {
		margin: 0;
		color: #333;
	}

	.pagination-info {
		color: #666;
		font-size: 14px;
	}

	.table-wrapper {
		overflow-x: auto;
	}

	.mapping-table {
		width: 100%;
		border-collapse: collapse;
	}

	.mapping-table th,
	.mapping-table td {
		padding: 12px;
		text-align: left;
		border-bottom: 1px solid #eee;
	}

	.mapping-table th {
		background: #f8f9fa;
		font-weight: 600;
		color: #333;
		cursor: pointer;
		user-select: none;
	}

	.mapping-table th:hover {
		background: #e9ecef;
	}

	.sku-cell .sku {
		font-family: monospace;
		font-weight: 600;
		color: #0066cc;
	}

	.name-cell .item-name {
		font-weight: 500;
	}

	.asin-cell .asins {
		font-family: monospace;
		font-size: 12px;
		color: #666;
	}

	.price-cell .price {
		font-weight: 600;
		color: #28a745;
	}

	.quantity-cell .quantity {
		font-weight: 600;
	}

	.fulfillment-cell .fulfillment {
		font-size: 12px;
		text-transform: uppercase;
		font-weight: 600;
		color: #666;
	}

	.status-cell .status {
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
	}

	.status-active {
		background: #d4edda;
		color: #155724;
	}

	.status-inactive {
		background: #f8d7da;
		color: #721c24;
	}

	.date-cell .date {
		font-size: 12px;
		color: #666;
	}

	.pagination {
		display: flex;
		justify-content: center;
		gap: 8px;
		padding: 16px;
		border-top: 1px solid #eee;
	}

	.pagination button {
		padding: 8px 12px;
		border: 1px solid #ddd;
		background: white;
		cursor: pointer;
		border-radius: 4px;
		font-size: 14px;
	}

	.pagination button:hover {
		background: #f8f9fa;
	}

	.pagination button.active {
		background: #007bff;
		color: white;
		border-color: #007bff;
	}

	.pagination button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.file-table {
		width: 100%;
		border-collapse: collapse;
	}

	.file-table th,
	.file-table td {
		padding: 12px;
		text-align: left;
		border-bottom: 1px solid #eee;
	}

	.file-table th {
		background: #f8f9fa;
		font-weight: 600;
		color: #333;
	}

	.filename-cell .filename {
		font-weight: 600;
		color: #333;
	}

	.size-cell .size {
		font-family: monospace;
		color: #666;
	}

	.date-cell .date {
		font-size: 14px;
		color: #666;
	}

	.status-cell .status {
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
	}

	.actions-cell {
		text-align: center;
	}

	.action-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px 8px;
		margin: 0 2px;
		border-radius: 4px;
		color: #666;
		font-size: 16px;
	}

	.action-btn:hover {
		background: #f8f9fa;
	}

	.download-btn:hover {
		color: #007bff;
	}

	.delete-btn:hover {
		color: #dc3545;
	}

	.tabs {
		display: flex;
		gap: 10px;
		margin-bottom: 20px;
	}

	.tab-btn {
		padding: 10px 20px;
		border: none;
		background: #f0f0f0;
		border-radius: 4px;
		cursor: pointer;
		font-size: 16px;
		font-weight: 600;
		transition: all 0.2s;
	}

	.tab-btn:hover {
		background: #e0e0e0;
	}

	.tab-btn.active {
		background: #007bff;
		color: white;
	}

	@media (max-width: 768px) {
		.controls {
			flex-direction: column;
			align-items: stretch;
		}

		.filter-group {
			flex-direction: column;
		}

		.filter-group select {
			width: 100%;
		}

		.actions {
			justify-content: stretch;
		}

		.actions button {
			flex: 1;
		}
	}
</style>
