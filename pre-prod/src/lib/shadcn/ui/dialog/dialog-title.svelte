<script>
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/shadcn/utils';

	let { ref = $bindable(null), class: className = undefined, ...restProps } = $props();
</script>

<DialogPrimitive.Title
	bind:ref
	data-slot="dialog-title"
	class={cn('text-lg leading-none font-semibold', className)}
	{...restProps}
/>
