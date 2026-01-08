<script lang="ts">
	import { Input } from '$lib/shadcn/ui/input';
	import { Button } from '$lib/shadcn/ui/button';
	import { showToast } from '$lib/toastStore';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Search, Loader2, Save } from 'lucide-svelte';

	export let data;

	let searchTerm = data.search;
	let loading = false;
	let updating = new Set<string>(); // Set of SKUs currently being updated

	function handleSearch() {
		const params = new URLSearchParams($page.url.searchParams);
		if (searchTerm) {
			params.set('q', searchTerm);
			params.set('page', '1'); // Reset to page 1
		} else {
			params.delete('q');
		}
		goto(`?${params.toString()}`);
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
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
							>Shipping Group</th
						>
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
							<td class="p-4 align-middle font-medium">{item.sku}</td>
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
			onclick={() => goto(`?page=${(data.page ?? 1) - 1}&q=${searchTerm || ''}`)}
			disabled={(data.page ?? 1) <= 1}
		>
			Previous
		</Button>
		<Button
			variant="outline"
			size="sm"
			onclick={() => goto(`?page=${(data.page ?? 1) + 1}&q=${searchTerm || ''}`)}
			disabled={data.items.length < (data.limit ?? 50)}
		>
			Next
		</Button>
	</div>
</div>
