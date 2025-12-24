<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/shadcn/ui/dialog';

	export let open = false;
	export let logs: string[] = [];
	export let title = 'Debug Output';
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-[600px] max-h-[80vh] flex flex-col">
		<DialogHeader>
			<DialogTitle>{title}</DialogTitle>
			<DialogDescription>Detailed debug logs for the selected item.</DialogDescription>
		</DialogHeader>
		<div class="flex-1 overflow-auto bg-muted p-4 rounded-md font-mono text-xs whitespace-pre-wrap">
			{#each logs as log}
				{log}
				{'\n'}
			{/each}
		</div>
		<DialogFooter>
			<Button onclick={() => (open = false)}>Close</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
