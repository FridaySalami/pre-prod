<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';

	interface ProductData {
		sku: string;
		title: string;
		weight: number;
		box: string;
		shipping: string;
		shippingTier: string;
		cost: number;
		costPlusMargin: number;
		marginProfit: number;
		materialTotalCost: number;
		shippingCost: number;
		amazonPrice: number;
		amazonFee: number;
		profitAfterFees: number;
		isProfitable: boolean;
		customMargin: number;
		customAmazonFee: number;
		isCustomShipping: boolean;
	}

	let sku = '';
	let customShippingCost = '';
	let customMargin = '23';
	let customAmazonFee = '15';
	let quantity = '1';
	let data: ProductData | null = null;
	let loading = false;
	let error = '';

	// Calculate new values when shipping cost changes
	$: newShippingCost = customShippingCost
		? parseFloat(customShippingCost)
		: data?.shippingCost || 0;
	$: newAmazonPrice = data ? calculateNewAmazonPrice(data, newShippingCost) : 0;
	$: newProfit = data ? calculateNewProfit(data, newShippingCost, newAmazonPrice) : 0;
	$: qty = parseInt(quantity) || 1;

	// Calculate quantity-adjusted values for display
	$: totalAmazonPrice = data ? data.amazonPrice * qty : 0;
	$: totalMaterialCost = data ? data.materialTotalCost * qty : 0;
	$: totalAmazonFee = data ? data.amazonPrice * (parseFloat(customAmazonFee) / 100) * qty : 0;
	$: totalOriginalProfit = data
		? data.amazonPrice * qty -
			data.amazonPrice * (parseFloat(customAmazonFee) / 100) * qty -
			data.materialTotalCost * qty -
			data.shippingCost
		: 0;

	function calculateNewAmazonPrice(originalData: ProductData, shippingCost: number): number {
		// For post-sale analysis, the Amazon price stays the same (what customer paid)
		return originalData.amazonPrice;
	}

	function calculateNewProfit(
		originalData: ProductData,
		shippingCost: number,
		amazonPrice: number
	): number {
		// Post-sale profit with quantity = (Amazon Price × Qty) - (Amazon Fee × Qty) - (Material Total × Qty) - Shipping (per order)
		const amazonFee = amazonPrice * (parseFloat(customAmazonFee) / 100) * qty;
		const totalAmazonPrice = amazonPrice * qty;
		const totalMaterialCost = originalData.materialTotalCost * qty;
		return totalAmazonPrice - amazonFee - totalMaterialCost - shippingCost;
	}

	async function loadProduct() {
		if (!sku.trim()) {
			error = 'Please enter a SKU';
			return;
		}

		loading = true;
		error = '';

		try {
			const params = new URLSearchParams({
				sku: sku.trim(),
				margin: customMargin,
				amazonFee: (parseFloat(customAmazonFee) / 100).toString()
			});

			const res = await fetch(`/api/inventory-profit-calculator/calculate?${params}`);
			const result = await res.json();

			if (result.success) {
				data = result.data;
				// Reset custom shipping when loading new product
				customShippingCost = '';
			} else {
				error = result.error || 'Failed to load product';
				data = null;
			}
		} catch (e) {
			error = 'Error loading product';
			data = null;
		} finally {
			loading = false;
		}
	}

	function handleSkuSearch(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			loadProduct();
		}
	}

	// Auto-load SKU from URL parameter
	onMount(() => {
		const urlSku = $page.url.searchParams.get('sku');
		if (urlSku) {
			sku = urlSku;
			loadProduct();
		}
	});
</script>

<svelte:head>
	<title>Shipping Cost Scenario Analysis</title>
</svelte:head>

