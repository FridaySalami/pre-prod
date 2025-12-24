<script>
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/shadcn/utils/index.js';

	let { ref = $bindable(null), class: className = undefined, ...restProps } = $props();
</script>

<DialogPrimitive.Title
	bind:ref
	data-slot="dialog-title"
	class={cn('text-lg font-semibold leading-none', className)}
	{...restProps}
/>
