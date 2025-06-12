<!-- AlertDescription.svelte -->
<script lang="ts">
	import { cn } from '../../utils/index.js';

	let className: string = '';
	export { className as class };
</script>

<div class={cn('text-sm [&_p]:leading-relaxed', className)} {...$$restProps}>
	<slot />
</div>
