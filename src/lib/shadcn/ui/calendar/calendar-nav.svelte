<script>
	import { cn } from "$lib/shadcn/utils";
	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	} = $props();
</script>

<nav
	{...restProps}
	bind:this={ref}
	class={cn("absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1", className)}
>
	{@render children?.()}
</nav>