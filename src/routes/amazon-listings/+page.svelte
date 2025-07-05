<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import UploadModal from '$lib/components/UploadModal.svelte';
	import AdminPageHeader from '$lib/components/AdminPageHeader.svelte';
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';

	let loading = true;
	let error = '';
	let listings: any[] = [];
	let stats: any = null;
	let currentPage = 1;
	let totalPages = 1;
	let totalListings = 0;
	let pageSize = 50;

	// Filters
	let searchTerm = '';
	let statusFilter = '';
	let shippingGroupFilter = '';
	let minPrice = '';
	let maxPrice = '';
	let sortBy = 'createdAt';
	let sortOrder = 'desc';
	let dateFilter = '';
	let priceRangeFilter = '';

	// Filter options
	const statusOptions = ['', 'Active', 'Inactive', 'Incomplete'];
	const shippingGroupOptions = ['', 'Nationwide Prime', 'UK Shipping', 'Migrated Template'];
	const sortOptions = [
		{ value: 'createdAt', label: 'Date Created' },
		{ value: 'updatedAt', label: 'Date Updated' },
		{ value: 'sellerSku', label: 'Seller SKU' },
		{ value: 'itemName', label: 'Item Name' },
		{ value: 'price', label: 'Price' },
		{ value: 'status', label: 'Status' }
	];
	const priceRangeOptions = [
		{ value: '', label: 'All Prices' },
		{ value: 'free', label: 'Free (N/A)' },
		{ value: '0-10', label: '£0 - £10' },
		{ value: '10-25', label: '£10 - £25' },
		{ value: '25-50', label: '£25 - £50' },
		{ value: '50-100', label: '£50 - £100' },
		{ value: '100+', label: '£100+' }
	];
	const dateFilterOptions = [
		{ value: '', label: 'All Time' },
		{ value: 'today', label: 'Today' },
		{ value: 'week', label: 'This Week' },
		{ value: 'month', label: 'This Month' },
		{ value: 'year', label: 'This Year' }
	];

	// Import modal
	let showImportModal = false;
	let importLoading = false;
	let importResult: any = null;
	let importFile: FileList | null = null;

	// Expected columns for Amazon listings
	const expectedColumns = [
		{ name: 'seller-sku', description: 'Unique seller SKU (also accepts seller_sku, sku)' },
		{
			name: 'item-name',
			description: 'Product name or title (also accepts item_name, name, title)'
		},
		{ name: 'price', description: 'Product price (optional - also accepts cost, amount)' },
		{
			name: 'merchant-shipping-group',
			description: 'Shipping group (optional - also accepts shipping-group, shipping_group)'
		},
		{
			name: 'status',
			description: 'Product status (optional - defaults to "active", also accepts state, condition)'
		}
	];

	onMount(async () => {
		await loadListings();
		await loadStats();
	});

	async function loadListings() {
		loading = true;
		try {
			const params = new URLSearchParams({
				page: currentPage.toString(),
				limit: pageSize.toString(),
				...(searchTerm && { search: searchTerm }),
				...(statusFilter && { status: statusFilter }),
				...(shippingGroupFilter && { shippingGroup: shippingGroupFilter }),
				...(minPrice && { minPrice }),
				...(maxPrice && { maxPrice }),
				...(sortBy && { sortBy }),
				...(sortOrder && { sortOrder }),
				...(dateFilter && { dateFilter }),
				...(priceRangeFilter && { priceRange: priceRangeFilter })
			});

			const response = await fetch(`/api/amazon-listings?${params}`);

			if (!response.ok) {
				throw new Error('Failed to load listings');
			}

			const data = await response.json();
			listings = data.listings;
			totalPages = data.pagination.pages;
			totalListings = data.pagination.total;

			error = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
			console.error('Error loading listings:', err);
		} finally {
			loading = false;
		}
	}

	async function loadStats() {
		try {
			const response = await fetch('/api/amazon-listings', {
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

	async function handleSearch() {
		currentPage = 1;
		await loadListings();
	}

	async function handlePageChange(page: number) {
		currentPage = page;
		await loadListings();
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

			const response = await fetch('/api/amazon-listings/upload', {
				method: 'POST',
				body: formData
			});

			importResult = await response.json();

			if (importResult.success) {
				await loadListings();
				await loadStats();
				// Keep modal open to show results
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
		if (!confirm('Are you sure you want to clear all Amazon listings? This cannot be undone.')) {
			return;
		}

		try {
			const response = await fetch('/api/amazon-listings', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					action: 'clear'
				})
			});

			const result = await response.json();

			if (result.success) {
				await loadListings();
				await loadStats();
				alert(`Successfully cleared ${result.deleted} listings`);
			} else {
				alert('Failed to clear listings: ' + result.message);
			}
		} catch (err) {
			alert('Error clearing listings: ' + (err instanceof Error ? err.message : 'Unknown error'));
		}
	}

	function formatPrice(price: number | null): string {
		if (price === null || price === undefined) return 'N/A';
		return `£${price.toFixed(2)}`;
	}

	function formatDate(date: string): string {
		return new Date(date).toLocaleDateString();
	}

	function clearFilters() {
		searchTerm = '';
		statusFilter = '';
		shippingGroupFilter = '';
		minPrice = '';
		maxPrice = '';
		priceRangeFilter = '';
		dateFilter = '';
		sortBy = 'createdAt';
		sortOrder = 'desc';
		currentPage = 1;
		handleSearch();
	}

	function handleSort(column: string) {
		if (sortBy === column) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = column;
			sortOrder = 'desc';
		}
		currentPage = 1;
		handleSearch();
	}

	function getSortIcon(column: string): string {
		if (sortBy !== column) return 'swap_vert';
		return sortOrder === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
	}

	// Clear price range when custom prices are entered
	function handleMinPriceChange() {
		if (minPrice && priceRangeFilter) {
			priceRangeFilter = '';
		}
		handleSearch();
	}

	function handleMaxPriceChange() {
		if (maxPrice && priceRangeFilter) {
			priceRangeFilter = '';
		}
		handleSearch();
	}

	// Clear custom prices when price range is selected
	function handlePriceRangeChange() {
		if (priceRangeFilter && (minPrice || maxPrice)) {
			minPrice = '';
			maxPrice = '';
		}
		handleSearch();
	}

	// Reactive statements - removed auto-search to prevent SSR issues
	// $: if (statusFilter !== undefined || minPrice !== undefined || maxPrice !== undefined) {
	//     handleSearch();
	// }
</script>

<svelte:head>
	<title>Amazon All Listings</title>
</svelte:head>

<div class="listings-container">
	<Breadcrumb currentPage="Amazon Listings" />

	<AdminPageHeader
		title="Amazon All Listings"
		description="Manage your Amazon seller listings"
		showClearButton={true}
		showDownloadButton={false}
		showImportButton={true}
		clearDisabled={loading}
		importDisabled={loading}
		importButtonText="Import Listings"
		onClear={handleClearData}
		onImport={() => (showImportModal = true)}
	/>

	<!-- Stats Cards -->
	{#if stats}
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-value">{stats.totalListings.toLocaleString()}</div>
				<div class="stat-label">Total Listings</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{stats.activeListings.toLocaleString()}</div>
				<div class="stat-label">Active Listings</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{formatPrice(stats.avgPrice)}</div>
				<div class="stat-label">Average Price</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{formatPrice(stats.minPrice)} - {formatPrice(stats.maxPrice)}</div>
				<div class="stat-label">Price Range</div>
			</div>
		</div>
	{/if}

	<!-- Filters -->
	<div class="filters-section">
		<div class="search-box">
			<input
				type="text"
				placeholder="Search by SKU or item name..."
				bind:value={searchTerm}
				on:keypress={(e) => e.key === 'Enter' && handleSearch()}
			/>
			<button on:click={handleSearch}>
				<i class="material-icons-outlined">search</i>
			</button>
		</div>

		<div class="filters">
			<select bind:value={statusFilter} on:change={handleSearch}>
				<option value="">All Status</option>
				{#each statusOptions.slice(1) as option}
					<option value={option}>{option}</option>
				{/each}
			</select>

			<select bind:value={shippingGroupFilter} on:change={handleSearch}>
				<option value="">All Shipping Groups</option>
				{#each shippingGroupOptions.slice(1) as option}
					<option value={option}>{option}</option>
				{/each}
			</select>

			<select bind:value={priceRangeFilter} on:change={handlePriceRangeChange}>
				{#each priceRangeOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>

			<select bind:value={dateFilter} on:change={handleSearch}>
				{#each dateFilterOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>

			<div class="price-range">
				<input
					type="number"
					placeholder="Min Price (£)"
					bind:value={minPrice}
					class="price-input"
					on:change={handleMinPriceChange}
				/>
				<input
					type="number"
					placeholder="Max Price (£)"
					bind:value={maxPrice}
					class="price-input"
					on:change={handleMaxPriceChange}
				/>
			</div>

			<div class="sort-controls">
				<select bind:value={sortBy} on:change={handleSearch}>
					{#each sortOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
				<select bind:value={sortOrder} on:change={handleSearch}>
					<option value="desc">Descending</option>
					<option value="asc">Ascending</option>
				</select>
			</div>

			<select bind:value={pageSize} on:change={handleSearch}>
				<option value={25}>25 per page</option>
				<option value={50}>50 per page</option>
				<option value={100}>100 per page</option>
				<option value={200}>200 per page</option>
			</select>

			<button class="clear-filters-btn" on:click={clearFilters}>
				<i class="material-icons-outlined">clear</i>
				Clear Filters
			</button>
		</div>
	</div>

	<!-- Listings Table -->
	<div class="listings-section">
		{#if loading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading listings...</p>
			</div>
		{:else if error}
			<div class="error-state">
				<i class="material-icons-outlined">error_outline</i>
				<h3>Error loading listings</h3>
				<p>{error}</p>
				<button class="retry-btn" on:click={loadListings}> Try Again </button>
			</div>
		{:else if listings.length === 0}
			<div class="empty-state">
				<i class="material-icons-outlined">inventory_2</i>
				<h3>No listings found</h3>
				<p>Try importing your Amazon listings CSV file or adjusting your search criteria.</p>
				<button class="import-btn" on:click={() => (showImportModal = true)}>
					Import Listings
				</button>
			</div>
		{:else}
			<div class="table-container">
				<div class="table-header">
					<h3>Listings ({totalListings.toLocaleString()})</h3>
					<div class="pagination-info">
						Showing {(currentPage - 1) * pageSize + 1}-{Math.min(
							currentPage * pageSize,
							totalListings
						)} of {totalListings.toLocaleString()}
					</div>
				</div>

				<div class="table-wrapper">
					<table class="listings-table">
						<thead>
							<tr>
								<th on:click={() => handleSort('sellerSku')}
									>Seller SKU
									<i class="material-icons-outlined sort-icon">{getSortIcon('sellerSku')}</i>
								</th>
								<th on:click={() => handleSort('itemName')}
									>Item Name
									<i class="material-icons-outlined sort-icon">{getSortIcon('itemName')}</i>
								</th>
								<th on:click={() => handleSort('price')}
									>Price
									<i class="material-icons-outlined sort-icon">{getSortIcon('price')}</i>
								</th>
								<th on:click={() => handleSort('shippingGroup')}
									>Shipping Group
									<i class="material-icons-outlined sort-icon">{getSortIcon('shippingGroup')}</i>
								</th>
								<th on:click={() => handleSort('status')}
									>Status
									<i class="material-icons-outlined sort-icon">{getSortIcon('status')}</i>
								</th>
								<th on:click={() => handleSort('createdAt')}
									>Created
									<i class="material-icons-outlined sort-icon">{getSortIcon('createdAt')}</i>
								</th>
								<th on:click={() => handleSort('updatedAt')}
									>Updated
									<i class="material-icons-outlined sort-icon">{getSortIcon('updatedAt')}</i>
								</th>
							</tr>
						</thead>
						<tbody>
							{#each listings as listing}
								<tr>
									<td class="sku">{listing.sellerSku}</td>
									<td class="item-name">{listing.itemName}</td>
									<td class="price">{formatPrice(listing.price)}</td>
									<td class="shipping-group">{listing.merchantShippingGroup || 'N/A'}</td>
									<td class="status">
										<span class="status-badge status-{listing.status}">
											{listing.status}
										</span>
									</td>
									<td class="date">{formatDate(listing.createdAt)}</td>
									<td class="date">{formatDate(listing.updatedAt)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Pagination -->
				{#if totalPages > 1}
					<div class="pagination">
						<button
							class="pagination-btn"
							disabled={currentPage === 1}
							on:click={() => handlePageChange(currentPage - 1)}
						>
							Previous
						</button>

						{#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + Math.max(1, currentPage - 2)) as page}
							{#if page <= totalPages}
								<button
									class="pagination-btn"
									class:active={page === currentPage}
									on:click={() => handlePageChange(page)}
								>
									{page}
								</button>
							{/if}
						{/each}

						<button
							class="pagination-btn"
							disabled={currentPage === totalPages}
							on:click={() => handlePageChange(currentPage + 1)}
						>
							Next
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- Import Modal -->
<UploadModal
	bind:showModal={showImportModal}
	title="Import Amazon Listings"
	description="Upload your Amazon seller listings CSV file. The system will automatically detect columns and map them appropriately."
	{expectedColumns}
	maxFileSize="10MB"
	{importLoading}
	{importResult}
	bind:selectedFile={importFile}
	on:fileSelected={handleFileSelected}
	on:upload={handleImport}
	on:close={handleModalClose}
/>

<style>
	.listings-container {
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

	.filters-section {
		background: white;
		padding: 20px;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		display: flex;
		gap: 20px;
		align-items: center;
		flex-wrap: wrap;
	}

	.search-box {
		display: flex;
		gap: 8px;
		flex: 1;
		min-width: 300px;
	}

	.search-box input {
		flex: 1;
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
	}

	.search-box button {
		padding: 8px 12px;
		background: #f59e0b;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
	}

	.filters {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		align-items: center;
		margin-bottom: 20px;
		padding: 16px;
		background: #f8f9fa;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.filters select,
	.filters input {
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-size: 0.875rem;
		background: white;
	}

	.filters select {
		min-width: 140px;
	}

	.price-range {
		display: flex;
		gap: 8px;
		align-items: center;
		position: relative;
	}

	.price-range::before {
		content: 'Custom Price:';
		font-size: 0.875rem;
		color: #6b7280;
		font-weight: 500;
		white-space: nowrap;
	}

	.price-range .price-input {
		width: 100px;
	}

	.sort-controls {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.sort-controls::before {
		content: 'Sort:';
		font-size: 0.875rem;
		color: #6b7280;
		font-weight: 500;
	}

	.clear-filters-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		background: #6b7280;
		color: white;
		border: none;
		padding: 8px 12px;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.clear-filters-btn:hover {
		background: #4b5563;
	}

	.listings-section {
		background: white;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		overflow: hidden;
		flex: 1;
	}

	.table-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px;
		border-bottom: 1px solid #e5e7eb;
	}

	.table-header h3 {
		margin: 0;
		color: #1f2937;
		font-size: 1.125rem;
		font-weight: 600;
	}

	.pagination-info {
		color: #6b7280;
		font-size: 0.875rem;
	}

	.table-wrapper {
		overflow-x: auto;
	}

	.listings-table {
		width: 100%;
		border-collapse: collapse;
	}

	.listings-table th {
		background: #f9fafb;
		padding: 12px;
		text-align: left;
		font-weight: 600;
		color: #374151;
		border-bottom: 1px solid #e5e7eb;
		font-size: 0.875rem;
		cursor: pointer;
		user-select: none;
		position: relative;
		padding-right: 24px;
	}

	.listings-table th:hover {
		background-color: #f3f4f6;
	}

	.sort-icon {
		font-size: 16px;
		position: absolute;
		right: 4px;
		top: 50%;
		transform: translateY(-50%);
		color: #6b7280;
	}

	.sort-icon:hover {
		color: #374151;
	}

	.listings-table td {
		padding: 12px;
		border-bottom: 1px solid #f3f4f6;
		font-size: 0.875rem;
	}

	.listings-table tr:hover {
		background: #f9fafb;
	}

	.sku {
		font-weight: 600;
		color: #1f2937;
	}

	.item-name {
		color: #1f2937;
		max-width: 300px;
	}

	.price {
		font-weight: 600;
		color: #10b981;
	}

	.shipping-group {
		color: #6b7280;
	}

	.status-badge {
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: uppercase;
	}

	.status-active {
		background: #d1fae5;
		color: #065f46;
	}

	.status-inactive {
		background: #fee2e2;
		color: #991b1b;
	}

	.status-pending {
		background: #fef3c7;
		color: #92400e;
	}

	.date {
		color: #6b7280;
		font-size: 0.75rem;
	}

	.pagination {
		display: flex;
		justify-content: center;
		gap: 8px;
		padding: 20px;
		border-top: 1px solid #e5e7eb;
	}

	.pagination-btn {
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		background: white;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.pagination-btn:hover:not(:disabled) {
		background: #f3f4f6;
	}

	.pagination-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pagination-btn.active {
		background: #f59e0b;
		color: white;
		border-color: #f59e0b;
	}

	/* Loading, Error, Empty States */
	.loading-state,
	.error-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 60px 24px;
		text-align: center;
	}

	.spinner {
		border: 3px solid rgba(245, 158, 11, 0.1);
		border-top: 3px solid #f59e0b;
		border-radius: 50%;
		width: 40px;
		height: 40px;
		animation: spin 1s linear infinite;
		margin-bottom: 16px;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.error-state i,
	.empty-state i {
		font-size: 48px;
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.error-state i {
		color: #ef4444;
	}

	.empty-state i {
		color: #6b7280;
	}

	.retry-btn {
		background: #6b7280;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 6px;
		cursor: pointer;
		margin-top: 16px;
	}

	/* Modal Styles */
	.modal-overlay {
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

	.modal {
		background: white;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		max-width: 500px;
		width: 90%;
		max-height: 90vh;
		overflow-y: auto;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px;
		border-bottom: 1px solid #e5e7eb;
	}

	.close-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px;
		color: #6b7280;
	}

	.modal-body {
		padding: 20px;
	}

	.error-detail {
		color: #ef4444;
		font-style: italic;
		margin: 2px 0;
	}

	.import-result {
		margin-top: 16px;
		padding: 12px;
		border-radius: 6px;
	}

	.import-result.success {
		background: #d1fae5;
		color: #065f46;
	}

	.import-result.error {
		background: #fee2e2;
		color: #991b1b;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		padding: 20px;
		border-top: 1px solid #e5e7eb;
	}

	.cancel-btn,
	.import-confirm-btn {
		padding: 8px 16px;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
	}

	.cancel-btn {
		background: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
	}

	.import-confirm-btn {
		background: #f59e0b;
		color: white;
		border: none;
	}

	.import-confirm-btn:hover:not(:disabled) {
		background: #d97706;
	}

	.import-confirm-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Loading, Error, Empty States */
	.loading-state,
	.error-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 60px 24px;
		text-align: center;
	}

	.spinner {
		border: 3px solid rgba(245, 158, 11, 0.1);
		border-top: 3px solid #f59e0b;
		border-radius: 50%;
		width: 40px;
		height: 40px;
		animation: spin 1s linear infinite;
		margin-bottom: 16px;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.error-state i,
	.empty-state i {
		font-size: 48px;
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.error-state i {
		color: #ef4444;
	}

	.empty-state i {
		color: #6b7280;
	}

	.retry-btn {
		background: #6b7280;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 6px;
		cursor: pointer;
		margin-top: 16px;
	}

	/* Modal Styles */
	.modal-overlay {
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

	.modal {
		background: white;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		max-width: 500px;
		width: 90%;
		max-height: 90vh;
		overflow-y: auto;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px;
		border-bottom: 1px solid #e5e7eb;
	}

	.close-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px;
		color: #6b7280;
	}

	.modal-body {
		padding: 20px;
	}

	.error-detail {
		color: #ef4444;
		font-style: italic;
		margin: 2px 0;
	}

	.import-result {
		margin-top: 16px;
		padding: 12px;
		border-radius: 6px;
	}

	.import-result.success {
		background: #d1fae5;
		color: #065f46;
	}

	.import-result.error {
		background: #fee2e2;
		color: #991b1b;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		padding: 20px;
		border-top: 1px solid #e5e7eb;
	}

	.cancel-btn,
	.import-confirm-btn {
		padding: 8px 16px;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
	}

	.cancel-btn {
		background: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
	}

	.import-confirm-btn {
		background: #f59e0b;
		color: white;
		border: none;
	}

	.import-confirm-btn:hover:not(:disabled) {
		background: #d97706;
	}

	.import-confirm-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
