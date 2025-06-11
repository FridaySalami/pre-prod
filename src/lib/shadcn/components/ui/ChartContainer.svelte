<!-- ChartContainer.svelte -->
<script lang="ts">
	import { cn } from '../../utils/index.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import ChartStyle from './ChartStyle.svelte';
	import { setChartContext, type ChartConfig } from './chart-utils.js';

	interface Props extends HTMLAttributes<HTMLElement> {
		config: ChartConfig;
		id?: string;
		class?: string;
	}

	let {
		config,
		id = `chart-${Math.random().toString(36).substr(2, 9)}`,
		class: className = '',
		children,
		...restProps
	}: Props = $props();

	const chartId = `chart-${id.replace(/:/g, '')}`;

	setChartContext({
		get config() {
			return config;
		}
	});
</script>

<div
	data-chart={chartId}
	data-slot="chart"
	class={cn(
		'flex aspect-video justify-center overflow-visible text-xs',
		// Overrides for layerchart styling
		'[&_.stroke-white]:stroke-transparent',
		'[&_.lc-line]:stroke-border/50',
		'[&_.lc-highlight-line]:stroke-0',
		'[&_.lc-area-path]:opacity-100 [&_.lc-highlight-line]:opacity-100 [&_.lc-highlight-point]:opacity-100 [&_.lc-spline-path]:opacity-100 [&_.lc-text-svg]:overflow-visible [&_.lc-text]:text-xs',
		'[&_.lc-axis-tick]:stroke-0',
		'[&_.lc-rule-x-line:not(.lc-grid-x-rule)]:stroke-0 [&_.lc-rule-y-line:not(.lc-grid-y-rule)]:stroke-0',
		'[&_.lc-grid-x-radial-line]:stroke-border [&_.lc-grid-x-radial-circle]:stroke-border',
		'[&_.lc-grid-y-radial-line]:stroke-border [&_.lc-grid-y-radial-circle]:stroke-border',
		// Legend adjustments
		'[&_.lc-legend-swatch-button]:items-center [&_.lc-legend-swatch-button]:gap-1.5',
		'[&_.lc-legend-swatch-group]:items-center [&_.lc-legend-swatch-group]:gap-4',
		'[&_.lc-legend-swatch]:size-2.5 [&_.lc-legend-swatch]:rounded-[2px]',
		// Labels
		'[&_.lc-labels-text:not([fill])]:fill-foreground [&_text]:stroke-transparent',
		'[&_.lc-axis-tick-label]:fill-muted-foreground [&_.lc-axis-tick-label]:font-normal',
		'[&_.lc-tooltip-rects-g]:fill-transparent',
		'[&_.lc-layout-svg-g]:fill-transparent',
		'[&_.lc-root-container]:w-full',
		className
	)}
	{...restProps}
>
	<ChartStyle {id} {config} />
	{#if children}
		{@render children()}
	{/if}
</div>
