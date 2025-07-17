<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Chart from 'chart.js/auto';

	// Enhanced Types
	interface SalesData {
		id?: number;
		reporting_month?: string;
		sku: string;
		parent_asin?: string;
		child_asin?: string;
		title?: string;
		units_ordered: number;
		ordered_product_sales: number;
		sessions_total: number;
		unit_session_percentage: number;
		buy_box_percentage: number;
		sessions_mobile?: number;
		sessions_browser?: number;
		page_views_total?: number;
	}

	interface TrendSummary {
		totalProducts: number;
		totalUnits: number;
		totalRevenue: number;
		totalSessions: number;
		avgBuyBoxPercentage: number;
		trends?: {
			unitsChange: number;
			revenueChange: number;
			sessionsChange: number;
			buyBoxChange: number;
		};
	}

	interface MonthlyComparison {
		month: string;
		total_products: number;
		total_units: number;
		total_revenue: number;
		total_sessions: number;
		avg_buy_box_percentage: number;
		changes?: {
			unitsChange: number;
			revenueChange: number;
			sessionsChange: number;
		};
	}

	interface Insight {
		type: 'success' | 'warning' | 'info' | 'error';
		title: string;
		message: string;
	}

	// State Management
	let salesData: SalesData[] = [];
	let monthlyComparison: MonthlyComparison[] = [];
	let summary: TrendSummary = {
		totalProducts: 0,
		totalUnits: 0,
		totalRevenue: 0,
		totalSessions: 0,
		avgBuyBoxPercentage: 0
	};
	let insights: Insight[] = [];
	let loading = false;
	let error = '';

	// Controls
	let searchTerm = '';
	let searchType = 'all';
	let analysisType = 'current'; // 'current', 'trends', 'comparison', 'performance'
	let timeframe = '6'; // months
	let currentOffset = 0;
	let hasMore = true;

	// Chart references
	let revenueChart: HTMLCanvasElement | undefined;
	let unitsChart: HTMLCanvasElement | undefined;
	let trendsChart: HTMLCanvasElement | undefined;

	// Chart instances
	let revenueChartInstance: Chart | undefined;
	let unitsChartInstance: Chart | undefined;
	let trendsChartInstance: Chart | undefined;

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
				analysis: analysisType,
				timeframe: timeframe,
				limit: '50',
				offset: currentOffset.toString()
			});

			const response = await fetch(`/api/sales-analytics-historical?${params}`);
			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to load data');
			}

			// Handle different analysis types
			switch (analysisType) {
				case 'comparison':
					monthlyComparison = result.data;
					insights = result.insights || [];
					createComparisonCharts();
					break;

				case 'trends':
					salesData = result.data;
					insights = result.insights || [];
					createTrendsChart();
					break;

				case 'performance':
					// Handle performance data
					insights = result.insights || [];
					break;

				default:
					if (reset) {
						salesData = result.data;
					} else {
						salesData = [...salesData, ...result.data];
					}
					summary = result.summary;
					insights = result.insights || [];
					hasMore = result.pagination?.hasMore || false;
					currentOffset += result.data.length;
					break;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
		} finally {
			loading = false;
		}
	}

	function createComparisonCharts() {
		if (!monthlyComparison.length) return;

		// Revenue trend chart
		if (revenueChart && revenueChartInstance) {
			revenueChartInstance.destroy();
		}

		const revenueCtx = revenueChart?.getContext('2d');
		if (revenueCtx) {
			revenueChartInstance = new Chart(revenueCtx, {
				type: 'line',
				data: {
					labels: monthlyComparison.map((m) =>
						new Date(m.month).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
					),
					datasets: [
						{
							label: 'Monthly Revenue',
							data: monthlyComparison.map((m) => m.total_revenue),
							borderColor: 'rgb(59, 130, 246)',
							backgroundColor: 'rgba(59, 130, 246, 0.1)',
							tension: 0.1,
							fill: true
						}
					]
				},
				options: {
					responsive: true,
					plugins: {
						title: {
							display: true,
							text: 'Revenue Trend Over Time'
						}
					},
					scales: {
						y: {
							beginAtZero: true,
							ticks: {
								callback: function (value) {
									return '£' + value.toLocaleString();
								}
							}
						}
					}
				}
			});
		}

		// Units sold chart
		if (unitsChart && unitsChartInstance) {
			unitsChartInstance.destroy();
		}

		const unitsCtx = unitsChart?.getContext('2d');
		if (unitsCtx) {
			unitsChartInstance = new Chart(unitsCtx, {
				type: 'bar',
				data: {
					labels: monthlyComparison.map((m) =>
						new Date(m.month).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
					),
					datasets: [
						{
							label: 'Units Sold',
							data: monthlyComparison.map((m) => m.total_units),
							backgroundColor: 'rgba(34, 197, 94, 0.8)',
							borderColor: 'rgb(34, 197, 94)',
							borderWidth: 1
						}
					]
				},
				options: {
					responsive: true,
					plugins: {
						title: {
							display: true,
							text: 'Units Sold by Month'
						}
					},
					scales: {
						y: {
							beginAtZero: true
						}
					}
				}
			});
		}
	}

	function createTrendsChart() {
		// Implementation for trends visualization
		if (trendsChart && trendsChartInstance) {
			trendsChartInstance.destroy();
		}

		// TODO: Add trends chart implementation when trends data is available
		console.log('Trends chart creation - to be implemented');
	}

	function handleAnalysisChange() {
		loadData(true);
	}

	function handleSearch() {
		loadData(true);
	}

	function loadMore() {
		if (!loading && hasMore && analysisType === 'current') {
			loadData(false);
		}
	}

	function formatCurrency(value: number): string {
		return `£${value.toFixed(2)}`;
	}

	function formatNumber(value: number): string {
		return value.toLocaleString();
	}

	function formatPercentage(value: number): string {
		return `${value.toFixed(1)}%`;
	}

	function getTrendIcon(change: number): string {
		if (change > 5) return '📈';
		if (change < -5) return '📉';
		return '➡️';
	}

	function getTrendClass(change: number): string {
		if (change > 0) return 'text-green-600';
		if (change < 0) return 'text-red-600';
		return 'text-gray-600';
	}

	onMount(() => {
		loadData(true);
	});
