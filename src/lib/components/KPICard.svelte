<script lang="ts">
	import { Card, CardContent } from '$lib/shadcn/components';

	interface Props {
		title: string;
		value: string | number;
		subValue?: string;
		trend?: number; // percentage change
		trendText?: string;
		icon?: any; // Lucide icon
		color?: 'primary' | 'success' | 'warning' | 'error' | 'info';
		loading?: boolean;
	}

	let {
		title,
		value,
		subValue,
		trend,
		trendText,
		icon: Icon,
		color = 'primary',
		loading = false
	}: Props = $props();

	const colorClasses = {
		primary: 'text-blue-600 bg-blue-50',
		success: 'text-emerald-600 bg-emerald-50',
		warning: 'text-amber-600 bg-amber-50',
		error: 'text-rose-600 bg-rose-50',
		info: 'text-sky-600 bg-sky-50'
	};
</script>

<Card class="overflow-hidden border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
	<CardContent class="p-6">
		{#if loading}
			<div class="space-y-3">
				<div class="h-4 w-24 bg-slate-100 animate-pulse rounded"></div>
				<div class="h-8 w-32 bg-slate-100 animate-pulse rounded"></div>
				<div class="h-4 w-20 bg-slate-100 animate-pulse rounded"></div>
			</div>
		{:else}
			<div class="flex items-start justify-between">
				<div class="space-y-1">
					<p class="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</p>
					<div class="flex items-baseline gap-2">
						<h3 class="text-2xl font-bold text-slate-900 tracking-tight">{value}</h3>
						{#if subValue}
							<span class="text-sm font-medium text-slate-400">{subValue}</span>
						{/if}
					</div>

					{#if trend !== undefined || trendText}
						<div class="flex items-center gap-1.5 mt-2">
							{#if trend !== undefined}
								<span
									class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold {trend >=
									0
										? 'bg-emerald-100 text-emerald-700'
										: 'bg-rose-100 text-rose-700'}"
								>
									{#if trend >= 0}
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="12"
											height="12"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="3"
											stroke-linecap="round"
											stroke-linejoin="round"
											class="mr-0.5"
										><path d="m18 15-6-6-6 6" /></svg
										>
									{:else}
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="12"
											height="12"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="3"
											stroke-linecap="round"
											stroke-linejoin="round"
											class="mr-0.5"
										><path d="m6 9 6 6 6-6" /></svg
										>
									{/if}
									{Math.abs(trend)}%
								</span>
							{/if}
							{#if trendText}
								<span class="text-xs text-slate-400 font-medium">{trendText}</span>
							{/if}
						</div>
					{/if}
				</div>

				{#if Icon}
					<div class="p-3 rounded-xl {colorClasses[color]} ring-4 ring-white shadow-sm">
						<Icon size={20} strokeWidth={2.5} />
					</div>
				{/if}
			</div>
		{/if}
	</CardContent>
</Card>
