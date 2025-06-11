<!-- TableHeader.svelte -->
<script lang="ts">
	import { cn } from '../../utils/index.js';

	let className: string = '';
	export { className as class };
</script>

<thead class={cn('[&_tr]:border-b', className)} {...$$restProps}>
	<slot />
</thead>
