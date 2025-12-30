<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button';
	import { Input } from '$lib/shadcn/ui/input';
	import { Label } from '$lib/shadcn/ui/label';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/shadcn/ui/dialog';
	import { showToast } from '$lib/toastStore';
	import { createEventDispatcher } from 'svelte';

	export let open = false;
	export let sku = '';
	export let title = '';
	export let asin = '';

	let loading = false;
	let width = '10';
	let height = '10';
	let depth = '10';
	let weight = '1';
	let merchant_shipping_group = 'Nationwide Prime';
	let product_cost = '0';
	let material_cost = '0.35';
	let box_cost = '0';
	let vat_rate = '20';
	let is_fragile = false;

	$: total_value = (
		(parseFloat(product_cost) || 0) +
		(parseFloat(material_cost) || 0) +
		(parseFloat(box_cost) || 0) +
		(is_fragile ? 1 : 0)
	).toFixed(2);
	$: baseCost = parseFloat(total_value) || 0;
	$: vatAmount = baseCost * ((parseFloat(vat_rate) || 0) / 100);
	$: totalCost = baseCost + vatAmount;

	const dispatch = createEventDispatcher();

	let suggestions: any[] = [];
	let searching = false;

	const boxSizeCosts = new Map([
		['5.25x5.25x5.25', 0.15],
		['6.25x6.25x6.25', 0.16],
		['9.25x6.25x6.25', 0.20],
		['9.25x9.25x9.25', 0.28],
		['0x0x0', 0.00],
		['12.25x9.25x3.25', 0.22],
		['14.75x11.25x14.75', 1.96],
		['12.25x9.25x6.25', 0.26],
		['14.25x4.25x4.25', 0.73],
		['14.25x12.25x8.25', 1.67],
		['14.25x10.5x12.25', 0.72],
		['16.25x10.25x10.75', 0.73],
		['16.25x11.25x7.25', 0.56],
		['18.25x12.25x7.25', 0.46],
		['18.25x12.25x12.25', 0.95],
		['18.25x18.25x18.25', 1.85],
		['Bubble Wrap', 9.33],
		['Fragile Tape', 0.67],
		['Pallet Wrap', 4.65],
		['10.25x8.25x6.25', 0.24],
		['14.25x11.25x9.25', 0.43],
		['15.75x11.75x7.75', 0.70],
		['10.25x7.25x2.25', 0.17],
		['11.25x14.25x3.25', 0.24],
		['14.25x10.25x12.25', 0.72],
		['15.25x10.25x5.25', 1.34],
		['10.25x10.25x10.25', 0.00],
		['15.25x15.25x15.25', 0.00],
		['Maggi Box', 1.52],
		['20.25x15.25x6.25', 1.52],
		['Poly Bag', 0.04]
	]);

	$: {
		const key = `${width}x${height}x${depth}`;
		const cost = boxSizeCosts.get(key);
		if (cost !== undefined) {
			box_cost = cost.toFixed(2);
		}
	}

	$: if (open && sku) {
		searchSuggestions();
	}

	async function searchSuggestions() {
		// Clean SKU for search
		// 1. Remove shipping suffixes first (so numeric suffix becomes trailing)
		let cleanSku = sku
			.replace(/ (Prime|One Day|uk shipping|Standard|NextDay|Premium)$/i, '')
			.trim();

		// 2. Remove numeric suffix (e.g. " - 001")
		cleanSku = cleanSku.replace(/ - \d{3}$/, '').trim();

		if (cleanSku.length < 3) return;

		searching = true;
		try {
			const res = await fetch(`/api/inventory/search?q=${encodeURIComponent(cleanSku)}`);
			const data = await res.json();
			suggestions = data.items || [];
		} catch (e) {
			console.error('Error fetching suggestions:', e);
		} finally {
			searching = false;
		}
	}

	function applySuggestion(item: any) {
		width = String(item.width || '10');
		height = String(item.height || '10');
		depth = String(item.depth || '10');
		weight = String(item.weight || '1');
		product_cost = String(item.cost || '0');
		material_cost = '0.35';
		box_cost = '0';
		vat_rate = String(item.vatRate || '20');
		showToast(`Applied data from ${item.sku}`, 'success');
	}

	async function handleSubmit() {
		loading = true;
		try {
			const response = await fetch('/api/amazon/costs/update', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sku,
					asin,
					title,
					width,
					height,
					depth,
					weight,
					merchant_shipping_group,
					total_value: product_cost,
					vat_rate
				})
			});

			const result = await response.json();

			if (result.success) {
				showToast('Cost data updated successfully', 'success');
				dispatch('success');
				open = false;
			} else {
				showToast(result.error || 'Failed to update cost data', 'error');
			}
		} catch (e) {
			showToast('An error occurred', 'error');
			console.error(e);
		} finally {
			loading = false;
		}
	}
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
		<DialogHeader>
			<DialogTitle>Update Cost Data</DialogTitle>
			<DialogDescription>
				Enter the missing information for SKU: <span class="font-mono font-bold">{sku}</span>
			</DialogDescription>
		</DialogHeader>
		<div class="grid gap-6 py-4">
			{#if suggestions.length > 0}
				<div class="col-span-4">
					<Label class="mb-2 block font-semibold">Suggestions found (click to apply):</Label>
					<div
						class="flex flex-col gap-2 max-h-40 overflow-y-auto border rounded-md p-2 bg-muted/20"
					>
						{#each suggestions as item}
							<button
								class="text-left text-sm p-3 hover:bg-muted rounded-md flex justify-between items-center group border border-transparent hover:border-border transition-all"
								onclick={() => applySuggestion(item)}
							>
								<div>
									<div class="font-medium flex items-center gap-2">
										{item.sku}
										<span class="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded"
											>£{Number(item.cost).toFixed(2)}</span
										>
									</div>
									<div class="text-xs text-muted-foreground">
										{item.title}
									</div>
								</div>
								<div
									class="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-medium shadow-sm"
								>
									Apply
								</div>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<div class="grid gap-4 border rounded-lg p-4 bg-card">
				<h3 class="font-semibold text-sm text-muted-foreground mb-2">Financials</h3>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="product_cost">Product Cost</Label>
						<Input id="product_cost" bind:value={product_cost} type="number" step="0.01" />
					</div>
					<div class="space-y-2">
						<Label for="material_cost">Material Cost</Label>
						<Input
							id="material_cost"
							bind:value={material_cost}
							type="number"
							step="0.01"
							readonly
							class="bg-muted"
						/>
					</div>
					<div class="space-y-2">
						<Label for="box_cost">Box Cost</Label>
						<Input
							id="box_cost"
							bind:value={box_cost}
							type="number"
							step="0.01"
							readonly
							class="bg-muted"
						/>
					</div>
					<div class="space-y-2">
						<Label for="vat">VAT Rate (%)</Label>
						<Input id="vat" bind:value={vat_rate} type="number" />
					</div>
				</div>

				<div class="rounded-md bg-muted p-3 text-sm space-y-1">
					<div class="flex justify-between">
						<span class="text-muted-foreground">Product Cost:</span>
						<span>£{(parseFloat(product_cost) || 0).toFixed(2)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">Material Cost:</span>
						<span>£{(parseFloat(material_cost) || 0).toFixed(2)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">Box Cost:</span>
						<span>£{(parseFloat(box_cost) || 0).toFixed(2)}</span>
					</div>
					{#if is_fragile}
						<div class="flex justify-between">
							<span class="text-muted-foreground">Fragile Charge:</span>
							<span>£1.00</span>
						</div>
					{/if}
					<div class="flex justify-between border-t border-border/50 pt-1 mt-1">
						<span class="text-muted-foreground font-medium">Net Cost:</span>
						<span class="font-medium">£{baseCost.toFixed(2)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">VAT ({vat_rate}%):</span>
						<span>£{vatAmount.toFixed(2)}</span>
					</div>
					<div class="flex justify-between font-bold border-t border-border pt-1 mt-1">
						<span>Total Cost (Inc VAT):</span>
						<span>£{totalCost.toFixed(2)}</span>
					</div>
				</div>
			</div>

			<div class="grid gap-4 border rounded-lg p-4 bg-card">
				<h3 class="font-semibold text-sm text-muted-foreground mb-2">Logistics</h3>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="shipping">Shipping Group</Label>
						<select
							id="shipping"
							bind:value={merchant_shipping_group}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						>
							<option value="Nationwide Prime">Nationwide Prime</option>
							<option value="UK Shipping">UK Shipping</option>
							<option value="UK shipping One day">UK shipping One day</option>
							<option value="Off Amazon">Off Amazon</option>
						</select>
					</div>
					<div class="space-y-2">
						<Label for="weight">Weight (kg)</Label>
						<Input id="weight" bind:value={weight} type="number" step="0.01" />
					</div>
				</div>

				<div class="space-y-2">
					<Label>Dimensions (cm)</Label>
					<div class="flex gap-4">
						<div class="relative flex-1">
							<Input placeholder="W" bind:value={width} type="number" class="pl-6" />
							<span class="absolute left-2 top-2.5 text-xs text-muted-foreground">W</span>
						</div>
						<div class="relative flex-1">
							<Input placeholder="H" bind:value={height} type="number" class="pl-6" />
							<span class="absolute left-2 top-2.5 text-xs text-muted-foreground">H</span>
						</div>
						<div class="relative flex-1">
							<Input placeholder="D" bind:value={depth} type="number" class="pl-6" />
							<span class="absolute left-2 top-2.5 text-xs text-muted-foreground">D</span>
						</div>
					</div>
				</div>

				<div class="flex items-center space-x-2">
					<input
						type="checkbox"
						id="fragile"
						bind:checked={is_fragile}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
					/>
					<Label
						for="fragile"
						class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
						>Fragile Item (+£1.00)</Label
					>
				</div>
			</div>
		</div>
		<DialogFooter>
			<Button type="submit" onclick={handleSubmit} disabled={loading} class="w-full sm:w-auto">
				{loading ? 'Saving...' : 'Save changes'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
