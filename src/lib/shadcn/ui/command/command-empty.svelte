<script>
	import { Command as CommandPrimitive } from "bits-ui";
	import { cn } from "$lib/shadcn/utils/index.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	} = $props();
</script>

<CommandPrimitive.Empty
	bind:ref
	data-slot="command-empty"
	class={cn("py-6 text-center text-sm", className)}
	{...restProps}
/>