<script lang="ts">
	import { onMount } from 'svelte';
	import ShadcnChart from '$lib/ShadcnChart.svelte';
	import DailyMetricChart from '$lib/DailyMetricChart.svelte';
	import DailyMetricAreaChart from '$lib/DailyMetricAreaChart.svelte';
	import MetricsDashboardChart from '$lib/MetricsDashboardChart.svelte';
	import { Button } from '$lib/shadcn/components';
	import {
		fetchDailyMetricData,
		getSampleMetricData,
		calculateMetricSummary,
		formatCurrency,
		type DailyMetricReviewData
	} from '$lib/chartDataService';

	let data: DailyMetricReviewData[] = [];
	let loading = true;
	let error = '';
	let selectedChart = 'dashboard';

	// Sample data for demonstration if no database data is available
	const sampleData: DailyMetricReviewData[] = [
		{
			date: '2024-12-01',
			total_sales: 15420,
			amazon_sales: 8500,
			ebay_sales: 4200,
			shopify_sales: 2720,
			linnworks_total_orders: 150,
			labor_efficiency: 12.5,
			actual_hours_worked: 8.5
		},
		{
			date: '2024-12-02',
			total_sales: 18650,
			amazon_sales: 10200,
			ebay_sales: 5100,
			shopify_sales: 3350,
			linnworks_total_orders: 180,
			labor_efficiency: 15.2,
			actual_hours_worked: 9.0
		},
		{
			date: '2024-12-03',
			total_sales: 12890,
			amazon_sales: 7800,
			ebay_sales: 3200,
			shopify_sales: 1890,
			linnworks_total_orders: 125,
			labor_efficiency: 11.8,
			actual_hours_worked: 7.5
		},
		{
			date: '2024-12-04',
			total_sales: 21340,
			amazon_sales: 12100,
			ebay_sales: 6200,
			shopify_sales: 3040,
			linnworks_total_orders: 205,
			labor_efficiency: 18.1,
			actual_hours_worked: 10.2
		},
		{
			date: '2024-12-05',
			total_sales: 16780,
			amazon_sales: 9400,
			ebay_sales: 4800,
			shopify_sales: 2580,
			linnworks_total_orders: 165,
			labor_efficiency: 14.7,
			actual_hours_worked: 8.8
		},
		{
			date: '2024-12-06',
			total_sales: 19230,
			amazon_sales: 10800,
			ebay_sales: 5300,
			shopify_sales: 3130,
			linnworks_total_orders: 190,
			labor_efficiency: 16.3,
			actual_hours_worked: 9.5
		},
		{
			date: '2024-12-07',
			total_sales: 14560,
			amazon_sales: 8200,
			ebay_sales: 3900,
			shopify_sales: 2460,
			linnworks_total_orders: 140,
			labor_efficiency: 13.2,
			actual_hours_worked: 8.0
		}
	];

	async function loadData() {
		try {
			loading = true;
			error = '';

			// Try to load real data from database
			const dbData = await fetchDailyMetricData(30); // Last 30 days

			if (dbData && dbData.length > 0) {
				data = dbData;
				console.log('Loaded data from database:', data.length, 'records');
			} else {
				console.log('No data found in database, using sample data');
				data = getSampleMetricData();
			}
		} catch (err) {
			console.error('Error loading data:', err);
			error = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
			// Use sample data as fallback
			data = getSampleMetricData();
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadData();
	});

	// Calculate summary stats using the service
	$: summary = calculateMetricSummary(data);
</script>

<svelte:head>
	<title>Daily Metric Charts</title>
</svelte:head>

