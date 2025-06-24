<!--
Enhanced Significance Display Component
Focuses on business-friendly communication with progressive disclosure
-->
<script lang="ts">
	import { Badge } from '$lib/shadcn/components';
	import { Button } from '$lib/shadcn/components';
	import { cn } from '$lib/shadcn/utils/index.js';
	import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '$lib/shadcn/ui/tooltip';
	import type { EnhancedSignificanceResult } from '$lib/services/enhancedSignificanceAnalyzer';

	interface Props {
		result: EnhancedSignificanceResult | null;
		metricName?: string;
		metricValue?: number;
		class?: string;
		compact?: boolean;
		showTechnicalDetails?: boolean;
		rawData?: Array<{ week: string; value: number }>;
		timeRange?: string; // e.g., "12 weeks", "18 weeks", "24 weeks"
	}

	let {
		result,
		metricName = 'Metric',
		metricValue,
		class: className = '',
		compact = false,
		showTechnicalDetails = false,
		rawData = [],
		timeRange
	}: Props = $props();

	let showDetails = $state(false);

	// Computed values for display
	const significanceColor = $derived(() => {
		if (!result) return 'text-gray-500';
		switch (result.significance) {
			case 'substantial':
				return 'text-red-600';
			case 'moderate':
				return 'text-orange-600';
			case 'minimal':
				return 'text-yellow-600';
			default:
				return 'text-gray-500';
		}
	});

	const significanceBadge = $derived(() => {
		if (!result) return { variant: 'secondary' as const, text: 'No Data' };
		switch (result.significance) {
			case 'substantial':
				return { variant: 'destructive' as const, text: 'Action Required' };
			case 'moderate':
				return { variant: 'default' as const, text: 'Needs Attention' };
			case 'minimal':
				return { variant: 'secondary' as const, text: 'Minor Change' };
			default:
				return { variant: 'outline' as const, text: 'Normal Variation' };
		}
	});

	const urgencyIndicator = $derived(() => {
		if (!result) return null;
		const urgency = result.business.urgency;
		if (urgency === 'high') return '🔴';
		if (urgency === 'medium') return '🟡';
		return '🟢';
	});

	function formatMetricValue(value: number, metric: string): string {
		if (metric.toLowerCase().includes('sales')) {
			return new Intl.NumberFormat('en-GB', {
				style: 'currency',
				currency: 'GBP',
				maximumFractionDigits: 0
			}).format(value);
		} else if (metric.toLowerCase().includes('orders')) {
			return `${value.toLocaleString()} orders`;
		} else if (metric.toLowerCase().includes('efficiency')) {
			return `${value.toFixed(1)}/hr`;
		}
		return value.toLocaleString();
	}

	function getConfidenceText(confidence: number): string {
		if (confidence >= 0.9) return 'Very High';
		if (confidence >= 0.8) return 'High';
		if (confidence >= 0.6) return 'Moderate';
		if (confidence >= 0.4) return 'Low';
		return 'Very Low';
	}

	// Extract trend information from primary message
	const trendInfo = $derived(() => {
		if (!result?.insights.primaryMessage) return null;

		const message = result.insights.primaryMessage;
		const percentageMatch = message.match(/(\d+\.?\d*)%/);
		const directionMatch = message.match(/(increased|decreased|changed)/i);

		if (!percentageMatch || !directionMatch) return null;

		const percentage = parseFloat(percentageMatch[1]);
		const direction = directionMatch[1].toLowerCase();

		return {
			percentage,
			direction,
			displayText:
				direction === 'increased'
					? `+${percentage}%`
					: direction === 'decreased'
						? `-${percentage}%`
						: `${percentage}%`,
			arrow: direction === 'increased' ? '↗' : direction === 'decreased' ? '↘' : '→',
			colorClass:
				direction === 'increased'
					? 'text-green-600'
					: direction === 'decreased'
						? 'text-red-600'
						: 'text-gray-600'
		};
	});

	// Check if a finding is the Change magnitude metric
	function isChangeMagnitudeFinding(finding: string): boolean {
		return finding.includes('Change magnitude:');
	}

	// Check if a finding is the Analysis confidence metric
	function isAnalysisConfidenceFinding(finding: string): boolean {
		return finding.includes('Analysis confidence:');
	}

	// Check if a finding is the Significance type metric
	function isSignificanceTypeFinding(finding: string): boolean {
		return finding.includes('Significance type:');
	}

	// Get tooltip text for Change magnitude
	function getChangeMagnitudeTooltip(): string {
		return 'Change magnitude shows the absolute percentage change in the metric over the analyzed period. Classifications: ≥15% = Substantial, ≥5% = Moderate, ≥2% = Minimal, <2% = Normal variation.';
	}

	// Get tooltip text for Analysis confidence
	function getAnalysisConfidenceTooltip(): string {
		return 'Analysis confidence is a composite score that combines statistical significance, trend consistency, and volatility analysis. Higher values indicate greater confidence that the observed change is meaningful rather than random variation.';
	}

	// Get expanded explanation for significance type
	function getExpandedSignificanceType(finding: string): string {
		if (!finding.includes('Significance type:')) return finding;

		const type = finding.split('Significance type:')[1]?.trim();

		switch (type) {
			case 'statistical':
				return 'Significance type: Statistical evidence - Change detected through rigorous statistical testing';
			case 'trend':
				return 'Significance type: Trend pattern - Consistent directional change detected over multiple periods';
			case 'practical':
				return 'Significance type: Practical threshold - Change exceeds business-defined significance levels';
			case 'volatility':
				return 'Significance type: Volatility anomaly - Change is unusually large compared to historical variation';
			case 'combined':
				return 'Significance type: Multiple indicators - Change confirmed by both statistical tests and trend analysis';
			default:
				return finding;
		}
	}

	// Computed values for best and worst weeks
	const bestAndWorstWeeks = $derived(() => {
		if (!rawData || rawData.length === 0) return null;

		const sortedData = [...rawData].sort((a, b) => b.value - a.value);
		const best = sortedData[0];
		const worst = sortedData[sortedData.length - 1];

		return {
			best: {
				week: best.week,
				value: formatMetricValue(best.value, metricName)
			},
			worst: {
				week: worst.week,
				value: formatMetricValue(worst.value, metricName)
			},
			dataPointsCount: rawData.length
		};
	});
