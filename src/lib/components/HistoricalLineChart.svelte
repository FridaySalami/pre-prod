<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '$lib/shadcn/components';
	import { cn } from '$lib/shadcn/utils/index.js';
	import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '$lib/shadcn/ui/tooltip';
	import SignificanceDisplay from './SignificanceDisplay.svelte';
	import EnhancedSignificanceDisplay from './EnhancedSignificanceDisplay.svelte';
	import { SeasonalTrendService } from '$lib/services/seasonalTrendService';
	import { PdfExportService } from '$lib/services/pdfExportService';
	import type { HistoricalDataResponse } from '$lib/types/historicalData';
	import type { SignificanceResult } from '$lib/services/significanceAnalyzer';
	import type { EnhancedSignificanceResult } from '$lib/services/enhancedSignificanceAnalyzer';

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

	// Check if we have sufficient data for significance analysis
	const hasSufficientDataForSignificance = $derived(() => {
		return chartData().length >= 12;
	});

	// Convert basic SignificanceResult to EnhancedSignificanceResult for better UX
	function convertToEnhancedResult(
		basicResult: SignificanceResult | undefined,
		percentage: number | undefined,
		direction: string | undefined,
		metricName: string
	): EnhancedSignificanceResult | null {
		if (!basicResult || !percentage || !direction) return null;

		// Determine significance level based on percentage change
		let significance: 'none' | 'minimal' | 'moderate' | 'substantial' = 'none';
		let urgency: 'low' | 'medium' | 'high' = 'low';
		let impactLevel: 'low' | 'medium' | 'high' = 'low';

		const absPercentage = Math.abs(percentage);
		if (absPercentage >= 15) {
			significance = 'substantial';
			urgency = 'high';
			impactLevel = 'high';
		} else if (absPercentage >= 5) {
			significance = 'moderate';
			urgency = 'medium';
			impactLevel = 'medium';
		} else if (absPercentage >= 2) {
			significance = 'minimal';
			urgency = 'low';
			impactLevel = 'low';
		}

		// Generate business-friendly messages
		const directionText =
			direction === 'up' ? 'increased' : direction === 'down' ? 'decreased' : 'changed';
		const primaryMessage = `${metricName} has ${directionText} by ${Math.abs(percentage).toFixed(1)}%.`;

		let businessMeaning = '';
		if (significance === 'substantial') {
			businessMeaning = `This represents a ${direction === 'up' ? 'significant improvement' : 'concerning decline'}.`;
		} else if (significance === 'moderate') {
			businessMeaning = `This change is ${direction === 'up' ? 'positive' : 'negative'} and warrants monitoring and potential intervention.`;
		} else {
			businessMeaning =
				'This represents normal business variation that should be monitored as part of regular operations.';
		}

		// Generate recommendations
		const recommendations = [];
		if (significance === 'substantial') {
			if (direction === 'down') {
				recommendations.push({
					action: 'Investigate root causes and implement corrective measures',
					priority: 'high' as const,
					timeframe: 'immediate' as const
				});
			} else {
				recommendations.push({
					action: 'Analyze success factors and scale successful strategies',
					priority: 'medium' as const,
					timeframe: 'short-term' as const
				});
			}
		} else if (significance === 'moderate') {
			recommendations.push({
				action: 'Monitor trend closely and prepare contingency plans',
				priority: 'medium' as const,
				timeframe: 'short-term' as const
			});
		}

		return {
			significance,
			confidence: basicResult.confidence,
			actionRequired: significance === 'substantial',
			statistical: {
				isSignificant: basicResult.isSignificant,
				method: 'welch-t', // Default method since we don't have it in basic result
				pValue: basicResult.metrics.pValue || 0.05,
				effectSize: Math.abs(percentage) / 100, // Convert percentage to effect size
				powerAnalysis: 0.8 // Default assumption
			},
			business: {
				impactLevel,
				businessMeaning,
				urgency,
				contextualFactors: []
			},
			insights: {
				primaryMessage,
				keyFindings: [
					`Analysis confidence: ${(basicResult.confidence * 100).toFixed(1)}%`,
					`Significance type: ${getExpandedSignificanceType(basicResult.significanceType)}`,
					...(basicResult.reasons || [])
				],
				recommendations
			},
			timeSeries: {
				trendSignificance: basicResult.isSignificant,
				autocorrelationDetected: false,
				seasonallyAdjusted: basicResult.metrics.seasonalityAdjusted || false,
				changePoints: []
			},
			technical: {
				rawMetrics: {
					pValue: basicResult.metrics.pValue || 0.05,
					confidence: basicResult.confidence,
					zScore: basicResult.metrics.zScore || 0,
					percentageChange: basicResult.metrics.percentageChange,
					volatilityScore: basicResult.metrics.volatilityScore || 0
				},
				assumptionChecks: {
					normalityTest: true, // Default assumption
					homoscedasticity: true,
					independence: true
				},
				diagnostics: basicResult.recommendations || []
			}
		};
	}

	// Enhanced significance results for better UX
	const enhancedTrendResult = $derived(() => {
		if (!historicalData?.trend) return null;
		return convertToEnhancedResult(
			historicalData.trend.significanceDetails,
			historicalData.trend.percentage,
			historicalData.trend.direction,
			getMetricDisplayName(historicalData.metric)
		);
	});

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

	// Peak and valley detection for color coding
	const peaksAndValleys = $derived(() => {
		const data = chartData();
		if (data.length < 3) return data.map(() => ({ type: 'normal' }));

		const points = data.map((d, index) => {
			if (index === 0 || index === data.length - 1) {
				// First and last points are neither peaks nor valleys
				return { type: 'normal' };
			}

			const prevValue = data[index - 1].value;
			const currentValue = d.value;
			const nextValue = data[index + 1].value;

			// Check if it's a peak (higher than both neighbors)
			if (currentValue > prevValue && currentValue > nextValue) {
				return { type: 'peak' };
			}
			// Check if it's a valley (lower than both neighbors)
			else if (currentValue < prevValue && currentValue < nextValue) {
				return { type: 'valley' };
			}
			// Normal point
			else {
				return { type: 'normal' };
			}
		});

		return points;
	});

	// Function to get point color based on peak/valley status
	function getPointColor(index: number): { fill: string; stroke: string } {
		const pointType = peaksAndValleys()[index]?.type || 'normal';

		switch (pointType) {
			case 'peak':
				return { fill: '#ef4444', stroke: '#dc2626' }; // Red for peaks
			case 'valley':
				return { fill: '#3b82f6', stroke: '#2563eb' }; // Blue for valleys
			default:
				return { fill: '#ffffff', stroke: '#3b82f6' }; // Default blue (matching HistoricalLineChart theme)
		}
	}

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

	// Expand significance type with detailed explanation
	function getExpandedSignificanceType(type: string): string {
		switch (type) {
			case 'statistical':
				return 'Statistical evidence - Change detected through rigorous statistical testing';
			case 'trend':
				return 'Trend pattern - Consistent directional change detected over multiple periods';
			case 'practical':
				return 'Practical threshold - Change exceeds business-defined significance levels';
			case 'volatility':
				return 'Volatility anomaly - Change is unusually large compared to historical variation';
			case 'combined':
				return 'Multiple indicators - Change confirmed by both statistical tests and trend analysis';
			default:
				return type;
		}
	}

	// Interactive state
	let hoveredPoint: { index: number; data: any } | null = $state(null);
	let mousePosition = $state({ x: 0, y: 0 });
	let isExportingPdf = $state(false);

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

	// PDF Export functionality
	async function exportToPdf() {
		if (!historicalData) return;

		isExportingPdf = true;
		try {
			// Find the chart container element
			const chartContainer = document.querySelector('.historical-chart-container') as HTMLElement;
			if (!chartContainer) {
				throw new Error('Chart container not found');
			}

			// Prepare data for export
			const data = chartData();
			const enhanced = enhancedTrendResult();

			// Get the time range text
			const timeRange = `${data.length} ${historicalData.weekday}s`;

			// Prepare statistical analysis
			const statisticalAnalysis = enhanced
				? {
						primaryMessage: enhanced.insights.primaryMessage,
						keyFindings: enhanced.insights.keyFindings,
						bestWeek: bestAndWorstWeeks()
							? {
									week: bestAndWorstWeeks()!.best.week,
									value: bestAndWorstWeeks()!.best.value
								}
							: undefined,
						worstWeek: bestAndWorstWeeks()
							? {
									week: bestAndWorstWeeks()!.worst.week,
									value: bestAndWorstWeeks()!.worst.value
								}
							: undefined
					}
				: undefined;

			await PdfExportService.exportToPdf({
				title: `${historicalData.weekday} ${getMetricDisplayName(historicalData.metric)} Analysis`,
				subtitle: `Historical ${historicalData.weekday} performance analysis`,
				timeRange: timeRange,
				metricName: getMetricDisplayName(historicalData.metric),
				chartElement: chartContainer,
				data: data.map((point) => ({
					week: `Week ${point.weekNumber}`,
					value: point.value,
					weekStartDate: point.date
				})),
				statisticalAnalysis
			});
		} catch (error) {
			console.error('PDF export failed:', error);
			// You could add a toast notification here
		} finally {
			isExportingPdf = false;
		}
	}

	// Helper function to get best and worst weeks
	function bestAndWorstWeeks() {
		const data = chartData();
		if (data.length === 0) return null;

		const sortedData = [...data].sort((a, b) => b.value - a.value);
		const best = sortedData[0];
		const worst = sortedData[sortedData.length - 1];

		return {
			best: {
				week: `Week ${best.weekNumber}, ${new Date(best.date).getFullYear()}`,
				value: formatValue(best.value, historicalData?.metric || '')
			},
			worst: {
				week: `Week ${worst.weekNumber}, ${new Date(worst.date).getFullYear()}`,
				value: formatValue(worst.value, historicalData?.metric || '')
			}
		};
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
			<div class="flex items-center gap-2">
				{#if historicalData && !loading}
					<Button
						variant="outline"
						size="sm"
						onclick={exportToPdf}
						disabled={isExportingPdf}
						class="flex items-center gap-2"
					>
						{#if isExportingPdf}
							<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
							Exporting...
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								></path>
							</svg>
							Export PDF
						{/if}
					</Button>
				{/if}
				{#if onClose}
					<Button variant="outline" size="sm" onclick={onClose}>Close</Button>
				{/if}
			</div>
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
					{#if hasSufficientDataForSignificance()}
						<!-- Use Enhanced Display if we have enhanced result, otherwise fallback -->
						{#if enhancedTrendResult()}
							<EnhancedSignificanceDisplay
								result={enhancedTrendResult()}
								metricName={getMetricDisplayName(historicalData.metric)}
								compact={true}
								rawData={chartData().map((point) => ({
									week: `Week ${point.weekNumber}, ${new Date(point.date).getFullYear()}`,
									value: point.value
								}))}
								timeRange={`${chartData().length} ${historicalData.weekday}s`}
							/>
						{:else}
							<SignificanceDisplay
								significanceDetails={historicalData.trend.significanceDetails}
								isSignificant={historicalData.trend.isSignificant}
								percentage={historicalData.trend.percentage}
								direction={historicalData.trend.direction}
								compact={true}
							/>
						{/if}
						{#if historicalData.trend.r2}
							<div class="text-xs text-muted-foreground mt-1">
								R² {(historicalData.trend.r2 * 100).toFixed(0)}%
							</div>
						{/if}
					{:else}
						<div class="text-sm text-muted-foreground">
							<Badge variant="outline" class="text-xs">Insufficient data</Badge>
						</div>
						<div class="text-xs text-muted-foreground mt-1">
							{12 - chartData().length} more data points needed for trend analysis
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

			<!-- Detailed Significance Analysis (if significant and sufficient data) -->
			{#if hasSufficientDataForSignificance() && historicalData.trend.isSignificant && (historicalData.trend.significanceDetails || enhancedTrendResult())}
				<div class="mt-4">
					{#if enhancedTrendResult()}
						<EnhancedSignificanceDisplay
							result={enhancedTrendResult()}
							metricName={getMetricDisplayName(historicalData.metric)}
							metricValue={historicalData.statistics.latest}
							compact={false}
							showTechnicalDetails={true}
							rawData={chartData().map((point) => ({
								week: `Week ${point.weekNumber}, ${new Date(point.date).getFullYear()}`,
								value: point.value
							}))}
							timeRange={`${chartData().length} ${historicalData.weekday}s`}
						/>
					{:else if historicalData.trend.significanceDetails}
						<SignificanceDisplay
							significanceDetails={historicalData.trend.significanceDetails}
							isSignificant={historicalData.trend.isSignificant}
							percentage={historicalData.trend.percentage}
							direction={historicalData.trend.direction}
							metricName={getMetricDisplayName(historicalData.metric)}
							compact={false}
						/>
					{/if}
				</div>
			{:else if !hasSufficientDataForSignificance()}
				<div class="mt-4 p-4 bg-muted/30 rounded-lg border border-dashed">
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span class="font-medium">Statistical Analysis Pending</span>
					</div>
					<p class="text-xs text-muted-foreground mt-2">
						Reliable trend analysis requires at least 12 data points. Currently showing {chartData()
							.length}
						{historicalData.weekday}s.
						{#if chartData().length > 0}
							Add {12 - chartData().length} more {historicalData.weekday}s to enable significance
							testing.
						{/if}
					</p>
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
			<div class="relative historical-chart-container">
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
						{@const colors = getPointColor(index)}
						<circle
							cx={x}
							cy={y}
							r="4"
							fill={point.isCurrentWeek ? '#3b82f6' : colors.fill}
							stroke={point.isCurrentWeek ? '#3b82f6' : colors.stroke}
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

					<!-- Always visible point value tooltips -->
					{#each chartData() as point, index}
						{@const x = padding.left + xScale()(index)}
						{@const y = padding.top + yScale()(point.value)}
						<g transform="translate({x}, {y - 25})">
							<!-- Tooltip background -->
							<rect
								x="-30"
								y="-14"
								width="60"
								height="24"
								rx="12"
								fill="rgba(255, 255, 255, 0.95)"
								stroke="rgba(59, 130, 246, 0.3)"
								stroke-width="1"
								filter="drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))"
							/>
							<!-- Tooltip text -->
							<text
								x="0"
								y="0"
								text-anchor="middle"
								dominant-baseline="middle"
								class="text-xs fill-gray-700 font-medium"
								style="font-size: 11px;"
							>
								{formatValue(point.value, historicalData.metric)}
							</text>
						</g>
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
