<!-- AlertTitle.svelte -->
<script lang="ts">
	import { cn } from '../../utils/index.js';

	let className: string = '';
	export { className as class };
</script>

<h5 class={cn('mb-1 font-medium leading-none tracking-tight', className)} {...$$restProps}>
	<slot />
</h5>