</script>

{#if !result}
	<div class={cn('text-sm text-muted-foreground', className)}>
		No significance analysis available
	</div>
{:else if compact}
	<!-- Compact View -->
	<div class={cn('flex flex-col gap-1', className)}>
		<!-- Display trend information only -->
		{#if trendInfo()}
			{@const trend = trendInfo()!}
			<div class="flex items-center gap-1">
				<span class={cn('text-sm font-semibold', trend.colorClass)}>
					{trend.displayText}
				</span>
				<span class="text-xs text-muted-foreground">
					{trend.arrow}
				</span>
			</div>
		{/if}
	</div>
{:else}
	<!-- Full Display -->
	<TooltipProvider>
		<div class={cn('space-y-4', className)}>
			<!-- Primary Assessment -->
			<div class="flex items-start justify-between">
				<div class="space-y-2">
					<!-- Primary Message -->
					<p class="text-base font-semibold text-gray-900 max-w-2xl">
						{result.insights.primaryMessage}
					</p>
				</div>

				{#if metricValue}
					<div class="text-right">
						<div class="text-sm text-muted-foreground">Last Week</div>
						<div class="text-lg font-semibold">
							{formatMetricValue(metricValue, metricName)}
						</div>
					</div>
				{/if}
			</div>

			<!-- Key Findings -->
			{#if result.insights.keyFindings.length > 0}
				<div class="space-y-2">
					<h4 class="text-sm font-medium text-gray-900">Statistical Analysis</h4>
					<div class="bg-gray-50 rounded-lg p-3">
						<ul class="space-y-2">
							{#each result.insights.keyFindings as finding}
								<li class="flex items-start gap-2 text-sm text-gray-700">
									<span class="text-blue-600 font-bold mt-0.5">📊</span>
									{#if isChangeMagnitudeFinding(finding)}
										<Tooltip>
											<TooltipTrigger
												class="cursor-help underline decoration-dotted underline-offset-2"
											>
												{finding}
											</TooltipTrigger>
											<TooltipContent class="max-w-xs" arrowClasses="">
												<p class="text-sm">
													{getChangeMagnitudeTooltip()}
												</p>
											</TooltipContent>
										</Tooltip>
									{:else if isAnalysisConfidenceFinding(finding)}
										<Tooltip>
											<TooltipTrigger
												class="cursor-help underline decoration-dotted underline-offset-2"
											>
												{finding}
											</TooltipTrigger>
											<TooltipContent class="max-w-xs" arrowClasses="">
												<p class="text-sm">
													{getAnalysisConfidenceTooltip()}
												</p>
											</TooltipContent>
										</Tooltip>
									{:else if isSignificanceTypeFinding(finding)}
										<span>{getExpandedSignificanceType(finding)}</span>
									{:else}
										<span>{finding}</span>
									{/if}
								</li>
							{/each}

							<!-- Best and Worst Weeks -->
							{#if bestAndWorstWeeks()}
								{@const weeks = bestAndWorstWeeks()!}
								<li class="flex items-start gap-2 text-sm text-gray-700">
									<span class="text-green-600 font-bold mt-0.5">📈</span>
									<span
										><strong>Best week{timeRange ? ` (${timeRange})` : ''}:</strong>
										{weeks.best.week} ({weeks.best.value})</span
									>
								</li>
								<li class="flex items-start gap-2 text-sm text-gray-700">
									<span class="text-red-600 font-bold mt-0.5">📉</span>
									<span
										><strong>Worst week{timeRange ? ` (${timeRange})` : ''}:</strong>
										{weeks.worst.week} ({weeks.worst.value})</span
									>
								</li>
							{/if}
						</ul>
					</div>
				</div>
			{/if}

			<!-- Technical Details Toggle -->
			{#if showTechnicalDetails}
				<div class="border-t pt-3">
					<Button
						variant="ghost"
						size="sm"
						class="text-xs"
						onclick={() => (showDetails = !showDetails)}
					>
						{showDetails ? 'Hide' : 'Show'} Technical Details
					</Button>

					{#if showDetails}
						<div class="mt-3 bg-gray-50 rounded-lg p-3 space-y-3">
							<!-- Statistical Details -->
							<div>
								<h5 class="text-xs font-medium text-gray-700 mb-1">Statistical Analysis</h5>
								<div class="space-y-2 text-xs text-gray-600">
									<div class="grid grid-cols-1 gap-2">
										<div class="flex justify-between items-center">
											<span class="font-medium">Analysis Method:</span>
											<span
												>{result.statistical.method === 'welch-t'
													? 'Advanced t-test (unequal variances)'
													: result.statistical.method === 'mann-whitney'
														? 'Non-parametric rank test'
														: result.statistical.method === 'bootstrap'
															? 'Resampling analysis'
															: result.statistical.method === 'bayesian'
																? 'Bayesian inference'
																: result.statistical.method}</span
											>
										</div>
										<div class="text-xs text-gray-500">
											{result.statistical.method === 'welch-t'
												? 'Robust test that handles data with different variability'
												: result.statistical.method === 'mann-whitney'
													? 'Distribution-free test, good for non-normal data'
													: result.statistical.method === 'bootstrap'
														? 'Uses resampling to estimate reliability'
														: result.statistical.method === 'bayesian'
															? 'Incorporates prior knowledge and uncertainty'
															: 'Standard statistical test'}
										</div>
									</div>

									<div class="grid grid-cols-1 gap-2">
										<div class="flex justify-between items-center">
											<span class="font-medium">Reliability Score:</span>
											<span
												>{(result.statistical.pValue * 100).toFixed(1)}% chance of false positive</span
											>
										</div>
										<div class="text-xs text-gray-500">
											{result.statistical.pValue <= 0.01
												? 'Very strong evidence of real change'
												: result.statistical.pValue <= 0.05
													? 'Strong evidence of real change'
													: result.statistical.pValue <= 0.1
														? 'Moderate evidence of change'
														: 'Weak evidence - could be random variation'}
										</div>
									</div>

									<div class="grid grid-cols-1 gap-2">
										<div class="flex justify-between items-center">
											<span class="font-medium">Change Strength:</span>
											<span
												>{result.statistical.effectSize >= 0.8
													? 'Large'
													: result.statistical.effectSize >= 0.5
														? 'Medium'
														: result.statistical.effectSize >= 0.2
															? 'Small'
															: 'Very Small'}
												({result.statistical.effectSize.toFixed(3)})</span
											>
										</div>
										<div class="text-xs text-gray-500">
											{result.statistical.effectSize >= 0.8
												? 'Practically significant - noticeable business impact'
												: result.statistical.effectSize >= 0.5
													? 'Moderate impact - worth monitoring'
													: result.statistical.effectSize >= 0.2
														? 'Small but measurable difference'
														: 'Minimal practical difference'}
										</div>
									</div>

									<div class="grid grid-cols-1 gap-2">
										<div class="flex justify-between items-center">
											<span class="font-medium">Detection Confidence:</span>
											<span
												>{(result.statistical.powerAnalysis * 100).toFixed(1)}% likely to catch real
												changes</span
											>
										</div>
										<div class="text-xs text-gray-500">
											{result.statistical.powerAnalysis >= 0.8
												? 'Excellent - reliably detects true changes'
												: result.statistical.powerAnalysis >= 0.6
													? 'Good - catches most real changes'
													: result.statistical.powerAnalysis >= 0.4
														? 'Fair - may miss some changes'
														: 'Low - high chance of missing real changes'}
										</div>
									</div>
								</div>
							</div>

							<!-- Time Series Details -->
							{#if result.timeSeries.autocorrelationDetected || result.timeSeries.seasonallyAdjusted}
								<div>
									<h5 class="text-xs font-medium text-gray-700 mb-1">Time Series Analysis</h5>
									<div class="text-xs text-gray-600 space-y-1">
										{#if result.timeSeries.autocorrelationDetected}
											<div>• Autocorrelation detected and adjusted for</div>
										{/if}
										{#if result.timeSeries.seasonallyAdjusted}
											<div>• Seasonal patterns adjusted</div>
										{/if}
										{#if result.timeSeries.changePoints.length > 0}
											<div>• {result.timeSeries.changePoints.length} change points detected</div>
										{/if}
									</div>
								</div>
							{/if}

							<!-- Diagnostics -->
							{#if result.technical.diagnostics.length > 0}
								<div>
									<h5 class="text-xs font-medium text-gray-700 mb-1">Diagnostics</h5>
									<ul class="text-xs text-gray-600 space-y-1">
										{#each result.technical.diagnostics as diagnostic}
											<li>• {diagnostic}</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</TooltipProvider>
{/if}
