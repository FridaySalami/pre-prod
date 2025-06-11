<!-- MonthlyChart.svelte -->
<script lang="ts">
	import {
		ChartContainer,
		type ChartConfig,
		Card,
		CardHeader,
		CardTitle,
		CardContent
	} from '$lib/shadcn/components';

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
		class?: string;
	}

	let { data = [], class: className = '' }: Props = $props();

	// Configuration
	const chartConfig = {
		amazon: {
			label: 'Amazon',
			color: '#2563eb'
		},
		ebay: {
			label: 'eBay',
			color: '#dc2626'
		},
		shopify: {
			label: 'Shopify',
			color: '#059669'
		}
	} satisfies ChartConfig;

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
			color: '#2563eb',
			total: data.reduce((sum, item) => sum + item.amazon_sales, 0)
		},
		{
			key: 'ebay',
			label: 'eBay',
			color: '#dc2626',
			total: data.reduce((sum, item) => sum + item.ebay_sales, 0)
		},
		{
			key: 'shopify',
			label: 'Shopify',
			color: '#059669',
			total: data.reduce((sum, item) => sum + item.shopify_sales, 0)
		}
	]);

	const grandTotal = $derived(channelTotals.reduce((sum, channel) => sum + channel.total, 0));

	// Chart Layout Calculations
	const channels = [
		{ key: 'amazon', label: 'Amazon', color: '#2563eb' },
		{ key: 'ebay', label: 'eBay', color: '#dc2626' },
		{ key: 'shopify', label: 'Shopify', color: '#059669' }
	];

	const maxValue = $derived(
		Math.max(
			...chartData.flatMap((d) => channels.map((ch) => d[ch.key as keyof typeof d] as number))
		)
	);

	const chartArea = {
		width: 940,
		height: 300
	};

	const barWidth = $derived(chartData.length > 0 ? chartArea.width / chartData.length : 0);
	const individualBarWidth = $derived(Math.max(8, (barWidth * 0.8) / channels.length));

	// Generate Y-axis tick values
	const yAxisTicks = $derived(() => {
		if (maxValue === 0) return [0];
		const step = Math.ceil(maxValue / 5 / 1000) * 1000;
		return Array.from({ length: 6 }, (_, i) => i * step);
	});

	// Interactive State Management
	let hoveredBar: number | null = $state(null);
	let hoveredChannel: string | null = $state(null);
	let mousePosition = $state({ x: 0, y: 0 });

	// Chart Positioning Functions
	function getBarX(dayIndex: number, channelIndex: number): number {
		const dayStartX = 50 + dayIndex * barWidth;
		const groupStartX = dayStartX + (barWidth * 0.1) / 2;
		return groupStartX + channelIndex * individualBarWidth;
	}

	function getBarHeight(value: number): number {
		return maxValue > 0 ? (value / maxValue) * chartArea.height : 0;
	}

	function getBarY(value: number): number {
		const height = getBarHeight(value);
		return 40 + chartArea.height - height;
	}

	function getTickY(tickValue: number): number {
		return 40 + chartArea.height - (tickValue / maxValue) * chartArea.height;
	}

	function formatCompactCurrency(value: number): string {
		if (value >= 1000000) {
			return `£${(value / 1000000).toFixed(1)}M`;
		}
		if (value >= 1000) {
			return `£${(value / 1000).toFixed(0)}k`;
		}
		return `£${value.toFixed(0)}`;
	}

	// Event Handlers
	function handleBarMouseMove(event: MouseEvent, barIndex: number, channelKey: string) {
		hoveredBar = barIndex;
		hoveredChannel = channelKey;
		mousePosition = { x: event.clientX, y: event.clientY };
	}

	function handleMouseLeave() {
		hoveredBar = null;
		hoveredChannel = null;
	}
</script>

