<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import UploadModal from '$lib/components/UploadModal.svelte';
	import AdminPageHeader from '$lib/components/AdminPageHeader.svelte';
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';

	export let data: PageData;

	let loading = false;
	let error = data.error || '';
	let sageData = data.sageData || [];
	let stats = data.stats;
	let currentPage = data.searchParams.page;
	let totalPages = data.totalPages;
	let totalItems = data.totalItems;
	let pageSize = data.searchParams.limit;

	// Initialize filters from URL params
	let searchTerm = data.searchParams.search;
	let companyFilter = data.searchParams.company;
	let supplierFilter = data.searchParams.supplier;
	let minPrice = data.searchParams.minPrice;
	let maxPrice = data.searchParams.maxPrice;
	let sortBy = data.searchParams.sortBy;
	let sortOrder = data.searchParams.sortOrder;

	// Filter options
	const sortOptions = [
		{ value: 'created_at', label: 'Date Created' },
		{ value: 'updated_at', label: 'Date Updated' },
		{ value: 'stock_code', label: 'Stock Code' },
		{ value: 'bin_name', label: 'Bin Name' },
		{ value: 'standard_cost', label: 'Standard Cost' },
		{ value: 'price', label: 'Price' },
		{ value: 'supplier_account_number', label: 'Supplier Account' }
	];

	// Import modal
	let showImportModal = false;
	let importLoading = false;
	let importResult: any = null;
	let importFile: FileList | null = null;

	// Expected columns for the upload modal
	const expectedColumns = [
		{ name: 'StockItems.Code', description: 'Stock item code' },
		{ name: 'BinItems.BinName', description: 'Bin location name' },
		{ name: 'StockItems.StandardCost', description: 'Standard cost' },
		{ name: 'StockItems.TaxRate', description: 'Tax rate percentage' },
		{ name: 'StockItemPrices.Price', description: 'Item price' },
		{ name: 'ProductGroups.Code', description: 'Product group code' },
		{ name: 'StockItems.BOMItemTypeID', description: 'BOM item type ID' },
		{ name: 'SYSCompanies.CompanyName', description: 'Company name' },
		{ name: 'PLSupplierAccounts.SupplierAccountNumber', description: 'Supplier account number' }
	];

	// Reactive statement to update data when page data changes
	$: {
		sageData = data.sageData;
		stats = data.stats;
		totalPages = data.totalPages;
		totalItems = data.totalItems;
		error = data.error || '';
	}

	async function loadSageData() {
		if (!browser) return; // Don't run on server

		loading = true;

		// Build URL with current filters
		const params = new URLSearchParams({
			page: currentPage.toString(),
			limit: pageSize.toString(),
			...(searchTerm && { search: searchTerm }),
			...(companyFilter && { company: companyFilter }),
			...(supplierFilter && { supplier: supplierFilter }),
			...(minPrice && { minPrice }),
			...(maxPrice && { maxPrice }),
			...(sortBy && { sortBy }),
			...(sortOrder && { sortOrder })
		});

		// Navigate to update URL and trigger load function
		await goto(`/sage-reports?${params}`, { replaceState: true });
		loading = false;
	}

	async function handleClearData() {
		if (!browser) return; // Don't run on server

		if (!confirm('Are you sure you want to clear all Sage report data? This cannot be undone.')) {
			return;
		}

		try {
			loading = true;
			const response = await fetch('/api/sage-reports?action=clear', { method: 'DELETE' });
			if (response.ok) {
				// Navigate to refresh data
				await goto('/sage-reports', { replaceState: true });
				alert('All Sage report data cleared successfully');
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

			console.log('Starting Sage Reports upload...', importFile[0].name);

			// Use the new single-step upload endpoint
			const response = await fetch('/api/sage-reports/upload', {
				method: 'POST',
				body: formData
			});

			importResult = await response.json();
			console.log('Upload result:', importResult);

			if (importResult.success) {
				// Refresh data to show new records
				await loadSageData();
				// Keep modal open to show results instead of immediately closing
				console.log(
					`Upload successful: ${importResult.imported} imported, ${importResult.updated} updated`
				);
			} else {
				console.error('Upload failed:', importResult.error);
			}
		} catch (err) {
			console.error('Upload error:', err);
			importResult = {
				success: false,
				error: err instanceof Error ? err.message : 'Import failed'
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

	function resetFilters() {
		searchTerm = '';
		companyFilter = '';
		supplierFilter = '';
		minPrice = '';
		maxPrice = '';
		currentPage = 1;
		loadSageData();
	}

	function handleSort(column: string) {
		if (sortBy === column) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = column;
			sortOrder = 'asc';
		}
		currentPage = 1;
		loadSageData();
	}

	function nextPage() {
		if (currentPage < totalPages) {
			currentPage++;
			loadSageData();
		}
	}

	function prevPage() {
		if (currentPage > 1) {
			currentPage--;
			loadSageData();
		}
	}

	function goToPage(page: number) {
		currentPage = page;
		loadSageData();
	}

	// Handle download
	async function downloadCsv() {
		if (!browser) return;

		try {
			const params = new URLSearchParams({
				...(searchTerm && { search: searchTerm }),
				...(companyFilter && { company: companyFilter }),
				...(supplierFilter && { supplier: supplierFilter }),
				...(minPrice && { minPrice }),
				...(maxPrice && { maxPrice }),
				...(sortBy && { sortBy }),
				...(sortOrder && { sortOrder })
			});

			const response = await fetch(`/api/sage-reports/download?${params}`);
			if (response.ok) {
				const blob = await response.blob();
				const url = window.URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `sage-reports-${new Date().toISOString().split('T')[0]}.csv`;
				document.body.appendChild(a);
				a.click();
				window.URL.revokeObjectURL(url);
				document.body.removeChild(a);
			} else {
				throw new Error('Failed to download CSV');
			}
		} catch (err) {
			alert('Failed to download CSV: ' + err);
		}
	}
</script>

<svelte:head>
	<title>Sage Reports - Pricer Dashboard</title>
</svelte:head>

<div class="sage-reports-container">
	<Breadcrumb currentPage="Sage Reports" />

	<!-- Header Section -->
	<AdminPageHeader
		title="Sage Reports Management"
		description="Import and manage Sage report data with stock items, bins, costs, and supplier information"
		showClearButton={true}
		showDownloadButton={true}
		showImportButton={true}
		clearDisabled={loading}
		downloadDisabled={loading}
		importDisabled={loading}
		onClear={handleClearData}
		onDownload={downloadCsv}
		onImport={() => (showImportModal = true)}
	/>

	<!-- Stats Cards -->
	{#if stats}
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-icon">📊</div>
				<div class="stat-info">
					<div class="stat-value">{stats.totalItems.toLocaleString()}</div>
					<div class="stat-label">Total Items</div>
				</div>
			</div>
			<div class="stat-card">
				<div class="stat-icon">🏢</div>
				<div class="stat-info">
					<div class="stat-value">{stats.totalCompanies}</div>
					<div class="stat-label">Companies</div>
				</div>
			</div>
			<div class="stat-card">
				<div class="stat-icon">🚚</div>
				<div class="stat-info">
					<div class="stat-value">{stats.totalSuppliers}</div>
					<div class="stat-label">Suppliers</div>
				</div>
			</div>
			<div class="stat-card">
				<div class="stat-icon">💷</div>
				<div class="stat-info">
					<div class="stat-value">£{stats.averagePrice.toFixed(2)}</div>
					<div class="stat-label">Average Price</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Filters -->
	<div class="filters">
		<div class="filter-group">
			<input
				type="text"
				placeholder="Search by stock code or bin name..."
				bind:value={searchTerm}
				on:input={loadSageData}
				class="filter-input"
			/>
		</div>
		<div class="filter-group">
			<input
				type="text"
				placeholder="Filter by company..."
				bind:value={companyFilter}
				on:input={loadSageData}
				class="filter-input"
			/>
		</div>
		<div class="filter-group">
			<input
				type="text"
				placeholder="Filter by supplier..."
				bind:value={supplierFilter}
				on:input={loadSageData}
				class="filter-input"
			/>
		</div>
		<div class="filter-group">
			<input
				type="number"
				placeholder="Min price"
				bind:value={minPrice}
				on:input={loadSageData}
				class="filter-input"
			/>
		</div>
		<div class="filter-group">
			<input
				type="number"
				placeholder="Max price"
				bind:value={maxPrice}
				on:input={loadSageData}
				class="filter-input"
			/>
		</div>
		<div class="filter-group">
			<select bind:value={sortBy} on:change={loadSageData} class="filter-select">
				{#each sortOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>
		<div class="filter-group">
			<select bind:value={sortOrder} on:change={loadSageData} class="filter-select">
				<option value="asc">Ascending</option>
				<option value="desc">Descending</option>
			</select>
		</div>
		<button class="btn btn-secondary" on:click={resetFilters}>
			<i class="material-icons">clear</i>
			Reset Filters
		</button>
	</div>

	<!-- Data Table -->
	<div class="table-container">
		{#if loading}
			<div class="loading">Loading Sage report data...</div>
		{:else if error}
			<div class="error">Error: {error}</div>
		{:else if sageData.length === 0}
			<div class="empty-state">
				<div class="empty-icon">📊</div>
				<h3>No Sage Report Data</h3>
				<p>Import your first Sage report to get started</p>
				<button class="btn btn-primary" on:click={() => (showImportModal = true)}>
					<i class="material-icons">upload</i>
					Import CSV
				</button>
			</div>
		{:else}
			<table class="data-table">
				<thead>
					<tr>
						<th style="width: 120px;" class="sortable" on:click={() => handleSort('stock_code')}>
							<div class="header-content">
								<span>Stock Code</span>
								{#if sortBy === 'stock_code'}
									<i class="material-icons sort-icon">
										{sortOrder === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
									</i>
								{/if}
							</div>
						</th>
						<th style="width: 100px;" class="sortable" on:click={() => handleSort('bin_name')}>
							<div class="header-content">
								<span>Bin Name</span>
								{#if sortBy === 'bin_name'}
									<i class="material-icons sort-icon">
										{sortOrder === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
									</i>
								{/if}
							</div>
						</th>
						<th style="width: 120px;" class="sortable" on:click={() => handleSort('standard_cost')}>
							<div class="header-content">
								<span>Standard Cost</span>
								{#if sortBy === 'standard_cost'}
									<i class="material-icons sort-icon">
										{sortOrder === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
									</i>
								{/if}
							</div>
						</th>
						<th style="width: 90px;">
							<span>Tax Rate</span>
						</th>
						<th style="width: 100px;" class="sortable" on:click={() => handleSort('price')}>
							<div class="header-content">
								<span>Price</span>
								{#if sortBy === 'price'}
									<i class="material-icons sort-icon">
										{sortOrder === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
									</i>
								{/if}
							</div>
						</th>
						<th style="width: 150px;">
							<span>Product Group</span>
						</th>
						<th style="width: 110px;">
							<span>BOM Type ID</span>
						</th>
						<th style="width: 180px;">
							<span>Company</span>
						</th>
						<th style="width: 140px;">
							<span>Supplier Account</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{#each sageData as item}
						<tr>
							<td style="width: 120px;" class="stock-code">{item.stock_code}</td>
							<td style="width: 100px;">{item.bin_name || '-'}</td>
							<td style="width: 120px;" class="currency"
								>£{item.standard_cost?.toFixed(2) || '0.00'}</td
							>
							<td style="width: 90px;" class="percentage">{item.tax_rate?.toFixed(2) || '0.00'}%</td
							>
							<td style="width: 100px;" class="currency">£{item.price?.toFixed(2) || '0.00'}</td>
							<td style="width: 150px;">{item.product_group_code || '-'}</td>
							<td style="width: 110px;">{item.bom_item_type_id || '-'}</td>
							<td style="width: 180px;">{item.company_name || '-'}</td>
							<td style="width: 140px;">{item.supplier_account_number || '-'}</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<!-- Pagination -->
			<div class="pagination">
				<div class="pagination-info">
					Showing {(currentPage - 1) * pageSize + 1} to {Math.min(
						currentPage * pageSize,
						totalItems
					)} of {totalItems} items
				</div>
				<div class="pagination-controls">
					<button class="btn btn-secondary" on:click={prevPage} disabled={currentPage === 1}>
						<i class="material-icons">chevron_left</i>
						Previous
					</button>

					{#if totalPages <= 7}
						{#each Array(totalPages) as _, i}
							<button
								class="btn {currentPage === i + 1 ? 'btn-primary' : 'btn-secondary'}"
								on:click={() => goToPage(i + 1)}
							>
								{i + 1}
							</button>
						{/each}
					{:else}
						<button
							class="btn {currentPage === 1 ? 'btn-primary' : 'btn-secondary'}"
							on:click={() => goToPage(1)}>1</button
						>
						{#if currentPage > 3}
							<span class="pagination-ellipsis">...</span>
						{/if}
						{#each Array(3) as _, i}
							{#if currentPage + i - 1 > 1 && currentPage + i - 1 < totalPages}
								<button
									class="btn {currentPage === currentPage + i - 1
										? 'btn-primary'
										: 'btn-secondary'}"
									on:click={() => goToPage(currentPage + i - 1)}
								>
									{currentPage + i - 1}
								</button>
							{/if}
						{/each}
						{#if currentPage < totalPages - 2}
							<span class="pagination-ellipsis">...</span>
						{/if}
						<button
							class="btn {currentPage === totalPages ? 'btn-primary' : 'btn-secondary'}"
							on:click={() => goToPage(totalPages)}>{totalPages}</button
						>
					{/if}

					<button
						class="btn btn-secondary"
						on:click={nextPage}
						disabled={currentPage === totalPages}
					>
						Next
						<i class="material-icons">chevron_right</i>
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Import Modal -->
<UploadModal
	bind:showModal={showImportModal}
	title="Import Sage Report Data"
	description="Upload your Sage report CSV file to import stock, pricing, and supplier data."
	{expectedColumns}
	maxFileSize="50MB"
	{importLoading}
	{importResult}
	bind:selectedFile={importFile}
	on:fileSelected={handleFileSelected}
	on:upload={handleFileUpload}
	on:close={handleModalClose}
/>

<style>
	.sage-reports-container {
		min-height: calc(100vh - 140px);
		background: #f8fafc;
		padding: 24px;
	}

	/* Stats Grid */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 16px;
		margin-bottom: 24px;
	}

	.stat-card {
		background: white;
		padding: 20px;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.stat-icon {
		font-size: 2rem;
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: #111827;
		margin-bottom: 4px;
	}

	.stat-label {
		color: #6b7280;
		font-size: 0.875rem;
	}

	/* Filters */
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-bottom: 24px;
		padding: 20px;
		background: white;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.filter-group {
		flex: 1;
		min-width: 150px;
	}

	.filter-input,
	.filter-select {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.filter-input:focus,
	.filter-select:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	/* Table */
	.table-container {
		background: white;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		overflow: hidden;
		margin-bottom: 24px;
		overflow-x: auto;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		min-width: 1210px;
	}

	.data-table th,
	.data-table td {
		padding: 8px 12px;
		text-align: left;
		border-bottom: 1px solid #e5e7eb;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		box-sizing: border-box;
	}

	.data-table th {
		background: #f9fafb;
		font-weight: 600;
		color: #374151;
		font-size: 0.875rem;
		position: sticky;
		top: 0;
		z-index: 10;
		height: 48px;
		vertical-align: middle;
	}

	.data-table th span {
		display: block;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.header-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		height: 100%;
	}

	.header-content span {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Remove the specific column width selectors since we're using inline styles */

	.data-table td {
		font-size: 0.875rem;
		color: #111827;
	}

	.sortable {
		cursor: pointer;
		user-select: none;
		padding: 0;
		margin: 0;
	}

	.sortable:hover {
		background: #f3f4f6;
	}

	.sort-icon {
		font-size: 1rem;
		flex-shrink: 0;
	}

	.stock-code {
		font-family: monospace;
		font-weight: 600;
	}

	.currency {
		text-align: right;
		font-weight: 600;
	}

	.percentage {
		text-align: right;
	}

	/* Pagination */
	.pagination {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		background: #f9fafb;
		border-top: 1px solid #e5e7eb;
		font-size: 0.875rem;
	}

	.pagination-controls {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.pagination-ellipsis {
		color: #6b7280;
		padding: 0 8px;
	}

	/* Empty State */
	.empty-state {
		padding: 48px 24px;
		text-align: center;
		color: #6b7280;
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: 16px;
	}

	.empty-state h3 {
		color: #374151;
		margin-bottom: 8px;
	}

	.empty-state p {
		margin-bottom: 24px;
	}

	/* Loading and Error States */
	.loading,
	.error {
		padding: 48px 24px;
		text-align: center;
		font-size: 1.125rem;
	}

	.loading {
		color: #6b7280;
	}

	.error {
		color: #dc2626;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.sage-reports-container {
			padding: 16px;
		}

		.filters {
			flex-direction: column;
		}

		.filter-group {
			min-width: auto;
		}

		.pagination {
			flex-direction: column;
			gap: 16px;
		}

		.pagination-controls {
			flex-wrap: wrap;
			justify-content: center;
		}

		.data-table {
			font-size: 0.75rem;
			min-width: 1000px;
		}

		.data-table th,
		.data-table td {
			padding: 6px 8px;
		}

		.table-container {
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
		}

		/* Adjust column widths for mobile */
		.data-table th:nth-child(1),
		.data-table td:nth-child(1) {
			width: 100px;
		}

		.data-table th:nth-child(2),
		.data-table td:nth-child(2) {
			width: 80px;
		}

		.data-table th:nth-child(3),
		.data-table td:nth-child(3) {
			width: 100px;
		}

		.data-table th:nth-child(4),
		.data-table td:nth-child(4) {
			width: 70px;
		}

		.data-table th:nth-child(5),
		.data-table td:nth-child(5) {
			width: 80px;
		}

		.data-table th:nth-child(6),
		.data-table td:nth-child(6) {
			width: 120px;
		}

		.data-table th:nth-child(7),
		.data-table td:nth-child(7) {
			width: 90px;
		}

		.data-table th:nth-child(8),
		.data-table td:nth-child(8) {
			width: 140px;
		}

		.data-table th:nth-child(9),
		.data-table td:nth-child(9) {
			width: 110px;
		}
	}
</style>
