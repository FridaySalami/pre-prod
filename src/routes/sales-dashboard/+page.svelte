<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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
	let sortKey = $state<SortKey>('total_revenue');
	let sortDirection = $state<'asc' | 'desc'>('desc');

	// Sorted products
	const sortedProducts = $derived.by(() => {
		const products = [...data.products];

		products.sort((a, b) => {
			const aVal = a[sortKey];
			const bVal = b[sortKey];

			if (aVal === null || aVal === undefined) return 1;
			if (bVal === null || bVal === undefined) return -1;

			if (sortDirection === 'asc') {
				return aVal > bVal ? 1 : -1;
			} else {
				return aVal < bVal ? 1 : -1;
			}
		});

		return products;
	});

	// Toggle sort
	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDirection = 'desc'; // Default to descending for new column
		}
	}

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
				<span>📊 {data.totalProducts} products</span>
				<span>•</span>
				<span>🔄 Data refreshed on page load</span>
			</div>
		</div>

		<!-- Summary Stats -->
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
			<div class="bg-white rounded-lg shadow p-4">
				<div class="text-sm text-gray-600">Total Revenue</div>
				<div class="text-2xl font-bold text-gray-900">
					{formatCurrency(sortedProducts.reduce((sum, p) => sum + p.total_revenue, 0))}
				</div>
			</div>
			<div class="bg-white rounded-lg shadow p-4">
				<div class="text-sm text-gray-600">Total Units Sold</div>
				<div class="text-2xl font-bold text-gray-900">
					{formatNumber(sortedProducts.reduce((sum, p) => sum + p.total_units, 0))}
				</div>
			</div>
			<div class="bg-white rounded-lg shadow p-4">
				<div class="text-sm text-gray-600">Total Sessions</div>
				<div class="text-2xl font-bold text-gray-900">
					{formatNumber(sortedProducts.reduce((sum, p) => sum + p.total_sessions, 0))}
				</div>
			</div>
			<div class="bg-white rounded-lg shadow p-4">
				<div class="text-sm text-gray-600">Avg Conversion</div>
				<div class="text-2xl font-bold text-gray-900">
					{formatPercent(
						sortedProducts.reduce((sum, p) => sum + p.avg_conversion, 0) / sortedProducts.length ||
							0
					)}
				</div>
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
						{#each sortedProducts as product, i}
							<tr class="hover:bg-gray-50 transition-colors">
								<td class="px-3 py-4 whitespace-nowrap">
									<a
										href="/buy-box-alerts/product/{product.asin}"
										class="text-sm font-mono text-blue-600 hover:text-blue-800 hover:underline"
									>
										{product.asin}
									</a>
									{#if i < 3}
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

			{#if sortedProducts.length === 0}
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
					<p class="mt-1 text-sm text-gray-500">No products found for the selected date range.</p>
				</div>
			{/if}
		</div>

		<!-- Footer Info -->
		<div class="mt-6 text-sm text-gray-500 text-center">
			<p>
				Data source: Amazon Reports API • Updated daily via cron job • Showing top {data.totalProducts}
				products
			</p>
		</div>
	</div>
</div>
