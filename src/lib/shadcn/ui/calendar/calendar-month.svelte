<script>
	import { cn } from "$lib/shadcn/utils";
	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	} = $props();
</script>

<div {...restProps} bind:this={ref} class={cn("flex flex-col", className)}>
	{@render children?.()}
</div>