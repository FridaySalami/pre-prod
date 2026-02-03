<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button';
	import { Input } from '$lib/shadcn/ui/input';
	import { Label } from '$lib/shadcn/ui/label';
	// Replaced Shadcn Dialog with custom implementation to fix width issues
	import { fade, scale } from 'svelte/transition';
	import { showToast } from '$lib/toastStore';
	import { createEventDispatcher } from 'svelte';
	import { Copy, Check, X } from 'lucide-svelte';

	export let open = false;
	export let sku = '';
	export let title = '';
	export let asin = '';
	export let shippingDetails = '';

	let loading = false;
	let width = '10';
	let height = '10';
	let depth = '10';
	let weight = '1';
	let merchant_shipping_group = 'Nationwide Prime';
	let product_cost = '0';
	let material_cost = '0.35';
	let box_cost = '0';
	let vat_rate = '0';
	let is_fragile = false;
	let copied = false;

	function copySku() {
		navigator.clipboard.writeText(sku);
		copied = true;
		showToast('SKU copied to clipboard', 'success');
		setTimeout(() => {
			copied = false;
		}, 2000);
	}

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
		['9.25x6.25x6.25', 0.2],
		['9.25x9.25x9.25', 0.28],
		['0x0x0', 0.0],
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
		['15.75x11.75x7.75', 0.7],
		['10.25x7.25x2.25', 0.17],
		['11.25x14.25x3.25', 0.24],
		['14.25x10.25x12.25', 0.72],
		['15.25x10.25x5.25', 1.34],
		['10.25x10.25x10.25', 0.0],
		['15.25x15.25x15.25', 0.0],
		['Maggi Box', 1.52],
		['20.25x15.25x6.25', 1.52],
		['Poly Bag', 0.04]
	]);

	const commonBoxSizes = new Set([
		'6.25x6.25x6.25',
		'9.25x6.25x6.25',
		'9.25x9.25x9.25',
		'12.25x9.25x6.25',
		'14.25x4.25x4.25',
		'14.25x10.5x12.25',
		'16.25x11.25x7.25',
		'18.25x12.25x7.25',
		'18.25x12.25x12.25',
		'18.25x18.25x18.25',
		'10.25x8.25x6.25'
	]);

	$: allBoxOptions = Array.from(boxSizeCosts.keys())
		.filter((k) => k.includes('x') && !k.includes('0x0x0'))
		.sort();

	$: commonOptions = allBoxOptions.filter((o) => commonBoxSizes.has(o));
	$: otherOptions = allBoxOptions.filter((o) => !commonBoxSizes.has(o));

	function handleBoxPresetChange(e: Event) {
		const val = (e.target as HTMLSelectElement).value;
		if (val && val !== 'custom') {
			const cost = boxSizeCosts.get(val);
			if (cost !== undefined) {
				box_cost = cost.toFixed(2);
			}

			const [w, h, d] = val.split('x');
			width = w;
			height = h;
			depth = d;
		}
	}

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
					vat_rate,
					is_fragile
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
	function close() {
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<button
		class="fixed inset-0 z-50 bg-black/80 border-none cursor-default w-full h-full block"
		transition:fade={{ duration: 150 }}
		onclick={close}
		tabindex="-1"
		aria-label="Close modal"
		type="button"
	></button>

	<div
		class="fixed left-[50%] top-[50%] z-50 grid w-full max-w-[95vw] sm:max-w-[1000px] translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg max-h-[90vh] overflow-y-auto"
		transition:scale={{ duration: 150, start: 0.95 }}
		role="dialog"
		aria-modal="true"
	>
		<div class="flex flex-col gap-2 text-center sm:text-left">
			<div class="flex justify-between items-start">
				<h2 class="text-lg font-semibold leading-none tracking-tight">Update Cost Data</h2>
				<button
					onclick={close}
					class="opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
				>
					<X class="h-4 w-4" />
					<span class="sr-only">Close</span>
				</button>
			</div>

			<div class="space-y-2">
				{#if title}
					<div class="font-medium text-base text-foreground border-b pb-2 mb-2">{title}</div>
				{/if}

				<div class="flex flex-col gap-1 text-sm text-muted-foreground">
					<div class="flex items-center gap-2 flex-wrap">
						<span class="text-muted-foreground">SKU:</span>
						<span class="font-mono font-bold text-foreground bg-muted px-1.5 py-0.5 rounded"
							>{sku}</span
						>
						<Button
							variant="ghost"
							size="icon"
							class="h-6 w-6 -ml-1"
							onclick={copySku}
							title="Copy SKU"
						>
							{#if copied}
								<Check class="h-3.5 w-3.5 text-green-500" />
							{:else}
								<Copy class="h-3.5 w-3.5" />
							{/if}
						</Button>
					</div>

					{#if shippingDetails}
						<div class="flex items-center gap-2 flex-wrap">
							<span class="text-muted-foreground">Ship:</span>
							<span class="font-medium text-foreground">{shippingDetails}</span>
						</div>
					{/if}

					<div class="text-xs text-muted-foreground pt-1">Enter the missing information below.</div>
				</div>
			</div>
		</div>

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

			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<!-- Left Column: Financials & Summary -->
				<div class="space-y-6">
					<div class="grid gap-4 border rounded-lg p-4 bg-card shadow-sm">
						<h3 class="font-semibold text-sm text-primary flex items-center gap-2">
							Files & Costs
						</h3>
						<!-- Changed from grid-cols-2 to grid-cols-1 to prevent cramping inputs on narrower screens -->
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div class="space-y-2">
								<Label for="product_cost" class="text-xs font-medium">Product Cost</Label>
								<div class="relative">
									<span class="absolute left-3 top-2.5 text-muted-foreground text-xs">£</span>
									<Input
										id="product_cost"
										bind:value={product_cost}
										type="number"
										step="0.01"
										class="pl-6 h-9"
									/>
								</div>
							</div>
							<div class="space-y-2">
								<Label for="material_cost" class="text-xs font-medium">Material Cost</Label>
								<div class="relative">
									<span class="absolute left-3 top-2.5 text-muted-foreground text-xs">£</span>
									<Input
										id="material_cost"
										bind:value={material_cost}
										type="number"
										step="0.01"
										readonly
										class="pl-6 h-9 bg-muted"
									/>
								</div>
							</div>
							<div class="space-y-2">
								<Label for="box_cost" class="text-xs font-medium">Box Cost</Label>
								<div class="relative">
									<span class="absolute left-3 top-2.5 text-muted-foreground text-xs">£</span>
									<Input
										id="box_cost"
										bind:value={box_cost}
										type="number"
										step="0.01"
										readonly
										class="pl-6 h-9 bg-muted"
									/>
								</div>
							</div>
							<div class="space-y-2">
								<Label for="vat" class="text-xs font-medium">VAT Rate (%)</Label>
								<div class="relative">
									<Input id="vat" bind:value={vat_rate} type="number" class="pl-3 h-9" />
									<span class="absolute right-3 top-2.5 text-muted-foreground text-xs">%</span>
								</div>
							</div>
						</div>
					</div>

					<div class="rounded-lg bg-muted/40 p-4 border text-sm space-y-2">
						<div class="flex justify-between items-center">
							<span class="text-muted-foreground text-xs uppercase tracking-wider font-medium"
								>Product</span
							>
							<span class="font-mono">£{(parseFloat(product_cost) || 0).toFixed(2)}</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-muted-foreground text-xs uppercase tracking-wider font-medium"
								>Material</span
							>
							<span class="font-mono">£{(parseFloat(material_cost) || 0).toFixed(2)}</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-muted-foreground text-xs uppercase tracking-wider font-medium"
								>Box</span
							>
							<span class="font-mono">£{(parseFloat(box_cost) || 0).toFixed(2)}</span>
						</div>
						{#if is_fragile}
							<div
								class="flex justify-between items-center text-amber-600 bg-amber-50 -mx-2 px-2 py-1 rounded"
							>
								<span class="text-xs uppercase tracking-wider font-medium">Fragile Fee</span>
								<span class="font-mono">£1.00</span>
							</div>
						{/if}
						<div
							class="flex justify-between items-center border-t border-dashed border-border/60 pt-2 mt-2"
						>
							<span class="text-foreground font-medium">Net Cost</span>
							<span class="font-mono font-medium">£{baseCost.toFixed(2)}</span>
						</div>
						<div class="flex justify-between items-center text-muted-foreground">
							<span class="text-xs">VAT ({vat_rate}%)</span>
							<span class="font-mono text-xs">£{vatAmount.toFixed(2)}</span>
						</div>
						<div
							class="flex justify-between items-center font-bold text-lg border-t border-border pt-2 mt-2"
						>
							<span>Total Cost</span>
							<span class="font-mono text-primary">£{totalCost.toFixed(2)}</span>
						</div>
					</div>
				</div>

				<!-- Right Column: Logistics -->
				<div class="space-y-6">
					<div class="grid gap-4 border rounded-lg p-4 bg-card shadow-sm h-full content-start">
						<h3 class="font-semibold text-sm text-primary flex items-center gap-2">
							Logistics & Shipping
						</h3>

						<div class="space-y-4">
							<div class="grid grid-cols-1 gap-4">
								<div class="space-y-2">
									<Label for="shipping" class="text-xs font-medium">Shipping Group</Label>
									<select
										id="shipping"
										bind:value={merchant_shipping_group}
										class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
									>
										<option value="Nationwide Prime">Nationwide Prime</option>
										<option value="UK Shipping">UK Shipping</option>
										<option value="UK shipping One day">UK shipping One day</option>
										<option value="Off Amazon">Off Amazon</option>
									</select>
								</div>

								<div class="space-y-2">
									<Label for="weight" class="text-xs font-medium">Weight</Label>
									<div class="relative">
										<Input
											id="weight"
											bind:value={weight}
											type="number"
											step="0.01"
											class="pl-3 pr-8 h-9"
										/>
										<span class="absolute right-3 top-2.5 text-muted-foreground text-xs">kg</span>
									</div>
								</div>

								<div class="space-y-2 flex items-center p-2 rounded-md border bg-muted/20">
									<input
										type="checkbox"
										id="fragile"
										bind:checked={is_fragile}
										class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary mr-2"
									/>
									<Label for="fragile" class="text-xs font-medium cursor-pointer"
										>Fragile Item (+£1)</Label
									>
								</div>
							</div>

							<div class="space-y-3 pt-2 border-t">
								<div class="flex items-center justify-between">
									<Label class="text-xs font-medium">Dimensions (cm)</Label>
									<select
										class="h-8 rounded-md border border-input bg-background/50 px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
										onchange={handleBoxPresetChange}
										value={`${width}x${height}x${depth}`}
									>
										<option value="custom">Custom Size</option>
										<optgroup label="Common Sizes">
											{#each commonOptions as option}
												<option value={option}>{option}</option>
											{/each}
										</optgroup>
										<optgroup label="All Sizes">
											{#each otherOptions as option}
												<option value={option}>{option}</option>
											{/each}
										</optgroup>
									</select>
								</div>

								<div class="grid grid-cols-3 gap-3">
									<div class="space-y-1.5">
										<div class="relative">
											<span
												class="absolute left-2.5 top-2.5 text-[10px] uppercase text-muted-foreground font-bold tracking-wider"
												>W</span
											>
											<Input
												placeholder="0"
												bind:value={width}
												type="number"
												class="pl-7 h-9 text-center font-mono"
											/>
										</div>
									</div>
									<div class="space-y-1.5">
										<div class="relative">
											<span
												class="absolute left-2.5 top-2.5 text-[10px] uppercase text-muted-foreground font-bold tracking-wider"
												>H</span
											>
											<Input
												placeholder="0"
												bind:value={height}
												type="number"
												class="pl-7 h-9 text-center font-mono"
											/>
										</div>
									</div>
									<div class="space-y-1.5">
										<div class="relative">
											<span
												class="absolute left-2.5 top-2.5 text-[10px] uppercase text-muted-foreground font-bold tracking-wider"
												>D</span
											>
											<Input
												placeholder="0"
												bind:value={depth}
												type="number"
												class="pl-7 h-9 text-center font-mono"
											/>
										</div>
									</div>
								</div>

								<div class="text-[10px] text-muted-foreground text-center bg-muted/20 py-1 rounded">
									Volume: {(
										((parseFloat(width) || 0) *
											(parseFloat(height) || 0) *
											(parseFloat(depth) || 0)) /
										1000
									).toFixed(2)} L
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
			<Button type="submit" onclick={handleSubmit} disabled={loading} class="w-full sm:w-auto">
				{loading ? 'Saving...' : 'Save changes'}
			</Button>
		</div>
	</div>
{/if}
