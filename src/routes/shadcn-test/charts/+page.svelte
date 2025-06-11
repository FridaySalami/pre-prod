<script lang="ts">
	import ShadcnChart from '$lib/ShadcnChart.svelte';
	import DailyMetricChart from '$lib/DailyMetricChart.svelte';
	import DailyMetricAreaChart from '$lib/DailyMetricAreaChart.svelte';
	import MetricsDashboardChart from '$lib/MetricsDashboardChart.svelte';
	import EnhancedMonthlyChart from '$lib/EnhancedMonthlyChart.svelte';
	import { Button } from '$lib/shadcn/components';

	let selectedChart = 'dashboard';

	// Sample data for testing
	const sampleData = [
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
</script>

<svelte:head>
	<title>Chart Test</title>
</svelte:head>

<div class="container mx-auto px-4 py-8 space-y-8">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Shadcn-Svelte Chart Test</h1>
		<p class="text-muted-foreground">Testing all chart components with sample data</p>
	</div>

	<!-- Chart Type Selector -->
	<div class="flex flex-wrap gap-2">
		<Button
			variant={selectedChart === 'dashboard' ? 'default' : 'outline'}
			on:click={() => {
				selectedChart = 'dashboard';
			}}
		>
			Daily Sales Visualization
		</Button>
		<Button
			variant={selectedChart === 'shadcn' ? 'default' : 'outline'}
			on:click={() => {
				selectedChart = 'shadcn';
			}}
		>
			Shadcn Bar Chart
		</Button>
		<Button
			variant={selectedChart === 'area' ? 'default' : 'outline'}
			on:click={() => {
				selectedChart = 'area';
			}}
		>
			Area Chart
		</Button>
		<Button
			variant={selectedChart === 'custom' ? 'default' : 'outline'}
			on:click={() => {
				selectedChart = 'custom';
			}}
		>
			Custom Chart
		</Button>
		<Button
			variant={selectedChart === 'enhanced' ? 'default' : 'outline'}
			on:click={() => {
				selectedChart = 'enhanced';
			}}
		>
			Enhanced Monthly
		</Button>
	</div>

	<!-- Selected Chart -->
	{#if selectedChart === 'dashboard'}
		<MetricsDashboardChart data={sampleData} title="Interactive Metrics Dashboard" />
	{:else if selectedChart === 'shadcn'}
		<ShadcnChart
			data={sampleData}
			title="Daily Sales Test"
			description="Testing the chart component with sample data"
		/>
	{:else if selectedChart === 'area'}
		<DailyMetricAreaChart data={sampleData} title="Daily Sales Trend" type="area" />
		<DailyMetricAreaChart
			data={sampleData}
			title="Daily Orders Trend"
			type="area"
			showOrders={true}
		/>
	{:else if selectedChart === 'custom'}
		<DailyMetricChart data={sampleData} title="Daily Metrics Overview" />
	{:else if selectedChart === 'enhanced'}
		<EnhancedMonthlyChart data={sampleData} title="Enhanced Monthly Chart" />
	{/if}
</div>
