<script>
	import { Separator as SeparatorPrimitive } from "bits-ui";
	import { cn } from "$lib/shadcn/utils/index.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	} = $props();
</script>

<SeparatorPrimitive.Root
	bind:ref
	data-slot="separator"
	class={cn(
		"bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px",
		className
	)}
	{...restProps}
/>