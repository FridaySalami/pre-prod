<script lang="ts">
	import { Badge } from '$lib/shadcn/components';
	import { cn } from '$lib/shadcn/utils/index.js';

	interface Props {
		significanceDetails: any | null;
		isSignificant: boolean;
		percentage: number;
		direction: 'up' | 'down' | 'stable';
		metricName?: string;
		class?: string;
		compact?: boolean;
	}

	let {
		significanceDetails,
		isSignificant,
		percentage,
		direction,
		metricName = 'Metric',
		class: className = '',
		compact = false
	}: Props = $props();

	// Removed showDetails state since we're not using the toggle anymore

	function getTrendIcon(dir: string): string {
		switch (dir) {
			case 'up':
				return '↗';
			case 'down':
				return '↘';
			default:
				return '→';
		}
	}

	function getTrendColor(dir: string): string {
		switch (dir) {
			case 'up':
				return 'text-green-600';
			case 'down':
				return 'text-red-600';
			default:
				return 'text-gray-600';
		}
	}

	function formatMetricValue(value: number, metric: string): string {
		if (metric.includes('sales')) {
			return new Intl.NumberFormat('en-GB', {
				style: 'currency',
				currency: 'GBP',
				maximumFractionDigits: 0
			}).format(value);
		}
		return value.toLocaleString();
	}

	function getTimePeriodDescription(dataLength: number, isWeekly: boolean = false): string {
		if (isWeekly) {
			return `${dataLength} weeks`;
		} else {
			return `${dataLength} periods`;
		}
	}
</script>

{#if compact}
	<!-- Compact Display -->
	<div class={cn('flex items-center gap-1', className)}>
		<span class={cn('text-sm font-medium flex items-center gap-1', getTrendColor(direction))}>
			{getTrendIcon(direction)}
			{percentage.toFixed(1)}%
		</span>
		{#if isSignificant}
			<Badge variant="secondary" class="text-xs">Significant</Badge>
		{/if}
	</div>
{:else}
	<!-- Plain Text Display -->
	<div class={cn('space-y-3 text-sm', className)}>
		<!-- Main Significance Summary -->
		<div class="flex items-center gap-2">
			<span class={cn('font-semibold flex items-center gap-1', getTrendColor(direction))}>
				{getTrendIcon(direction)}
				{percentage.toFixed(1)}%
			</span>
			{#if isSignificant}
				<Badge variant="default" class="bg-blue-600">Significant Change</Badge>
			{:else}
				<Badge variant="secondary">Not Significant</Badge>
			{/if}
		</div>

		{#if significanceDetails}
			<!-- Analysis Summary -->
			<div class="text-gray-700 leading-relaxed">
				<p>
					This {metricName.toLowerCase()} change is
					<span class="font-medium {isSignificant ? 'text-blue-600' : 'text-gray-600'}">
						{isSignificant ? 'statistically significant' : 'not statistically significant'}
					</span>
					based on a {(significanceDetails.confidence * 100).toFixed(0)}% confidence level.
				</p>

				{#if significanceDetails.metrics.absoluteChange}
					<p class="mt-2">
						The value changed by
						<span class="font-medium">
							{formatMetricValue(Math.abs(significanceDetails.metrics.absoluteChange), metricName)}
						</span>
						from start to end of the analyzed period.
					</p>
				{/if}

				{#if significanceDetails.metrics.trendStrength !== undefined}
					<p class="mt-2">
						The trend consistency is
						<span class="font-medium">
							{(significanceDetails.metrics.trendStrength * 100).toFixed(1)}%
						</span>
						(how well the data follows a linear pattern).
					</p>
				{/if}
			</div>

			<!-- Key Insights -->
			{#if significanceDetails.reasons && significanceDetails.reasons.length > 0}
				<div class="space-y-1">
					<div class="font-medium text-gray-800">Key Insights:</div>
					{#each significanceDetails.reasons as reason}
						<div class="flex items-start gap-2 text-gray-700">
							<span class="text-blue-600 font-medium">•</span>
							<span>{reason}</span>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Technical Details (Always visible but subtle) -->
			<div class="text-xs text-gray-500 border-t pt-2 mt-3">
				<div class="flex flex-wrap gap-4">
					{#if significanceDetails.metrics.zScore}
						<span>Z-Score: {significanceDetails.metrics.zScore.toFixed(3)}</span>
					{/if}
					{#if significanceDetails.metrics.pValue}
						<span>P-Value: {significanceDetails.metrics.pValue.toFixed(4)}</span>
					{/if}
					{#if significanceDetails.metrics.volatilityScore}
						<span>Volatility: {significanceDetails.metrics.volatilityScore.toFixed(3)}</span>
					{/if}
					<span class="capitalize">Analysis: {significanceDetails.significanceType}</span>
				</div>
			</div>
		{/if}
	</div>
{/if}
