<!-- Card.svelte -->
<script lang="ts">
	import { cn } from "$lib/shadcn/utils/index.js";

	let className: string = '';
	export { className as class };
</script>

<div
	class={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}
	{...$$restProps}
>
	<slot />
</div>
