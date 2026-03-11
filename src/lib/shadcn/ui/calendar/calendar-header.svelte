<script>
	import { Calendar as CalendarPrimitive } from "bits-ui";
	import { cn } from "$lib/shadcn/utils";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	} = $props();
</script>

<CalendarPrimitive.Header
	bind:ref
	class={cn(
		"h-(--cell-size) flex w-full items-center justify-center gap-1.5 text-sm font-medium",
		className
	)}
	{...restProps}
/>