<!-- ChartStyle.svelte -->
<script lang="ts">
	import { THEMES, type ChartConfig } from './chart-utils.js';

	interface Props {
		id: string;
		config: ChartConfig;
	}

	let { id, config }: Props = $props();

	const colorConfig = $derived(
		config ? Object.entries(config).filter(([, config]) => config.theme || config.color) : null
	);
</script>

{#if colorConfig && colorConfig.length}
	{@const themeContents = Object.entries(THEMES)
		.map(
			([theme, prefix]) => `
${prefix} [data-chart="${id}"] {
${colorConfig
	.map(([key, itemConfig]) => {
		const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] || itemConfig.color;
		return color ? `  --color-${key}: ${color};` : null;
	})
	.join('\n')}
}
`
		)
		.join('\n')}

	{#key id}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html `<style>
		${themeContents}
		</style>`}
	{/key}
{/if}
