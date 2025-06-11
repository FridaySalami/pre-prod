<!-- DailyMetricChart.svelte -->
<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/shadcn/components';

	// Type Definitions
	interface DailyMetric {
		date: string;
		total_sales: number;
		amazon_sales: number;
		ebay_sales: number;
		shopify_sales: number;
		linnworks_total_orders: number;
		labor_efficiency?: number;
	}

	interface Props {
		data: DailyMetric[];
		title?: string;
		class?: string;
	}

	let { data = [], title = 'Daily Sales Metrics', class: className = '' }: Props = $props();

	// Chart Configuration
	const chartConfig = {
		amazon: {
			label: 'Amazon',
			color: 'hsl(221, 83%, 53%)'
		},
		ebay: {
			label: 'eBay',
			color: 'hsl(0, 72%, 51%)'
		},
		shopify: {
			label: 'Shopify',
			color: 'hsl(160, 84%, 39%)'
		}
	};

	// Utility Functions
	function formatCurrency(value: number): string {
		return new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency: 'GBP',
			maximumFractionDigits: 0
		}).format(value);
	}

	function formatPercentage(part: number, total: number): string {
		if (total === 0) return '0.0';
		return ((part / total) * 100).toFixed(1);
	}

	// Chart Data Processing
	const chartData = $derived(
		data.map((item) => ({
			date: new Date(item.date).toLocaleDateString('en-GB', {
				day: '2-digit',
				month: 'short'
			}),
			amazon: item.amazon_sales,
			ebay: item.ebay_sales,
			shopify: item.shopify_sales,
			total: item.total_sales
		}))
	);

	const channelTotals = $derived([
		{
			key: 'amazon',
			label: 'Amazon',
			color: 'hsl(221, 83%, 53%)',
			total: data.reduce((sum, item) => sum + item.amazon_sales, 0)
		},
		{
			key: 'ebay',
			label: 'eBay',
			color: 'hsl(0, 72%, 51%)',
			total: data.reduce((sum, item) => sum + item.ebay_sales, 0)
		},
		{
			key: 'shopify',
			label: 'Shopify',
			color: 'hsl(160, 84%, 39%)',
			total: data.reduce((sum, item) => sum + item.shopify_sales, 0)
		}
	]);

	const grandTotal = $derived(channelTotals.reduce((sum, channel) => sum + channel.total, 0));
</script>

<Card class={className}>
	<CardHeader>
		<CardTitle>{title}</CardTitle>
	</CardHeader>
	<CardContent>
		{#if chartData.length === 0}
			<div class="text-center py-8 text-muted-foreground">
				<p>No data available</p>
			</div>
		{:else}
			<!-- SVG Chart -->
			<div class="h-[300px] w-full border rounded-lg bg-background p-4">
				<svg viewBox="0 0 800 240" class="w-full h-full">
					<!-- Grid lines -->
					{#each Array(5) as _, i}
						<line
							x1="40"
							y1={20 + i * 40}
							x2="760"
							y2={20 + i * 40}
							stroke="hsl(var(--muted))"
							stroke-width="0.5"
						/>
					{/each}

					{#each chartData as item, i}
						{@const barWidth = (720 / chartData.length) * 0.8}
						{@const barSpacing = (720 / chartData.length) * 0.2}
						{@const x = 40 + i * (720 / chartData.length) + barSpacing / 2}
						{@const maxValue = Math.max(...chartData.map((d) => d.total))}

						<!-- Amazon Bar -->
						<rect
							{x}
							y={200 - (item.amazon / maxValue) * 160}
							width={barWidth / 3}
							height={(item.amazon / maxValue) * 160}
							fill={chartConfig.amazon.color}
							class="transition-opacity hover:opacity-80"
						/>

						<!-- eBay Bar -->
						<rect
							x={x + barWidth / 3}
							y={200 - (item.ebay / maxValue) * 160}
							width={barWidth / 3}
							height={(item.ebay / maxValue) * 160}
							fill={chartConfig.ebay.color}
							class="transition-opacity hover:opacity-80"
						/>

						<!-- Shopify Bar -->
						<rect
							x={x + (barWidth / 3) * 2}
							y={200 - (item.shopify / maxValue) * 160}
							width={barWidth / 3}
							height={(item.shopify / maxValue) * 160}
							fill={chartConfig.shopify.color}
							class="transition-opacity hover:opacity-80"
						/>

						<!-- Date Label -->
						<text
							x={x + barWidth / 2}
							y="230"
							text-anchor="middle"
							class="text-xs fill-muted-foreground"
						>
							{item.date}
						</text>
					{/each}

					<!-- Y-axis labels -->
					{#each Array(5) as _, i}
						<text x="35" y={25 + i * 40} text-anchor="end" class="text-xs fill-muted-foreground">
							{formatCurrency(Math.max(...chartData.map((d) => d.total)) * (1 - i / 4))}
						</text>
					{/each}

					<!-- Axes -->
					<line x1="40" y1="20" x2="40" y2="200" stroke="hsl(var(--foreground))" stroke-width="1" />
					<line
						x1="40"
						y1="200"
						x2="760"
						y2="200"
						stroke="hsl(var(--foreground))"
						stroke-width="1"
					/>
				</svg>
			</div>
		{/if}

		<!-- Legend and Summary -->
		<div class="mt-6 space-y-4">
			<!-- Channel Legend -->
			<div class="flex justify-center gap-6">
				{#each channelTotals as channel}
					<div class="flex items-center gap-2">
						<div class="h-3 w-3 rounded-full" style="background-color: {channel.color}"></div>
						<span class="text-sm font-medium">{channel.label}</span>
						<span class="text-sm text-muted-foreground">
							{formatCurrency(channel.total)}
						</span>
					</div>
				{/each}
			</div>

			<!-- Summary Cards -->
			<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div class="bg-muted/50 rounded-lg p-4 text-center">
					<div class="text-2xl font-bold">{formatCurrency(grandTotal)}</div>
					<div class="text-sm text-muted-foreground">Total Sales</div>
				</div>
				{#each channelTotals as channel}
					<div class="bg-muted/50 rounded-lg p-4 text-center">
						<div class="text-lg font-semibold" style="color: {channel.color}">
							{formatCurrency(channel.total)}
						</div>
						<div class="text-sm text-muted-foreground">{channel.label}</div>
						<div class="text-xs text-muted-foreground">
							{formatPercentage(channel.total, grandTotal)}%
						</div>
					</div>
				{/each}
			</div>
		</div>
	</CardContent>
</Card>
