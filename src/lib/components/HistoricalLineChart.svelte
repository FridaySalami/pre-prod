<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '$lib/shadcn/components';
	import { cn } from '$lib/shadcn/utils/index.js';
	import SignificanceDisplay from './SignificanceDisplay.svelte';
	import { SeasonalTrendService } from '$lib/services/seasonalTrendService';
	import type { HistoricalDataResponse } from '$lib/types/historicalData';

	interface Props {
		historicalData: HistoricalDataResponse | null;
		loading?: boolean;
		error?: string | null;
		class?: string;
		onClose?: () => void;
	}

	let {
		historicalData,
		loading = false,
		error = null,
		class: className = '',
		onClose
	}: Props = $props();

	// Chart dimensions and styling
	const chartWidth = 800;
	const chartHeight = 400;
	const padding = { top: 20, right: 60, bottom: 80, left: 80 };
	const plotWidth = chartWidth - padding.left - padding.right;
	const plotHeight = chartHeight - padding.top - padding.bottom;

	// Seasonal trend analysis state
	let showSeasonalAnalysis = $state(false); // Default to hidden for weekday data

	// Computed values for chart rendering
	const chartData = $derived(() => {
		if (!historicalData?.data || historicalData.data.length === 0) return [];
		return historicalData.data;
	});

	// Seasonal trend analysis (for weekday data, we'll use weekly periods)
	const seasonalAnalysis = $derived(() => {
		const data = chartData();
		if (data.length === 0) return null;

		const values = data.map((d) => d.value);
		// For weekday data, we use a weekly cycle (7 days) but adapt to available data
		const cyclePeriod = Math.min(7, Math.floor(values.length / 2));
		return SeasonalTrendService.analyzeSeasonalTrend(values, cyclePeriod);
	});

	const yDomain = $derived(() => {
		if (chartData().length === 0) return [0, 100];
		const values = chartData().map((d) => d.value);
		const min = Math.min(...values);
		const max = Math.max(...values);
		const padding = (max - min) * 0.1;
		return [Math.max(0, min - padding), max + padding];
	});

	const xScale = $derived(() => {
		const data = chartData();
		if (data.length === 0) return () => 0;
		return (index: number) => (index / (data.length - 1)) * plotWidth;
	});

	const yScale = $derived(() => {
		const [min, max] = yDomain();
		return (value: number) => plotHeight - ((value - min) / (max - min)) * plotHeight;
	});

	// Generate line path
	const linePath = $derived(() => {
		const data = chartData();
		if (data.length === 0) return '';

		const pathParts = data.map((point, index) => {
			const x = padding.left + xScale()(index);
			const y = padding.top + yScale()(point.value);
			return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
		});

		return pathParts.join(' ');
	});

	// Generate area path for gradient fill
	const areaPath = $derived(() => {
		const data = chartData();
		if (data.length === 0) return '';

		const pathParts = ['M'];
		// Start from bottom left
		pathParts.push(`${padding.left} ${padding.top + plotHeight}`);

		// Draw line to first point
		pathParts.push(`L ${padding.left + xScale()(0)} ${padding.top + yScale()(data[0].value)}`);

		// Draw the line
		data.forEach((point, index) => {
			if (index > 0) {
				const x = padding.left + xScale()(index);
				const y = padding.top + yScale()(point.value);
				pathParts.push(`L ${x} ${y}`);
			}
		});

		// Close the area
		const lastIndex = data.length - 1;
		pathParts.push(`L ${padding.left + xScale()(lastIndex)} ${padding.top + plotHeight}`);
		pathParts.push('Z');

		return pathParts.join(' ');
	});

	// Y-axis ticks
	const yTicks = $derived(() => {
		const [min, max] = yDomain();
		const tickCount = 5;
		const step = (max - min) / (tickCount - 1);
		return Array.from({ length: tickCount }, (_, i) => min + i * step);
	});

	// Format functions
	function formatValue(value: number, metric: string): string {
		if (metric.includes('sales')) {
			return new Intl.NumberFormat('en-GB', {
				style: 'currency',
				currency: 'GBP',
				maximumFractionDigits: 0
			}).format(value);
		} else if (metric.includes('orders')) {
			return value.toString();
		} else if (metric.includes('efficiency')) {
			return `${value.toFixed(1)} /hr`;
		}
		return value.toString();
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-GB', {
			month: 'short',
			day: 'numeric'
		});
	}

	function getMetricDisplayName(metric: string): string {
		const nameMap: Record<string, string> = {
			total_sales: 'Total Sales',
			amazon_sales: 'Amazon Sales',
			ebay_sales: 'eBay Sales',
			shopify_sales: 'Shopify Sales',
			linnworks_total_orders: 'Total Orders',
			labor_efficiency: 'Labor Efficiency'
		};
		return nameMap[metric] || metric;
	}

	function getTrendIcon(direction: string): string {
		switch (direction) {
			case 'up':
				return '↗';
			case 'down':
				return '↘';
			default:
				return '→';
		}
	}

	function getTrendColor(direction: string): string {
		switch (direction) {
			case 'up':
				return 'text-green-600';
			case 'down':
				return 'text-red-600';
			default:
				return 'text-gray-600';
		}
	}

	// Interactive state
	let hoveredPoint: { index: number; data: any } | null = $state(null);
	let mousePosition = $state({ x: 0, y: 0 });

	function handlePointHover(event: PointerEvent, index: number, data: any) {
		const svg = (event.currentTarget as Element).closest('svg');
		if (svg) {
			const rect = svg.getBoundingClientRect();
			mousePosition = {
				x: event.clientX - rect.left,
				y: event.clientY - rect.top
			};
		}
		hoveredPoint = { index, data };
	}

	function handleMouseLeave() {
		hoveredPoint = null;
	}