<div class="container mx-auto px-4 py-6">
	<Breadcrumb currentPage="SKU Shipping Calculator" />

	<div class="mb-6">
		<h1 class="text-3xl font-bold mb-2">SKU Shipping Calculator</h1>
		<p class="text-gray-600">
			Post-sale analysis: How do different shipping costs affect actual profit?
		</p>
	</div>

	<!-- SKU Input Section -->
	<div class="bg-white rounded-lg shadow-sm border p-4 mb-6">
		<div class="flex gap-4 items-center">
			<div>
				<label for="sku" class="block text-sm font-medium text-gray-700 mb-1">SKU</label>
				<input
					id="sku"
					type="text"
					bind:value={sku}
					on:keydown={handleSkuSearch}
					placeholder="Enter SKU..."
					class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
			</div>
			<div>
				<label for="margin" class="block text-sm font-medium text-gray-700 mb-1">Margin (%)</label>
				<input
					id="margin"
					type="number"
					step="0.1"
					bind:value={customMargin}
					class="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
			</div>
			<div>
				<label for="amazonFee" class="block text-sm font-medium text-gray-700 mb-1"
					>Amazon Fee (%)</label
				>
				<input
					id="amazonFee"
					type="number"
					step="0.1"
					bind:value={customAmazonFee}
					class="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
			</div>
			<div>
				<label for="quantity" class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
				<input
					id="quantity"
					type="number"
					min="1"
					step="1"
					bind:value={quantity}
					class="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
			</div>
			<div class="pt-6">
				<button
					on:click={loadProduct}
					disabled={loading || !sku.trim()}
					class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{loading ? 'Loading...' : 'Load Product'}
				</button>
			</div>
		</div>
	</div>

	<!-- Error Display -->
	{#if error}
		<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
			{error}
		</div>
	{/if}

	<!-- Excel-like Table -->
	{#if data}
		<div class="bg-white rounded-lg shadow-sm border overflow-hidden">
			<!-- Header with product info -->
			<div class="bg-gray-50 px-6 py-4 border-b">
				<h2 class="text-xl font-semibold text-gray-900">{data.sku}</h2>
				<p class="text-sm text-gray-600">{data.title}</p>
			</div>

			<!-- Excel-like spreadsheet -->
			<div class="overflow-x-auto">
				<table class="w-full">
					<!-- Column Headers (A-M) -->
					<thead>
						<tr class="bg-gray-100 border-b">
							<th class="w-12 px-2 py-2 text-center text-xs font-medium text-gray-500 border-r"
								>A</th
							>
							<th class="w-12 px-2 py-2 text-center text-xs font-medium text-gray-500 border-r"
								>B</th
							>
							<th class="w-24 px-2 py-2 text-center text-xs font-medium text-gray-500 border-r"
								>C</th
							>
							<th class="w-24 px-2 py-2 text-center text-xs font-medium text-gray-500 border-r"
								>D</th
							>
							<th class="w-32 px-2 py-2 text-center text-xs font-medium text-gray-500 border-r"
								>E</th
							>
							<th class="w-24 px-2 py-2 text-center text-xs font-medium text-gray-500 border-r"
								>F</th
							>
							<th class="w-24 px-2 py-2 text-center text-xs font-medium text-gray-500 border-r"
								>G</th
							>
							<th class="w-32 px-2 py-2 text-center text-xs font-medium text-gray-500 border-r"
								>H</th
							>
							<th class="w-24 px-2 py-2 text-center text-xs font-medium text-gray-500 border-r"
								>I</th
							>
							<th class="w-24 px-2 py-2 text-center text-xs font-medium text-gray-500 border-r"
								>J</th
							>
							<th
								class="w-32 px-2 py-2 text-center text-xs font-medium text-gray-500 border-r bg-yellow-100"
								>K</th
							>
							<th
								class="w-24 px-2 py-2 text-center text-xs font-medium text-gray-500 border-r bg-green-100"
								>L</th
							>
							<th class="w-24 px-2 py-2 text-center text-xs font-medium text-gray-500 bg-green-100"
								>M</th
							>
						</tr>
					</thead>
					<tbody>
						<!-- Row 1: Headers -->
						<tr class="border-b bg-gray-50">
							<td class="px-2 py-3 text-xs text-gray-600 border-r">1</td>
							<td class="px-2 py-3 text-xs font-medium text-gray-900 border-r">SKU</td>
							<td class="px-2 py-3 text-xs font-medium text-gray-900 border-r">Listed Price</td>
							<td class="px-2 py-3 text-xs font-medium text-gray-900 border-r"
								>Cost Price + Margin</td
							>
							<td class="px-2 py-3 text-xs font-medium text-gray-900 border-r">Costs</td>
							<td class="px-2 py-3 text-xs font-medium text-gray-900 border-r">Fees</td>
							<td class="px-2 py-3 text-xs font-medium text-gray-900 border-r">Shipping</td>
							<td class="px-2 py-3 text-xs font-medium text-gray-900 border-r">Shipping Tier</td>
							<td class="px-2 py-3 text-xs font-medium text-gray-900 border-r">Profit</td>
							<td class="px-2 py-3 text-xs font-medium text-gray-900 border-r">Business Profit %</td
							>
							<td class="px-2 py-3 text-xs font-medium text-gray-900 border-r bg-yellow-100"
								>Change Shipping to</td
							>
							<td class="px-2 py-3 text-xs font-medium text-gray-900 border-r bg-green-100"
								>Profit after change</td
							>
							<td class="px-2 py-3 text-xs font-medium text-gray-900 bg-green-100"
								>Business Profit % after change</td
							>
						</tr>
						<!-- Row 2: Data -->
						<tr class="border-b hover:bg-gray-50">
							<td class="px-2 py-3 text-xs text-gray-600 border-r">2</td>
							<td class="px-2 py-3 text-sm font-medium text-gray-900 border-r">{data.sku}</td>
							<td class="px-2 py-3 text-sm text-gray-900 border-r"
								>£{totalAmazonPrice.toFixed(2)}</td
							>
							<td class="px-2 py-3 text-sm text-blue-600 font-medium border-r"
								>£{(data.costPlusMargin * qty).toFixed(2)}</td
							>
							<td class="px-2 py-3 text-sm text-gray-900 border-r"
								>£{totalMaterialCost.toFixed(2)}</td
							>
							<td class="px-2 py-3 text-sm text-red-600 border-r">£{totalAmazonFee.toFixed(2)}</td>
							<td class="px-2 py-3 text-sm text-indigo-600 border-r"
								>£{data.shippingCost.toFixed(2)}</td
							>
							<td class="px-2 py-3 text-sm text-gray-700 border-r">{data.shippingTier}</td>
							<td
								class="px-2 py-3 text-sm font-medium border-r {totalOriginalProfit > 0
									? 'text-green-600'
									: 'text-red-600'}"
							>
								£{totalOriginalProfit.toFixed(2)}
							</td>
							<td
								class="px-2 py-3 text-sm font-medium border-r {totalOriginalProfit > 0
									? 'text-green-600'
									: 'text-red-600'}"
							>
								{data.cost > 0
									? ((totalOriginalProfit / (data.cost * qty)) * 100).toFixed(1)
									: '0.0'}%
							</td>
							<td class="px-2 py-3 border-r bg-yellow-50">
								<input
									type="number"
									step="0.01"
									bind:value={customShippingCost}
									placeholder={data.shippingCost.toFixed(2)}
									class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
								/>
							</td>
							<td
								class="px-2 py-3 text-sm font-medium border-r bg-green-50 {newProfit > 0
									? 'text-green-600'
									: 'text-red-600'}"
							>
								£{newProfit.toFixed(2)}
							</td>
							<td
								class="px-2 py-3 text-sm font-medium bg-green-50 {newProfit > 0
									? 'text-green-600'
									: 'text-red-600'}"
							>
								{data && data.cost > 0
									? ((newProfit / (data.cost * qty)) * 100).toFixed(1)
									: '0.0'}%
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<!-- Summary Section -->
			<div class="bg-gray-50 px-6 py-4 border-t">
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div class="text-sm">
						<span class="font-medium text-gray-700">Weight:</span>
						<span class="text-gray-900">{data.weight}kg</span>
					</div>
					<div class="text-sm">
						<span class="font-medium text-gray-700">Box:</span>
						<span class="text-gray-900">{data.box}</span>
					</div>
					<div class="text-sm">
						<span class="font-medium text-gray-700">Service:</span>
						<span class="text-gray-900">{data.shipping}</span>
					</div>
				</div>
			</div>
		</div>
	{:else if !loading}
		<div class="bg-gray-50 rounded-lg p-8 text-center">
			<p class="text-gray-600">Enter a SKU above to load product data</p>
		</div>
	{/if}
</div>