</script>

<svelte:head>
	<title>Enhanced Sales Analytics | Historical Analysis</title>
</svelte:head>

<div class="container mx-auto p-6 max-w-7xl">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-2">Enhanced Sales Analytics Dashboard</h1>
		<p class="text-gray-600">
			Comprehensive historical analysis with trends, comparisons, and actionable insights
		</p>
	</div>

	<!-- Analysis Type Selector -->
	<div class="bg-white rounded-lg shadow-sm border p-6 mb-6">
		<div class="flex flex-col gap-4">
			<!-- Analysis Type Row -->
			<div class="flex flex-col sm:flex-row gap-4">
				<div class="flex-1">
					<label for="analysisType" class="block text-sm font-medium text-gray-700 mb-2"
						>Analysis Type</label
					>
					<select
						id="analysisType"
						bind:value={analysisType}
						on:change={handleAnalysisChange}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					>
						<option value="current">Current Month Analysis</option>
						<option value="comparison">Monthly Comparison</option>
						<option value="trends">Product Trends</option>
						<option value="performance">Performance Analysis</option>
					</select>
				</div>

				<div class="sm:w-48">
					<label for="timeframe" class="block text-sm font-medium text-gray-700 mb-2"
						>Timeframe</label
					>
					<select
						id="timeframe"
						bind:value={timeframe}
						on:change={handleAnalysisChange}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					>
						<option value="3">Last 3 Months</option>
						<option value="6">Last 6 Months</option>
						<option value="12">Last 12 Months</option>
					</select>
				</div>
			</div>

			<!-- Search Row (only for current and trends analysis) -->
			{#if analysisType === 'current' || analysisType === 'trends'}
				<div class="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-200">
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
			{/if}
		</div>
	</div>

	<!-- Summary Cards with Trends -->
	{#if analysisType === 'current' && summary}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
			<div class="bg-white rounded-lg shadow-sm border p-4">
				<div class="flex items-center justify-between">
					<div>
						<div class="text-sm font-medium text-gray-500">Total Products</div>
						<div class="text-2xl font-bold text-gray-900">
							{summary.totalProducts.toLocaleString()}
						</div>
					</div>
				</div>
			</div>

			<div class="bg-white rounded-lg shadow-sm border p-4">
				<div class="flex items-center justify-between">
					<div>
						<div class="text-sm font-medium text-gray-500">Total Units</div>
						<div class="text-2xl font-bold text-green-600">
							{summary.totalUnits.toLocaleString()}
						</div>
					</div>
					{#if summary.trends?.unitsChange !== undefined}
						<div class="text-right">
							<div class="text-xs {getTrendClass(summary.trends.unitsChange)}">
								{getTrendIcon(summary.trends.unitsChange)}
								{summary.trends.unitsChange.toFixed(1)}%
							</div>
						</div>
					{/if}
				</div>
			</div>

			<div class="bg-white rounded-lg shadow-sm border p-4">
				<div class="flex items-center justify-between">
					<div>
						<div class="text-sm font-medium text-gray-500">Total Revenue</div>
						<div class="text-2xl font-bold text-green-600">
							{formatCurrency(summary.totalRevenue)}
						</div>
					</div>
					{#if summary.trends?.revenueChange !== undefined}
						<div class="text-right">
							<div class="text-xs {getTrendClass(summary.trends.revenueChange)}">
								{getTrendIcon(summary.trends.revenueChange)}
								{summary.trends.revenueChange.toFixed(1)}%
							</div>
						</div>
					{/if}
				</div>
			</div>

			<div class="bg-white rounded-lg shadow-sm border p-4">
				<div class="flex items-center justify-between">
					<div>
						<div class="text-sm font-medium text-gray-500">Avg Buy Box %</div>
						<div class="text-2xl font-bold text-purple-600">
							{summary.avgBuyBoxPercentage.toFixed(1)}%
						</div>
					</div>
					{#if summary.trends?.buyBoxChange !== undefined}
						<div class="text-right">
							<div class="text-xs {getTrendClass(summary.trends.buyBoxChange)}">
								{getTrendIcon(summary.trends.buyBoxChange)}
								{summary.trends.buyBoxChange.toFixed(1)}%
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Charts Section for Monthly Comparison -->
	{#if analysisType === 'comparison' && monthlyComparison.length > 0}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
			<div class="bg-white rounded-lg shadow-sm border p-4">
				<canvas bind:this={revenueChart} width="400" height="200"></canvas>
			</div>
			<div class="bg-white rounded-lg shadow-sm border p-4">
				<canvas bind:this={unitsChart} width="400" height="200"></canvas>
			</div>
		</div>
	{/if}

	<!-- Insights Section -->
	{#if insights.length > 0}
		<div class="mb-6 space-y-3">
			{#each insights as insight}
				<div
					class="bg-{insight.type === 'success'
						? 'green'
						: insight.type === 'warning'
							? 'yellow'
							: insight.type === 'error'
								? 'red'
								: 'blue'}-50 border border-{insight.type === 'success'
						? 'green'
						: insight.type === 'warning'
							? 'yellow'
							: insight.type === 'error'
								? 'red'
								: 'blue'}-200 rounded-md p-4"
				>
					<h3
						class="text-lg font-semibold text-{insight.type === 'success'
							? 'green'
							: insight.type === 'warning'
								? 'yellow'
								: insight.type === 'error'
									? 'red'
									: 'blue'}-900 mb-1"
					>
						{insight.title}
					</h3>
					<p
						class="text-{insight.type === 'success'
							? 'green'
							: insight.type === 'warning'
								? 'yellow'
								: insight.type === 'error'
									? 'red'
									: 'blue'}-800"
					>
						{insight.message}
					</p>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Error Display -->
	{#if error}
		<div class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
			<div class="text-red-800">
				<strong>Error:</strong>
				{error}
			</div>
		</div>
	{/if}

	<!-- Data Display based on analysis type -->
	{#if analysisType === 'comparison'}
		<!-- Monthly Comparison Table -->
		<div class="bg-white rounded-lg shadow-sm border overflow-hidden">
			<div class="px-6 py-4 border-b border-gray-200">
				<h3 class="text-lg font-semibold text-gray-900">Monthly Performance Comparison</h3>
			</div>
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Month</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Products</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Units</th
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
								>Buy Box %</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Changes</th
							>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each monthlyComparison as month}
							<tr class="hover:bg-gray-50">
								<td class="px-6 py-4 text-sm font-medium text-gray-900">
									{new Date(month.month).toLocaleDateString('en-GB', {
										month: 'long',
										year: 'numeric'
									})}
								</td>
								<td class="px-6 py-4 text-sm text-gray-900"
									>{month.total_products.toLocaleString()}</td
								>
								<td class="px-6 py-4 text-sm font-semibold text-gray-900"
									>{month.total_units.toLocaleString()}</td
								>
								<td class="px-6 py-4 text-sm font-semibold text-gray-900"
									>{formatCurrency(month.total_revenue)}</td
								>
								<td class="px-6 py-4 text-sm text-blue-600"
									>{month.total_sessions.toLocaleString()}</td
								>
								<td class="px-6 py-4 text-sm text-purple-600"
									>{formatPercentage(month.avg_buy_box_percentage)}</td
								>
								<td class="px-6 py-4 text-sm">
									{#if month.changes}
										<div class="space-y-1">
											<div class="{getTrendClass(month.changes.unitsChange)} text-xs">
												Units: {month.changes.unitsChange.toFixed(1)}%
											</div>
											<div class="{getTrendClass(month.changes.revenueChange)} text-xs">
												Revenue: {month.changes.revenueChange.toFixed(1)}%
											</div>
										</div>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{:else if analysisType === 'current'}
		<!-- Current Month Data Table -->
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
								>Units</th
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
							<tr class="hover:bg-gray-50">
								<td class="px-6 py-4">
									<div
										class="text-sm font-medium text-gray-900 max-w-xs truncate"
										title={item.title}
									>
										{item.title || 'No title'}
									</div>
								</td>
								<td class="px-6 py-4">
									<div class="text-sm text-gray-900 font-mono">{item.sku}</div>
								</td>
								<td class="px-6 py-4 text-sm text-gray-900 font-mono">{item.child_asin || 'N/A'}</td
								>
								<td class="px-6 py-4 text-sm font-semibold text-gray-900"
									>{formatNumber(item.units_ordered)}</td
								>
								<td class="px-6 py-4 text-sm font-semibold text-gray-900"
									>{formatCurrency(item.ordered_product_sales)}</td
								>
								<td class="px-6 py-4 text-sm text-blue-600">{formatNumber(item.sessions_total)}</td>
								<td class="px-6 py-4 text-sm text-gray-900"
									>{formatPercentage(item.unit_session_percentage)}</td
								>
								<td class="px-6 py-4 text-sm text-purple-600"
									>{formatPercentage(item.buy_box_percentage)}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>

				{#if salesData.length === 0 && !loading}
					<div class="text-center py-12">
						<div class="text-gray-500 text-lg">No data available for the selected criteria.</div>
					</div>
				{/if}
			</div>

			<!-- Load More Button -->
			{#if hasMore && salesData.length > 0}
				<div class="px-6 py-4 border-t border-gray-200 bg-gray-50">
					<button
						on:click={loadMore}
						disabled={loading}
						class="w-full px-4 py-2 text-blue-600 hover:text-blue-700 disabled:opacity-50"
					>
						{loading ? 'Loading...' : 'Load More Products'}
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	:global(.chart-container) {
		position: relative;
		height: 300px;
		width: 100%;
	}
</style>
