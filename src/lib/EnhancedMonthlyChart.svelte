<!-- EnhancedMonthlyChart.svelte -->
<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/shadcn/components';
	import { Button } from '$lib/shadcn/components';
	import { formatCurrency, formatPercentage } from '$lib/chartDataService';

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

	let { data = [], title = 'Enhanced Monthly Chart', class: className = '' }: Props = $props();

	let viewMode: 'daily' | 'weekly' | 'monthly' = $state('daily');
	let metricType: 'sales' | 'orders' = $state('sales');

	const chartConfig = {
		total: {
			label: 'Total',
			color: 'hsl(var(--chart-1))'
		},
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
		},
		orders: {
			label: 'Orders',
			color: 'hsl(var(--chart-4))'
		}
	};

	// Aggregate data based on view mode
	const processedData = $derived(() => {
		if (!data || data.length === 0) return [];

		const sortedData = [...data].sort(
			(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
		);

		if (viewMode === 'daily') {
			return sortedData.map((item) => ({
				date: new Date(item.date),
				dateStr: new Date(item.date).toLocaleDateString('en-GB', {
					month: 'short',
					day: 'numeric'
				}),
				amazon_sales: item.amazon_sales,
				ebay_sales: item.ebay_sales,
				shopify_sales: item.shopify_sales,
				total_sales: item.total_sales,
				orders: item.linnworks_total_orders,
				efficiency: item.labor_efficiency || 0
			}));
		}

		// For weekly/monthly aggregation
		const groups = new Map();

		sortedData.forEach((item) => {
			const date = new Date(item.date);
			let key: string;

			if (viewMode === 'weekly') {
				const weekStart = new Date(date);
				weekStart.setDate(date.getDate() - date.getDay());
				key = weekStart.toISOString().split('T')[0];
			} else {
				key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
			}

			if (!groups.has(key)) {
				groups.set(key, {
					dates: [],
					amazon_sales: 0,
					ebay_sales: 0,
					shopify_sales: 0,
					total_sales: 0,
					orders: 0,
					efficiency: 0,
					count: 0
				});
			}

			const group = groups.get(key);
			group.dates.push(date);
			group.amazon_sales += item.amazon_sales;
			group.ebay_sales += item.ebay_sales;
			group.shopify_sales += item.shopify_sales;
			group.total_sales += item.total_sales;
			group.orders += item.linnworks_total_orders;
			group.efficiency += item.labor_efficiency || 0;
			group.count++;
		});

		return Array.from(groups.entries()).map(([key, group]) => {
			const firstDate = group.dates[0];
			let dateStr: string;

			if (viewMode === 'weekly') {
				dateStr = `Week ${firstDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}`;
			} else {
				dateStr = firstDate.toLocaleDateString('en-GB', { year: 'numeric', month: 'long' });
			}

			return {
				date: firstDate,
				dateStr,
				amazon_sales: group.amazon_sales,
				ebay_sales: group.ebay_sales,
				shopify_sales: group.shopify_sales,
				total_sales: group.total_sales,
				orders: group.orders,
				efficiency: group.count > 0 ? group.efficiency / group.count : 0
			};
		});
	});

	// Calculate totals
	const totals = $derived(() => {
		const dataToUse = processedData();
		if (dataToUse.length === 0) return { amazon: 0, ebay: 0, shopify: 0, orders: 0, total: 0 };

		const amazon = dataToUse.reduce((sum, item) => sum + item.amazon_sales, 0);
		const ebay = dataToUse.reduce((sum, item) => sum + item.ebay_sales, 0);
		const shopify = dataToUse.reduce((sum, item) => sum + item.shopify_sales, 0);
		const orders = dataToUse.reduce((sum, item) => sum + item.orders, 0);
		const total = amazon + ebay + shopify;

		return { amazon, ebay, shopify, orders, total };
	});

	const maxValue = $derived(() => {
		const dataToUse = processedData();
		if (dataToUse.length === 0) return 0;

		if (metricType === 'sales') {
			return Math.max(...dataToUse.map((d) => d.total_sales));
		} else {
			return Math.max(...dataToUse.map((d) => d.orders));
		}
	});
</script>

<Card class={className}>
	<CardHeader>
		<CardTitle>{title}</CardTitle>

		<!-- Controls -->
		<div class="flex flex-wrap gap-4 mt-4">
			<!-- View Mode -->
			<div class="flex gap-2">
				<Button
					variant={viewMode === 'daily' ? 'default' : 'outline'}
					size="sm"
					onclick={() => (viewMode = 'daily')}
				>
					Daily
				</Button>
				<Button
					variant={viewMode === 'weekly' ? 'default' : 'outline'}
					size="sm"
					onclick={() => (viewMode = 'weekly')}
				>
					Weekly
				</Button>
				<Button
					variant={viewMode === 'monthly' ? 'default' : 'outline'}
					size="sm"
					onclick={() => (viewMode = 'monthly')}
				>
					Monthly
				</Button>
			</div>

			<!-- Metric Type -->
			<div class="flex gap-2">
				<Button
					variant={metricType === 'sales' ? 'default' : 'outline'}
					size="sm"
					onclick={() => (metricType = 'sales')}
				>
					Sales
				</Button>
				<Button
					variant={metricType === 'orders' ? 'default' : 'outline'}
					size="sm"
					onclick={() => (metricType = 'orders')}
				>
					Orders
				</Button>
			</div>
		</div>
	</CardHeader>

	<CardContent>
		{#if processedData().length === 0}
			<div class="text-center py-8 text-muted-foreground">
				<p>No data available</p>
			</div>
		{:else}
			<!-- Chart -->
			<div class="h-[400px] w-full border rounded-lg bg-background p-4 mb-6">
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

					{#each Array(processedData().length) as _, i}
						<line
							x1={80 + i * (660 / Math.max(1, processedData().length - 1))}
							y1="50"
							x2={80 + i * (660 / Math.max(1, processedData().length - 1))}
							y2="250"
							stroke="hsl(var(--muted))"
							stroke-width="0.5"
						/>
					{/each}

					<!-- Y-axis labels -->
					{#each Array(6) as _, i}
						<text x="50" y={55 + i * 40} text-anchor="end" class="text-xs fill-muted-foreground">
							{#if metricType === 'sales'}
								{formatCurrency(maxValue() * (1 - i / 5))}
							{:else}
								{Math.round(maxValue() * (1 - i / 5))}
							{/if}
						</text>
					{/each}

					<!-- Bars -->
					{#each processedData() as item, i}
						{@const x = 80 + i * (660 / Math.max(1, processedData().length - 1)) - 15}
						{@const value = metricType === 'sales' ? item.total_sales : item.orders}
						{@const height = maxValue() > 0 ? (value / maxValue()) * 200 : 0}
						<rect
							{x}
							y={250 - height}
							width="30"
							{height}
							fill={metricType === 'sales' ? chartConfig.total.color : chartConfig.orders.color}
							fill-opacity="0.8"
							rx="2"
						></rect>
					{/each}

					<!-- X-axis labels -->
					{#each processedData() as item, i}
						<text
							x={80 + i * (660 / Math.max(1, processedData().length - 1))}
							y="270"
							text-anchor="middle"
							class="text-xs fill-muted-foreground"
						>
							{item.dateStr}
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

			<!-- Summary Statistics -->
			<div class="grid grid-cols-2 md:grid-cols-6 gap-4">
				<!-- Total Sales -->
				<div class="bg-muted/50 rounded-lg p-4 text-center">
					<div class="text-2xl font-bold">{formatCurrency(totals().total)}</div>
					<div class="text-sm text-muted-foreground">Total Sales</div>
				</div>

				<!-- Channel Breakdown -->
				<div class="bg-muted/50 rounded-lg p-4 text-center">
					<div class="text-lg font-semibold" style="color: {chartConfig.amazon.color}">
						{formatCurrency(totals().amazon)}
					</div>
					<div class="text-sm text-muted-foreground">Amazon</div>
					<div class="text-xs text-muted-foreground">
						{totals().total > 0 ? formatPercentage((totals().amazon / totals().total) * 100) : '0'}%
					</div>
				</div>

				<div class="bg-muted/50 rounded-lg p-4 text-center">
					<div class="text-lg font-semibold" style="color: {chartConfig.ebay.color}">
						{formatCurrency(totals().ebay)}
					</div>
					<div class="text-sm text-muted-foreground">eBay</div>
					<div class="text-xs text-muted-foreground">
						{totals().total > 0 ? formatPercentage((totals().ebay / totals().total) * 100) : '0'}%
					</div>
				</div>

				<div class="bg-muted/50 rounded-lg p-4 text-center">
					<div class="text-lg font-semibold" style="color: {chartConfig.shopify.color}">
						{formatCurrency(totals().shopify)}
					</div>
					<div class="text-sm text-muted-foreground">Shopify</div>
					<div class="text-xs text-muted-foreground">
						{totals().total > 0
							? formatPercentage((totals().shopify / totals().total) * 100)
							: '0'}%
					</div>
				</div>

				<!-- Orders Stats -->
				<div class="bg-muted/50 rounded-lg p-4 text-center">
					<div class="text-2xl font-bold">{totals().orders.toLocaleString()}</div>
					<div class="text-sm text-muted-foreground">Total Orders</div>
				</div>

				<div class="bg-muted/50 rounded-lg p-4 text-center">
					<div class="text-lg font-semibold">
						{processedData().length > 0
							? Math.round(totals().orders / processedData().length).toLocaleString()
							: '0'}
					</div>
					<div class="text-sm text-muted-foreground">Avg/Period</div>
					<div class="text-xs text-muted-foreground">
						Peak: {processedData().length > 0
							? Math.max(...processedData().map((d) => d.orders)).toLocaleString()
							: '0'}
					</div>
				</div>
			</div>

			<!-- Additional Metrics -->
			{#if metricType === 'sales'}
				<div class="mt-6 grid grid-cols-2 gap-4">
					<div class="bg-muted/50 rounded-lg p-4 text-center">
						<div class="text-lg font-semibold">
							{totals().orders > 0
								? formatCurrency(totals().total / totals().orders)
								: formatCurrency(0)}
						</div>
						<div class="text-sm text-muted-foreground">Average Order Value</div>
					</div>
					<div class="bg-muted/50 rounded-lg p-4 text-center">
						<div class="text-lg font-semibold">
							{processedData().length > 0
								? formatCurrency(totals().total / processedData().length)
								: formatCurrency(0)}
						</div>
						<div class="text-sm text-muted-foreground">
							Average per {viewMode.charAt(0).toUpperCase() + viewMode.slice(1, -2)}
						</div>
					</div>
				</div>
			{/if}
		{/if}
	</CardContent>
</Card>
