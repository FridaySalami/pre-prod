<!-- CardHeader.svelte -->
<script lang="ts">
	import { cn } from "$lib/shadcn/utils/index.js";

	let className: string = '';
	export { className as class };
</script>

<div class={cn('flex flex-col space-y-1.5 p-6', className)} {...$$restProps}>
	<slot />
</div>