<div class="container mx-auto px-4 py-8 space-y-8">
	<div class="flex justify-between items-center">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Daily Metric Charts</h1>
			<p class="text-muted-foreground">
				Visualizing daily sales metrics using shadcn-svelte chart components
			</p>
		</div>
		<Button on:click={loadData} disabled={loading}>
			{loading ? 'Loading...' : 'Refresh Data'}
		</Button>
	</div>

	{#if error}
		<div
			class="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md"
		>
			<p class="font-medium">Error loading data</p>
			<p class="text-sm">{error}</p>
			<p class="text-sm mt-2">Showing sample data instead.</p>
		</div>
	{/if}

	<!-- Chart Type Selector -->
	<div class="flex gap-2">
		<Button
			variant={selectedChart === 'dashboard' ? 'default' : 'outline'}
			on:click={() => (selectedChart = 'dashboard')}
		>
			Daily Sales Visualization
		</Button>
		<Button
			variant={selectedChart === 'shadcn' ? 'default' : 'outline'}
			on:click={() => (selectedChart = 'shadcn')}
		>
			Shadcn Bar Chart
		</Button>
		<Button
			variant={selectedChart === 'area' ? 'default' : 'outline'}
			on:click={() => (selectedChart = 'area')}
		>
			Area Chart
		</Button>
		<Button
			variant={selectedChart === 'custom' ? 'default' : 'outline'}
			on:click={() => (selectedChart = 'custom')}
		>
			Custom Chart
		</Button>
	</div>

	<!-- Summary Stats -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
		<div class="bg-card text-card-foreground p-6 rounded-lg border">
			<div class="text-2xl font-bold">
				{formatCurrency(summary.totalSales)}
			</div>
			<p class="text-sm text-muted-foreground">Total Sales ({data.length} days)</p>
		</div>
		<div class="bg-card text-card-foreground p-6 rounded-lg border">
			<div class="text-2xl font-bold">{summary.totalOrders}</div>
			<p class="text-sm text-muted-foreground">Total Orders</p>
		</div>
		<div class="bg-card text-card-foreground p-6 rounded-lg border">
			<div class="text-2xl font-bold">
				{formatCurrency(summary.averageDailySales)}
			</div>
			<p class="text-sm text-muted-foreground">Average Daily Sales</p>
		</div>
	</div>

	<!-- Charts -->
	{#if loading}
		<div class="flex items-center justify-center p-12">
			<div class="text-center">
				<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
				<p class="text-muted-foreground">Loading chart data...</p>
			</div>
		</div>
	{:else if data.length === 0}
		<div class="text-center p-12">
			<p class="text-muted-foreground">No data available</p>
		</div>
	{:else}
		<!-- Selected Chart -->
		{#if selectedChart === 'dashboard'}
			<MetricsDashboardChart {data} title="Interactive Daily Metrics Dashboard" />
		{:else if selectedChart === 'shadcn'}
			<ShadcnChart
				{data}
				title="Daily Sales by Channel"
				description="Sales performance across Amazon, eBay, and Shopify"
			/>
		{:else if selectedChart === 'area'}
			<DailyMetricAreaChart {data} title="Daily Sales Trend" type="area" />
			<DailyMetricAreaChart {data} title="Daily Orders Trend" type="area" showOrders={true} />
		{:else if selectedChart === 'custom'}
			<DailyMetricChart {data} title="Daily Metrics Overview" />
		{/if}
	{/if}

	<!-- Data Table -->
	<div class="bg-card rounded-lg border">
		<div class="p-6 border-b">
			<h3 class="text-lg font-semibold">Raw Data</h3>
			<p class="text-sm text-muted-foreground">Recent daily metric review data</p>
		</div>
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr class="border-b text-left text-sm font-medium text-muted-foreground">
						<th class="p-4">Date</th>
						<th class="p-4">Total Sales</th>
						<th class="p-4">Amazon</th>
						<th class="p-4">eBay</th>
						<th class="p-4">Shopify</th>
						<th class="p-4">Orders</th>
					</tr>
				</thead>
				<tbody>
					{#each data.slice(-10) as row}
						<tr class="border-b">
							<td class="p-4 font-mono text-sm">
								{new Date(row.date).toLocaleDateString('en-GB')}
							</td>
							<td class="p-4 font-medium">
								{formatCurrency(row.total_sales)}
							</td>
							<td class="p-4">
								{formatCurrency(row.amazon_sales)}
							</td>
							<td class="p-4">
								{formatCurrency(row.ebay_sales)}
							</td>
							<td class="p-4">
								{formatCurrency(row.shopify_sales)}
							</td>
							<td class="p-4">{row.linnworks_total_orders}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
