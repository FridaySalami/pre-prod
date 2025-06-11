<!-- DailyMetricAreaChart.svelte -->
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
		type?: 'area' | 'bar' | 'line';
		showOrders?: boolean;
		class?: string;
	}

	let {
		data = [],
		title = 'Daily Sales Metrics',
		type = 'area',
		showOrders = false,
		class: className = ''
	}: Props = $props();

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
		},
		orders: {
			label: 'Total Orders',
			color: 'hsl(40, 84%, 39%)'
		}
	};

	// Process chart data
	const chartData = $derived(() => {
		return data.map((item) => ({
			date: new Date(item.date),
			amazon: item.amazon_sales,
			ebay: item.ebay_sales,
			shopify: item.shopify_sales,
			total: item.total_sales,
			orders: item.linnworks_total_orders,
			efficiency: item.labor_efficiency || 0
		}));
	});

	// Calculate channel totals and percentages
	const channelTotals = $derived(() => [
		{
			label: 'Amazon',
			total: data.reduce((sum, item) => sum + item.amazon_sales, 0),
			color: chartConfig.amazon.color
		},
		{
			label: 'eBay',
			total: data.reduce((sum, item) => sum + item.ebay_sales, 0),
			color: chartConfig.ebay.color
		},
		{
			label: 'Shopify',
			total: data.reduce((sum, item) => sum + item.shopify_sales, 0),
			color: chartConfig.shopify.color
		}
	]);

	const grandTotal = $derived(() =>
		channelTotals().reduce((sum, channel) => sum + channel.total, 0)
	);
	const totalOrders = $derived(() =>
		data.reduce((sum, item) => sum + item.linnworks_total_orders, 0)
	);

	// Calculate max value for scaling
	const maxValue = $derived(() => {
		if (showOrders) {
			return Math.max(...data.map((d) => d.linnworks_total_orders));
		} else {
			return Math.max(...data.map((d) => d.total_sales));
		}
	});

	function formatCurrency(value: number): string {
		return new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency: 'GBP',
			maximumFractionDigits: 0
		}).format(value);
	}

	function formatPercentage(value: number, total: number): string {
		if (total === 0) return '0';
		return ((value / total) * 100).toFixed(1);
	}
</script>

