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
	let total_value = '0';
	let vat_rate = '20';

	$: baseCost = parseFloat(total_value) || 0;
	$: vatAmount = baseCost * ((parseFloat(vat_rate) || 0) / 100);
	$: totalCost = baseCost + vatAmount;

	const dispatch = createEventDispatcher();

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
					total_value,
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
	<DialogContent class="sm:max-w-[425px]">
		<DialogHeader>
			<DialogTitle>Update Cost Data</DialogTitle>
			<DialogDescription>
				Enter the missing information for SKU: <span class="font-mono font-bold">{sku}</span>
			</DialogDescription>
		</DialogHeader>
		<div class="grid gap-4 py-4">
			<div class="grid grid-cols-4 items-center gap-4">
				<Label for="cost" class="text-right">Base Cost (Ex VAT)</Label>
				<Input id="cost" bind:value={total_value} class="col-span-3" type="number" step="0.01" />
			</div>
			<div class="grid grid-cols-4 items-center gap-4">
				<Label for="vat" class="text-right">VAT Rate (%)</Label>
				<Input id="vat" bind:value={vat_rate} class="col-span-3" type="number" />
			</div>
			<div class="grid grid-cols-4 gap-4">
				<div class="col-start-2 col-span-3">
					<div class="rounded-md bg-muted p-3 text-sm">
						<div class="flex justify-between mb-1">
							<span class="text-muted-foreground">VAT Amount:</span>
							<span>£{vatAmount.toFixed(2)}</span>
						</div>
						<div class="flex justify-between font-medium border-t pt-1 mt-1 border-border">
							<span>Total Cost (Inc VAT):</span>
							<span>£{totalCost.toFixed(2)}</span>
						</div>
					</div>
				</div>
			</div>
			<div class="grid grid-cols-4 items-center gap-4">
				<Label for="shipping" class="text-right">Shipping Group</Label>
				<select
					id="shipping"
					bind:value={merchant_shipping_group}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 col-span-3"
				>
					<option value="Nationwide Prime">Nationwide Prime</option>
					<option value="UK Shipping">UK Shipping</option>
					<option value="UK shipping One day">UK shipping One day</option>
					<option value="Off Amazon">Off Amazon</option>
				</select>
			</div>
			<div class="grid grid-cols-4 items-center gap-4">
				<Label class="text-right">Dimensions (cm)</Label>
				<div class="col-span-3 flex gap-2">
					<Input placeholder="W" bind:value={width} type="number" />
					<Input placeholder="H" bind:value={height} type="number" />
					<Input placeholder="D" bind:value={depth} type="number" />
				</div>
			</div>
			<div class="grid grid-cols-4 items-center gap-4">
				<Label for="weight" class="text-right">Weight (kg)</Label>
				<Input id="weight" bind:value={weight} class="col-span-3" type="number" step="0.01" />
			</div>
		</div>
		<DialogFooter>
			<Button type="submit" onclick={handleSubmit} disabled={loading}>
				{loading ? 'Saving...' : 'Save changes'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
