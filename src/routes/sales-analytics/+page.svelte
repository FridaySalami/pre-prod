<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	// Types
	interface SalesData {
		'Primary Key'?: number;
		SKU: string;
		'(Parent) ASIN'?: string;
		'(Child) ASIN'?: string;
		Title?: string;
		'Units ordered': number;
		'Ordered Product Sales': string;
		'Sessions – Total': string;
		'Unit Session Percentage': string;
		'Featured Offer (Buy Box) percentage': string;
		'Sessions – Mobile app'?: string;
		'Sessions – Browser'?: string;
		'Page views – Total'?: string;
		// Additional fields from mapping
		'item-name'?: string;
		'item-description'?: string;
		price?: string;
		status?: string;
		has_sales: boolean;
	}

	interface Summary {
		totalProducts: number;
		totalUnits: number;
		totalRevenue: number;
		totalSessions: number;
		avgBuyBoxPercentage: number;
		productsWithSales?: number;
		productsWithNoSales?: number;
	}

	// State
	let salesData: SalesData[] = [];
	let summary: Summary = {
		totalProducts: 0,
		totalUnits: 0,
		totalRevenue: 0,
		totalSessions: 0,
		avgBuyBoxPercentage: 0
	};
	let loading = false;
	let error = '';
	let searchTerm = '';
	let searchType = 'all';
	let currentOffset = 0;
	let hasMore = true;
	let includeNoSales = false;
	let showOnlyNoSales = false;

	// Search and load data
	async function loadData(reset = false) {
		loading = true;
		error = '';

		if (reset) {
			currentOffset = 0;
			salesData = [];
		}

		try {
			const params = new URLSearchParams({
				search: searchTerm,
				type: searchType,
				limit: '50',
				offset: currentOffset.toString()
			});

			// Only add parameters if actually needed
			if (includeNoSales) {
				params.set('includeNoSales', 'true');
			}
			if (showOnlyNoSales) {
				params.set('showOnlyNoSales', 'true');
			}

			const apiEndpoint =
				includeNoSales || showOnlyNoSales
					? '/api/sales-analytics-enhanced'
					: '/api/sales-analytics';

			const response = await fetch(`${apiEndpoint}?${params}`);
			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to load data');
			}

			if (reset) {
				salesData = result.data;
			} else {
				salesData = [...salesData, ...result.data];
			}

			summary = result.summary;
			hasMore = result.pagination.hasMore;
			currentOffset += result.data.length;
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
		} finally {
			loading = false;
		}
	}

	function handleSearch() {
		loadData(true);
	}

	function loadMore() {
		if (!loading && hasMore) {
			loadData(false);
		}
	}

	function formatCurrency(value: string | number): string {
		if (typeof value === 'string') {
			return value;
		}
		return `£${value.toFixed(2)}`;
	}

	function formatNumber(value: string | number): string {
		if (typeof value === 'string') {
			return value.replace(/,/g, '');
		}
		return value.toLocaleString();
	}

	function formatPercentage(value: string): string {
		return value || '0%';
	}

	onMount(() => {
		loadData(true);
	});
</script>

<svelte:head>
	<title>Sales Analytics | Amazon Sales Data</title>
</svelte:head>

