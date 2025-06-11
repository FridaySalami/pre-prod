<!-- ChartTooltip.svelte -->
<script lang="ts">
	import { cn } from '../../utils/index.js';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		hideLabel?: boolean;
		label?: string;
		indicator?: 'line' | 'dot' | 'dashed';
		nameKey?: string;
		labelKey?: string;
		hideIndicator?: boolean;
		labelClassName?: string;
		class?: string;
		payload?: any[];
		active?: boolean;
	}

	let {
		hideLabel = false,
		label,
		indicator = 'dot',
		nameKey,
		labelKey,
		hideIndicator = false,
		labelClassName = '',
		class: className = '',
		payload = [],
		active = false,
		...restProps
	}: Props = $props();

	function formatValue(value: any): string {
		if (typeof value === 'number') {
			return value.toLocaleString();
		}
		return String(value);
	}

	function formatCurrency(value: number): string {
		return new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency: 'GBP'
		}).format(value);
	}
</script>

{#if active && payload && payload.length}
	<div
		class={cn(
			'border-border/50 bg-background grid min-w-[9rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl',
			className
		)}
		{...restProps}
	>
		{#if !hideLabel && label}
			<div class={cn('font-medium', labelClassName)}>
				{label}
			</div>
		{/if}

		<div class="grid gap-1.5">
			{#each payload as item, i}
				{@const key = nameKey || item.name || item.dataKey || 'value'}
				{@const indicatorColor = item.color || item.payload?.color}

				<div
					class={cn(
						'flex w-full flex-wrap items-stretch gap-2',
						indicator === 'dot' && 'items-center'
					)}
				>
					{#if !hideIndicator}
						<div
							style="background-color: {indicatorColor}; border-color: {indicatorColor};"
							class={cn('shrink-0 rounded-[2px] border', {
								'size-2.5': indicator === 'dot',
								'h-full w-1': indicator === 'line',
								'w-0 border-[1.5px] border-dashed bg-transparent': indicator === 'dashed'
							})}
						></div>
					{/if}

					<div class="flex flex-1 shrink-0 justify-between leading-none items-center">
						<span class="text-muted-foreground">
							{item.name || key}
						</span>
						{#if item.value !== undefined}
							<span class="text-foreground font-mono font-medium tabular-nums">
								{#if item.name && (item.name.toLowerCase().includes('sales') || item.name
											.toLowerCase()
											.includes('revenue'))}
									{formatCurrency(item.value)}
								{:else}
									{formatValue(item.value)}
								{/if}
							</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
