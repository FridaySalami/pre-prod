<script lang="ts">
	/**
	 * DynamicIcon Component
	 * 
	 * This component lazy-loads Lucide icons only when they are needed.
	 * This significantly reduces the initial JavaScript bundle size (Hydration Bloat).
	 * 
	 * Usage: 
	 * <DynamicIcon name="TrendingUp" class="h-4 w-4" />
	 */
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';

	interface Props {
		name: string;
		class?: string;
		[key: string]: any;
	}

	let { name, class: className, ...rest }: Props = $props();
	let IconComponent = $state<Component | null>(null);

	$effect(() => {
		if (name) {
			loadIcon(name);
		}
	});

	async function loadIcon(iconName: string) {
		try {
			// Dynamic import from @lucide/svelte
			// This tells Vite to create separate chunks for these icons
			const module = await import('@lucide/svelte');
			// @ts-ignore - access by string name
			const Icon = module[iconName];
			
			if (Icon) {
				IconComponent = Icon;
			} else {
				console.warn(`Icon "${iconName}" not found in @lucide/svelte`);
			}
		} catch (err) {
			console.error(`Failed to load icon "${iconName}":`, err);
		}
	}
</script>

{#if IconComponent}
	<IconComponent class={className} {...rest} />
{:else}
	<!-- Simple placeholder to prevent layout shift -->
	<div class="inline-block {className} opacity-0"></div>
{/if}
