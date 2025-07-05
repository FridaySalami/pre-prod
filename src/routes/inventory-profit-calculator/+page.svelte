<script lang="ts">
	import { onMount } from 'svelte';
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';

	interface ProductData {
		id: string | number;
		sku: string;
		stockLevel: number;
		depth: string;
		height: string;
		width: string;
		box: string;
		purchasePrice: number;
		retailPrice: number;
		title: string;
		tracked: string;
		weight: number;
		shipping: string;
		shippingTier: string;
		shippingCost: number;
		cost: number;
		boxCost: number;
		materialCost: number;
		fragileCharge: number;
		vatCode: number;
		vatAmount: number;
		marginPercent: number;
		prProfit: number;
		costPlusMargin: number;
		materialTotalCost: number;
		amazonPrice: number;
	}

	let data: ProductData[] = [];
	let loading = true;
	let error = '';
	let search = '';
	let page = 1;
	let pageSize = 10;
	let total = 0;
	let exportLoading = false;

	// Summary stats
	$: profitableCount = data.filter((item) => {
		const profit = item.costPlusMargin - item.cost;
		return profit > 0;
	}).length;
	$: totalProfit = data.reduce((sum, item) => {
		const profit = item.costPlusMargin - item.cost;
		return sum + (profit > 0 ? profit : 0);
	}, 0);

	async function fetchData() {
		loading = true;
		error = '';
		try {
			const params = new URLSearchParams({
				search,
				page: String(page),
				limit: String(pageSize)
			});
			const res = await fetch(`/api/inventory-profit-calculator/summary?${params}`);
			const result = await res.json();
			if (result.success) {
				data = result.data;
				total = result.total;
			} else {
				error = result.error || 'Failed to fetch data.';
			}
		} catch (e) {
			error = 'Error fetching data.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		fetchData();
	});

	function handleSearch(e: Event) {
		search = (e.target as HTMLInputElement).value;
		page = 1;
		fetchData();
	}

	function goToPage(p: number) {
		if (p >= 1 && p <= Math.ceil(total / pageSize)) {
			page = p;
			fetchData();
		}
	}

	async function handleGenerate() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/inventory-profit-calculator/summary', { method: 'POST' });
			const result = await res.json();
			if (!result.success) error = result.error || 'Failed to generate report.';
			else fetchData();
		} catch (e) {
			error = 'Error generating report.';
		} finally {
			loading = false;
		}
	}

	async function exportToCSV() {
		exportLoading = true;
		try {
			// Fetch all data for export (without pagination)
			const res = await fetch(
				`/api/inventory-profit-calculator/summary?search=${search}&page=1&limit=10000`
			);
			const result = await res.json();

			if (result.success) {
				const csvData = result.data;
				const headers = [
					'SKU',
					'Stock Level',
					'Box',
					'Title',
					'Tracked',
					'Weight (kg)',
					'Shipping',
					'Shipping Tier',
					'Shipping Cost (£)',
					'Cost (£)',
					'Box Cost (£)',
					'Material Cost (£)',
					'Fragile Charge (£)',
					'VAT Code',
					'VAT (£)',
					'Margin %',
					'Cost + Margin (£)',
					'Material Total Cost (£)',
					'Amazon Price (£)',
					'Profit (£)'
				];

				const csvContent = [
					headers.join(','),
					...csvData.map((item: ProductData) => {
						const profit = item.costPlusMargin - item.cost;
						return [
							item.sku,
							item.stockLevel,
							`"${item.box}"`,
							`"${item.title.replace(/"/g, '""')}"`,
							item.tracked,
							item.weight,
							`"${item.shipping}"`,
							`"${item.shippingTier}"`,
							item.shippingCost.toFixed(2),
							item.cost.toFixed(2),
							item.boxCost.toFixed(2),
							item.materialCost.toFixed(2),
							item.fragileCharge.toFixed(2),
							item.vatCode,
							item.vatAmount.toFixed(2),
							item.marginPercent,
							item.costPlusMargin.toFixed(2),
							item.materialTotalCost.toFixed(2),
							item.amazonPrice.toFixed(2),
							profit.toFixed(2)
						].join(',');
					})
				].join('\n');

				// Download CSV
				const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
				const link = document.createElement('a');
				const url = URL.createObjectURL(blob);
				link.setAttribute('href', url);
				link.setAttribute(
					'download',
					`inventory-profit-analysis-${new Date().toISOString().split('T')[0]}.csv`
				);
				link.style.visibility = 'hidden';
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			} else {
				throw new Error(result.error || 'Export failed');
			}
		} catch (e) {
			error = 'Failed to export data';
		} finally {
			exportLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Inventory Profit Calculator</title>
</svelte:head>

<div class="container mx-auto px-4 py-6">
	<Breadcrumb currentPage="Inventory Profit Calculator" />

	<div class="mb-6">
		<h1 class="text-3xl font-bold mb-2">Inventory Profit Calculator</h1>
		<p class="text-gray-600">Live product data with profit analysis and cost calculations</p>
	</div>

	<!-- Summary Stats Panel -->
	{#if data.length > 0}
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
			<div class="bg-white rounded-lg shadow-sm border p-4">
				<div class="text-2xl font-bold text-blue-600">{data.length}</div>
				<div class="text-sm text-gray-500">Products Displayed</div>
			</div>
			<div class="bg-white rounded-lg shadow-sm border p-4">
				<div class="text-2xl font-bold text-green-600">{profitableCount}</div>
				<div class="text-sm text-gray-500">Profitable Products</div>
			</div>
			<div class="bg-white rounded-lg shadow-sm border p-4">
				<div class="text-2xl font-bold text-gray-800">{total.toLocaleString()}</div>
				<div class="text-sm text-gray-500">Total Products</div>
			</div>
			<div class="bg-white rounded-lg shadow-sm border p-4">
				<div class="text-2xl font-bold text-green-600">£{totalProfit.toFixed(2)}</div>
				<div class="text-sm text-gray-500">Total Profit (Page)</div>
			</div>
		</div>
	{/if}

	<!-- Controls -->
	<div class="bg-white rounded-lg shadow-sm border p-4 mb-6">
		<div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
			<div class="flex-1 max-w-md">
				<input
					type="text"
					placeholder="Search by SKU or title..."
					bind:value={search}
					on:input={() => {
						page = 1;
						fetchData();
					}}
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>
			<div class="flex gap-2 items-center">
				<select
					bind:value={pageSize}
					on:change={() => {
						page = 1;
						fetchData();
					}}
					class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
				>
					<option value={10}>10 per page</option>
					<option value={25}>25 per page</option>
					<option value={50}>50 per page</option>
					<option value={100}>100 per page</option>
				</select>
				<a
					href="/inventory-profit-calculator/scenario-analysis"
					class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm whitespace-nowrap"
				>
					SKU Analysis
				</a>
				<button
					on:click={exportToCSV}
					disabled={exportLoading || data.length === 0}
					class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
				>
					{exportLoading ? 'Exporting...' : 'Export CSV'}
				</button>
			</div>
		</div>
	</div>

	<!-- Main Profit Calculator Data -->
	<div class="mb-8">
		<h2 class="text-lg font-semibold mb-2">Product Profit Analysis</h2>

		<div class="mb-4 flex gap-4 items-center">
			<input
				type="text"
				placeholder="Search products..."
				value={search}
				on:input={handleSearch}
				class="border px-3 py-2 rounded w-64"
			/>
			<button
				class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
				on:click={handleGenerate}
				disabled={loading}
			>
				{loading ? 'Refreshing...' : 'Refresh Data'}
			</button>
			<button
				class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
				on:click={exportToCSV}
				disabled={exportLoading || loading}
			>
				{exportLoading ? 'Exporting...' : 'Export to CSV'}
			</button>
		</div>

		<!-- Debug: show last generate result and error -->
		{#if error}
			<pre class="bg-red-100 text-red-700 p-2 text-xs rounded mb-4">{error}</pre>
		{/if}
		{#if data && data.length === 0 && !loading}
			<pre
				class="bg-yellow-100 text-yellow-700 p-2 text-xs rounded mb-4">No data returned from API.\nRaw: {JSON.stringify(
					data,
					null,
					2
				)}</pre>
		{/if}

		{#if loading}
			<div>Loading...</div>
		{:else if error}
			<div class="text-red-600">{error}</div>
		{:else if data.length === 0}
			<div>No data available.</div>
		{:else}
			<!-- Legend -->
			<div class="mb-4 p-4 bg-gray-50 rounded-lg">
				<h3 class="text-sm font-medium text-gray-900 mb-2">Color Legend:</h3>
				<div class="flex flex-wrap gap-4 text-xs">
					<div class="flex items-center gap-2">
						<div class="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
						<span>Profitable Products</span>
					</div>
					<div class="flex items-center gap-2">
						<div class="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
						<span>Loss-Making Products</span>
					</div>
					<div class="flex items-center gap-2">
						<div class="w-4 h-4 bg-blue-100 border-l-4 border-blue-400"></div>
						<span>Cost + Margin (Blue)</span>
					</div>
					<div class="flex items-center gap-2">
						<div class="w-4 h-4 bg-yellow-100 border-l-4 border-yellow-400"></div>
						<span>Material Total Cost (Yellow)</span>
					</div>
				</div>
			</div>

			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200 mt-4">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
							<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
								>Stock Level</th
							>
							<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Box</th>
							<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
							<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
								>Tracked</th
							>
							<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Weight</th
							>
							<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
								>Shipping</th
							>
							<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
								>Shipping Tier</th
							>
							<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
								>Shipping Cost</th
							>
							<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
							<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
								>Cost + Margin</th
							>
							<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
								>Box Cost</th
							>
							<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
								>Material Cost</th
							>
							<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
								>Fragile Charge</th
							>
							<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
								>VAT Code</th
							>
							<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">VAT</th>
							<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
								>Material Total Cost</th
							>
							<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
								>Amazon Price</th
							>
							<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Profit</th
							>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each data as row}
							{@const profit = row.costPlusMargin - row.cost}
							{@const isProfitable = profit > 0}
							<tr class="{isProfitable ? 'bg-green-50' : 'bg-red-50'} hover:bg-opacity-80">
								<td class="px-4 py-2 text-sm font-medium text-gray-900">
									<a
										href="/inventory-profit-calculator/scenario-analysis?sku={row.sku}"
										class="text-blue-600 hover:text-blue-800 hover:underline"
									>
										{row.sku}
									</a>
								</td>
								<td
									class="px-4 py-2 text-sm text-gray-900 {row.stockLevel < 10
										? 'text-orange-600 font-medium'
										: ''}">{row.stockLevel}</td
								>
								<td class="px-4 py-2 text-sm text-gray-900">{row.box}</td>
								<td class="px-4 py-2 text-sm text-gray-900">{row.title}</td>
								<td class="px-4 py-2 text-sm text-gray-900">{row.tracked}</td>
								<td class="px-4 py-2 text-sm text-gray-900">{row.weight}</td>
								<td class="px-4 py-2 text-sm text-gray-900">{row.shipping}</td>
								<td class="px-4 py-2 text-sm text-indigo-600 font-medium">{row.shippingTier}</td>
								<td class="px-4 py-2 text-sm text-indigo-600 font-medium"
									>£{row.shippingCost.toFixed(2)}</td
								>
								<td class="px-4 py-2 text-sm text-gray-900">£{row.cost.toFixed(2)}</td>
								<td class="px-4 py-2 text-sm font-semibold text-blue-600"
									>£{row.costPlusMargin.toFixed(2)}</td
								>
								<td class="px-4 py-2 text-sm text-green-600 font-medium"
									>£{row.boxCost.toFixed(2)}</td
								>
								<td class="px-4 py-2 text-sm text-purple-600 font-medium"
									>£{row.materialCost.toFixed(2)}</td
								>
								<td
									class="px-4 py-2 text-sm text-red-600 font-medium {row.fragileCharge > 0
										? 'bg-red-50'
										: ''}">£{row.fragileCharge.toFixed(2)}</td
								>
								<td class="px-4 py-2 text-sm text-gray-900">{row.vatCode}%</td>
								<td
									class="px-4 py-2 text-sm text-gray-900 {row.vatAmount > 0
										? 'text-orange-600 font-medium'
										: ''}">£{row.vatAmount.toFixed(2)}</td
								>
								<td
									class="px-4 py-2 text-sm text-gray-800 font-bold bg-yellow-50 border-l-4 border-yellow-400"
									>£{row.materialTotalCost.toFixed(2)}</td
								>
								<td
									class="px-4 py-2 text-sm text-gray-900 font-bold bg-blue-50 border-l-4 border-blue-400"
									>£{row.amazonPrice.toFixed(2)}</td
								>
								<td
									class="px-4 py-2 text-sm font-bold {isProfitable
										? 'text-green-700 bg-green-100'
										: 'text-red-700 bg-red-100'} border-l-4 {isProfitable
										? 'border-green-500'
										: 'border-red-500'}">{isProfitable ? '+' : ''}£{profit.toFixed(2)}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<!-- Pagination -->
			{#if total > pageSize}
				<div class="mt-4 flex gap-2 items-center">
					<button
						on:click={() => goToPage(page - 1)}
						disabled={page === 1}
						class="px-3 py-1 border rounded">Prev</button
					>
					<span>Page {page} of {Math.ceil(total / pageSize)}</span>
					<button
						on:click={() => goToPage(page + 1)}
						disabled={page === Math.ceil(total / pageSize)}
						class="px-3 py-1 border rounded">Next</button
					>
				</div>
			{/if}
		{/if}
	</div>
</div>
