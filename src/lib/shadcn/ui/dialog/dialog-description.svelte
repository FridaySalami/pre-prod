<script>
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/shadcn/utils/index.js';

	let { ref = $bindable(null), class: className = undefined, ...restProps } = $props();
</script>

<DialogPrimitive.Description
	bind:ref
	data-slot="dialog-description"
	class={cn('text-muted-foreground text-sm', className)}
	{...restProps}
/>
