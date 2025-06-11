<!-- MetricsDashboardChart.svelte -->
<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/shadcn/components';
	import { Button } from '$lib/shadcn/components';
	import { cn } from '$lib/shadcn/utils/index.js';

	interface DailyMetric {
		date: string;
		total_sales: number;
		amazon_sales: number;
		ebay_sales: number;
		shopify_sales: number;
		linnworks_total_orders: number;
		labor_efficiency?: number;
		actual_hours_worked?: number;
	}

	interface Props {
		data: DailyMetric[];
		title?: string;
		class?: string;
	}

	let { data = [], title = 'Daily Sales Visualization', class: className = '' }: Props = $props();

	let selectedMetric: 'sales' | 'orders' | 'efficiency' = $state('sales');

	// Calculate display data based on selected metric
	const displayData = $derived(() => {
		if (!data || data.length === 0) return [];

		return data.map((item) => {
			const date = new Date(item.date);
			const dateStr = date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });

			let value = 0;
			switch (selectedMetric) {
				case 'sales':
					value = item.total_sales;
					break;
				case 'orders':
					value = item.linnworks_total_orders;
					break;
				case 'efficiency':
					value = item.labor_efficiency || 0;
					break;
			}

			return {
				date,
				dateStr,
				value,
				total_sales: item.total_sales,
				amazon_sales: item.amazon_sales,
				ebay_sales: item.ebay_sales,
				shopify_sales: item.shopify_sales,
				orders: item.linnworks_total_orders,
				efficiency: item.labor_efficiency || 0,
				hours: item.actual_hours_worked || 0
			};
		});
	});

	const maxValue = $derived(() => {
		if (!displayData() || displayData().length === 0) return 0;

		// For sales view, use max individual channel value for proper scaling
		if (selectedMetric === 'sales') {
			const channelValues = displayData().flatMap((d) => [
				d.amazon_sales,
				d.ebay_sales,
				d.shopify_sales
			]);
			return Math.max(...channelValues);
		}

		// For other metrics, use the original calculation
		return Math.max(...displayData().map((d) => d.value));
	});

	const totalValue = $derived(() => {
		if (!displayData() || displayData().length === 0) return 0;
		return displayData().reduce((sum, d) => sum + d.value, 0);
	});

	const averageValue = $derived(() => {
		if (!displayData() || displayData().length === 0) return 0;
		return totalValue() / displayData().length;
	});

	function formatValue(value: number): string {
		switch (selectedMetric) {
			case 'sales':
				return new Intl.NumberFormat('en-GB', {
					style: 'currency',
					currency: 'GBP',
					maximumFractionDigits: 0
				}).format(value);
			case 'orders':
				return value.toString();
			case 'efficiency':
				return `${value.toFixed(1)}%`;
			default:
				return value.toString();
		}
	}

	function getMetricLabel(): string {
		switch (selectedMetric) {
			case 'sales':
				return 'Sales';
			case 'orders':
				return 'Orders';
			case 'efficiency':
				return 'Efficiency';
			default:
				return 'Value';
		}
	}

	// Y-axis tick calculations
	const yAxisTicks = $derived(() => {
		if (maxValue() === 0) return [0];
		const max = maxValue();
		const step = Math.ceil(max / 5);
		return Array.from({ length: 6 }, (_, i) => i * step);
	});

	function formatCompactValue(value: number): string {
		switch (selectedMetric) {
			case 'sales':
				if (value >= 1000000) {
					return `£${(value / 1000000).toFixed(1)}M`;
				}
				if (value >= 1000) {
					return `£${(value / 1000).toFixed(0)}k`;
				}
				return `£${value.toFixed(0)}`;
			case 'orders':
				if (value >= 1000) {
					return `${(value / 1000).toFixed(1)}k`;
				}
				return value.toString();
			case 'efficiency':
				return `${value.toFixed(1)}`;
			default:
				return value.toString();
		}
	}

	// Interactive state management for tooltip
	let hoveredItem: {
		dayIndex: number;
		channelKey: string | undefined;
		value: number;
		label: string;
		dateStr: string;
	} | null = $state(null);
	let mousePosition = $state({ x: 0, y: 0 });

	// Event handlers
	function handleBarMouseMove(
		event: MouseEvent,
		dayIndex: number,
		channelKey: string | null,
		value: number,
		label: string,
		dateStr: string
	) {
		const target = event.currentTarget as SVGRectElement;
		const rect = target?.closest('svg')?.getBoundingClientRect();
		if (rect) {
			mousePosition = {
				x: event.clientX - rect.left,
				y: event.clientY - rect.top
			};
		}
		hoveredItem = { dayIndex, channelKey: channelKey ?? undefined, value, label, dateStr };
	}

	function handleMouseLeave() {
		hoveredItem = null;
	}

	function handleKeyDown(
		event: KeyboardEvent,
		dayIndex: number,
		channelKey: string | null,
		value: number,
		label: string,
		dateStr: string
	) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			// Show tooltip on keyboard activation
			hoveredItem = { dayIndex, channelKey: channelKey ?? undefined, value, label, dateStr };
			// Set mouse position to center of the focused element
			const target = event.currentTarget as SVGRectElement;
			const rect = target?.closest('svg')?.getBoundingClientRect();
			if (rect) {
				const targetRect = target.getBBox();
				mousePosition = {
					x: targetRect.x + targetRect.width / 2,
					y: targetRect.y + targetRect.height / 2
				};
			}
		}
	}
