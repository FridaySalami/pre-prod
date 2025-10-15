<script lang="ts">
	import type { PageData } from './$types';
	import Pagination from '$lib/components/Pagination.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let { data }: { data: PageData } = $props();

	// Search and filter state
	let searchInput = $state(data.filters?.search || '');
	let minRevenueInput = $state(data.filters?.minRevenue?.toString() || '');

	// Sorting state
	type SortKey =
		| 'asin'
		| 'total_revenue'
		| 'total_units'
		| 'total_sessions'
		| 'total_page_views'
		| 'avg_conversion'
		| 'avg_buy_box'
		| 'avg_price';
	let sortKey = $state<SortKey>((data.filters?.sortBy as SortKey) || 'total_revenue');
	let sortDirection = $state<'asc' | 'desc'>(data.filters?.sortDir || 'desc');

	// Products from server (already sorted and paginated)
	const products = $derived(data.products || []);

	// Toggle sort - updates URL to trigger server-side sort
	function toggleSort(key: SortKey) {
		const newDirection = sortKey === key && sortDirection === 'desc' ? 'asc' : 'desc';
		sortKey = key;
		sortDirection = newDirection;

		const url = new URL($page.url);
		url.searchParams.set('sortBy', key);
		url.searchParams.set('sortDir', newDirection);
		url.searchParams.set('page', '1'); // Reset to first page when sorting changes
		goto(url.toString());
	}

	// Apply search and filters
	function applyFilters() {
		const url = new URL($page.url);

		if (searchInput.trim()) {
			url.searchParams.set('search', searchInput.trim());
		} else {
			url.searchParams.delete('search');
		}

		const minRev = parseFloat(minRevenueInput);
		if (!isNaN(minRev) && minRev > 0) {
			url.searchParams.set('minRevenue', minRev.toString());
		} else {
			url.searchParams.delete('minRevenue');
		}

		url.searchParams.set('page', '1'); // Reset to first page
		goto(url.toString());
	}

	// Clear all filters
	function clearFilters() {
		searchInput = '';
		minRevenueInput = '';

		const url = new URL($page.url);
		url.searchParams.delete('search');
		url.searchParams.delete('minRevenue');
		url.searchParams.set('page', '1');
		goto(url.toString());
	}

	// Check if any filters are active
	const hasActiveFilters = $derived(searchInput || minRevenueInput);

	// Format currency
	function formatCurrency(value: number): string {
		return new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency: 'GBP',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(value);
	}

	// Format number
	function formatNumber(value: number): string {
		return new Intl.NumberFormat('en-GB').format(Math.round(value));
	}

	// Format percentage
	function formatPercent(value: number): string {
		return `${value.toFixed(1)}%`;
	}

	// Get sort indicator
	function getSortIndicator(key: SortKey): string {
		if (sortKey !== key) return '';
		return sortDirection === 'asc' ? '↑' : '↓';
	}
</script>