</script>

<Card class={cn('w-full', className)}>
	<CardHeader class="pb-4">
		<div class="flex items-center justify-between">
			<div class="space-y-1">
				<CardTitle class="text-xl font-semibold">
					{#if historicalData}
						Historical {getMetricDisplayName(historicalData.metric)} - {historicalData.weekday}s
					{:else}
						Historical Data
					{/if}
				</CardTitle>
				{#if historicalData}
					<p class="text-sm text-muted-foreground">
						Last {historicalData.data.length}
						{historicalData.weekday}s
						<span class="text-xs text-muted-foreground/70">
							(excludes today - data incomplete until end of day)
						</span>
					</p>
				{/if}
			</div>
			{#if onClose}
				<Button variant="outline" size="sm" onclick={onClose}>Close</Button>
			{/if}
		</div>

		<!-- Statistics Cards -->
		{#if historicalData && !loading}
			<div class="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4">
				<div class="bg-muted/50 rounded-lg p-3">
					<div class="text-xs text-muted-foreground">Latest {historicalData.weekday}</div>
					<div class="text-lg font-semibold">
						{formatValue(historicalData.statistics.latest, historicalData.metric)}
					</div>
				</div>
				<div class="bg-muted/50 rounded-lg p-3">
					<div class="text-xs text-muted-foreground">{historicalData.weekday} Average</div>
					<div class="text-lg font-semibold">
						{formatValue(historicalData.statistics.average, historicalData.metric)}
					</div>
				</div>
				<div class="bg-muted/50 rounded-lg p-3">
					<div class="text-xs text-muted-foreground">Overall Trend</div>
					<SignificanceDisplay
						significanceDetails={historicalData.trend.significanceDetails}
						isSignificant={historicalData.trend.isSignificant}
						percentage={historicalData.trend.percentage}
						direction={historicalData.trend.direction}
						compact={true}
					/>
					{#if historicalData.trend.r2}
						<div class="text-xs text-muted-foreground mt-1">
							R² {(historicalData.trend.r2 * 100).toFixed(0)}%
						</div>
					{/if}
				</div>
				<div class="bg-muted/50 rounded-lg p-3">
					<div class="text-xs text-muted-foreground">Week-over-Week</div>
					<div class="text-sm font-medium">
						{historicalData.statistics.weeklyGrowthRate > 0
							? '+'
							: ''}{historicalData.statistics.weeklyGrowthRate.toFixed(1)}%
					</div>
					<div class="text-xs text-muted-foreground">Last 2 {historicalData.weekday}s</div>
				</div>
				<div class="bg-muted/50 rounded-lg p-3">
					<div class="text-xs text-muted-foreground">Monthly Growth</div>
					<div class="text-sm font-medium">
						{historicalData.statistics.monthlyGrowthRate > 0
							? '+'
							: ''}{historicalData.statistics.monthlyGrowthRate.toFixed(1)}%
					</div>
					<div class="text-xs text-muted-foreground">vs 4 {historicalData.weekday}s ago</div>
				</div>
				<div class="bg-muted/50 rounded-lg p-3">
					<div class="text-xs text-muted-foreground">Trend Consistency</div>
					<div class="text-sm font-medium">
						{(historicalData.statistics.consistencyScore * 100).toFixed(0)}%
					</div>
					<div class="text-xs text-muted-foreground">
						{historicalData.statistics.consistencyScore > 0.7
							? 'Very consistent'
							: historicalData.statistics.consistencyScore > 0.5
								? 'Moderately consistent'
								: 'Variable'}
					</div>
				</div>
			</div>

			<!-- Detailed Significance Analysis (if significant) -->
			{#if historicalData.trend.isSignificant && historicalData.trend.significanceDetails}
				<div class="mt-4">
					<SignificanceDisplay
						significanceDetails={historicalData.trend.significanceDetails}
						isSignificant={historicalData.trend.isSignificant}
						percentage={historicalData.trend.percentage}
						direction={historicalData.trend.direction}
						metricName={getMetricDisplayName(historicalData.metric)}
						compact={false}
					/>
				</div>
			{/if}
		{/if}
	</CardHeader>

	<CardContent>
		{#if loading}
			<div class="flex items-center justify-center h-64">
				<div class="flex items-center gap-2">
					<svg
						class="animate-spin h-5 w-5"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					<span>Loading historical data...</span>
				</div>
			</div>
		{:else if error}
			<div class="text-center py-8">
				<p class="text-red-600">Error: {error}</p>
			</div>
		{:else if !historicalData || chartData().length === 0}
			<div class="text-center py-8 text-muted-foreground">
				<p>No historical data available</p>
			</div>
		{:else}
			<!-- Line Chart -->
			<div class="relative">
				<svg
					width={chartWidth}
					height={chartHeight}
					class="border rounded-lg bg-background"
					onmouseleave={handleMouseLeave}
					role="img"
					aria-label="Historical line chart showing {historicalData.weekday} data for {getMetricDisplayName(
						historicalData.metric
					)}"
				>
					<!-- Gradient Definition -->
					<defs>
						<linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0.3" />
							<stop offset="100%" style="stop-color:#3b82f6;stop-opacity:0.05" />
						</linearGradient>
					</defs>

					<!-- Grid lines -->
					{#each yTicks() as tick}
						{@const y = padding.top + yScale()(tick)}
						<line
							x1={padding.left}
							y1={y}
							x2={padding.left + plotWidth}
							y2={y}
							stroke="currentColor"
							stroke-width="0.5"
							opacity="0.1"
						/>
					{/each}

					<!-- Y-axis -->
					<line
						x1={padding.left}
						y1={padding.top}
						x2={padding.left}
						y2={padding.top + plotHeight}
						stroke="currentColor"
						stroke-width="1"
						opacity="0.3"
					/>

					<!-- Y-axis labels -->
					{#each yTicks() as tick}
						{@const y = padding.top + yScale()(tick)}
						<text
							x={padding.left - 10}
							y={y + 4}
							text-anchor="end"
							class="text-xs fill-muted-foreground"
						>
							{formatValue(tick, historicalData.metric)}
						</text>
					{/each}

					<!-- X-axis -->
					<line
						x1={padding.left}
						y1={padding.top + plotHeight}
						x2={padding.left + plotWidth}
						y2={padding.top + plotHeight}
						stroke="currentColor"
						stroke-width="1"
						opacity="0.3"
					/>

					<!-- Area fill -->
					<path d={areaPath()} fill="url(#areaGradient)" />

					<!-- Line -->
					<path
						d={linePath()}
						fill="none"
						stroke="#3b82f6"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>

					<!-- Data points -->
					{#each chartData() as point, index}
						{@const x = padding.left + xScale()(index)}
						{@const y = padding.top + yScale()(point.value)}
						<circle
							cx={x}
							cy={y}
							r="4"
							fill={point.isCurrentWeek ? '#3b82f6' : '#ffffff'}
							stroke="#3b82f6"
							stroke-width="2"
							class="cursor-pointer hover:r-6 transition-all"
							onpointerenter={(e) => handlePointHover(e, index, point)}
						/>
						{#if point.isCurrentWeek}
							<circle
								cx={x}
								cy={y}
								r="8"
								fill="none"
								stroke="#3b82f6"
								stroke-width="2"
								stroke-dasharray="2,2"
								opacity="0.5"
							/>
						{/if}
					{/each}

					<!-- X-axis labels -->
					{#each chartData() as point, index}
						{@const x = padding.left + xScale()(index)}
						<text
							{x}
							y={padding.top + plotHeight + 20}
							text-anchor="middle"
							class="text-xs fill-muted-foreground"
							transform="rotate(-45, {x}, {padding.top + plotHeight + 20})"
						>
							{formatDate(point.date)}
						</text>
					{/each}
				</svg>

				<!-- Tooltip -->
				{#if hoveredPoint}
					<div
						class="absolute bg-background border border-border rounded-lg shadow-lg p-3 pointer-events-none z-10"
						style="left: {mousePosition.x + 10}px; top: {mousePosition.y - 10}px;"
					>
						<div class="font-medium text-sm">
							{formatDate(hoveredPoint.data.date)}
						</div>
						<div class="text-xs text-muted-foreground">
							Week {hoveredPoint.data.weekNumber}
							{#if hoveredPoint.data.isCurrentWeek}
								<Badge variant="outline" class="ml-1 text-xs">Current</Badge>
							{/if}
						</div>
						<div class="font-semibold">
							{formatValue(hoveredPoint.data.value, historicalData.metric)}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Seasonal Trend Analysis -->
		{#if historicalData && !loading}
			<div class="mt-4 space-y-3">
				<!-- Controls -->
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-4">
						<div class="flex items-center gap-2">
							<span class="text-sm font-medium">Seasonal Analysis:</span>
							<button
								class="px-2 py-1 text-xs rounded {showSeasonalAnalysis
									? 'bg-blue-100 text-blue-700'
									: 'bg-gray-100 text-gray-600'}"
								onclick={() => (showSeasonalAnalysis = !showSeasonalAnalysis)}
								aria-label="Toggle seasonal analysis visibility"
							>
								{showSeasonalAnalysis ? 'Hide' : 'Show'}
							</button>
						</div>
					</div>
				</div>

				<!-- Seasonal Analysis Results -->
				{#if seasonalAnalysis() && showSeasonalAnalysis}
					{@const analysis = seasonalAnalysis()}
					{#if analysis}
						<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
							<div class="flex items-center gap-2 mb-2">
								<span class="text-sm font-medium">Weekday Seasonal Trend Analysis:</span>
								<Badge
									variant={analysis.overallTrend === 'up'
										? 'default'
										: analysis.overallTrend === 'down'
											? 'destructive'
											: 'secondary'}
								>
									{analysis.overallTrend === 'up'
										? '↗ Trending Up'
										: analysis.overallTrend === 'down'
											? '↘ Trending Down'
											: '→ Stable'}
								</Badge>
								{#if analysis.seasonalityDetected}
									<Badge variant="outline" class="text-xs">📊 Pattern Detected</Badge>
								{/if}
							</div>

							<div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
								<!-- Trend Analysis -->
								<div class="space-y-2">
									<h4 class="font-medium text-sm">Overall Trend</h4>
									<div class="space-y-1">
										<p>
											<strong>Direction:</strong>
											{analysis.overallTrend === 'up'
												? 'Growing'
												: analysis.overallTrend === 'down'
													? 'Declining'
													: 'Stable'}
										</p>
										<p>
											<strong>Strength:</strong>
											{(analysis.trendStrength * 100).toFixed(1)}% -
											{analysis.trendStrength > 0.15
												? 'Strong'
												: analysis.trendStrength > 0.08
													? 'Moderate'
													: 'Weak'}
										</p>
										<p>
											<strong>Consistency:</strong>
											{(analysis.consistency * 100).toFixed(0)}% -
											{analysis.consistency > 0.8
												? 'Very consistent'
												: analysis.consistency > 0.6
													? 'Moderately consistent'
													: 'Variable'}
										</p>
									</div>
								</div>

								<!-- Period Comparison -->
								<div class="space-y-2">
									<h4 class="font-medium text-sm">Recent vs Historical</h4>
									<div class="space-y-1">
										<p>
											<strong>Recent vs Previous:</strong>
											<span
												class={analysis.periodOverPeriod.direction === 'up'
													? 'text-green-600'
													: analysis.periodOverPeriod.direction === 'down'
														? 'text-red-600'
														: 'text-gray-600'}
											>
												{analysis.periodOverPeriod.changePercent > 0
													? '+'
													: ''}{analysis.periodOverPeriod.changePercent.toFixed(1)}%
											</span>
										</p>
										<p>
											<strong>Latest Value:</strong>
											{formatValue(analysis.periodOverPeriod.currentValue, historicalData.metric)}
										</p>
										<p>
											<strong>Comparison Value:</strong>
											{formatValue(
												analysis.periodOverPeriod.previousPeriodValue,
												historicalData.metric
											)}
										</p>
									</div>
								</div>

								<!-- Seasonality -->
								{#if analysis.seasonalityDetected}
									<div class="space-y-2">
										<h4 class="font-medium text-sm">Weekly Patterns</h4>
										<div class="space-y-1">
											<p>
												<strong>Pattern Strength:</strong>
												{(analysis.seasonalStrength * 100).toFixed(1)}%
											</p>
											{#if analysis.cyclePeriod}
												<p>
													<strong>Detected Cycle:</strong>
													{analysis.cyclePeriod}
													{historicalData.weekday}s pattern
												</p>
											{/if}
										</div>
									</div>
								{/if}

								<!-- Volatility -->
								<div class="space-y-2">
									<h4 class="font-medium text-sm">Data Quality</h4>
									<div class="space-y-1">
										<p>
											<strong>Volatility:</strong>
											{(analysis.volatility * 100).toFixed(1)}% -
											{analysis.volatility < 0.1
												? 'Low'
												: analysis.volatility < 0.3
													? 'Moderate'
													: 'High'}
										</p>
										<p>
											<strong>Confidence:</strong>
											{(analysis.confidence * 100).toFixed(0)}%
										</p>
									</div>
								</div>
							</div>

							<!-- Summary Insights -->
							<div class="mt-3 pt-3 border-t border-blue-200">
								<p class="text-sm text-gray-700">
									<strong>Key Insights:</strong>
									{analysis.summary}
								</p>
							</div>
						</div>
					{/if}
				{/if}
			</div>
		{/if}
	</CardContent>
</Card>
