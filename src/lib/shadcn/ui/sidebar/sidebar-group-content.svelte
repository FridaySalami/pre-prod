<script>
	import { cn } from "$lib/shadcn/utils/index.js";
	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="sidebar-group-content"
	data-sidebar="group-content"
	class={cn("w-full text-sm", className)}
	{...restProps}
>
	{@render children?.()}
</div>