<svelte:head>
	<title>Sales Dashboard - Top Sellers</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900">Top Sellers Dashboard</h1>
			<p class="mt-2 text-sm text-gray-600">
				Last 30 days ({data.dateRange.start} to {data.dateRange.end})
			</p>
			<div class="mt-4 flex items-center space-x-4 text-sm text-gray-500">
				<span>📊 {data.pagination.totalProducts.toLocaleString()} products</span>
				<span>•</span>
				<span>🔄 Data source: {data.dataSource}</span>
				{#if data.dataSource === 'materialized-view'}
					<span
						class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
					>
						⚡ Optimized
					</span>
				{/if}
			</div>
		</div>

		<!-- Search and Filters -->
		<div class="bg-white rounded-lg shadow p-4 mb-6">
			<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
				<!-- Search -->
				<div class="md:col-span-2">
					<label for="search" class="block text-sm font-medium text-gray-700 mb-1">
						Search Products
					</label>
					<input
						id="search"
						type="text"
						bind:value={searchInput}
						onkeydown={(e) => e.key === 'Enter' && applyFilters()}
						placeholder="Search by ASIN or product name..."
						class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
					/>
				</div>

				<!-- Min Revenue Filter -->
				<div>
					<label for="minRevenue" class="block text-sm font-medium text-gray-700 mb-1">
						Min Revenue (£)
					</label>
					<input
						id="minRevenue"
						type="number"
						min="0"
						step="100"
						bind:value={minRevenueInput}
						onkeydown={(e) => e.key === 'Enter' && applyFilters()}
						placeholder="e.g., 1000"
						class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
					/>
				</div>

				<!-- Action Buttons -->
				<div class="flex items-end gap-2">
					<button
						onclick={applyFilters}
						class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
					>
						Apply
					</button>
					{#if hasActiveFilters}
						<button
							onclick={clearFilters}
							class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
							title="Clear all filters"
						>
							✕
						</button>
					{/if}
				</div>
			</div>

			<!-- Active filters display -->
			{#if hasActiveFilters}
				<div class="mt-3 flex flex-wrap gap-2">
					<span class="text-sm text-gray-600">Active filters:</span>
					{#if searchInput}
						<span
							class="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-sm"
						>
							Search: "{searchInput}"
						</span>
					{/if}
					{#if minRevenueInput}
						<span
							class="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-sm"
						>
							Min Revenue: £{parseFloat(minRevenueInput).toLocaleString()}
						</span>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Summary Stats -->
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
			<div class="bg-white rounded-lg shadow p-4">
				<div class="text-sm text-gray-600">Total Revenue</div>
				<div class="text-2xl font-bold text-gray-900">
					{formatCurrency(products.reduce((sum, p) => sum + p.total_revenue, 0))}
				</div>
				<div class="text-xs text-gray-500 mt-1">Current page total</div>
			</div>
			<div class="bg-white rounded-lg shadow p-4">
				<div class="text-sm text-gray-600">Total Units Sold</div>
				<div class="text-2xl font-bold text-gray-900">
					{formatNumber(products.reduce((sum, p) => sum + p.total_units, 0))}
				</div>
				<div class="text-xs text-gray-500 mt-1">Current page total</div>
			</div>
			<div class="bg-white rounded-lg shadow p-4">
				<div class="text-sm text-gray-600">Total Sessions</div>
				<div class="text-2xl font-bold text-gray-900">
					{formatNumber(products.reduce((sum, p) => sum + p.total_sessions, 0))}
				</div>
				<div class="text-xs text-gray-500 mt-1">Current page total</div>
			</div>
			<div class="bg-white rounded-lg shadow p-4">
				<div class="text-sm text-gray-600">Avg Conversion</div>
				<div class="text-2xl font-bold text-gray-900">
					{formatPercent(
						products.reduce((sum, p) => sum + p.avg_conversion, 0) / products.length || 0
					)}
				</div>
				<div class="text-xs text-gray-500 mt-1">Current page average</div>
			</div>
		</div>

		<!-- Products Table -->
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th
								scope="col"
								class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
								onclick={() => toggleSort('asin')}
							>
								ASIN {getSortIndicator('asin')}
							</th>
							<th
								scope="col"
								class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>
								Product Name
							</th>
							<th
								scope="col"
								class="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
								onclick={() => toggleSort('total_revenue')}
							>
								Revenue {getSortIndicator('total_revenue')}
							</th>
							<th
								scope="col"
								class="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
								onclick={() => toggleSort('total_units')}
							>
								Units {getSortIndicator('total_units')}
							</th>
							<th
								scope="col"
								class="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
								onclick={() => toggleSort('total_sessions')}
							>
								Sessions {getSortIndicator('total_sessions')}
							</th>
							<th
								scope="col"
								class="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
								onclick={() => toggleSort('total_page_views')}
							>
								Page Views {getSortIndicator('total_page_views')}
							</th>
							<th
								scope="col"
								class="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
								onclick={() => toggleSort('avg_conversion')}
							>
								Conversion {getSortIndicator('avg_conversion')}
							</th>
							<th
								scope="col"
								class="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
								onclick={() => toggleSort('avg_buy_box')}
							>
								Buy Box % {getSortIndicator('avg_buy_box')}
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each products as product, i}
							<tr class="hover:bg-gray-50 transition-colors">
								<td class="px-3 py-4 whitespace-nowrap">
									<a
										href="/buy-box-alerts/product/{product.asin}"
										target="_blank"
										rel="noopener noreferrer"
										class="text-sm font-mono text-blue-600 hover:text-blue-800 hover:underline"
									>
										{product.asin}
									</a>
									{#if i < 3 && data.pagination.currentPage === 1}
										<span class="ml-2 text-xs">
											{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
										</span>
									{/if}
								</td>
								<td class="px-3 py-4 text-sm text-gray-900">
									<div
										class="line-clamp-2 min-w-[200px] max-w-[400px]"
										title={product.item_name || product.asin}
									>
										{product.item_name || '—'}
									</div>
								</td>
								<td
									class="px-3 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900"
								>
									{formatCurrency(product.total_revenue)}
								</td>
								<td class="px-3 py-4 whitespace-nowrap text-right text-sm text-gray-900">
									{formatNumber(product.total_units)}
								</td>
								<td class="px-3 py-4 whitespace-nowrap text-right text-sm text-gray-600">
									{formatNumber(product.total_sessions)}
								</td>
								<td class="px-3 py-4 whitespace-nowrap text-right text-sm text-gray-600">
									{formatNumber(product.total_page_views)}
								</td>
								<td class="px-3 py-4 whitespace-nowrap text-right text-sm">
									<span
										class={product.avg_conversion >= 10
											? 'text-green-600 font-semibold'
											: product.avg_conversion >= 5
												? 'text-blue-600'
												: 'text-gray-600'}
									>
										{formatPercent(product.avg_conversion)}
									</span>
								</td>
								<td class="px-3 py-4 whitespace-nowrap text-right text-sm">
									<span
										class={product.avg_buy_box >= 80
											? 'text-green-600 font-semibold'
											: product.avg_buy_box >= 50
												? 'text-blue-600'
												: 'text-yellow-600'}
									>
										{formatPercent(product.avg_buy_box)}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if products.length === 0}
				<div class="text-center py-12">
					<svg
						class="mx-auto h-12 w-12 text-gray-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
					<h3 class="mt-2 text-sm font-medium text-gray-900">No sales data</h3>
					<p class="mt-1 text-sm text-gray-500">
						{#if hasActiveFilters}
							No products match your search criteria. Try adjusting your filters.
						{:else}
							No products found for the selected date range.
						{/if}
					</p>
					{#if hasActiveFilters}
						<button
							onclick={clearFilters}
							class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
						>
							Clear Filters
						</button>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Pagination -->
		{#if products.length > 0}
			<Pagination
				currentPage={data.pagination.currentPage}
				totalPages={data.pagination.totalPages}
				pageSize={data.pagination.pageSize}
				totalProducts={data.pagination.totalProducts}
				hasNext={data.pagination.hasNext}
				hasPrev={data.pagination.hasPrev}
				showing={data.pagination.showing}
			/>
		{/if}

		<!-- Footer Info -->
		<div class="mt-6 text-sm text-gray-500 text-center">
			<p>
				Data source: Amazon Reports API • Updated daily via cron job
				{#if data.dataSource === 'materialized-view'}
					• Using optimized materialized view
				{:else}
					• Real-time aggregation
				{/if}
			</p>
		</div>
	</div>
</div>
