<script>
	import { cn } from '$lib/shadcn/utils';
	import { Popover as PopoverPrimitive } from 'bits-ui';

	let { ref = $bindable(null), class: className = undefined, ...restProps } = $props();
</script>

<PopoverPrimitive.Trigger
	bind:ref
	data-slot="popover-trigger"
	class={cn('', className)}
	{...restProps}
/>