<div class="container mx-auto p-6 max-w-7xl">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-2">Sales Analytics Dashboard</h1>
		<p class="text-gray-600">Analyze your Amazon sales data with advanced search and filtering</p>
	</div>

	<!-- Search Controls -->
	<div class="bg-white rounded-lg shadow-sm border p-6 mb-6">
		<div class="flex flex-col gap-4">
			<!-- Search Row -->
			<div class="flex flex-col sm:flex-row gap-4">
				<div class="flex-1">
					<label for="search" class="block text-sm font-medium text-gray-700 mb-2"
						>Search Products</label
					>
					<input
						id="search"
						type="text"
						bind:value={searchTerm}
						placeholder="Search by SKU, ASIN, or product name..."
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						on:keypress={(e) => e.key === 'Enter' && handleSearch()}
					/>
				</div>

				<div class="sm:w-48">
					<label for="searchType" class="block text-sm font-medium text-gray-700 mb-2"
						>Search Type</label
					>
					<select
						id="searchType"
						bind:value={searchType}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					>
						<option value="all">All Fields</option>
						<option value="sku">SKU Only</option>
						<option value="asin">ASIN Only</option>
						<option value="title">Product Name</option>
					</select>
				</div>

				<div class="sm:w-32 flex items-end">
					<button
						on:click={handleSearch}
						disabled={loading}
						class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{loading ? 'Searching...' : 'Search'}
					</button>
				</div>
			</div>

			<!-- Filter Options Row -->
			<div class="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-200">
				<div class="flex items-center space-x-4">
					<label class="flex items-center">
						<input
							type="checkbox"
							bind:checked={includeNoSales}
							on:change={() => {
								if (includeNoSales) showOnlyNoSales = false;
								handleSearch();
							}}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
						<span class="ml-2 text-sm text-gray-700">Include SKUs with no sales</span>
					</label>

					<label class="flex items-center">
						<input
							type="checkbox"
							bind:checked={showOnlyNoSales}
							on:change={() => {
								if (showOnlyNoSales) includeNoSales = false;
								handleSearch();
							}}
							class="rounded border-gray-300 text-red-600 focus:ring-red-500"
						/>
						<span class="ml-2 text-sm text-gray-700">Show only SKUs with no sales</span>
					</label>
				</div>

				<div class="text-sm text-gray-500 flex items-center">
					{#if showOnlyNoSales}
						<span class="text-red-600">📊 Showing products with zero sales</span>
					{:else if includeNoSales}
						<span class="text-blue-600">📊 Showing all products (including zero sales)</span>
					{:else}
						<span class="text-green-600">📊 Showing products with sales only</span>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Summary Cards -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
		<div class="bg-white rounded-lg shadow-sm border p-4">
			<div class="text-sm font-medium text-gray-500">Total Products</div>
			<div class="text-2xl font-bold text-gray-900">{summary.totalProducts.toLocaleString()}</div>
		</div>

		{#if summary.productsWithSales !== undefined}
			<div class="bg-white rounded-lg shadow-sm border p-4">
				<div class="text-sm font-medium text-gray-500">With Sales</div>
				<div class="text-2xl font-bold text-green-600">
					{summary.productsWithSales.toLocaleString()}
				</div>
			</div>
		{/if}

		{#if summary.productsWithNoSales !== undefined}
			<div class="bg-white rounded-lg shadow-sm border p-4">
				<div class="text-sm font-medium text-gray-500">No Sales</div>
				<div class="text-2xl font-bold text-red-600">
					{summary.productsWithNoSales.toLocaleString()}
				</div>
			</div>
		{/if}

		<div class="bg-white rounded-lg shadow-sm border p-4">
			<div class="text-sm font-medium text-gray-500">Total Units Sold</div>
			<div class="text-2xl font-bold text-green-600">{summary.totalUnits.toLocaleString()}</div>
		</div>

		<div class="bg-white rounded-lg shadow-sm border p-4">
			<div class="text-sm font-medium text-gray-500">Total Revenue</div>
			<div class="text-2xl font-bold text-green-600">{formatCurrency(summary.totalRevenue)}</div>
		</div>

		<div class="bg-white rounded-lg shadow-sm border p-4">
			<div class="text-sm font-medium text-gray-500">Total Sessions</div>
			<div class="text-2xl font-bold text-blue-600">{summary.totalSessions.toLocaleString()}</div>
		</div>

		<div class="bg-white rounded-lg shadow-sm border p-4">
			<div class="text-sm font-medium text-gray-500">Avg Buy Box %</div>
			<div class="text-2xl font-bold text-purple-600">
				{summary.avgBuyBoxPercentage.toFixed(1)}%
			</div>
		</div>
	</div>

	<!-- Error Display -->
	{#if error}
		<div class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
			<div class="text-red-800">
				<strong>Error:</strong>
				{error}
			</div>
		</div>
	{/if}

	<!-- Data Table -->
	<div class="bg-white rounded-lg shadow-sm border overflow-hidden">
		<div class="overflow-x-auto">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Product</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>SKU</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>ASIN</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Units Sold</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Revenue</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Sessions</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Conversion</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Buy Box %</th
						>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each salesData as item, index}
						<tr class="hover:bg-gray-50 {index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}">
							<td class="px-6 py-4">
								<div
									class="text-sm font-medium text-gray-900 max-w-xs truncate"
									title={item.Title || item['item-name']}
								>
									{item.Title || item['item-name'] || 'No title'}
								</div>
								{#if item['item-description']}
									<div class="text-xs text-gray-500 truncate" title={item['item-description']}>
										{item['item-description']}
									</div>
								{/if}
							</td>
							<td class="px-6 py-4">
								<div class="text-sm text-gray-900 font-mono">{item.SKU}</div>
							</td>
							<td class="px-6 py-4 text-sm text-gray-900 font-mono"
								>{item['(Child) ASIN'] || 'N/A'}</td
							>
							<td class="px-6 py-4 text-sm font-semibold text-gray-900"
								>{formatNumber(item['Units ordered'])}</td
							>
							<td class="px-6 py-4 text-sm font-semibold text-gray-900"
								>{item['Ordered Product Sales']}</td
							>
							<td class="px-6 py-4 text-sm text-blue-600"
								>{formatNumber(item['Sessions – Total'])}</td
							>
							<td class="px-6 py-4 text-sm text-gray-900"
								>{formatPercentage(item['Unit Session Percentage'])}</td
							>
							<td class="px-6 py-4 text-sm text-purple-600"
								>{formatPercentage(item['Featured Offer (Buy Box) percentage'])}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>

			{#if salesData.length === 0 && !loading}
				<div class="text-center py-12">
					<div class="text-gray-500 text-lg">
						{searchTerm ? 'No products found matching your search.' : 'No sales data available.'}
					</div>
					{#if searchTerm}
						<button
							on:click={() => {
								searchTerm = '';
								handleSearch();
							}}
							class="mt-4 text-blue-600 hover:text-blue-700"
						>
							Clear search and show all products
						</button>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Load More Button -->
		{#if hasMore && salesData.length > 0}
			<div class="px-6 py-4 border-t border-gray-200 bg-gray-50">
				<button
					on:click={loadMore}
					disabled={loading}
					class="w-full px-4 py-2 text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{loading ? 'Loading...' : 'Load More Products'}
				</button>
			</div>
		{/if}
	</div>

	<!-- Data Insights -->
	{#if salesData.length > 0}
		<div class="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
			<h3 class="text-lg font-semibold text-blue-900 mb-2">💡 Quick Insights</h3>
			<div class="text-blue-800 space-y-1">
				<p>• Showing {salesData.length} products {searchTerm ? `matching "${searchTerm}"` : ''}</p>
				<p>
					• Average revenue per product: {formatCurrency(
						summary.totalRevenue / summary.totalProducts
					)}
				</p>
				<p>
					• Average conversion rate: {summary.totalSessions > 0
						? ((summary.totalUnits / summary.totalSessions) * 100).toFixed(2)
						: 0}%
				</p>
				<p>
					• Products with 90%+ Buy Box: {salesData.filter(
						(item) =>
							parseFloat(item['Featured Offer (Buy Box) percentage']?.replace('%', '') || '0') >= 90
					).length}
				</p>
			</div>
		</div>
	{/if}
</div>

<style>
	.bg-gray-25 {
		background-color: #fafafa;
	}
</style>
