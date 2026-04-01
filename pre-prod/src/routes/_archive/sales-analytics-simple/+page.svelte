<script lang="ts">
	import { onMount } from 'svelte';
	import Chart from 'chart.js/auto';

	// Simplified Types
	interface BaseSalesData {
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
	}

	interface TrendData {
		sku: string;
		title?: string;
		current_data: BaseSalesData;
		previous_data?: BaseSalesData;
		trends: {
			units: number;
			revenue: number;
			sessions: number;
			buyBox: number;
		};
	}

	// Union type for different analysis types
	type SalesData = BaseSalesData | TrendData;

	// Type guards and helper functions
	function isTrendData(item: SalesData): item is TrendData {
		return 'current_data' in item && 'trends' in item;
	}

	function getUnitsOrdered(item: SalesData): number {
		return isTrendData(item) ? item.current_data.units_ordered : item.units_ordered;
	}

	function getOrderedProductSales(item: SalesData): number {
		return isTrendData(item) ? item.current_data.ordered_product_sales : item.ordered_product_sales;
	}

	function getSessionsTotal(item: SalesData): number {
		return isTrendData(item) ? item.current_data.sessions_total : item.sessions_total;
	}

	function getBuyBoxPercentage(item: SalesData): number {
		return isTrendData(item) ? item.current_data.buy_box_percentage : item.buy_box_percentage;
	}

	function getTitle(item: SalesData): string {
		if (isTrendData(item)) {
			return item.title || item.current_data.title || 'No title';
		}
		return item.title || 'No title';
	}

	interface Summary {
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

	interface MonthlyData {
		month: string;
		totalProducts: number;
		totalUnits: number;
		totalRevenue: number;
		totalSessions: number;
		avgBuyBoxPercentage: number;
		growth_vs_previous: {
			units: number;
			revenue: number;
			sessions: number;
		};
	}

	interface Insight {
		type: 'success' | 'warning' | 'info' | 'error';
		title: string;
		message: string;
	}

	// State
	let salesData: SalesData[] = [];
	let monthlyData: MonthlyData[] = [];
	let summary: Summary = {
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
	let analysisType = 'current'; // 'current', 'comparison', 'trends'
	let timeframe = '6';
	let currentOffset = 0;
	let hasMore = true;

	// Chart elements
	let revenueChart: HTMLCanvasElement | undefined;
	let revenueChartInstance: Chart | undefined;

	async function loadData(reset = false) {
		loading = true;
		error = '';

		if (reset) {
			currentOffset = 0;
			salesData = [];
			monthlyData = [];
		}

		try {
			const params = new URLSearchParams({
				analysis: analysisType,
				search: searchTerm,
				type: searchType,
				timeframe: timeframe,
				limit: '50',
				offset: currentOffset.toString()
			});

			const response = await fetch(`/api/sales-analytics-simple?${params}`);
			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to load data');
			}

			switch (analysisType) {
				case 'comparison':
					monthlyData = result.data;
					insights = result.insights || [];
					createRevenueChart();
					break;

				case 'trends':
					salesData = result.data;
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

	function createRevenueChart() {
		if (!monthlyData.length || !revenueChart) return;

		if (revenueChartInstance) {
			revenueChartInstance.destroy();
		}

		const ctx = revenueChart.getContext('2d');
		if (!ctx) return;

		revenueChartInstance = new Chart(ctx, {
			type: 'line',
			data: {
				labels: monthlyData.map((m) =>
					new Date(m.month).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
				),
				datasets: [
					{
						label: 'Monthly Revenue',
						data: monthlyData.map((m) => m.totalRevenue),
						borderColor: 'rgb(59, 130, 246)',
						backgroundColor: 'rgba(59, 130, 246, 0.1)',
						tension: 0.1,
						fill: true
					},
					{
						label: 'Units Sold',
						data: monthlyData.map((m) => m.totalUnits),
						borderColor: 'rgb(34, 197, 94)',
						backgroundColor: 'rgba(34, 197, 94, 0.1)',
						tension: 0.1,
						yAxisID: 'y1'
					}
				]
			},
			options: {
				responsive: true,
				interaction: {
					mode: 'index',
					intersect: false
				},
				plugins: {
					title: {
						display: true,
						text: 'Revenue & Units Trend'
					},
					legend: {
						display: true
					}
				},
				scales: {
					x: {
						display: true,
						title: {
							display: true,
							text: 'Month'
						}
					},
					y: {
						type: 'linear',
						display: true,
						position: 'left',
						title: {
							display: true,
							text: 'Revenue (£)'
						},
						ticks: {
							callback: function (value) {
								return '£' + Number(value).toLocaleString();
							}
						}
					},
					y1: {
						type: 'linear',
						display: true,
						position: 'right',
						title: {
							display: true,
							text: 'Units'
						},
						grid: {
							drawOnChartArea: false
						},
						ticks: {
							callback: function (value) {
								return Number(value).toLocaleString();
							}
						}
					}
				}
			}
		});
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
	<title>Step-by-Step Sales Analytics | Historical Analysis</title>
</svelte:head>

<div class="container mx-auto p-6 max-w-7xl">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-2">📊 Enhanced Sales Analytics</h1>
		<p class="text-gray-600">Historical analysis with trends and month-over-month comparisons</p>

		<!-- Progress indicator -->
		<div class="mt-4 flex items-center space-x-2 text-sm">
			<span class="px-2 py-1 bg-green-100 text-green-800 rounded">✅ Step 1: Historical Data</span>
			<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded">🔄 Step 2: Enhanced Analytics</span>
			<span class="px-2 py-1 bg-gray-100 text-gray-600 rounded">⏳ Step 3: AI Insights</span>
		</div>
	</div>

	<!-- Analysis Controls -->
	<div class="bg-white rounded-lg shadow-sm border p-6 mb-6">
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
			<div>
				<label for="analysisType" class="block text-sm font-medium text-gray-700 mb-2">
					Analysis Type
				</label>
				<select
					id="analysisType"
					bind:value={analysisType}
					on:change={handleAnalysisChange}
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				>
					<option value="current">📈 Current Month</option>
					<option value="comparison">📊 Monthly Comparison</option>
					<option value="trends">🔍 Product Trends</option>
				</select>
			</div>

			<div>
				<label for="timeframe" class="block text-sm font-medium text-gray-700 mb-2">
					Timeframe
				</label>
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

			{#if analysisType !== 'comparison'}
				<div>
					<label for="search" class="block text-sm font-medium text-gray-700 mb-2"> Search </label>
					<input
						id="search"
						type="text"
						bind:value={searchTerm}
						placeholder="Search products..."
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						on:keypress={(e) => e.key === 'Enter' && handleSearch()}
					/>
				</div>

				<div>
					<label for="searchType" class="block text-sm font-medium text-gray-700 mb-2">
						Search Type
					</label>
					<select
						id="searchType"
						bind:value={searchType}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					>
						<option value="all">All Fields</option>
						<option value="sku">SKU Only</option>
						<option value="title">Product Name</option>
					</select>
				</div>
			{/if}
		</div>

		{#if analysisType !== 'comparison'}
			<div class="mt-4">
				<button
					on:click={handleSearch}
					disabled={loading}
					class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
				>
					{loading ? '🔄 Loading...' : '🔍 Search'}
				</button>
			</div>
		{/if}
	</div>

	<!-- Summary Cards (Current Analysis) -->
	{#if analysisType === 'current' && summary}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
			<div class="bg-white rounded-lg shadow-sm border p-4">
				<div class="flex items-center justify-between">
					<div>
						<div class="text-sm font-medium text-gray-500">Products</div>
						<div class="text-2xl font-bold text-gray-900">
							{formatNumber(summary.totalProducts)}
						</div>
					</div>
				</div>
			</div>

			<div class="bg-white rounded-lg shadow-sm border p-4">
				<div class="flex items-center justify-between">
					<div>
						<div class="text-sm font-medium text-gray-500">Units Sold</div>
						<div class="text-2xl font-bold text-green-600">{formatNumber(summary.totalUnits)}</div>
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
						<div class="text-sm font-medium text-gray-500">Revenue</div>
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
						<div class="text-sm font-medium text-gray-500">Avg Buy Box</div>
						<div class="text-2xl font-bold text-purple-600">
							{formatPercentage(summary.avgBuyBoxPercentage)}
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

	<!-- Chart Section (Monthly Comparison) -->
	{#if analysisType === 'comparison' && monthlyData.length > 0}
		<div class="bg-white rounded-lg shadow-sm border p-6 mb-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-4">📈 Historical Performance</h3>
			<div class="h-96">
				<canvas bind:this={revenueChart} class="w-full h-full"></canvas>
			</div>
		</div>
	{/if}

	<!-- Insights Section -->
	{#if insights.length > 0}
		<div class="mb-6 space-y-3">
			{#each insights as insight}
				<div
					class="border-l-4 border-{insight.type === 'success'
						? 'green'
						: insight.type === 'warning'
							? 'yellow'
							: insight.type === 'error'
								? 'red'
								: 'blue'}-400 bg-{insight.type === 'success'
						? 'green'
						: insight.type === 'warning'
							? 'yellow'
							: insight.type === 'error'
								? 'red'
								: 'blue'}-50 p-4"
				>
					<div class="flex">
						<div class="flex-shrink-0">
							{#if insight.type === 'success'}
								<span class="text-green-400">✅</span>
							{:else if insight.type === 'warning'}
								<span class="text-yellow-400">⚠️</span>
							{:else if insight.type === 'error'}
								<span class="text-red-400">❌</span>
							{:else}
								<span class="text-blue-400">ℹ️</span>
							{/if}
						</div>
						<div class="ml-3">
							<h3
								class="text-sm font-medium text-{insight.type === 'success'
									? 'green'
									: insight.type === 'warning'
										? 'yellow'
										: insight.type === 'error'
											? 'red'
											: 'blue'}-800"
							>
								{insight.title}
							</h3>
							<p
								class="mt-1 text-sm text-{insight.type === 'success'
									? 'green'
									: insight.type === 'warning'
										? 'yellow'
										: insight.type === 'error'
											? 'red'
											: 'blue'}-700"
							>
								{insight.message}
							</p>
						</div>
					</div>
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

	<!-- Data Tables -->
	{#if analysisType === 'comparison'}
		<!-- Monthly Comparison Table -->
		<div class="bg-white rounded-lg shadow-sm border overflow-hidden">
			<div class="px-6 py-4 border-b border-gray-200">
				<h3 class="text-lg font-semibold text-gray-900">📊 Monthly Performance</h3>
			</div>
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
								>Products</th
							>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
								>Revenue</th
							>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
								>Buy Box %</th
							>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Growth</th
							>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each monthlyData as month}
							<tr class="hover:bg-gray-50">
								<td class="px-6 py-4 text-sm font-medium text-gray-900">
									{new Date(month.month).toLocaleDateString('en-GB', {
										month: 'long',
										year: 'numeric'
									})}
								</td>
								<td class="px-6 py-4 text-sm text-gray-900">{formatNumber(month.totalProducts)}</td>
								<td class="px-6 py-4 text-sm font-semibold text-gray-900"
									>{formatNumber(month.totalUnits)}</td
								>
								<td class="px-6 py-4 text-sm font-semibold text-green-600"
									>{formatCurrency(month.totalRevenue)}</td
								>
								<td class="px-6 py-4 text-sm text-purple-600"
									>{formatPercentage(month.avgBuyBoxPercentage)}</td
								>
								<td class="px-6 py-4 text-sm">
									<div class="space-y-1">
										<div class="{getTrendClass(month.growth_vs_previous.revenue)} text-xs">
											Revenue: {month.growth_vs_previous.revenue.toFixed(1)}%
										</div>
										<div class="{getTrendClass(month.growth_vs_previous.units)} text-xs">
											Units: {month.growth_vs_previous.units.toFixed(1)}%
										</div>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{:else}
		<!-- Product Data Table -->
		<div class="bg-white rounded-lg shadow-sm border overflow-hidden">
			<div class="px-6 py-4 border-b border-gray-200">
				<h3 class="text-lg font-semibold text-gray-900">
					{#if analysisType === 'trends'}
						🔍 Product Trends
					{:else}
						📈 Current Performance
					{/if}
				</h3>
			</div>
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
								>Product</th
							>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
								>Revenue</th
							>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
								>Sessions</th
							>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
								>Buy Box %</th
							>
							{#if analysisType === 'trends'}
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
									>Trends</th
								>
							{/if}
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each salesData as item}
							<tr class="hover:bg-gray-50">
								<td class="px-6 py-4">
									<div
										class="text-sm font-medium text-gray-900 max-w-xs truncate"
										title={getTitle(item)}
									>
										{getTitle(item)}
									</div>
								</td>
								<td class="px-6 py-4 text-sm text-gray-900 font-mono">{item.sku}</td>
								<td class="px-6 py-4 text-sm font-semibold text-gray-900">
									{formatNumber(getUnitsOrdered(item))}
								</td>
								<td class="px-6 py-4 text-sm font-semibold text-green-600">
									{formatCurrency(getOrderedProductSales(item))}
								</td>
								<td class="px-6 py-4 text-sm text-blue-600">
									{formatNumber(getSessionsTotal(item))}
								</td>
								<td class="px-6 py-4 text-sm text-purple-600">
									{formatPercentage(getBuyBoxPercentage(item))}
								</td>
								{#if analysisType === 'trends' && isTrendData(item)}
									<td class="px-6 py-4 text-sm">
										<div class="space-y-1">
											<div class="{getTrendClass(item.trends.revenue)} text-xs">
												Rev: {item.trends.revenue.toFixed(1)}%
											</div>
											<div class="{getTrendClass(item.trends.units)} text-xs">
												Units: {item.trends.units.toFixed(1)}%
											</div>
										</div>
									</td>
								{/if}
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
			{#if hasMore && salesData.length > 0 && analysisType === 'current'}
				<div class="px-6 py-4 border-t border-gray-200 bg-gray-50">
					<button
						on:click={loadMore}
						disabled={loading}
						class="w-full px-4 py-2 text-blue-600 hover:text-blue-700 disabled:opacity-50"
					>
						{loading ? '🔄 Loading...' : '📄 Load More Products'}
					</button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Getting Started Guide -->
	<div class="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
		<h3 class="text-lg font-semibold text-blue-900 mb-3">🚀 Getting Started</h3>
		<div class="text-blue-800 space-y-2">
			<p>
				<strong>Step 1:</strong> Run the database setup:
				<code class="bg-blue-100 px-2 py-1 rounded"
					>psql "$DATABASE_URL" -f step1-basic-historical-setup.sql</code
				>
			</p>
			<p><strong>Step 2:</strong> Try different analysis types above to explore your data</p>
			<p><strong>Step 3:</strong> Add more monthly data as it becomes available</p>
			<p>
				<strong>Next:</strong> Advanced features like AI insights and predictive analytics coming soon!
			</p>
		</div>
	</div>
</div>

<style>
	canvas {
		max-height: 400px;
	}
</style>
