<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button';
	import { Input } from '$lib/shadcn/ui/input';
	import { Label } from '$lib/shadcn/ui/label';
	// Replaced Shadcn Dialog with custom implementation to fix width issues
	import { fade, scale } from 'svelte/transition';
	import { showToast } from '$lib/stores/toastStore';
	import { createEventDispatcher } from 'svelte';
	import { Copy, Check, X } from 'lucide-svelte';
	import { formatCurrency } from '$lib/utils/formatters';

	export let open = false;
	export let sku = '';
	export let title = '';
	export let asin = '';
	export let shippingDetails = '';
	export let supplies: any[] = [];
	export let currentData: any = null;

	let loading = false;
	let searching = false;
	let lastSearchedSku = '';

	// Constants - In a real Dev Ops environment, these would be environment variables or DB-driven
	const DEFAULT_MATERIAL_COST = 0.35;
	const FRAGILE_SURCHARGE = 1.00;

	let width = '10';
	let height = '10';
	let depth = '10';
	let weight = '1';
	let merchant_shipping_group = 'Nationwide Prime';
	let product_cost = '0';
	let material_cost = String(DEFAULT_MATERIAL_COST);
	let box_cost = '0';
	let vat_rate = '20';
	let is_vat_applicable = false;
	let is_fragile = false;
	let copied = false;
	let suggestions: any[] = [];

	const dispatch = createEventDispatcher();

	// Reset form when modal opens or currentData changes
	$: if (open && sku) {
		if (currentData) {
			width = String(currentData.width || '10');
			height = String(currentData.height || '10');
			depth = String(currentData.depth || '10');
			weight = String(currentData.weight || '1');
			merchant_shipping_group = currentData.merchant_shipping_group || 'Nationwide Prime';
			product_cost = String(currentData.total_value || '0');
			material_cost = String(currentData.material_cost || DEFAULT_MATERIAL_COST);
			box_cost = String(currentData.box_cost || '0');
			is_vat_applicable = currentData.vat_rate === '20' || currentData.vat_rate === 20;
			is_fragile = !!currentData.is_fragile;
		} else if (sku !== lastSearchedSku) {
			lastSearchedSku = sku;
			searchSuggestions();
		}
	}

	// Defensive reactive calculations
	$: safeProductCost = parseFloat(product_cost) || 0;
	$: safeMaterialCost = parseFloat(material_cost) || 0;
	$: safeBoxCost = parseFloat(box_cost) || 0;

	$: baseCost = safeProductCost + safeMaterialCost + safeBoxCost + (is_fragile ? FRAGILE_SURCHARGE : 0);
	$: vatAmount = is_vat_applicable ? baseCost * 0.2 : 0;
	$: totalCost = baseCost + vatAmount;

	// Validation logic
	$: isInputInvalid = isNaN(safeProductCost) || safeProductCost < 0;

	$: boxSizeCosts = supplies.reduce((map, s) => {
		if (['box', 'envelope', 'bag'].includes(s.type)) {
			const price = s.packing_supplier_prices?.[0]?.default_price || 0;
			map.set(s.code, price);
		}
		return map;
	}, new Map());

	let boxOptions: { code: string; name: string }[] = [];
	$: boxOptions = supplies
		.filter((s) => ['box', 'envelope', 'bag'].includes(s.type))
		.map((s) => ({ code: s.code, name: s.name }))
		.sort((a, b) => a.name.localeCompare(b.name));

	// If no supplies passed, fallback gracefully or just use empty arrays
	// Ensure 0x0x0 is always available as a choice
	$: if (!boxOptions.find((o) => o.code === '0x0x0')) {
		boxOptions = [{ code: '0x0x0', name: 'None / Own Box' }, ...boxOptions];
	}

	$: commonOptions = boxOptions;
	$: otherOptions = [] as { code: string; name: string }[];

	function handleBoxPresetChange(e: Event) {
		const val = (e.target as HTMLSelectElement).value;
		if (val && val !== 'custom') {
			if (val === '0x0x0') {
				box_cost = '0.00';
				width = '0';
				height = '0';
				depth = '0';
				return;
			}
			const cost = boxSizeCosts.get(val);
			if (cost !== undefined) {
				box_cost = Number(cost).toFixed(2);
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
		is_vat_applicable = item.vatRate === '20' || item.vatRate === 20 || !item.vatRate;
		
		// If suggestion has dimensions, try to match a box
		if (item.width && item.height && item.depth) {
			const key = `${item.width}x${item.height}x${item.depth}`;
			const cost = boxSizeCosts.get(key);
			if (cost !== undefined) {
				box_cost = cost.toFixed(2);
			}
		}

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
					material_cost,
					box_cost,
					vat_rate: is_vat_applicable ? '20' : '0',
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

	function copySku() {
		navigator.clipboard.writeText(sku);
		copied = true;
		setTimeout(() => (copied = false), 2000);
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
		class="fixed left-1/2 top-1/2 z-50 w-[min(96vw,1120px)] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden border bg-background shadow-2xl sm:rounded-xl"
		transition:scale={{ duration: 150, start: 0.95 }}
		role="dialog"
		aria-modal="true"
	>
		<!-- Header -->
		<div class="border-b bg-background px-5 py-4 sm:px-6">
			<div class="flex items-start justify-between gap-4">
				<div class="min-w-0">
					<h2 class="text-lg font-semibold leading-none tracking-tight">Update Cost Data</h2>

					{#if title}
						<div class="mt-2 text-base font-medium text-foreground line-clamp-2">
							{title}
						</div>
					{/if}
				</div>

				<button
					onclick={close}
					class="shrink-0 opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
					type="button"
				>
					<X class="h-4 w-4" />
					<span class="sr-only">Close</span>
				</button>
			</div>

			<div class="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
				<div class="flex items-center gap-2 flex-wrap">
					<span>SKU:</span>
					<span class="font-mono font-bold text-foreground bg-muted px-1.5 py-0.5 rounded">
						{sku}
					</span>
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
						<span>Ship:</span>
						<span class="font-medium text-foreground">{shippingDetails}</span>
					</div>
				{/if}

				<div class="text-xs pt-1">Enter the missing information below.</div>
			</div>
		</div>

		<!-- Scrollable body -->
		<div class="overflow-y-auto px-5 py-4 sm:px-6">
			<div class="grid grid-cols-1 xl:grid-cols-[1fr_0.95fr] gap-5 py-5">
				<!-- Left Column -->
				<div class="space-y-5">
					<div class="grid gap-5 rounded-xl border bg-card p-5 shadow-sm">
						<h3 class="text-base font-bold text-primary border-b pb-3">Shipping & VAT</h3>

						<div class="space-y-5 text-foreground">
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div class="space-y-1">
									<Label for="shipping" class="text-sm font-semibold">Shipping Template</Label>
									<select
										id="shipping"
										bind:value={merchant_shipping_group}
										class="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
									>
										<option value="Nationwide Prime">Nationwide Prime</option>
										<option value="UK Shipping">UK Shipping</option>
										<option value="UK shipping One day">UK shipping One day</option>
										<option value="Off Amazon">Off Amazon</option>
									</select>
								</div>

								<div class="space-y-1">
									<Label for="vat" class="text-sm font-semibold">VAT Application</Label>
									<div
										class="flex items-center h-11 px-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
									>
										<input
											type="checkbox"
											id="vat"
											bind:checked={is_vat_applicable}
											class="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary mr-3 cursor-pointer"
										/>
										<Label for="vat" class="text-sm font-bold cursor-pointer text-foreground">
											Apply 20% VAT
										</Label>
									</div>
								</div>
							</div>

							<div class="border-t pt-4">
								<h3 class="font-bold text-base text-primary uppercase tracking-tight">
									Cost Breakdown
								</h3>
							</div>

							<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
								<div class="space-y-1">
									<Label for="product_cost" class="text-sm font-bold text-primary">Product Cost</Label>
									<div class="relative">
										<span class="absolute left-3 top-3 text-primary font-bold">£</span>
										<Input
											id="product_cost"
											bind:value={product_cost}
											type="number"
											step="0.01"
											class="pl-7 h-11 text-base shadow-sm font-mono border-primary/40 focus-visible:ring-primary bg-primary/5 ring-offset-1"
										/>
									</div>
									<p class="text-[10px] text-primary/70 font-bold pt-1 uppercase tracking-tight">
										← Edit This
									</p>
								</div>

								<div class="space-y-1 opacity-80">
									<Label for="material_cost" class="text-sm font-semibold text-muted-foreground">
										Material
									</Label>
									<div class="relative">
										<span class="absolute left-3 top-3 text-muted-foreground font-medium">£</span>
										<Input
											id="material_cost"
											bind:value={material_cost}
											type="number"
											step="0.01"
											readonly
											class="pl-7 h-11 bg-muted/40 text-muted-foreground font-mono"
										/>
									</div>
								</div>

								<div class="space-y-1">
									<Label for="box_cost" class="text-sm font-semibold text-muted-foreground">Box</Label>
									<div class="relative">
										<span class="absolute left-3 top-3 text-muted-foreground font-medium">£</span>
										<Input
											id="box_cost"
											bind:value={box_cost}
											type="number"
											step="0.01"
											readonly
											class="pl-7 h-11 bg-muted/40 text-muted-foreground font-mono"
										/>
									</div>
								</div>
							</div>

							<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
								<div class="space-y-1">
									<Label for="weight" class="text-sm font-semibold">Shipping Weight</Label>
									<div class="relative">
										<Input
											id="weight"
											bind:value={weight}
											type="number"
											step="0.01"
											class="pl-3 pr-10 h-11 text-base shadow-sm"
										/>
										<span class="absolute right-3 top-3 text-muted-foreground font-medium">kg</span>
									</div>
								</div>

								<div class="space-y-1 text-foreground">
									<Label for="fragile" class="text-sm font-semibold">Handling</Label>
									<div
										class="flex items-center p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
									>
										<input
											type="checkbox"
											id="fragile"
											bind:checked={is_fragile}
											class="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary mr-3 cursor-pointer"
										/>
										<Label for="fragile" class="text-sm font-bold cursor-pointer text-foreground">
											Fragile Item (+£1.00)
										</Label>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Right Column -->
				<div class="space-y-5">
					<div class="grid gap-5 rounded-xl border bg-card p-5 shadow-sm">
						<h3 class="text-base font-bold text-primary border-b pb-3">Package Dimensions</h3>

						<div class="space-y-4">
							<div class="grid gap-2">
								<Label class="text-sm font-semibold">Box Size Override</Label>
								<select
									class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary shadow-sm"
									onchange={handleBoxPresetChange}
									value={`${width}x${height}x${depth}`}
								>
									<option value="custom">Custom Dimensions</option>
									<optgroup label="Available Sizes">
										{#each commonOptions as option}
											<option value={option.code}>{option.name}</option>
										{/each}
									</optgroup>
									<optgroup label="Other Options">
										{#each otherOptions as option}
											<option value={option.code}>{option.name}</option>
										{/each}
									</optgroup>
								</select>
							</div>

							<div class="grid grid-cols-3 gap-3 text-foreground">
								<div class="space-y-1">
									<Label class="text-xs font-semibold text-muted-foreground">Width</Label>
									<Input
										placeholder="0"
										bind:value={width}
										type="number"
										class="h-11 text-center font-mono text-base"
									/>
								</div>
								<div class="space-y-1">
									<Label class="text-xs font-semibold text-muted-foreground">Height</Label>
									<Input
										placeholder="0"
										bind:value={height}
										type="number"
										class="h-11 text-center font-mono text-base"
									/>
								</div>
								<div class="space-y-1">
									<Label class="text-xs font-semibold text-muted-foreground">Depth</Label>
									<Input
										placeholder="0"
										bind:value={depth}
										type="number"
										class="h-11 text-center font-mono text-base"
									/>
								</div>
							</div>

							<div
								class="text-[11px] font-bold text-muted-foreground text-center bg-muted/40 py-2 rounded-md uppercase tracking-wider border border-dashed"
							>
								Total Volume:
								{(
									((parseFloat(width) || 0) *
										(parseFloat(height) || 0) *
										(parseFloat(depth) || 0)) /
									1000
								).toFixed(2)}
								Liters
							</div>

							<div class="rounded-xl bg-muted/20 p-5 border-2 border-dashed space-y-3">
								<div class="flex justify-between items-center text-sm">
									<span class="text-muted-foreground font-semibold uppercase tracking-wider">
										Subtotal (Net)
									</span>
									<span class="font-mono text-base font-bold text-foreground">
										{formatCurrency(baseCost)}
									</span>
								</div>

								<div class="flex justify-between items-center text-sm text-muted-foreground">
									<span class="font-medium">VAT ({vat_rate}%)</span>
									<span class="font-mono">{formatCurrency(vatAmount)}</span>
								</div>

								<div class="border-t-2 border-primary/20 pt-4 flex justify-between items-center">
									<span class="font-extrabold text-lg text-foreground uppercase tracking-tight">
										Total Cost
									</span>
									<span class="font-mono font-black text-2xl text-primary leading-none">
										{formatCurrency(totalCost)}
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Footer -->
		<div class="border-t bg-background px-5 py-4 sm:px-6">
			<div class="flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2">
				{#if isInputInvalid}
					<p class="text-xs text-destructive font-bold self-center mb-2 sm:mb-0 sm:mr-4">
						Please enter a valid product cost
					</p>
				{/if}
				<Button 
					type="submit" 
					onclick={handleSubmit} 
					disabled={loading || isInputInvalid} 
					class="w-full sm:w-auto relative"
				>
					{#if loading}
						<span class="opacity-0">Save changes</span>
						<div class="absolute inset-0 flex items-center justify-center">
							<div class="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
						</div>
					{:else}
						Save changes
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}