</script>

<Card class="w-full {className}">
	<CardHeader class="pb-4">
		<CardTitle class="text-xl font-semibold">{title}</CardTitle>

		<!-- Metric Selection Buttons -->
		<div class="flex gap-2 mt-4">
			<Button
				variant={selectedMetric === 'sales' ? 'default' : 'outline'}
				size="sm"
				onclick={() => (selectedMetric = 'sales')}
				class={selectedMetric === 'sales'
					? 'bg-blue-600 hover:bg-blue-700'
					: 'hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'}
			>
				Sales
			</Button>
			<Button
				variant={selectedMetric === 'orders' ? 'default' : 'outline'}
				size="sm"
				onclick={() => (selectedMetric = 'orders')}
				class={selectedMetric === 'orders'
					? 'bg-orange-600 hover:bg-orange-700'
					: 'hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200'}
			>
				Orders
			</Button>
			<Button
				variant={selectedMetric === 'efficiency' ? 'default' : 'outline'}
				size="sm"
				onclick={() => (selectedMetric = 'efficiency')}
				class={selectedMetric === 'efficiency'
					? 'bg-green-600 hover:bg-green-700'
					: 'hover:bg-green-50 hover:text-green-600 hover:border-green-200'}
			>
				Efficiency
			</Button>
		</div>
	</CardHeader>

	<CardContent>
		{#if displayData().length === 0}
			<div class="text-center py-8 text-muted-foreground">
				<p>No data available</p>
			</div>
		{:else}
			<!-- Screen reader accessible summary -->
			<div class="sr-only">
				<p>
					Chart showing {displayData().length} days of {getMetricLabel().toLowerCase()} data. Total {getMetricLabel().toLowerCase()}:
					{formatValue(totalValue())}. Average {getMetricLabel().toLowerCase()}: {formatValue(
						averageValue()
					)}. Use arrow keys to navigate through the chart data.
				</p>
			</div>
			<!-- Multi-Channel Bar Chart with SVG -->
			<div class="relative">
				<svg
					width="100%"
					height="500"
					viewBox="0 0 1600 500"
					class="border rounded-lg bg-background"
					role="img"
					aria-label="Interactive bar chart showing daily {getMetricLabel().toLowerCase()} data over {displayData()
						.length} days. Navigate with tab key and activate with Enter or Space."
					onmouseleave={handleMouseLeave}
				>
					<!-- Y-axis -->
					<g role="presentation" aria-label="Y-axis with value scale">
						{#each yAxisTicks() as tick, i}
							{@const y = 450 - (tick / maxValue()) * 400}
							<!-- Y-axis tick marks -->
							<line
								x1="60"
								y1={y}
								x2="65"
								y2={y}
								stroke="currentColor"
								stroke-width="1"
								opacity="0.3"
							/>
							<!-- Y-axis labels -->
							<text x="55" y={y + 4} text-anchor="end" class="text-xs fill-muted-foreground">
								{formatCompactValue(tick)}
							</text>
							<!-- Grid lines -->
							<line
								x1="65"
								y1={y}
								x2="1550"
								y2={y}
								stroke="currentColor"
								stroke-width="0.5"
								opacity="0.1"
							/>
						{/each}
					</g>

					<!-- Chart bars -->
					{#each displayData() as item, index}
						{@const xPosition = 80 + index * (1400 / displayData().length)}
						{@const barWidth = (1400 / displayData().length) * 0.6}

						{#if selectedMetric === 'sales'}
							{@const amazonHeight = maxValue() > 0 ? (item.amazon_sales / maxValue()) * 400 : 0}
							{@const ebayHeight = maxValue() > 0 ? (item.ebay_sales / maxValue()) * 400 : 0}
							{@const shopifyHeight = maxValue() > 0 ? (item.shopify_sales / maxValue()) * 400 : 0}
							{@const individualBarWidth = Math.max(15, barWidth / 3)}
							{@const barSpacing = 0}

							<!-- Amazon Bar -->
							<rect
								x={xPosition}
								y={450 - amazonHeight}
								width={individualBarWidth}
								height={amazonHeight}
								fill="#3b82f6"
								opacity={hoveredItem?.dayIndex === index && hoveredItem?.channelKey === 'amazon'
									? 1
									: 0.8}
								class="transition-all duration-300 hover:opacity-100 cursor-pointer"
								role="button"
								tabindex="0"
								aria-label="Amazon sales for {item.dateStr}: {formatValue(item.amazon_sales)}"
								onmousemove={(e) =>
									handleBarMouseMove(e, index, 'amazon', item.amazon_sales, 'Amazon', item.dateStr)}
								onkeydown={(e) =>
									handleKeyDown(e, index, 'amazon', item.amazon_sales, 'Amazon', item.dateStr)}
							></rect>
							<!-- eBay Bar -->
							<rect
								x={xPosition + individualBarWidth + barSpacing}
								y={450 - ebayHeight}
								width={individualBarWidth}
								height={ebayHeight}
								fill="#eab308"
								opacity={hoveredItem?.dayIndex === index && hoveredItem?.channelKey === 'ebay'
									? 1
									: 0.8}
								class="transition-all duration-300 hover:opacity-100 cursor-pointer"
								role="button"
								tabindex="0"
								aria-label="eBay sales for {item.dateStr}: {formatValue(item.ebay_sales)}"
								onmousemove={(e) =>
									handleBarMouseMove(e, index, 'ebay', item.ebay_sales, 'eBay', item.dateStr)}
								onkeydown={(e) =>
									handleKeyDown(e, index, 'ebay', item.ebay_sales, 'eBay', item.dateStr)}
							></rect>
							<!-- Shopify Bar -->
							<rect
								x={xPosition + (individualBarWidth + barSpacing) * 2}
								y={450 - shopifyHeight}
								width={individualBarWidth}
								height={shopifyHeight}
								fill="#10b981"
								opacity={hoveredItem?.dayIndex === index && hoveredItem?.channelKey === 'shopify'
									? 1
									: 0.8}
								class="transition-all duration-300 hover:opacity-100 cursor-pointer"
								role="button"
								tabindex="0"
								aria-label="Shopify sales for {item.dateStr}: {formatValue(item.shopify_sales)}"
								onmousemove={(e) =>
									handleBarMouseMove(
										e,
										index,
										'shopify',
										item.shopify_sales,
										'Shopify',
										item.dateStr
									)}
								onkeydown={(e) =>
									handleKeyDown(e, index, 'shopify', item.shopify_sales, 'Shopify', item.dateStr)}
							></rect>
						{:else}
							<!-- Single bar for Orders/Efficiency -->
							{@const barHeight = maxValue() > 0 ? (item.value / maxValue()) * 400 : 0}
							{@const barColor = selectedMetric === 'orders' ? '#ea580c' : '#16a34a'}
							<rect
								x={xPosition + barWidth / 4}
								y={450 - barHeight}
								width={barWidth / 2}
								height={barHeight}
								fill={barColor}
								opacity={hoveredItem?.dayIndex === index ? 1 : 0.8}
								class="transition-all duration-300 hover:opacity-100 cursor-pointer"
								role="button"
								tabindex="0"
								aria-label="{getMetricLabel()} for {item.dateStr}: {formatValue(item.value)}"
								onmousemove={(e) =>
									handleBarMouseMove(e, index, null, item.value, getMetricLabel(), item.dateStr)}
								onkeydown={(e) =>
									handleKeyDown(e, index, null, item.value, getMetricLabel(), item.dateStr)}
							></rect>
						{/if}

						<!-- Date labels -->
						<text
							x={xPosition + barWidth / 2}
							y="480"
							text-anchor="middle"
							class="text-xs fill-muted-foreground"
							transform="rotate(-45, {xPosition + barWidth / 2}, 480)"
						>
							{item.dateStr}
						</text>
					{/each}
				</svg>

				<!-- Shadcn-style Tooltip -->
				{#if hoveredItem}
					<div
						class={cn(
							'absolute border-border/50 bg-background grid min-w-[9rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl pointer-events-none z-50'
						)}
						style="left: {mousePosition.x + 10}px; top: {mousePosition.y - 10}px;"
					>
						<!-- Date Label -->
						<div class="font-medium">
							{hoveredItem.dateStr}
						</div>

						<!-- Value Display -->
						<div class="grid gap-1.5">
							<div class="flex w-full flex-wrap gap-2 items-center">
								<!-- Indicator dot for channel color -->
								{#if hoveredItem.channelKey}
									{@const channelColor =
										hoveredItem.channelKey === 'amazon'
											? '#3b82f6'
											: hoveredItem.channelKey === 'ebay'
												? '#eab308'
												: '#10b981'}
									<div
										style="background-color: {channelColor}; border-color: {channelColor};"
										class="shrink-0 rounded-[2px] border size-2.5"
									></div>
								{:else}
									{@const metricColor = selectedMetric === 'orders' ? '#ea580c' : '#16a34a'}
									<div
										style="background-color: {metricColor}; border-color: {metricColor};"
										class="shrink-0 rounded-[2px] border size-2.5"
									></div>
								{/if}

								<div class="flex flex-1 shrink-0 justify-between leading-none items-center">
									<span class="text-muted-foreground">
										{hoveredItem.label}
									</span>
									<span class="text-foreground font-mono font-medium tabular-nums">
										{formatValue(hoveredItem.value)}
									</span>
								</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- Legend - only show for Sales -->
				{#if selectedMetric === 'sales'}
					<div class="flex justify-center gap-4 mt-4">
						<div class="flex items-center gap-2">
							<div class="w-3 h-3 bg-blue-500 rounded"></div>
							<span class="text-sm text-muted-foreground">Amazon</span>
						</div>
						<div class="flex items-center gap-2">
							<div class="w-3 h-3 bg-yellow-500 rounded"></div>
							<span class="text-sm text-muted-foreground">eBay</span>
						</div>
						<div class="flex items-center gap-2">
							<div class="w-3 h-3 bg-green-500 rounded"></div>
							<span class="text-sm text-muted-foreground">Shopify</span>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</CardContent>
</Card>
