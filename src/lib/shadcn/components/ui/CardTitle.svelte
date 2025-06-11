<!-- CardTitle.svelte -->
<script lang="ts">
	import { cn } from '../../utils/index.js';

	let className: string = '';
	export { className as class };
</script>

<h3 class={cn('text-2xl font-semibold leading-none tracking-tight', className)} {...$$restProps}>
	<slot />
</h3>
