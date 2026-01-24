<script lang="ts">
	import { Input } from '$lib/shadcn/ui/input';
	import { Button } from '$lib/shadcn/ui/button';
	import { showToast } from '$lib/toastStore';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Search, Loader2, Save, Copy, Filter } from 'lucide-svelte';
	import * as Popover from '$lib/shadcn/ui/popover';
	import { Checkbox } from '$lib/shadcn/ui/checkbox';
	import { Label } from '$lib/shadcn/ui/label';

	export let data;

	let searchTerm = data.search;
	let missingCost = data.missingCost;
	let selectedShippingGroups: string[] = data.shippingGroups || [];

	$: searchTerm = data.search;
	$: missingCost = data.missingCost;
	$: selectedShippingGroups = data.shippingGroups || [];

	const shippingOptions = ['Nationwide Prime', 'UK Shipping', 'UK shipping One day', 'Off Amazon'];

	let loading = false;
	let updating = new Set<string>(); // Set of SKUs currently being updated

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
		showToast('Copied to clipboard', 'success');
	}

	function handleSearch() {
		const params = new URLSearchParams($page.url.searchParams);
		if (searchTerm) {
			params.set('q', searchTerm);
			params.set('page', '1'); // Reset to page 1
		} else {
			params.delete('q');
		}

		if (missingCost) {
			params.set('missing_cost', 'true');
			params.set('page', '1');
		} else {
			params.delete('missing_cost');
		}

		if (selectedShippingGroups.length > 0) {
			params.set('shipping_groups', selectedShippingGroups.join(','));
			params.set('page', '1');
		} else {
			params.delete('shipping_groups');
		}

		goto(`?${params.toString()}`);
	}

	function toggleShippingGroup(group: string) {
		if (selectedShippingGroups.includes(group)) {
			selectedShippingGroups = selectedShippingGroups.filter((g) => g !== group);
		} else {
			selectedShippingGroups = [...selectedShippingGroups, group];
		}
		handleSearch();
	}

	async function updateCost(item: any) {
		if (updating.has(item.sku)) return;
		updating.add(item.sku);
		updating = updating; // trigger reactivity

		try {
			const response = await fetch('/api/amazon/costs/update', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sku: item.sku,
					title: item.title,
					// Use existing dimensions/weight (we are not editing them but the API expects them or might reset them if omitted?
					// Checked API code: it upserts. If we omit, it might set to 0 if we passed undefined.
					// The API expects: width, height, depth, weight.
					width: String(item.width),
					height: String(item.height),
					depth: String(item.depth),
					weight: String(item.weight),
					merchant_shipping_group: item.merchant_shipping_group,
					total_value: String(item.total_value),
					vat_rate: String(item.vat_rate),
					// We don't have ASIN in this view, passing null/undefined. API handles it by upserting SKU mapping.
					asin: null
				})
			});

			const result = await response.json();

			if (result.success) {
				showToast(`Updated ${item.sku}`, 'success');
			} else {
				showToast(`Failed to update ${item.sku}: ${result.error}`, 'error');
			}
		} catch (e) {
			console.error(e);
			showToast(`Error updating ${item.sku}`, 'error');
		} finally {
			updating.delete(item.sku);
			updating = updating;
		}
	}

	function handlePageChange(newPage: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', String(newPage));
		goto(`?${params.toString()}`);
	}
</script>

