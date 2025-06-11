<!-- TableCell.svelte -->
<script lang="ts">
	import { cn } from '../../utils/index.js';

	let className: string = '';
	export { className as class };
</script>

<td class={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)} {...$$restProps}>
	<slot />
</td>
