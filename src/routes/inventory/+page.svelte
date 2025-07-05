<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import UploadModal from '$lib/components/UploadModal.svelte';
	import AdminPageHeader from '$lib/components/AdminPageHeader.svelte';
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	let loading = false;
	let error = data.error || '';
	let inventory = data.inventory;
	let stats = data.stats;
	let currentPage = data.searchParams.page;
	let totalPages = data.totalPages;
	let totalItems = data.totalItems;
	let pageSize = data.searchParams.limit;

	// Initialize filters from URL params
	let searchTerm = data.searchParams.search;
	let trackedFilter = data.searchParams.tracked;
	let minPrice = data.searchParams.minPrice;
	let maxPrice = data.searchParams.maxPrice;
	let sortBy = data.searchParams.sortBy;
	let sortOrder = data.searchParams.sortOrder;
	let priceRangeFilter = data.searchParams.priceRange;

	// Filter options
	const trackedOptions = ['', 'true', 'false'];
	const sortOptions = [
		{ value: 'createdAt', label: 'Date Created' },
		{ value: 'updatedAt', label: 'Date Updated' },
		{ value: 'sku', label: 'SKU' },
		{ value: 'title', label: 'Title' },
		{ value: 'stockLevel', label: 'Stock Level' },
		{ value: 'retailPrice', label: 'Retail Price' },
		{ value: 'purchasePrice', label: 'Purchase Price' },
		{ value: 'weight', label: 'Weight' }
	];
	const priceRangeOptions = [
		{ value: '', label: 'All Prices' },
		{ value: '0-10', label: '£0 - £10' },
		{ value: '10-25', label: '£10 - £25' },
		{ value: '25-50', label: '£25 - £50' },
		{ value: '50-100', label: '£50 - £100' },
		{ value: '100-250', label: '£100 - £250' },
		{ value: '250+', label: '£250+' }
	];

	// Import modal
	let showImportModal = false;
	let importLoading = false;
	let importResult: any = null;
	let importFile: FileList | null = null;

	// Expected columns for the upload modal
	const expectedColumns = [
		{ name: 'SKU', description: 'Product SKU (required)' },
		{ name: 'Title', description: 'Product title (required)' },
		{ name: 'Stock Level', description: 'Current stock quantity (optional)' },
		{ name: 'Depth', description: 'Product depth in cm (optional)' },
		{ name: 'Height', description: 'Product height in cm (optional)' },
		{ name: 'Width', description: 'Product width in cm (optional)' },
		{ name: 'Purchase Price', description: 'Purchase price in GBP (optional)' },
		{ name: 'Retail Price', description: 'Retail price in GBP (optional)' },
		{ name: 'Tracked', description: 'Whether product is tracked (true/false, optional)' },
		{ name: 'Weight', description: 'Product weight in kg (optional)' }
	];

	// Reactive statement to update data when page data changes
	$: {
		inventory = data.inventory;
		stats = data.stats;
		totalPages = data.totalPages;
		totalItems = data.totalItems;
		error = data.error || '';
	}

	async function loadInventory() {
		if (!browser) return; // Don't run on server

		loading = true;

		// Build URL with current filters
		const params = new URLSearchParams({
			page: currentPage.toString(),
			limit: pageSize.toString(),
			...(searchTerm && { search: searchTerm }),
			...(trackedFilter && { tracked: trackedFilter }),
			...(minPrice && { minPrice }),
			...(maxPrice && { maxPrice }),
			...(sortBy && { sortBy }),
			...(sortOrder && { sortOrder }),
			...(priceRangeFilter && { priceRange: priceRangeFilter })
		});

		// Handle price range filter
		if (priceRangeFilter && !minPrice && !maxPrice) {
			if (priceRangeFilter === '250+') {
				params.set('minPrice', '250');
			} else {
				const [min, max] = priceRangeFilter.split('-');
				if (min) params.set('minPrice', min);
				if (max) params.set('maxPrice', max);
			}
		}

		// Navigate to update URL and trigger load function
		await goto(`/inventory?${params}`, { replaceState: true });
		loading = false;
	}

	async function loadStats() {
		if (!browser) return; // Don't run on server
		// Stats will be reloaded automatically when page data invalidates
		await invalidate('/api/inventory?action=stats');
	}

	async function handleClearData() {
		if (!browser) return; // Don't run on server

		if (!confirm('Are you sure you want to clear all inventory? This cannot be undone.')) {
			return;
		}

		try {
			loading = true;
			const response = await fetch('/api/inventory?action=clear');
			if (response.ok) {
				// Invalidate and reload data
				await invalidate('/inventory');
				alert('All inventory data cleared successfully');
			} else {
				throw new Error('Failed to clear data');
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to clear data';
			alert(error);
		} finally {
			loading = false;
		}
	}

	async function handleFileUpload() {
		if (!browser) return; // Don't run on server

		if (!importFile || importFile.length === 0) {
			alert('Please select a CSV file');
			return;
		}

		importLoading = true;
		importResult = null;

		try {
			const formData = new FormData();
			formData.append('file', importFile[0]);

			const uploadResponse = await fetch('/api/inventory/upload', {
				method: 'POST',
				body: formData
			});

			const uploadResult = await uploadResponse.json();

			if (!uploadResult.success) {
				throw new Error(uploadResult.error || 'Upload failed');
			}

			// The upload endpoint already handles the complete import process
			// uploadResult.data contains the import results (ImportResult)
			importResult = uploadResult.data;

			if (importResult.success) {
				// Reload data to show the newly imported items
				await invalidate('/inventory');
				// Clear the file input
				importFile = null;
			}
		} catch (err) {
			importResult = {
				success: false,
				error: err instanceof Error ? err.message : 'Import failed'
			};
		} finally {
			importLoading = false;
		}
	}

	function handleFileSelected(event: any) {
		importFile = event.detail.files;
	}

	function handleModalClose() {
		showImportModal = false;
		importResult = null;
		importFile = null;
	}

	function resetFilters() {
		searchTerm = '';
		trackedFilter = '';
		minPrice = '';
		maxPrice = '';
		priceRangeFilter = '';
		currentPage = 1;
		loadInventory();
	}

	function handleSort(column: string) {
		if (sortBy === column) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = column;
			sortOrder = 'asc';
		}
		currentPage = 1;
		loadInventory();
	}

	function getSortIcon(column: string) {
		if (sortBy === column) {
			return sortOrder === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
		}
		return 'unfold_more';
	}

	function handlePriceRangeChange() {
		if (priceRangeFilter) {
			minPrice = '';
			maxPrice = '';
		}
		currentPage = 1;
		loadInventory();
	}

	function handleCustomPriceChange() {
		if (minPrice || maxPrice) {
			priceRangeFilter = '';
		}
		currentPage = 1;
		loadInventory();
	}

	// Download inventory as CSV
	async function downloadInventoryCSV() {
		try {
			const params = new URLSearchParams({
				...(searchTerm && { search: searchTerm }),
				...(trackedFilter && { tracked: trackedFilter }),
				...(minPrice && { minPrice }),
				...(maxPrice && { maxPrice }),
				...(sortBy && { sortBy }),
				...(sortOrder && { sortOrder }),
				...(priceRangeFilter && { priceRange: priceRangeFilter })
			});

			const response = await fetch(`/api/inventory/download?${params}`);

			if (!response.ok) {
				throw new Error('Download failed');
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `inventory_export_${new Date().toISOString().split('T')[0]}.csv`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);
		} catch (err) {
			console.error('Error downloading inventory:', err);
			error = err instanceof Error ? err.message : 'Download failed';
		}
	}

	// Format currency
	function formatCurrency(amount: number | null | undefined) {
		if (amount === null || amount === undefined) return 'N/A';
		return new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency: 'GBP'
		}).format(amount);
	}

	// Format weight
	function formatWeight(weight: number | null | undefined) {
		if (weight === null || weight === undefined) return 'N/A';
		return `${weight} kg`;
	}

	// Format dimensions
	function formatDimensions(
		depth: number | null | undefined,
		height: number | null | undefined,
		width: number | null | undefined
	) {
		const dims = [depth, height, width].filter((d) => d !== null && d !== undefined);
		return dims.length > 0 ? `${dims.join(' × ')} cm` : 'N/A';
	}

	// Reactive statements for filtering
	$: {
		if (
			searchTerm !== undefined ||
			trackedFilter !== undefined ||
			minPrice !== undefined ||
			maxPrice !== undefined ||
			priceRangeFilter !== undefined
		) {
			currentPage = 1;
			if (typeof loadInventory === 'function') {
				loadInventory();
			}
		}
	}

	$: {
		if (currentPage && typeof loadInventory === 'function') {
			loadInventory();
		}
	}
