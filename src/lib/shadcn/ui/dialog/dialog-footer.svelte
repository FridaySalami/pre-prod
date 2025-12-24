<script>
	import { cn } from '$lib/shadcn/utils/index.js';
	let { ref = $bindable(null), class: className = undefined, children, ...restProps } = $props();
</script>

<div
	bind:this={ref}
	data-slot="dialog-footer"
	class={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
	{...restProps}
>
	{@render children?.()}
</div>