<Card class="w-full {className}">
	<CardHeader>
		<CardTitle>Bar Chart - Interactive</CardTitle>
		<p class="text-sm text-muted-foreground">
			Showing total sales for the last {data.length} days
		</p>
	</CardHeader>
	<CardContent>
		{#if data.length === 0}
			<div class="text-center py-8 text-muted-foreground">
				<p>No data available</p>
			</div>
		{:else}
			<!-- Summary Cards -->
			<div class="grid gap-4 md:grid-cols-3 mb-6">
				{#each channelTotals as channel}
					<div class="bg-muted/50 p-4 rounded-lg border">
						<div class="flex items-center gap-2 mb-2">
							<div class="w-3 h-3 rounded-full" style="background-color: {channel.color}"></div>
							<span class="text-sm font-medium">{channel.label}</span>
						</div>
						<div class="text-2xl font-bold">{formatCurrency(channel.total)}</div>
						<p class="text-xs text-muted-foreground">
							{formatPercentage(channel.total, grandTotal)}% of total
						</p>
					</div>
				{/each}
			</div>

			<!-- Chart Container -->
			<ChartContainer config={chartConfig} class="h-[400px]">
				<div class="w-full h-full relative">
					<svg
						width="100%"
						height="100%"
						viewBox="0 0 1000 400"
						role="img"
						aria-label="Interactive bar chart showing daily sales by channel"
						onmouseleave={handleMouseLeave}
					>
						<!-- Y-axis -->
						<g>
							{#each yAxisTicks() as tick}
								<line
									x1="45"
									y1={getTickY(tick)}
									x2="50"
									y2={getTickY(tick)}
									stroke="currentColor"
									stroke-width="1"
									opacity="0.3"
								/>
								<text
									x="40"
									y={getTickY(tick) + 4}
									text-anchor="end"
									class="text-xs fill-muted-foreground"
								>
									{formatCompactCurrency(tick)}
								</text>
								<!-- Grid lines -->
								<line
									x1="50"
									y1={getTickY(tick)}
									x2="990"
									y2={getTickY(tick)}
									stroke="currentColor"
									stroke-width="0.5"
									opacity="0.1"
								/>
							{/each}
						</g>

						<!-- Bars -->
						{#each chartData as day, dayIndex}
							{#each channels as channel, channelIndex}
								{@const value = day[channel.key as keyof typeof day] as number}
								{@const x = getBarX(dayIndex, channelIndex)}
								{@const y = getBarY(value)}
								{@const height = getBarHeight(value)}
								{@const isHovered = hoveredBar === dayIndex && hoveredChannel === channel.key}

								<rect
									{x}
									{y}
									width={individualBarWidth}
									{height}
									fill={channel.color}
									opacity={isHovered ? 0.8 : 0.6}
									stroke={isHovered ? channel.color : 'none'}
									stroke-width={isHovered ? 2 : 0}
									class="transition-all duration-200 cursor-pointer"
									role="button"
									tabindex="0"
									aria-label="{channel.label} sales for {day.date}: {formatCurrency(value)}"
									onmousemove={(e) => handleBarMouseMove(e, dayIndex, channel.key)}
								/>
							{/each}
						{/each}

						<!-- X-axis labels -->
						{#each chartData as day, dayIndex}
							<text
								x={50 + dayIndex * barWidth + barWidth / 2}
								y={chartArea.height + 60}
								text-anchor="middle"
								class="text-xs fill-muted-foreground"
							>
								{day.date}
							</text>
						{/each}
					</svg>

					<!-- Tooltip -->
					{#if hoveredBar !== null && hoveredChannel !== null}
						{@const day = chartData[hoveredBar]}
						{@const channel = channels.find((c) => c.key === hoveredChannel)}
						{@const value = day[hoveredChannel as keyof typeof day] as number}

						<div
							class="absolute bg-popover border rounded-lg shadow-lg p-3 pointer-events-none z-10"
							style="left: {mousePosition.x - 300}px; top: {mousePosition.y - 100}px;"
						>
							<div class="font-medium mb-1">{day.date}</div>
							<div class="flex items-center gap-2">
								<div class="w-3 h-3 rounded-full" style="background-color: {channel?.color}"></div>
								<span class="text-sm">{channel?.label}:</span>
								<span class="font-mono font-medium">{formatCurrency(value)}</span>
							</div>
						</div>
					{/if}
				</div>
			</ChartContainer>
		{/if}
	</CardContent>
</Card>