</script>

<svelte:head>
	<title>Inventory Management</title>
</svelte:head>

<div class="inventory-container">
	<Breadcrumb currentPage="Inventory Management" />

	<AdminPageHeader
		title="Inventory Management"
		description="Manage your inventory items and stock levels"
		showClearButton={true}
		showDownloadButton={true}
		showImportButton={true}
		clearDisabled={loading}
		downloadDisabled={loading}
		importDisabled={loading}
		importButtonText="Import Inventory"
		onClear={handleClearData}
		onDownload={downloadInventoryCSV}
		onImport={() => (showImportModal = true)}
	/>

	<!-- Stats Cards -->
	{#if stats}
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-value">{stats.totalItems.toLocaleString()}</div>
				<div class="stat-label">Total Items</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{stats.trackedItems.toLocaleString()}</div>
				<div class="stat-label">Tracked Items</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{formatCurrency(stats.averageRetailPrice)}</div>
				<div class="stat-label">Avg Retail Price</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{formatCurrency(stats.totalValue)}</div>
				<div class="stat-label">Total Inventory Value</div>
			</div>
		</div>
	{/if}

	<!-- Filters -->
	<div class="filters">
		<div class="filter-row">
			<div class="search-box">
				<i class="material-icons-outlined">search</i>
				<input type="text" placeholder="Search by SKU or title..." bind:value={searchTerm} />
			</div>

			<select bind:value={trackedFilter}>
				<option value="">All Items</option>
				<option value="true">Tracked Only</option>
				<option value="false">Untracked Only</option>
			</select>

			<select bind:value={sortBy}>
				{#each sortOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>

			<select bind:value={sortOrder}>
				<option value="asc">Ascending</option>
				<option value="desc">Descending</option>
			</select>
		</div>

		<div class="filter-row">
			<div class="price-filters">
				<select bind:value={priceRangeFilter} on:change={handlePriceRangeChange}>
					{#each priceRangeOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>

				<div class="custom-price">
					<input
						type="number"
						placeholder="Min £"
						bind:value={minPrice}
						on:input={handleCustomPriceChange}
						min="0"
						step="0.01"
					/>
					<span>to</span>
					<input
						type="number"
						placeholder="Max £"
						bind:value={maxPrice}
						on:input={handleCustomPriceChange}
						min="0"
						step="0.01"
					/>
				</div>
			</div>

			<button class="reset-btn" on:click={resetFilters}>
				<i class="material-icons-outlined">clear</i>
				Reset Filters
			</button>
		</div>
	</div>

	<!-- Results -->
	<div class="results">
		<div class="results-header">
			<span>
				Showing {inventory.length.toLocaleString()} of {totalItems.toLocaleString()} items
			</span>
		</div>

		{#if loading}
			<div class="loading">Loading inventory items...</div>
		{:else if error}
			<div class="error">
				<i class="material-icons-outlined">error_outline</i>
				{error}
			</div>
		{:else if inventory.length === 0}
			<div class="empty-state">
				<i class="material-icons-outlined">inventory_2</i>
				<h3>No inventory items found</h3>
				<p>Try importing your inventory CSV file or adjusting your search criteria.</p>
			</div>
		{:else}
			<div class="table-container">
				<table class="inventory-table">
					<thead>
						<tr>
							<th class="sortable" on:click={() => handleSort('sku')}>
								SKU
								<i class="material-icons-outlined sort-icon">{getSortIcon('sku')}</i>
							</th>
							<th class="sortable" on:click={() => handleSort('title')}>
								Title
								<i class="material-icons-outlined sort-icon">{getSortIcon('title')}</i>
							</th>
							<th class="sortable" on:click={() => handleSort('stockLevel')}>
								Stock Level
								<i class="material-icons-outlined sort-icon">{getSortIcon('stockLevel')}</i>
							</th>
							<th class="sortable" on:click={() => handleSort('retailPrice')}>
								Retail Price
								<i class="material-icons-outlined sort-icon">{getSortIcon('retailPrice')}</i>
							</th>
							<th class="sortable" on:click={() => handleSort('purchasePrice')}>
								Purchase Price
								<i class="material-icons-outlined sort-icon">{getSortIcon('purchasePrice')}</i>
							</th>
							<th>Dimensions</th>
							<th class="sortable" on:click={() => handleSort('weight')}>
								Weight
								<i class="material-icons-outlined sort-icon">{getSortIcon('weight')}</i>
							</th>
							<th class="sortable" on:click={() => handleSort('tracked')}>
								Tracked
								<i class="material-icons-outlined sort-icon">{getSortIcon('tracked')}</i>
							</th>
							<th class="sortable" on:click={() => handleSort('updatedAt')}>
								Updated
								<i class="material-icons-outlined sort-icon">{getSortIcon('updatedAt')}</i>
							</th>
						</tr>
					</thead>
					<tbody>
						{#each inventory as item}
							<tr>
								<td class="sku">{item.sku}</td>
								<td class="title">{item.title}</td>
								<td class="stock-level">{item.stockLevel || 'N/A'}</td>
								<td class="price">{formatCurrency(item.retailPrice)}</td>
								<td class="price">{formatCurrency(item.purchasePrice)}</td>
								<td class="dimensions">{formatDimensions(item.depth, item.height, item.width)}</td>
								<td class="weight">{formatWeight(item.weight)}</td>
								<td class="tracked">
									<span class="status-badge {item.tracked ? 'tracked' : 'untracked'}">
										{item.tracked ? 'Yes' : 'No'}
									</span>
								</td>
								<td class="date">{new Date(item.updatedAt).toLocaleDateString()}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			{#if totalPages > 1}
				<div class="pagination">
					<button
						class="page-btn"
						disabled={currentPage === 1}
						on:click={() => {
							currentPage = 1;
						}}
					>
						First
					</button>
					<button
						class="page-btn"
						disabled={currentPage === 1}
						on:click={() => {
							currentPage--;
						}}
					>
						Previous
					</button>
					<span class="page-info">
						Page {currentPage} of {totalPages}
					</span>
					<button
						class="page-btn"
						disabled={currentPage === totalPages}
						on:click={() => {
							currentPage++;
						}}
					>
						Next
					</button>
					<button
						class="page-btn"
						disabled={currentPage === totalPages}
						on:click={() => {
							currentPage = totalPages;
						}}
					>
						Last
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>

<!-- Upload Modal -->
<UploadModal
	bind:showModal={showImportModal}
	title="Import Inventory"
	description="Upload a CSV file to import inventory data."
	{expectedColumns}
	{importLoading}
	{importResult}
	selectedFile={importFile}
	on:upload={handleFileUpload}
	on:fileSelected={handleFileSelected}
	on:close={handleModalClose}
/>

<style>
	.inventory-container {
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
		font-size: 1.5rem;
		font-weight: 600;
		color: #1f2937;
		margin-bottom: 4px;
	}

	.stat-label {
		font-size: 0.875rem;
		color: #6b7280;
	}

	.filters {
		background: white;
		padding: 20px;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.filter-row {
		display: flex;
		gap: 12px;
		align-items: center;
		flex-wrap: wrap;
		margin-bottom: 12px;
	}

	.filter-row:last-child {
		margin-bottom: 0;
	}

	.search-box {
		position: relative;
		flex: 1;
		min-width: 250px;
		max-width: 400px;
	}

	.search-box i {
		position: absolute;
		left: 12px;
		top: 50%;
		transform: translateY(-50%);
		color: #6b7280;
		font-size: 1rem;
	}

	.search-box input {
		width: 100%;
		padding: 8px 12px 8px 40px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
	}

	.search-box input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.price-filters {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.custom-price {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.custom-price input {
		width: 80px;
		padding: 6px 8px;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.custom-price span {
		color: #6b7280;
		font-size: 0.875rem;
	}

	select {
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
		background: white;
		cursor: pointer;
	}

	select:focus {
		outline: none;
		border-color: #3b82f6;
	}

	.reset-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		background: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.reset-btn:hover {
		background: #e5e7eb;
	}

	.results {
		background: white;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		overflow: hidden;
	}

	.results-header {
		padding: 16px 20px;
		border-bottom: 1px solid #e5e7eb;
		font-size: 0.875rem;
		color: #6b7280;
	}

	.loading,
	.error,
	.empty-state {
		padding: 40px 20px;
		text-align: center;
		color: #6b7280;
	}

	.error {
		color: #ef4444;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.empty-state i {
		font-size: 3rem;
		color: #d1d5db;
		margin-bottom: 16px;
	}

	.table-container {
		overflow-x: auto;
	}

	.inventory-table {
		width: 100%;
		border-collapse: collapse;
	}

	.inventory-table th {
		padding: 12px 16px;
		text-align: left;
		font-weight: 600;
		color: #374151;
		border-bottom: 1px solid #e5e7eb;
		background: #f9fafb;
		font-size: 0.875rem;
		white-space: nowrap;
	}

	.inventory-table th.sortable {
		cursor: pointer;
		user-select: none;
		transition: background-color 0.2s ease;
		position: relative;
	}

	.inventory-table th.sortable:hover {
		background: #f3f4f6;
	}

	.sort-icon {
		font-size: 1rem;
		margin-left: 4px;
		opacity: 0.5;
	}

	.inventory-table td {
		padding: 12px 16px;
		border-bottom: 1px solid #f3f4f6;
		font-size: 0.875rem;
		color: #374151;
	}

	.inventory-table tr:hover {
		background: #f9fafb;
	}

	.sku {
		font-family: monospace;
		font-weight: 500;
		color: #3b82f6;
	}

	.title {
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.price {
		font-weight: 500;
		text-align: right;
	}

	.status-badge {
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: uppercase;
	}

	.status-badge.tracked {
		background: #dcfce7;
		color: #166534;
	}

	.status-badge.untracked {
		background: #fef3c7;
		color: #92400e;
	}

	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 8px;
		padding: 20px;
		border-top: 1px solid #e5e7eb;
	}

	.page-btn {
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		background: white;
		color: #374151;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.875rem;
		transition: all 0.2s ease;
	}

	.page-btn:hover:not(:disabled) {
		background: #f3f4f6;
	}

	.page-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.page-info {
		margin: 0 16px;
		font-size: 0.875rem;
		color: #6b7280;
	}

	@media (max-width: 768px) {
		.filter-row {
			flex-direction: column;
			align-items: stretch;
		}

		.search-box {
			min-width: auto;
			max-width: none;
		}

		.price-filters {
			flex-direction: column;
			align-items: stretch;
		}

		.custom-price {
			justify-content: center;
		}

		.table-container {
			font-size: 0.75rem;
		}

		.inventory-table th,
		.inventory-table td {
			padding: 8px 12px;
		}

		.title {
			max-width: 150px;
		}
	}
</style>
