<script>
	import { Command as CommandPrimitive, useId } from "bits-ui";
	import { cn } from "$lib/shadcn/utils/index.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		heading,
		value,
		...restProps
	} = $props();
</script>

<CommandPrimitive.Group
	bind:ref
	data-slot="command-group"
	class={cn("text-foreground overflow-hidden p-1", className)}
	value={value ?? heading ?? `----${useId()}`}
	{...restProps}
>
	{#if heading}
		<CommandPrimitive.GroupHeading
			class="text-muted-foreground px-2 py-1.5 text-xs font-medium"
		>
			{heading}
		</CommandPrimitive.GroupHeading>
	{/if}
	<CommandPrimitive.GroupItems {children} />
</CommandPrimitive.Group>