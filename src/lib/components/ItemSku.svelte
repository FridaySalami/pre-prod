<script lang="ts">
	import { onMount } from 'svelte';

	export let item: { ItemNumber?: string; ItemName?: string };

	let sku: string | null = null;
	let isLoading = false;
	let error: string | null = null;

	onMount(async () => {
		if (!item || !item.ItemNumber) {
			error = 'Item number is missing';
			return;
		}

		isLoading = true;
		error = null;
		try {
			// IMPORTANT: Replace with your actual API endpoint for fetching SKU details
			const response = await fetch(`/api/sku-details?itemNumber=${item.ItemNumber}`);
			if (!response.ok) {
				throw new Error(`API Error ${response.status}: ${await response.text()}`);
			}
			const data = await response.json();
			if (data && data.sku) {
				sku = data.sku;
			} else {
				throw new Error('SKU not found in API response');
			}
		} catch (err) {
			console.error('Error fetching SKU:', err);
			error = err instanceof Error ? err.message : String(err);
			sku = 'Error fetching SKU'; // Display error in place of SKU
		} finally {
			isLoading = false;
		}
	});
</script>

<div class="item-sku-container">
	{#if item}
		<span>{item.ItemName || 'Unknown Item'}: </span>
		{#if isLoading}
			<span class="loading-sku">Loading SKU...</span>
		{:else if error && sku === 'Error fetching SKU'}
			<span class="sku-error">{error}</span>
		{:else if sku}
			<span class="sku-value">{sku}</span>
		{:else}
			<span class="sku-not-found">SKU not available</span>
		{/if}
	{/if}
</div>

<style>
	.item-sku-container {
		font-size: 0.8em;
		padding: 2px 0;
	}
	.loading-sku {
		color: #6b7280; /* gray-500 */
	}
	.sku-error {
		color: #ef4444; /* red-500 */
		font-weight: bold;
	}
	.sku-value {
		font-weight: 500;
	}
	.sku-not-found {
		color: #6b7280; /* gray-500 */
		font-style: italic;
	}
</style>
