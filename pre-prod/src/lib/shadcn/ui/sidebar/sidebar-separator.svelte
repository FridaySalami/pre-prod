<script>
	import { Separator } from "$lib/shadcn/ui/separator/index.js";
	import { cn } from "$lib/shadcn/utils/index.js";
	let {
		ref = $bindable(null),
		class: className,
		...restProps
	} = $props();
</script>

<Separator
	bind:ref
	data-slot="sidebar-separator"
	data-sidebar="separator"
	class={cn("bg-sidebar-border mx-2 w-auto", className)}
	{...restProps}
/>