<!-- CardContent.svelte -->
<script lang="ts">
	import { cn } from "$lib/shadcn/utils/index.js";

	let className: string = '';
	export { className as class };
</script>

<div class={cn('p-6 pt-0', className)} {...$$restProps}>
	<slot />
</div>
