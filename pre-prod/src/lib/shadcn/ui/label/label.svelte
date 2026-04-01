<script>
	import { Label as LabelPrimitive } from 'bits-ui';
	import { cn } from '$lib/shadcn/utils/index.js';

	let { ref = $bindable(null), class: className = undefined, children, ...restProps } = $props();
</script>

<LabelPrimitive.Root
	bind:ref
	data-slot="label"
	class={cn(
		'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</LabelPrimitive.Root>
