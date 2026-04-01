<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { browser } from '$app/environment';
	import UploadModal from '$lib/components/UploadModal.svelte';
	import AdminPageHeader from '$lib/components/AdminPageHeader.svelte';
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';

	let loading = true;
	let error = '';
	let compositionData: any[] = [];

	// Import modal
	let showImportModal = false;
	let importLoading = false;
	let importResult: any = null;
	let importFile: FileList | null = null;

	// Expected columns for the upload modal
	const expectedColumns = [
		{ name: 'ParentSKU', description: 'SKU of the parent product (required)' },
		{ name: 'ParentTitle', description: 'Title of the parent product (required)' },
		{ name: 'ChildSKU', description: 'SKU of the child/component product (required)' },
		{ name: 'ChildTitle', description: 'Title of the child/component product (required)' },
		{ name: 'Quantity', description: 'Quantity of child product in parent (required)' }
	];

	// Pagination
	let currentPage = 1;
	let pageSize = 10;
	let totalItems = 0;
	let totalPages = 1;

	// Search and filters
	let searchTerm = '';
	let debouncedSearchTerm = '';
	let searchTimeout: any;

	// Summary
	let summaryLoading = false;
	let summaryMessage = '';
	let summaryData: any[] = [];

	// Reactive statement to update totalPages
	$: totalPages = Math.ceil(totalItems / pageSize);

	async function fetchData() {
		if (!browser) return;
		loading = true;
		error = '';

		try {
			const params = new URLSearchParams({
				page: String(currentPage),
				limit: String(pageSize),
				filter: debouncedSearchTerm
			});

			const response = await fetch(`/api/linnworks-composition?${params}`);
			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.error || 'Failed to fetch data');
			}

			const result = await response.json();
			compositionData = result.data;
			totalItems = result.total;
			currentPage = result.page;
		} catch (err) {
			error = err instanceof Error ? err.message : 'An unknown error occurred';
			compositionData = [];
			totalItems = 0;
		} finally {
			loading = false;
		}
	}

	async function fetchSummaryData() {
		summaryLoading = true;
		summaryMessage = '';
		try {
			const response = await fetch('/api/linnworks-composition/summary');
			const result = await response.json();
			if (result.success) {
				summaryData = result.data;
			} else {
				summaryMessage = result.error || 'Failed to fetch summary.';
			}
		} catch (e) {
			summaryMessage = 'Error fetching summary.';
		} finally {
			summaryLoading = false;
		}
	}

	async function handleFileUpload() {
		if (!importFile || importFile.length === 0) {
			error = 'Please select a file';
			return;
		}

		const file = importFile[0];
		const formData = new FormData();
		formData.append('file', file);

		try {
			importLoading = true;
			importResult = null;
			error = '';

			const response = await fetch('/api/linnworks-composition/upload', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.success) {
				importResult = result;
				// Refetch data from the server
				await fetchData();
				// Clear the file input
				importFile = null;
			} else {
				importResult = {
					success: false,
					error: result.error || 'Upload failed',
					errorDetails: result.errorDetails || []
				};
			}
		} catch (err) {
			importResult = {
				success: false,
				error: err instanceof Error ? err.message : 'Upload failed'
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

	async function handleClearData() {
		if (!browser) return;

		if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) {
			return;
		}

		try {
			loading = true;
			const response = await fetch('/api/linnworks-composition', { method: 'DELETE' });
			if (!response.ok) {
				throw new Error('Failed to clear data');
			}
			await fetchData();
		} catch (err) {
			error = err instanceof Error ? err.message : 'An unknown error occurred';
		} finally {
			loading = false;
		}
	}

	function resetFilters() {
		searchTerm = '';
		debouncedSearchTerm = '';
		if (currentPage !== 1) {
			currentPage = 1;
		} else {
			fetchData();
		}
	}

	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages && page !== currentPage) {
			currentPage = page;
		}
	}

	// Debounce search input
	$: {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			debouncedSearchTerm = searchTerm;
		}, 300);
	}

	// Fetch data when page or filter changes
	$: if (browser) {
		(async () => {
			await tick(); // Wait for debouncedSearchTerm to update
			if (currentPage > totalPages && totalPages > 0) {
				currentPage = totalPages;
			} else {
				fetchData();
			}
		})();
	}

	// Fetch summary data on mount and after generating summary
	onMount(() => {
		fetchData();
		fetchSummaryData();
	});

	function formatNumber(value: any): string {
		if (value === null || value === undefined || value === '') return '-';
		const num = Number(value);
		if (isNaN(num)) return String(value);
		return num.toString();
	}

	function safeParse(value: any): any[] {
		if (Array.isArray(value)) return value;
		if (typeof value === 'string') {
			try {
				return JSON.parse(value);
			} catch (e) {
				return [];
			}
		}
		return [];
	}

	async function handleGenerateSummary() {
		summaryLoading = true;
		summaryMessage = '';
		try {
			const response = await fetch('/api/linnworks-composition/summary', { method: 'POST' });
			const result = await response.json();
			if (result.success) {
				summaryMessage = 'Summary generated successfully.';
				await fetchSummaryData();
			} else {
				summaryMessage = result.error || 'Failed to generate summary.';
			}
		} catch (e) {
			summaryMessage = 'Error generating summary.';
		} finally {
			summaryLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Linnworks Composition - Dashboard</title>
</svelte:head>

<div class="container mx-auto px-4 py-6">
	<Breadcrumb currentPage="Linnworks Composition" />

	<!-- Header -->
	<AdminPageHeader
		title="Linnworks Composition"
		description="Upload and manage product composition data with parent-child relationships"
		showClearButton={totalItems > 0}
		showDownloadButton={false}
		showImportButton={true}
		clearDisabled={loading}
		importDisabled={loading || importLoading}
		importButtonText="Upload CSV"
		onClear={handleClearData}
		onImport={() => (showImportModal = true)}
	/>

	<!-- Additional Action Buttons -->
	<div class="flex flex-wrap gap-4 mb-6">
		<button
			class="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
			on:click={handleGenerateSummary}
			disabled={loading}
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			Generate Summary
		</button>

		<a
			href="/linnworks-composition/summary"
			class="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
			style="text-decoration: none;"
			title="View the summary output table"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 17v-2a4 4 0 014-4h4m0 0V7m0 4l-4-4m4 4l4-4"
				/>
			</svg>
			View Summary Output
		</a>
	</div>

	<!-- Error Display -->
	{#if error}
		<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
			<div class="flex items-center">
				<svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
						clip-rule="evenodd"
					></path>
				</svg>
				{error}
			</div>
		</div>
	{/if}

	<!-- Summary Message -->
	{#if summaryLoading}
		<div class="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6">
			Generating summary...
		</div>
	{:else if summaryMessage}
		<div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
			{summaryMessage}
		</div>
	{/if}

	<!-- Filters -->
	<div class="bg-white p-6 rounded-lg border border-gray-200 mb-6">
		<h3 class="text-lg font-medium text-gray-900 mb-4">Filters</h3>
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div class="md:col-span-3">
				<label for="search" class="block text-sm font-medium text-gray-700 mb-2">Search</label>
				<input
					id="search"
					type="text"
					bind:value={searchTerm}
					placeholder="Search by SKU or Title..."
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
			</div>
		</div>
		<div class="mt-4 flex justify-between items-center">
			<button class="text-sm text-blue-600 hover:text-blue-800 font-medium" on:click={resetFilters}>
				Clear Filter
			</button>
			<span class="text-sm text-gray-600">
				Showing {compositionData.length} of {totalItems} records
			</span>
		</div>
	</div>

	<!-- Data Table -->
	{#if loading}
		<div class="text-center py-12">
			<p class="text-gray-600">Loading data...</p>
		</div>
	{:else if compositionData.length > 0}
		<div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200" style="table-layout: fixed;">
					<thead class="bg-gray-50">
						<tr>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								style="width: 20%; min-width: 150px;"
							>
								Parent SKU
							</th>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								style="width: 30%; min-width: 200px;"
							>
								Parent Title
							</th>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								style="width: 20%; min-width: 150px;"
							>
								Child SKU
							</th>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								style="width: 20%; min-width: 150px;"
							>
								Child Title
							</th>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								style="width: 10%; min-width: 100px;"
							>
								Quantity
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each compositionData as item}
							<tr class="hover:bg-gray-50">
								<td
									class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
									style="width: 20%; min-width: 150px;"
								>
									{item.parent_sku || '-'}
								</td>
								<td
									class="px-6 py-4 text-sm text-gray-900"
									style="width: 30%; min-width: 200px; word-wrap: break-word;"
								>
									{item.parent_title || '-'}
								</td>
								<td
									class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
									style="width: 20%; min-width: 150px;"
								>
									{item.child_sku || '-'}
								</td>
								<td
									class="px-6 py-4 text-sm text-gray-900"
									style="width: 20%; min-width: 150px; word-wrap: break-word;"
								>
									{item.child_title || '-'}
								</td>
								<td
									class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
									style="width: 10%; min-width: 100px;"
								>
									{formatNumber(item.quantity)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			{#if totalPages > 1}
				<div class="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
					<div class="flex items-center justify-between">
						<div class="flex-1 flex justify-between sm:hidden">
							<button
								class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
								disabled={currentPage <= 1}
								on:click={() => goToPage(currentPage - 1)}
							>
								Previous
							</button>
							<button
								class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
								disabled={currentPage >= totalPages}
								on:click={() => goToPage(currentPage + 1)}
							>
								Next
							</button>
						</div>
						<div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
							<div>
								<p class="text-sm text-gray-700">
									Showing
									<span class="font-medium">{(currentPage - 1) * pageSize + 1}</span>
									to
									<span class="font-medium">
										{Math.min(currentPage * pageSize, totalItems)}
									</span>
									of
									<span class="font-medium">{totalItems}</span>
									results
								</p>
							</div>
							<div>
								<nav
									class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
									aria-label="Pagination"
								>
									<button
										class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
										disabled={currentPage <= 1}
										on:click={() => goToPage(currentPage - 1)}
									>
										<span class="sr-only">Previous</span>
										<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
											<path
												fill-rule="evenodd"
												d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
												clip-rule="evenodd"
											></path>
										</svg></button
									>

									<!-- Page numbers could be dynamically generated here for larger sets -->
									<span
										class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
									>
										Page {currentPage} of {totalPages}
									</span>

									<button
										class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
										disabled={currentPage >= totalPages}
										on:click={() => goToPage(currentPage + 1)}
									>
										<span class="sr-only">Next</span>
										<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
											<path
												fill-rule="evenodd"
												d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
												clip-rule="evenodd"
											></path>
										</svg></button
									>
								</nav>
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<div class="text-center py-12 bg-white rounded-lg border border-gray-200">
			<h3 class="text-lg font-medium text-gray-900">No Data Available</h3>
			<p class="text-gray-600 mt-2">Upload a CSV file to get started.</p>
		</div>
	{/if}

	<!-- Summary Table -->
	{#if summaryData.length > 0}
		<div class="bg-white rounded-lg border border-gray-200 overflow-x-auto mb-8">
			<h3 class="text-lg font-semibold text-gray-900 px-6 pt-6">Composition Summary</h3>
			<table class="min-w-full divide-y divide-gray-200 mt-4" style="table-layout: fixed;">
				<thead class="bg-gray-50">
					<tr>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Parent SKU</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Parent Title</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Child SKUs</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Child Quantities</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Child Prices</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Child VATs</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Total Qty</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Total Value</th
						>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each summaryData as row}
						<tr>
							<td class="px-6 py-4 text-sm text-gray-900">{row.parent_sku}</td>
							<td class="px-6 py-4 text-sm text-gray-900">{row.parent_title}</td>
							<td class="px-6 py-4 text-sm text-gray-900">{safeParse(row.child_skus).join(', ')}</td
							>
							<td class="px-6 py-4 text-sm text-gray-900"
								>{safeParse(row.child_quantities).join(', ')}</td
							>
							<td class="px-6 py-4 text-sm text-gray-900"
								>{safeParse(row.child_prices).map(formatNumber).join(', ')}</td
							>
							<td class="px-6 py-4 text-sm text-gray-900"
								>{safeParse(row.child_vats).map(formatNumber).join(', ')}</td
							>
							<td class="px-6 py-4 text-sm text-gray-900">{formatNumber(row.total_qty)}</td>
							<td class="px-6 py-4 text-sm text-gray-900">{formatNumber(row.total_value)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<!-- Upload Modal -->
	<UploadModal
		bind:showModal={showImportModal}
		title="Upload Linnworks Composition"
		description="Upload a CSV file to import Linnworks composition data."
		{expectedColumns}
		{importLoading}
		{importResult}
		selectedFile={importFile}
		on:upload={handleFileUpload}
		on:fileSelected={handleFileSelected}
		on:close={handleModalClose}
	/>
</div>
