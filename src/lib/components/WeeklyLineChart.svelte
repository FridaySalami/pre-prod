<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '$lib/shadcn/components';
	import { cn } from '$lib/shadcn/utils/index.js';
	import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '$lib/shadcn/ui/tooltip';
	import SignificanceDisplay from './SignificanceDisplay.svelte';
	import EnhancedSignificanceDisplay from './EnhancedSignificanceDisplay.svelte';
	import { SeasonalTrendService } from '$lib/services/seasonalTrendService';
	import { PdfExportService } from '$lib/services/pdfExportService';
	import type { WeeklyDataResponse } from '$lib/types/historicalData';
	import type { SignificanceResult } from '$lib/services/significanceAnalyzer';
	import type { EnhancedSignificanceResult } from '$lib/services/enhancedSignificanceAnalyzer';

	interface Props {
		weeklyData: WeeklyDataResponse | null;
		loading?: boolean;
		error?: string | null;
		class?: string;
		onClose?: () => void;
	}

	let {
		weeklyData,
		loading = false,
		error = null,
		class: className = '',
		onClose
	}: Props = $props();

	// Chart dimensions and styling
	const chartWidth = 900;
	const chartHeight = 400;
	const padding = { top: 20, right: 80, bottom: 80, left: 80 };
	const plotWidth = chartWidth - padding.left - padding.right;
	const plotHeight = chartHeight - padding.top - padding.bottom;

	// Seasonal trend analysis state
	let showSeasonalAnalysis = $state(true);

	// Check if we have sufficient data for significance analysis (13 weeks to get 12 complete)
	const hasSufficientDataForSignificance = $derived(() => {
		return chartData().length >= 12; // We need at least 12 complete weeks for analysis
	});

	// Calculate comprehensive trend over the full period
	function calculateOverallTrend(data: any[]): {
		percentage: number;
		direction: 'up' | 'down' | 'stable';
	} {
		if (data.length < 2) return { percentage: 0, direction: 'stable' };

		// Use linear regression to get overall trend
		const n = data.length;
		const xValues = Array.from({ length: n }, (_, i) => i);
		const yValues = data.map((d) => d.value);

		// Calculate linear regression
		const xMean = xValues.reduce((a, b) => a + b, 0) / n;
		const yMean = yValues.reduce((a, b) => a + b, 0) / n;

		const numerator = xValues.reduce((sum, x, i) => sum + (x - xMean) * (yValues[i] - yMean), 0);
		const denominator = xValues.reduce((sum, x) => sum + Math.pow(x - xMean, 2), 0);

		const slope = numerator / denominator;

		// Calculate start and end values from regression line
		const startValue = yMean + slope * (0 - xMean);
		const endValue = yMean + slope * (n - 1 - xMean);

		// Calculate percentage change
		const percentageChange = ((endValue - startValue) / startValue) * 100;

		// Determine direction
		let direction: 'up' | 'down' | 'stable' = 'stable';
		if (Math.abs(percentageChange) >= 2) {
			direction = percentageChange > 0 ? 'up' : 'down';
		}

		return {
			percentage: Math.abs(percentageChange),
			direction
		};
	}

	// Calculate trend consistency using the actual chart data
	function calculateTrendConsistency(
		data: any[],
		windowSize: number = 3
	): {
		isSignificant: boolean;
		reason: string;
	} {
		if (data.length < windowSize) {
			return { isSignificant: false, reason: '' };
		}

		// Use the last 'windowSize' data points for trend consistency
		const recentData = data.slice(-windowSize);
		const recentValues = recentData.map((d) => d.value);

		console.log('🔍 Trend Analysis Debug:');
		console.log(`- Analyzing last ${windowSize} weeks for trend consistency:`);

		// Calculate week-to-week changes with detailed tracking
		const changes: Array<{
			fromWeek: string;
			toWeek: string;
			fromValue: number;
			toValue: number;
			change: number;
			direction: 'up' | 'down' | 'flat';
			marker: string;
		}> = [];

		for (let i = 1; i < recentValues.length; i++) {
			const fromData = recentData[i - 1];
			const toData = recentData[i];
			const fromValue = recentValues[i - 1];
			const toValue = recentValues[i];
			const change = toValue - fromValue;
			const fromWeek = `Week ${fromData.weekNumber}, ${fromData.year}`;
			const toWeek = `Week ${toData.weekNumber}, ${toData.year}`;

			let direction: 'up' | 'down' | 'flat';
			let marker: string;

			if (change > 0) {
				direction = 'up';
				marker = '📈 HIGHER';
			} else if (change < 0) {
				direction = 'down';
				marker = '📉 LOWER';
			} else {
				direction = 'flat';
				marker = '➡️ FLAT';
			}

			changes.push({
				fromWeek,
				toWeek,
				fromValue,
				toValue,
				change,
				direction,
				marker
			});

			console.log(
				`  ${fromWeek} (£${fromValue.toLocaleString()}) → ${toWeek} (£${toValue.toLocaleString()}): ${marker} (${change > 0 ? '+' : ''}£${Math.abs(change).toLocaleString()})`
			);
		}

		// Analyze the pattern
		const upChanges = changes.filter((c) => c.direction === 'up').length;
		const downChanges = changes.filter((c) => c.direction === 'down').length;
		const flatChanges = changes.filter((c) => c.direction === 'flat').length;
		const totalChanges = upChanges + downChanges;

		console.log(`- Pattern analysis:`);
		console.log(`  📈 UP changes: ${upChanges}`);
		console.log(`  📉 DOWN changes: ${downChanges}`);
		console.log(`  ➡️ FLAT changes: ${flatChanges}`);

		const trendStrength = totalChanges > 0 ? Math.max(upChanges, downChanges) / totalChanges : 0;
		console.log(`  🎯 Trend strength: ${(trendStrength * 100).toFixed(1)}%`);

		// Consider it significant if trend is consistent (>75% in same direction) and we have at least 2 changes
		const isSignificant = trendStrength > 0.75 && totalChanges >= 2;

		let reason = '';
		if (isSignificant) {
			const direction = upChanges > downChanges ? 'upward' : 'downward';
			const consistencyPercent = (trendStrength * 100).toFixed(0);
			reason = `Consistent ${direction} trend over ${windowSize} periods (${consistencyPercent}% consistency)`;

			console.log(`  ✅ SIGNIFICANT: ${reason}`);
		} else {
			console.log(
				`  ❌ NOT SIGNIFICANT: Trend strength ${(trendStrength * 100).toFixed(1)}% is below 75% threshold`
			);
		}

		console.log('---');

		return { isSignificant, reason };
	}

	// Convert basic SignificanceResult to EnhancedSignificanceResult for better UX
	function convertToEnhancedResult(
		basicResult: SignificanceResult | undefined,
		percentage: number | undefined,
		direction: string | undefined,
		metricName: string,
		chartData?: any[]
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
			businessMeaning = `This change is ${direction === 'up' ? 'positive trend' : 'negative trend'} and warrants close monitoring and potential intervention.`;
		} else if (significance === 'minimal') {
			businessMeaning = `This is a ${direction === 'up' ? 'minor improvement' : 'minor decline'} that should be monitored as part of regular business operations.`;
		} else {
			businessMeaning = 'This represents normal business variation within expected ranges.';
		}

		// Generate recommendations
		const recommendations = [];
		if (significance === 'substantial') {
			if (direction === 'down') {
				recommendations.push({
					action:
						'Investigate root causes immediately - analyze operational changes, market conditions, and customer behavior',
					priority: 'high' as const,
					timeframe: 'immediate' as const
				});
				recommendations.push({
					action: 'Implement emergency response plan and monitor daily performance metrics',
					priority: 'high' as const,
					timeframe: 'immediate' as const
				});
			} else {
				recommendations.push({
					action: 'Document and analyze success factors to understand what drove this improvement',
					priority: 'medium' as const,
					timeframe: 'short-term' as const
				});
				recommendations.push({
					action: 'Scale successful strategies across similar business areas or time periods',
					priority: 'medium' as const,
					timeframe: 'short-term' as const
				});
			}
		} else if (significance === 'moderate') {
			recommendations.push({
				action: 'Monitor trend closely with weekly reviews and prepare contingency plans',
				priority: 'medium' as const,
				timeframe: 'short-term' as const
			});
			if (direction === 'down') {
				recommendations.push({
					action: 'Review operational processes and identify potential improvement areas',
					priority: 'medium' as const,
					timeframe: 'long-term' as const
				});
			}
		} else if (significance === 'minimal') {
			recommendations.push({
				action: 'Continue regular monitoring as part of standard business review cycles',
				priority: 'low' as const,
				timeframe: 'long-term' as const
			});
		}

		// Generate contextual factors based on metric type
		const contextualFactors = [];
		if (metricName.toLowerCase().includes('sales')) {
			contextualFactors.push('Market Seasonality', 'Customer Behavior', 'Competitive Activity');
			if (direction === 'down') {
				contextualFactors.push('Economic Conditions', 'Inventory Levels');
			}
		} else if (metricName.toLowerCase().includes('orders')) {
			contextualFactors.push('Conversion Rates', 'Traffic Patterns', 'Fulfillment Capacity');
		} else if (metricName.toLowerCase().includes('efficiency')) {
			contextualFactors.push('Process Changes', 'Staff Training', 'System Updates');
		}

		// Recalculate trend consistency using actual chart data to ensure accuracy
		console.log('🔧 Recalculating Trend Consistency:');
		console.log('- Chart data provided:', !!chartData);
		console.log('- Chart data length:', chartData?.length || 0);

		const recalculatedTrendFindings: string[] = [];
		if (chartData && chartData.length >= 3) {
			console.log('- Calling calculateTrendConsistency with chart data...');
			const trendConsistency = calculateTrendConsistency(chartData);
			if (trendConsistency.isSignificant) {
				console.log('- Adding recalculated trend finding:', trendConsistency.reason);
				recalculatedTrendFindings.push(trendConsistency.reason);
			} else {
				console.log('- No significant trend found in recalculation');
			}
		} else {
			console.log('- Not enough data for trend consistency (need at least 3 points)');
		}
		console.log('---');

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
				contextualFactors
			},
			insights: {
				primaryMessage,
				keyFindings: [
					`Analysis confidence: ${(basicResult.confidence * 100).toFixed(1)}%`,
					`Significance type: ${getExpandedSignificanceType(basicResult.significanceType)}`,
					`Change magnitude: ${Math.abs(percentage).toFixed(1)}% (${absPercentage >= 15 ? 'substantial' : absPercentage >= 5 ? 'moderate' : 'minimal'})`,
					...recalculatedTrendFindings, // Use recalculated trend consistency instead of original
					// Filter out trend-related reasons from original to avoid contradictions
					...(basicResult.reasons?.filter(
						(reason) =>
							!reason.toLowerCase().includes('trend') &&
							!reason.toLowerCase().includes('consistent')
					) || [])
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
		if (!weeklyData?.trend) return null;

		// Use comprehensive trend calculation if we have enough data (12+ complete weeks)
		const data = chartData();
		let trendPercentage = weeklyData.trend.percentage;
		let trendDirection = weeklyData.trend.direction;

		if (data.length >= 12) {
			// Calculate comprehensive trend over all 12+ weeks using linear regression
			const comprehensiveTrend = calculateOverallTrend(data);
			trendPercentage = comprehensiveTrend.percentage;
			trendDirection = comprehensiveTrend.direction;
		}

		return convertToEnhancedResult(
			weeklyData.trend.significanceDetails,
			trendPercentage,
			trendDirection,
			getMetricDisplayName(weeklyData.metric),
			data // Pass the actual chart data for trend consistency recalculation
		);
	});

	// Computed values for chart rendering
	const chartData = $derived(() => {
		if (!weeklyData?.data || weeklyData.data.length === 0) return [];

		// DEBUG: Log chart data
		console.log('📊 Chart Data Debug:');
		console.log('- Raw weeklyData.data:', weeklyData.data);
		console.log('- Processed chart data:');
		weeklyData.data.forEach((d, i) => {
			console.log(
				`  ${i + 1}. Week ${d.weekNumber}, ${d.year}: ${d.value} (isCurrentWeek: ${d.isCurrentWeek})`
			);
		});
		console.log('---');

		return weeklyData.data;
	});

	// Seasonal trend analysis
	const seasonalAnalysis = $derived(() => {
		const data = chartData();
		if (data.length === 0) return null;

		const values = data.map((d) => d.value);
		return SeasonalTrendService.analyzeSeasonalTrend(values, 4); // 4-week cycle
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
				return { fill: '#ffffff', stroke: '#10b981' }; // Default green
		}
	}

	const yDomain = $derived(() => {
		const data = chartData();

		if (data.length === 0) return [0, 100];

		const allValues = data.map((d) => d.value);
		const min = Math.min(...allValues);
		const max = Math.max(...allValues);
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

	function formatWeekRange(weekStart: string, weekEnd: string): string {
		const start = new Date(weekStart);
		const end = new Date(weekEnd);

		const startStr = start.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
		const endStr = end.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });

		return `${startStr} - ${endStr}`;
	}

	function formatWeekLabel(weekStart: string): string {
		const date = new Date(weekStart);
		return `W${getWeekNumber(date)}`;
	}

	function getWeekNumber(date: Date): number {
		const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
		const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
		return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
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
		if (!weeklyData) return;

		isExportingPdf = true;
		try {
			// Find the chart container element
			const chartContainer = document.querySelector('.weekly-chart-container') as HTMLElement;
			if (!chartContainer) {
				throw new Error('Chart container not found');
			}

			// Prepare data for export
			const data = chartData();
			const enhanced = enhancedTrendResult();

			// Get the time range text
			const timeRange = `${data.length} weeks`;

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
				title: `Weekly ${getMetricDisplayName(weeklyData.metric)} Trends`,
				subtitle: `Last ${data.length} weeks analysis (excludes current incomplete week)`,
				timeRange: timeRange,
				metricName: getMetricDisplayName(weeklyData.metric),
				chartElement: chartContainer,
				data: data.map((point) => ({
					week: `W${point.weekNumber}`,
					value: point.value,
					weekStartDate: point.weekStartDate
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
				week: `Week ${best.weekNumber}, ${best.year}`,
				value: formatValue(best.value, weeklyData?.metric || '')
			},
			worst: {
				week: `Week ${worst.weekNumber}, ${worst.year}`,
				value: formatValue(worst.value, weeklyData?.metric || '')
			}
		};
	}

	// Calculate proper monthly growth: last 4 weeks total vs previous 4 weeks total
	const monthlyGrowthRate = $derived(() => {
		const data = chartData();
		if (data.length < 8) return 0; // Need at least 8 weeks to compare two 4-week periods

		// Get the last 4 weeks (most recent complete weeks)
		const last4Weeks = data.slice(-4);
		const last4WeeksTotal = last4Weeks.reduce((sum, week) => sum + week.value, 0);

		// Get the previous 4 weeks (weeks 5-8 from the end)
		const previous4Weeks = data.slice(-8, -4);
		const previous4WeeksTotal = previous4Weeks.reduce((sum, week) => sum + week.value, 0);

		if (previous4WeeksTotal === 0) return 0;

		return ((last4WeeksTotal - previous4WeeksTotal) / previous4WeeksTotal) * 100;
	});
</script>

<Card class={cn('w-full', className)}>
	<CardHeader class="pb-4">
		<div class="flex items-center justify-between">
			<div class="space-y-1">
				<CardTitle class="text-xl font-semibold">
					{#if weeklyData}
						Weekly {getMetricDisplayName(weeklyData.metric)} Trends
					{:else}
						Weekly Data
					{/if}
				</CardTitle>
				{#if weeklyData}
					<p class="text-sm text-muted-foreground">
						Last {weeklyData.data.length} weeks analysis
						<span class="text-xs text-muted-foreground/70">
							(excludes current incomplete week)
						</span>
					</p>
				{/if}
			</div>
			<div class="flex items-center gap-2">
				{#if weeklyData && !loading}
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
		{#if weeklyData && !loading}
			<div class="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4">
				<div class="bg-muted/50 rounded-lg p-3">
					<div class="text-xs text-muted-foreground">Latest Week</div>
					<div class="text-lg font-semibold">
						{formatValue(weeklyData.statistics.latest, weeklyData.metric)}
					</div>
				</div>
				<div class="bg-muted/50 rounded-lg p-3">
					<div class="text-xs text-muted-foreground">Weekly Average</div>
					<div class="text-lg font-semibold">
						{formatValue(weeklyData.statistics.average, weeklyData.metric)}
					</div>
				</div>
				<div class="bg-muted/50 rounded-lg p-3">
					<div class="text-xs text-muted-foreground">Overall Trend</div>
					{#if hasSufficientDataForSignificance()}
						<!-- Use Enhanced Display if we have enhanced result, otherwise fallback -->
						{#if enhancedTrendResult()}
							<EnhancedSignificanceDisplay
								result={enhancedTrendResult()}
								metricName={getMetricDisplayName(weeklyData.metric)}
								compact={true}
								rawData={chartData().map((point) => ({
									week: `Week ${point.weekNumber}, ${point.year}`,
									value: point.value
								}))}
								timeRange={`${chartData().length} weeks`}
							/>
						{:else}
							<SignificanceDisplay
								significanceDetails={weeklyData.trend.significanceDetails}
								isSignificant={weeklyData.trend.isSignificant}
								percentage={weeklyData.trend.percentage}
								direction={weeklyData.trend.direction}
								compact={true}
							/>
						{/if}
						{#if weeklyData.trend.r2}
							<div class="text-xs text-muted-foreground mt-1">
								R² {(weeklyData.trend.r2 * 100).toFixed(0)}%
							</div>
						{/if}
						<div class="text-xs text-muted-foreground mt-1">
							{chartData().length}-week analysis
						</div>
					{:else}
						<div class="text-sm text-muted-foreground">
							<Badge variant="outline" class="text-xs">Insufficient data</Badge>
						</div>
						<div class="text-xs text-muted-foreground mt-1">
							{12 - chartData().length} more weeks needed for trend analysis
						</div>
					{/if}
				</div>
				<div class="bg-muted/50 rounded-lg p-3">
					<div class="text-xs text-muted-foreground">Week-over-Week</div>
					<div class="text-sm font-medium">
						{weeklyData.statistics.weeklyGrowthRate > 0
							? '+'
							: ''}{weeklyData.statistics.weeklyGrowthRate.toFixed(1)}%
					</div>
					<div class="text-xs text-muted-foreground">Last 2 weeks</div>
				</div>
				{#if chartData().length >= 8}
					<div class="bg-muted/50 rounded-lg p-3">
						<div class="text-xs text-muted-foreground">Monthly Growth</div>
						<div class="text-sm font-medium">
							{monthlyGrowthRate() > 0 ? '+' : ''}{monthlyGrowthRate().toFixed(1)}%
						</div>
						<div class="text-xs text-muted-foreground">Last 4 weeks vs previous 4 weeks</div>
					</div>
				{:else}
					<div class="bg-muted/50 rounded-lg p-3">
						<div class="text-xs text-muted-foreground">Monthly Growth</div>
						<div class="text-sm font-medium text-gray-400">N/A</div>
						<div class="text-xs text-muted-foreground">Need 8+ weeks</div>
					</div>
				{/if}
				<div class="bg-muted/50 rounded-lg p-3">
					<div class="text-xs text-muted-foreground">Trend Consistency</div>
					<div class="text-sm font-medium">
						{(weeklyData.statistics.consistencyScore * 100).toFixed(0)}%
					</div>
					<div class="text-xs text-muted-foreground">
						{weeklyData.statistics.consistencyScore > 0.7
							? 'Very consistent'
							: weeklyData.statistics.consistencyScore > 0.5
								? 'Moderately consistent'
								: 'Variable'}
					</div>
				</div>
			</div>

			<!-- Detailed Significance Analysis (if significant and sufficient data) -->
			{#if hasSufficientDataForSignificance() && weeklyData.trend.isSignificant && (weeklyData.trend.significanceDetails || enhancedTrendResult())}
				<div class="mt-4">
					{#if enhancedTrendResult()}
						<EnhancedSignificanceDisplay
							result={enhancedTrendResult()}
							metricName={getMetricDisplayName(weeklyData.metric)}
							metricValue={weeklyData.statistics.latest}
							compact={false}
							showTechnicalDetails={true}
							rawData={chartData().map((point) => ({
								week: `Week ${point.weekNumber}, ${point.year}`,
								value: point.value
							}))}
							timeRange={`${chartData().length} weeks`}
						/>
					{:else if weeklyData.trend.significanceDetails}
						<SignificanceDisplay
							significanceDetails={weeklyData.trend.significanceDetails}
							isSignificant={weeklyData.trend.isSignificant}
							percentage={weeklyData.trend.percentage}
							direction={weeklyData.trend.direction}
							metricName={getMetricDisplayName(weeklyData.metric)}
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
						Reliable trend analysis requires at least 12 weeks of data. Currently showing {chartData()
							.length} weeks.
						{#if chartData().length > 0}
							Add {12 - chartData().length} more weeks to enable significance testing.
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
					<span>Loading weekly data...</span>
				</div>
			</div>
		{:else if error}
			<div class="text-center py-8">
				<p class="text-red-600">Error: {error}</p>
			</div>
		{:else if !weeklyData || chartData().length === 0}
			<div class="text-center py-8 text-muted-foreground">
				<p>No weekly data available</p>
			</div>
		{:else}
			<!-- Line Chart -->
			<div class="relative weekly-chart-container">
				<svg
					width={chartWidth}
					height={chartHeight}
					class="border rounded-lg bg-background"
					onmouseleave={handleMouseLeave}
					role="img"
					aria-label="Weekly line chart showing {getMetricDisplayName(
						weeklyData.metric
					)} trends over {weeklyData.data.length} weeks"
				>
					<!-- Gradient Definition -->
					<defs>
						<linearGradient id="weeklyAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" style="stop-color:#10b981;stop-opacity:0.3" />
							<stop offset="100%" style="stop-color:#10b981;stop-opacity:0.05" />
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
							{formatValue(tick, weeklyData.metric)}
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
					<path d={areaPath()} fill="url(#weeklyAreaGradient)" />

					<!-- Line -->
					<path
						d={linePath()}
						fill="none"
						stroke="#10b981"
						stroke-width="3"
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
							r="5"
							fill={colors.fill}
							stroke={colors.stroke}
							stroke-width="3"
							class="cursor-pointer hover:r-7 transition-all"
							onpointerenter={(e) => handlePointHover(e, index, point)}
						/>
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
								stroke="rgba(16, 185, 129, 0.3)"
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
								{formatValue(point.value, weeklyData.metric)}
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
						>
							W{point.weekNumber}
						</text>
						<text
							{x}
							y={padding.top + plotHeight + 35}
							text-anchor="middle"
							class="text-xs fill-muted-foreground opacity-70"
						>
							{new Date(point.weekStartDate).toLocaleDateString('en-GB', {
								month: 'short',
								day: 'numeric'
							})}
						</text>
					{/each}
				</svg>

				<!-- Tooltip -->
				{#if hoveredPoint}
					<div
						class="absolute bg-background border border-border rounded-lg shadow-lg p-3 pointer-events-none z-10 min-w-48"
						style="left: {mousePosition.x + 10}px; top: {mousePosition.y - 10}px;"
					>
						<div class="font-medium text-sm">
							Week {hoveredPoint.data.weekNumber}, {hoveredPoint.data.year}
						</div>
						<div class="text-xs text-muted-foreground mb-2">
							{formatWeekRange(hoveredPoint.data.weekStartDate, hoveredPoint.data.weekEndDate)}
						</div>
						<div class="space-y-1">
							<div class="flex justify-between">
								<span class="text-xs text-muted-foreground">Total:</span>
								<span class="text-sm font-semibold">
									{formatValue(hoveredPoint.data.value, weeklyData.metric)}
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-xs text-muted-foreground">Daily Avg:</span>
								<span class="text-xs">
									{formatValue(hoveredPoint.data.dailyAverage, weeklyData.metric)}
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-xs text-muted-foreground">Working Days:</span>
								<span class="text-xs">
									{hoveredPoint.data.workingDays}
								</span>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Seasonal Trend Analysis -->
		{#if weeklyData && !loading}
			<div class="mt-4 space-y-3">
				<!-- Controls -->
			</div>
		{/if}

		<!-- Statistical Analysis Information -->
		{#if weeklyData && !loading}
			<div class="mt-6 pt-4 border-t border-muted">
				<div class="text-xs text-muted-foreground space-y-1">
					<p>
						<strong>Statistical Analysis:</strong>
						{#if hasSufficientDataForSignificance()}
							Based on {chartData().length} complete weeks of data with robust statistical testing.
						{:else}
							Requires minimum 12 complete weeks of data for reliable trend analysis ({chartData()
								.length} weeks available).
						{/if}
					</p>
					{#if hasSufficientDataForSignificance()}
						<p>
							Methods include normality testing, autocorrelation analysis, and appropriate
							statistical tests (Welch's t-test, Mann-Whitney U, or Bootstrap methods). Analysis
							excludes the current incomplete week.
						</p>
					{/if}
				</div>
			</div>
		{/if}
	</CardContent>
</Card>