<Card class={className}>
	<CardHeader>
		<CardTitle>{title}</CardTitle>
	</CardHeader>
	<CardContent>
		{#if chartData().length === 0}
			<div class="text-center py-8 text-muted-foreground">
				<p>No data available</p>
			</div>
		{:else}
			<!-- SVG Area Chart -->
			<div class="h-[400px] w-full border rounded-lg bg-background p-4">
				<svg viewBox="0 0 800 300" class="w-full h-full">
					<!-- Grid lines -->
					{#each Array(6) as _, i}
						<line
							x1="60"
							y1={50 + i * 40}
							x2="740"
							y2={50 + i * 40}
							stroke="hsl(var(--muted))"
							stroke-width="0.5"
						/>
					{/each}

					{#each Array(chartData().length) as _, i}
						<line
							x1={80 + i * (660 / Math.max(1, chartData().length - 1))}
							y1="50"
							x2={80 + i * (660 / Math.max(1, chartData().length - 1))}
							y2="250"
							stroke="hsl(var(--muted))"
							stroke-width="0.5"
						/>
					{/each}

					<!-- Y-axis labels -->
					{#each Array(6) as _, i}
						<text x="50" y={55 + i * 40} text-anchor="end" class="text-xs fill-muted-foreground">
							{formatCurrency(maxValue() * (1 - i / 5))}
						</text>
					{/each}

					{#if type === 'area' && !showOrders}
						<!-- Stacked Area Chart for Sales Channels -->
						{@const points = chartData().map((d, i) => {
							const x = 80 + i * (660 / Math.max(1, chartData().length - 1));
							const totalHeight = (d.total / maxValue()) * 200;
							const amazonHeight = (d.amazon / maxValue()) * 200;
							const ebayHeight = ((d.amazon + d.ebay) / maxValue()) * 200;

							return { x, totalHeight, amazonHeight, ebayHeight };
						})}

						<!-- Shopify Area (top) -->
						<path
							d="M 80 250 {points
								.map((p) => `L ${p.x} ${250 - p.totalHeight}`)
								.join(' ')} L {points[points.length - 1]?.x || 80} 250 Z"
							fill={chartConfig.shopify.color}
							fill-opacity="0.6"
						/>

						<!-- eBay Area (middle) -->
						<path
							d="M 80 250 {points.map((p) => `L ${p.x} ${250 - p.ebayHeight}`).join(' ')} L {points[
								points.length - 1
							]?.x || 80} 250 Z"
							fill={chartConfig.ebay.color}
							fill-opacity="0.6"
						/>

						<!-- Amazon Area (bottom) -->
						<path
							d="M 80 250 {points
								.map((p) => `L ${p.x} ${250 - p.amazonHeight}`)
								.join(' ')} L {points[points.length - 1]?.x || 80} 250 Z"
							fill={chartConfig.amazon.color}
							fill-opacity="0.6"
						/>
					{:else if type === 'bar' || showOrders}
						<!-- Bar Chart -->
						{#each chartData() as item, i}
							{@const x = 80 + i * (660 / Math.max(1, chartData().length - 1)) - 15}
							{@const value = showOrders ? item.orders : item.total}
							{@const height = (value / maxValue()) * 200}
							<rect
								{x}
								y={250 - height}
								width="30"
								{height}
								fill={showOrders ? chartConfig.orders.color : chartConfig.amazon.color}
								fill-opacity="0.8"
								rx="2"
							/>
						{/each}
					{/if}

					<!-- X-axis labels -->
					{#each chartData() as item, i}
						<text
							x={80 + i * (660 / Math.max(1, chartData().length - 1))}
							y="270"
							text-anchor="middle"
							class="text-xs fill-muted-foreground"
						>
							{item.date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
						</text>
					{/each}

					<!-- Axes -->
					<line x1="60" y1="50" x2="60" y2="250" stroke="hsl(var(--foreground))" stroke-width="1" />
					<line
						x1="60"
						y1="250"
						x2="740"
						y2="250"
						stroke="hsl(var(--foreground))"
						stroke-width="1"
					/>
				</svg>
			</div>

			<!-- Legend -->
			<div class="mt-6 flex justify-center gap-6">
				{#if !showOrders}
					{#each channelTotals() as channel}
						<div class="flex items-center gap-2">
							<div class="w-3 h-3 rounded" style="background-color: {channel.color}"></div>
							<span class="text-sm">{channel.label}</span>
						</div>
					{/each}
				{:else}
					<div class="flex items-center gap-2">
						<div class="w-3 h-3 rounded" style="background-color: {chartConfig.orders.color}"></div>
						<span class="text-sm">{chartConfig.orders.label}</span>
					</div>
				{/if}
			</div>

			<!-- Summary Cards -->
			<div class="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
				<div class="bg-muted/50 rounded-lg p-4 text-center">
					<div class="text-2xl font-bold">{formatCurrency(grandTotal())}</div>
					<div class="text-sm text-muted-foreground">Total Sales</div>
				</div>
				<div class="bg-muted/50 rounded-lg p-4 text-center">
					<div class="text-2xl font-bold">{totalOrders()}</div>
					<div class="text-sm text-muted-foreground">Total Orders</div>
				</div>
				{#each channelTotals() as channel}
					<div class="bg-muted/50 rounded-lg p-4 text-center">
						<div class="text-lg font-semibold" style="color: {channel.color}">
							{formatCurrency(channel.total)}
						</div>
						<div class="text-sm text-muted-foreground">{channel.label}</div>
						<div class="text-xs text-muted-foreground">
							{formatPercentage(channel.total, grandTotal())}%
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</CardContent>
</Card>
