<!-- Textarea.svelte -->
<script lang="ts">
	import { cn } from '../../utils/index.js';

	let className: string = '';
	export { className as class };
	export let value: string = '';
	export let placeholder: string = '';
	export let rows: number = 3;
</script>

<textarea
	bind:value
	{placeholder}
	{rows}
	class={cn(
		'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
	{...$$restProps}
></textarea>
