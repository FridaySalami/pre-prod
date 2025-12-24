<script>
	import { cn } from '$lib/shadcn/utils/index.js';

	let { ref = $bindable(null), class: className = undefined, children, ...restProps } = $props();
</script>

<div
	bind:this={ref}
	data-slot="dialog-header"
	class={cn('flex flex-col gap-2 text-center sm:text-left', className)}
	{...restProps}
>
	{@render children?.()}
</div>
