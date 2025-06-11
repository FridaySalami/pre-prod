<!-- ShadcnChart.svelte -->
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
		description?: string;
		class?: string;
	}

	let { 
		data = [], 
		title = 'Daily Sales by Channel', 
		description = 'Sales performance across different channels',
		class: className = '' 
	}: Props = $props();

	// Chart Configuration
	const chartConfig = {
		amazon: {
			label: 'Amazon',
			color: 'hsl(var(--chart-1))'
		},
		ebay: {
			label: 'eBay',
			color: 'hsl(var(--chart-2))'
		},
		shopify: {
			label: 'Shopify',
			color: 'hsl(var(--chart-3))'
		}
	};

	// Process data for the chart
	const chartData = $derived(
		data.map((item) => ({
			date: new Date(item.date).toLocaleDateString('en-GB', {
				month: 'short',
				day: 'numeric'
			}),
			amazon: item.amazon_sales,
			ebay: item.ebay_sales,
			shopify: item.shopify_sales,
			total: item.total_sales
		}))
	);

	// Calculate totals for summary
	const totals = $derived({
		amazon: data.reduce((sum, item) => sum + item.amazon_sales, 0),
		ebay: data.reduce((sum, item) => sum + item.ebay_sales, 0),
		shopify: data.reduce((sum, item) => sum + item.shopify_sales, 0),
		total: data.reduce((sum, item) => sum + item.total_sales, 0)
	});

	function formatCurrency(value: number): string {
		return new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency: 'GBP',
			maximumFractionDigits: 0
		}).format(value);
	}
</script>

<Card class="w-full {className}">
	<CardHeader>
		<CardTitle>{title}</CardTitle>
		{#if description}
			<p class="text-sm text-muted-foreground">{description}</p>
		{/if}
	</CardHeader>
	<CardContent>
		{#if chartData.length === 0}
			<div class="text-center py-8 text-muted-foreground">
				<p>No data available</p>
			</div>
		{:else}
			<!-- Chart -->
			<div class="min-h-[200px] w-full border rounded-lg bg-background p-4">
				<div class="w-full h-[300px]">
					<!-- Simple HTML/CSS Chart -->
					<div class="flex items-end justify-between h-full gap-1 p-4">
						{#each chartData as day, i}
							{@const maxValue = Math.max(...chartData.map(d => d.total))}
							{@const amazonHeight = maxValue > 0 ? (day.amazon / maxValue) * 100 : 0}
							{@const ebayHeight = maxValue > 0 ? (day.ebay / maxValue) * 100 : 0}
							{@const shopifyHeight = maxValue > 0 ? (day.shopify / maxValue) * 100 : 0}
							
							<div class="flex flex-col items-center gap-2 flex-1">
								<!-- Bars -->
								<div class="flex items-end gap-0.5 h-full w-full max-w-12">
									<!-- Amazon Bar -->
									<div 
										class="rounded-t-sm transition-all hover:opacity-80 min-h-[2px]"
										style="height: {amazonHeight}%; width: 33.33%; background-color: {chartConfig.amazon.color}"
										title="Amazon: {formatCurrency(day.amazon)}"
									></div>
									<!-- eBay Bar -->
									<div 
										class="rounded-t-sm transition-all hover:opacity-80 min-h-[2px]"
										style="height: {ebayHeight}%; width: 33.33%; background-color: {chartConfig.ebay.color}"
										title="eBay: {formatCurrency(day.ebay)}"
									></div>
									<!-- Shopify Bar -->
									<div 
										class="rounded-t-sm transition-all hover:opacity-80 min-h-[2px]"
										style="height: {shopifyHeight}%; width: 33.33%; background-color: {chartConfig.shopify.color}"
										title="Shopify: {formatCurrency(day.shopify)}"
									></div>
								</div>
								<!-- Date Label -->
								<span class="text-xs text-muted-foreground text-center">
									{day.date}
								</span>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Legend -->
			<div class="mt-4 flex justify-center gap-6 text-sm">
				<div class="flex items-center gap-2">
					<div class="w-3 h-3 rounded-sm" style="background-color: {chartConfig.amazon.color}"></div>
					<span>Amazon</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-3 h-3 rounded-sm" style="background-color: {chartConfig.ebay.color}"></div>
					<span>eBay</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-3 h-3 rounded-sm" style="background-color: {chartConfig.shopify.color}"></div>
					<span>Shopify</span>
				</div>
			</div>

			<!-- Summary -->
			<div class="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
				<div class="space-y-2">
					<p class="text-sm font-medium leading-none">Total Sales</p>
					<p class="text-2xl font-bold">{formatCurrency(totals.total)}</p>
				</div>
				<div class="space-y-2">
					<p class="text-sm font-medium leading-none flex items-center gap-2">
						<span class="w-2 h-2 rounded-full" style="background-color: {chartConfig.amazon.color}"></span>
						Amazon
					</p>
					<p class="text-xl font-semibold">{formatCurrency(totals.amazon)}</p>
					<p class="text-xs text-muted-foreground">
						{totals.total > 0 ? ((totals.amazon / totals.total) * 100).toFixed(1) : '0'}% of total
					</p>
				</div>
				<div class="space-y-2">
					<p class="text-sm font-medium leading-none flex items-center gap-2">
						<span class="w-2 h-2 rounded-full" style="background-color: {chartConfig.ebay.color}"></span>
						eBay
					</p>
					<p class="text-xl font-semibold">{formatCurrency(totals.ebay)}</p>
					<p class="text-xs text-muted-foreground">
						{totals.total > 0 ? ((totals.ebay / totals.total) * 100).toFixed(1) : '0'}% of total
					</p>
				</div>
				<div class="space-y-2">
					<p class="text-sm font-medium leading-none flex items-center gap-2">
						<span class="w-2 h-2 rounded-full" style="background-color: {chartConfig.shopify.color}"></span>
						Shopify
					</p>
					<p class="text-xl font-semibold">{formatCurrency(totals.shopify)}</p>
					<p class="text-xs text-muted-foreground">
						{totals.total > 0 ? ((totals.shopify / totals.total) * 100).toFixed(1) : '0'}% of total
					</p>
				</div>
			</div>
		{/if}
	</CardContent>
</Card>
