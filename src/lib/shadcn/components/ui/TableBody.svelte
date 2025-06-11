<!-- TableBody.svelte -->
<script lang="ts">
	import { cn } from '../../utils/index.js';

	let className: string = '';
	export { className as class };
</script>

<tbody class={cn('[&_tr:last-child]:border-0', className)} {...$$restProps}>
	<slot />
</tbody>