<div class="h-full flex-1 flex-col space-y-8 p-8 md:flex">
	<div class="flex items-center justify-between space-y-2">
		<div>
			<h2 class="text-2xl font-bold tracking-tight">Cost Manager</h2>
			<p class="text-muted-foreground">
				Manually update cost pricing, VAT, and shipping settings.
				<br />
				<span class="text-xs text-yellow-600"
					>Note: Updating here overrides Sage data for profit calculations.</span
				>
			</p>
		</div>
		<div class="flex items-center space-x-2">
			<Button variant="outline" onclick={() => goto('/cost-price-upload')}>
				Bulk Update Costs
			</Button>
		</div>
	</div>

	<div class="flex items-center space-x-2">
		<div class="relative flex-1 max-w-sm">
			<Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
			<Input
				type="text"
				placeholder="Search SKUs..."
				class="pl-8"
				bind:value={searchTerm}
				onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleSearch()}
			/>
		</div>
		<Button onclick={handleSearch} disabled={loading}>Search</Button>
		<Button
			variant={missingCost ? 'default' : 'outline'}
			onclick={() => {
				missingCost = !missingCost;
				handleSearch();
			}}
		>
			{missingCost ? 'Missing Costs Only' : 'Show Missing Costs'}
		</Button>
	</div>

	<div class="rounded-md border">
		<div class="relative w-full overflow-auto">
			<table class="w-full caption-bottom text-sm">
				<thead class="[&_tr]:border-b">
					<tr class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">SKU</th>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Title</th
						>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-32"
							>Cost (£)</th
						>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-20"
							>VAT (%)</th
						>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
							<div class="flex items-center space-x-2">
								<span>Shipping Group</span>
								<Popover.Root>
									<Popover.Trigger>
										<Button variant="ghost" size="icon" class="h-6 w-6">
											<Filter
												class="h-3 w-3 {selectedShippingGroups.length > 0 ? 'text-primary' : ''}"
											/>
										</Button>
									</Popover.Trigger>
									<Popover.Content class="w-56 p-2">
										<div class="space-y-2">
											<h4 class="font-medium leading-none">Filter Shipping Groups</h4>
											<div class="grid gap-2">
												{#each shippingOptions as option}
													<div class="flex items-center space-x-2">
														<Checkbox
															id={option}
															checked={selectedShippingGroups.includes(option)}
															onCheckedChange={() => toggleShippingGroup(option)}
														/>
														<Label
															for={option}
															class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
														>
															{option}
														</Label>
													</div>
												{/each}
											</div>
										</div>
									</Popover.Content>
								</Popover.Root>
							</div>
						</th>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
							>Box (cm)</th
						>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
							>Actions</th
						>
					</tr>
				</thead>
				<tbody class="[&_tr:last-child]:border-0">
					{#each data.items as item (item.sku)}
						<tr class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
							<td class="p-4 align-middle font-medium">
								<div class="flex items-center space-x-2">
									<span>{item.sku}</span>
									<Button
										variant="ghost"
										size="icon"
										class="h-6 w-6"
										onclick={() => copyToClipboard(item.sku)}
										title="Copy SKU"
									>
										<Copy class="h-3 w-3" />
									</Button>
								</div>
							</td>
							<td class="p-4 align-middle text-xs max-w-[300px] truncate" title={item.title}
								>{item.title}</td
							>
							<td class="p-4 align-middle">
								<Input type="number" step="0.01" bind:value={item.total_value} class="w-24 h-8" />
							</td>
							<td class="p-4 align-middle">
								<Input type="number" bind:value={item.vat_rate} class="w-16 h-8" />
							</td>
							<td class="p-4 align-middle">
								<select
									class="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1"
									bind:value={item.merchant_shipping_group}
								>
									<option value="Nationwide Prime">Nationwide Prime</option>
									<option value="UK Shipping">UK Shipping</option>
									<option value="UK shipping One day">UK shipping One day</option>
									<option value="Off Amazon">Off Amazon</option>
								</select>
							</td>
							<td class="p-4 align-middle text-xs text-muted-foreground">
								{item.width} x {item.height} x {item.depth}
							</td>
							<td class="p-4 align-middle">
								<Button
									size="sm"
									variant="ghost"
									onclick={() => updateCost(item)}
									disabled={updating.has(item.sku)}
								>
									{#if updating.has(item.sku)}
										<Loader2 class="h-4 w-4 animate-spin" />
									{:else}
										<Save class="h-4 w-4" />
									{/if}
								</Button>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="7" class="p-4 text-center text-muted-foreground">No items found</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<div class="flex items-center justify-end space-x-2 py-4">
		<Button
			variant="outline"
			size="sm"
			onclick={() => handlePageChange((data.page ?? 1) - 1)}
			disabled={(data.page ?? 1) <= 1}
		>
			Previous
		</Button>
		<Button
			variant="outline"
			size="sm"
			onclick={() => handlePageChange((data.page ?? 1) + 1)}
			disabled={data.items.length < (data.limit ?? 50)}
		>
			Next
		</Button>
	</div>
</div>
