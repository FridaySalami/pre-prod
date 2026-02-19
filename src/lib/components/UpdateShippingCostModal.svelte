<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button';
	import { Input } from '$lib/shadcn/ui/input';
	import { Label } from '$lib/shadcn/ui/label';
	import { fade, scale } from 'svelte/transition';
	import { showToast } from '$lib/toastStore';
	import { createEventDispatcher } from 'svelte';
	import { X, Truck, Save } from 'lucide-svelte';

	export let open = false;
	export let orderId = '';
	export let currentShippingCost: number | null = null;
	export let currencyCode = 'GBP';

	let loading = false;
	let shippingCostString = '';

	$: if (open && currentShippingCost !== null) {
		shippingCostString = currentShippingCost.toString();
	} else if (open) {
		shippingCostString = '';
	}

	const dispatch = createEventDispatcher();

	async function handleSave() {
		if (!orderId) return;

		const costValue = parseFloat(shippingCostString);
		if (isNaN(costValue) && shippingCostString !== '') {
			showToast('Please enter a valid number for shipping cost', 'error');
			return;
		}

		loading = true;
		try {
			const response = await fetch('/api/amazon/orders/update-shipping-cost', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					orderId,
					shippingCost: shippingCostString === '' ? null : costValue
				})
			});

			const result = await response.json();

			if (result.success) {
				showToast('Shipping cost updated successfully', 'success');
				dispatch('success');
				open = false;
			} else {
				showToast(result.error || 'Failed to update shipping cost', 'error');
			}
		} catch (error) {
			console.error('Error updating shipping cost:', error);
			showToast('An error occurred while updating shipping cost', 'error');
		} finally {
			loading = false;
		}
	}

	function close() {
		if (!loading) open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
		onmousedown={close}
		transition:fade={{ duration: 200 }}
		onkeydown={handleKeydown}
	>
		<div
			class="relative w-full max-w-md bg-white dark:bg-slate-950 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
			onmousedown={(e) => e.stopPropagation()}
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<!-- Header -->
			<div
				class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50"
			>
				<div class="flex items-center gap-3">
					<div
						class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400"
					>
						<Truck class="h-5 w-5" />
					</div>
					<div>
						<h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit Shipping</h3>
						<p class="text-xs text-slate-500 dark:text-slate-400 font-mono">{orderId}</p>
					</div>
				</div>
				<button
					onclick={close}
					class="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<!-- Content -->
			<div class="p-6 space-y-6">
				<div
					class="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 p-4 rounded-lg"
				>
					<p class="text-sm text-blue-800 dark:text-blue-300">
						Enter the manual shipping cost for this order. This will override any estimated costs in
						calculations.
					</p>
				</div>

				<div class="space-y-4">
					<div class="grid gap-2">
						<Label for="shipping_cost" class="text-sm font-medium"
							>Actual Shipping Cost ({currencyCode})</Label
						>
						<div class="relative">
							<span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
								{currencyCode === 'GBP' ? '£' : currencyCode === 'EUR' ? '€' : '$'}
							</span>
							<Input
								id="shipping_cost"
								type="number"
								step="0.01"
								placeholder="0.00"
								class="pl-7 h-11 text-lg"
								bind:value={shippingCostString}
								disabled={loading}
							/>
						</div>
						<p class="text-[10px] text-slate-400">Leave empty to revert to estimated cost.</p>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div
				class="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3"
			>
				<Button variant="outline" onclick={close} disabled={loading}>Cancel</Button>
				<Button
					onclick={handleSave}
					disabled={loading}
					class="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px]"
				>
					{#if loading}
						<div
							class="h-4 w-4 border-2 border-white/30 border-t-white animate-spin rounded-full mr-2"
						></div>
						Saving...
					{:else}
						<Save class="h-4 w-4 mr-2" />
						Save Changes
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}
