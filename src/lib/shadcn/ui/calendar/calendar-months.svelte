<script>
	import { cn } from "$lib/shadcn/utils";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	} = $props();
</script>

<div
	bind:this={ref}
	class={cn("relative flex flex-col gap-4 md:flex-row", className)}
	{...restProps}
>
	{@render children?.()}
</div>