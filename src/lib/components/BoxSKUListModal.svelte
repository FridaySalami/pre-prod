<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button';
	import { Label } from '$lib/shadcn/ui/label';
	import { fade, scale } from 'svelte/transition';
	import { showToast } from '$lib/stores/toastStore';
	import { X, ExternalLink, Loader2 } from 'lucide-svelte';

	export let open = false;
	export let boxCode = '';
	export let supplies: any[] = [];
	export let onSuccess: () => void;

	let loading = true;
	let processing = false;
	let items: any[] = [];

	$: boxOptions = supplies
		.filter((s) => ['box', 'envelope', 'bag'].includes(s.type))
		.map((s) => ({ code: s.code, name: s.name }))
		.sort((a, b) => a.name.localeCompare(b.name));

	// Ensure 0x0x0 is always in the options for "None / Own Box" if not present
	$: if (!boxOptions.find((o) => o.code === '0x0x0')) {
		boxOptions = [{ code: '0x0x0', name: 'None / Own Box' }, ...boxOptions];
	}

	$: currentBoxName = boxOptions.find((o) => o.code === boxCode)?.name || boxCode;

	$: if (open && boxCode) {
		fetchItems();
	}

	async function fetchItems() {
		loading = true;
		try {
			const res = await fetch(
				`/api/tools/packing-supplies/reassign?boxCode=${encodeURIComponent(boxCode)}`
			);
			const data = await res.json();
			items = data.items || [];
		} catch (e) {
			console.error('Error fetching items for box:', e);
		} finally {
			loading = false;
		}
	}

	async function handleReassign(sku: string, newBoxCode: string) {
		if (newBoxCode === boxCode) return;

		processing = true;
		try {
			const res = await fetch('/api/tools/packing-supplies/reassign', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sku, newBoxCode })
			});

			if (res.ok) {
				showToast(`Reassigned ${sku} to ${newBoxCode}`, 'success');
				// Remove from local list
				items = items.filter((i) => i.sku !== sku);
				onSuccess();
			} else {
				showToast('Failed to reassign SKU', 'error');
			}
		} catch (e) {
			showToast('An error occurred', 'error');
		} finally {
			processing = false;
		}
	}

	function close() {
		open = false;
	}
</script>

{#if open}
	<button
		class="fixed inset-0 z-[60] bg-black/80 border-none cursor-default w-full h-full block"
		transition:fade={{ duration: 150 }}
		onclick={close}
		tabindex="-1"
		aria-label="Close modal"
	></button>

	<div
		class="fixed left-[50%] top-[50%] z-[70] flex w-full max-w-[800px] translate-x-[-50%] translate-y-[-50%] flex-col gap-4 border bg-background p-6 shadow-xl duration-200 sm:rounded-lg max-h-[85vh]"
		transition:scale={{ duration: 150, start: 0.95 }}
		role="dialog"
		aria-modal="true"
	>
		<div class="flex justify-between items-center border-b pb-4">
			<div>
				<h2 class="text-xl font-bold flex items-center gap-2">
					SKUs Assigned to {currentBoxName}
				</h2>
				<p class="text-sm text-muted-foreground">
					Reassign individual items to a different box size by selecting from the dropdown.
				</p>
			</div>
			<button onclick={close} class="p-2 hover:bg-muted rounded-full transition-colors">
				<X class="h-5 w-5" />
			</button>
		</div>

		<div class="flex-1 overflow-y-auto py-4">
			{#if loading}
				<div class="flex justify-center items-center py-20">
					<Loader2 class="h-8 w-8 animate-spin text-primary" />
				</div>
			{:else if items.length === 0}
				<div class="text-center py-20 bg-muted/20 rounded-lg border-2 border-dashed">
					<p class="text-muted-foreground">No SKUs directly found with dimensions {boxCode}.</p>
				</div>
			{:else}
				<div class="border rounded-md overflow-hidden">
					<table class="w-full text-sm">
						<thead class="bg-muted/50 border-b">
							<tr>
								<th class="text-left p-3 font-semibold">SKU / Item Name</th>
								<th class="text-right p-3 font-semibold w-[220px]">New Box Size</th>
							</tr>
						</thead>
						<tbody class="divide-y text-sm">
							{#each items as item (item.sku)}
								<tr class="hover:bg-muted/30 transition-colors">
									<td class="p-3">
										<div class="font-bold text-primary">{item.sku}</div>
										<div class="text-xs text-muted-foreground truncate max-w-[400px]">
											{item.title}
										</div>
									</td>
									<td class="p-3 text-right">
										<select
											class="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
											value={boxCode}
											onchange={(e) => handleReassign(item.sku, e.currentTarget.value)}
											disabled={processing}
										>
											<option value={boxCode}>
												{currentBoxName} (Current)
											</option>
											<optgroup label="Available Sizes">
												{#each boxOptions as option}
													{#if option.code !== boxCode}
														<option value={option.code}>
															{option.name}
														</option>
													{/if}
												{/each}
											</optgroup>
										</select>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<div class="border-t pt-4 flex justify-end">
			<Button variant="outline" onclick={close}>Close</Button>
		</div>
	</div>
{/if}
