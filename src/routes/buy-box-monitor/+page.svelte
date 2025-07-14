<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import type { SkuAsinMapping, BuyBoxResponse } from '$lib/types/buybox';

	// Search and results state
	let searchQuery = '';
	let searchResults: SkuAsinMapping[] = [];
	let isLoading = false;
	let errorMessage = '';
	let resultCount = 0;
	let selectedProduct: SkuAsinMapping | null = null;
	let buyBoxInfo: BuyBoxResponse | null = null;
	let isBuyBoxLoading = false;
	let buyBoxError = '';

	// Pagination
	let currentPage = 1;
	let itemsPerPage = 10;

	// Initialize from URL params if any
	onMount(() => {
		if (browser) {
			const urlParams = new URLSearchParams(window.location.search);
			const urlQuery = urlParams.get('query');
			if (urlQuery) {
				searchQuery = urlQuery;
				handleSearch();
			}
		}
	});

	// Search function
	async function handleSearch(): Promise<void> {
		if (!searchQuery.trim()) return;

		isLoading = true;
		errorMessage = '';

		try {
			// Update URL with search query
			if (browser) {
				const url = new URL(window.location.href);
				url.searchParams.set('query', searchQuery);
				window.history.replaceState({}, '', url);
			}

			// Fetch results from API
			const response = await fetch(
				`/api/buy-box-monitor/search?query=${encodeURIComponent(searchQuery)}&page=${currentPage}&limit=${itemsPerPage}`
			);
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to search products');
			}

			searchResults = data.results as SkuAsinMapping[];
			resultCount = data.total;

			// Clear previous selection
			selectedProduct = null;
			buyBoxInfo = null;
		} catch (error: unknown) {
			console.error('Search error:', error);
			errorMessage = error instanceof Error ? error.message : 'An error occurred while searching';
			searchResults = [];
			resultCount = 0;
		} finally {
			isLoading = false;
		}
	}

	// Function to check Buy Box ownership for a specific product
	async function checkBuyBox(product: SkuAsinMapping): Promise<void> {
		selectedProduct = product;
		isBuyBoxLoading = true;
		buyBoxError = '';
		buyBoxInfo = null;

		try {
			const response = await fetch(
				`/api/buy-box-monitor/check?asin=${encodeURIComponent(product.asin1 || '')}`
			);
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to check Buy Box');
			}

			buyBoxInfo = data as BuyBoxResponse;
		} catch (error: unknown) {
			console.error('Buy Box check error:', error);
			buyBoxError = error instanceof Error ? error.message : 'Failed to check Buy Box ownership';
		} finally {
			isBuyBoxLoading = false;
		}
	}

	// Handle pagination
	function changePage(newPage: number): void {
		if (newPage < 1) newPage = 1;
		currentPage = newPage;
		handleSearch();
	}
</script>

<svelte:head>
	<title>Buy Box Monitor | Dashboard</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="mb-8">
		<div class="flex justify-between items-center mb-2">
			<h1 class="text-3xl font-bold">Buy Box Monitor</h1>
			<div>
				<a
					href="/buy-box-monitor/jobs"
					class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
				>
					View Jobs
				</a>
			</div>
		</div>
		<p class="text-gray-600 mb-6">Search for products by SKU to check Buy Box ownership status</p>

		<!-- Search Form -->
		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<div class="flex flex-col md:flex-row gap-4">
				<div class="flex-grow">
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Enter SKU, item name or ASIN..."
						class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						on:keydown={(e) => e.key === 'Enter' && handleSearch()}
					/>
				</div>
				<button
					on:click={handleSearch}
					class="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
					disabled={isLoading}
				>
					{#if isLoading}
						<span class="inline-block animate-spin mr-2">⟳</span>Searching...
					{:else}
						Search
					{/if}
				</button>
			</div>
		</div>

		<!-- Results Section -->
		{#if errorMessage}
			<div
				class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6"
				role="alert"
				transition:fade
			>
				<p>{errorMessage}</p>
			</div>
		{/if}

		{#if searchResults.length > 0}
			<div class="bg-white rounded-lg shadow-md overflow-hidden">
				<div class="px-6 py-4 border-b border-gray-200">
					<h2 class="text-xl font-semibold">Search Results</h2>
					<p class="text-sm text-gray-600">Found {resultCount} products matching your search</p>
				</div>

				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th
									scope="col"
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
									>SKU</th
								>
								<th
									scope="col"
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
									>Item Name</th
								>
								<th
									scope="col"
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
									>ASIN</th
								>
								<th
									scope="col"
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
									>Price</th
								>
								<th
									scope="col"
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
									>Status</th
								>
								<th
									scope="col"
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
									>Actions</th
								>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{#each searchResults as product}
								<tr class={selectedProduct?.id === product.id ? 'bg-blue-50' : ''}>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
										>{product.seller_sku}</td
									>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
										>{product.item_name || 'N/A'}</td
									>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
										{#if product.asin1}
											<a
												href={`https://www.amazon.co.uk/dp/${product.asin1}`}
												target="_blank"
												rel="noopener noreferrer"
												class="text-blue-600 hover:text-blue-800 hover:underline"
											>
												{product.asin1}
											</a>
										{:else}
											N/A
										{/if}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
										{product.price ? `£${product.price.toFixed(2)}` : 'N/A'}
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<span
											class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${
												product.status === 'active'
													? 'bg-green-100 text-green-800'
													: product.status === 'inactive'
														? 'bg-red-100 text-red-800'
														: 'bg-gray-100 text-gray-800'
											}`}
										>
											{product.status || 'Unknown'}
										</span>
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
										<button
											on:click={() => checkBuyBox(product)}
											class="text-blue-600 hover:text-blue-900 mr-3 font-medium"
											disabled={!product.asin1 || isBuyBoxLoading}
										>
											Check Buy Box
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Pagination -->
				{#if resultCount > itemsPerPage}
					<div
						class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between"
					>
						<div>
							<p class="text-sm text-gray-700">
								Showing <span class="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to
								<span class="font-medium">{Math.min(currentPage * itemsPerPage, resultCount)}</span>
								of <span class="font-medium">{resultCount}</span> results
							</p>
						</div>
						<div class="flex-1 flex justify-end">
							<button
								on:click={() => changePage(currentPage - 1)}
								disabled={currentPage <= 1}
								class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 {currentPage <=
								1
									? 'opacity-50 cursor-not-allowed'
									: ''}"
							>
								Previous
							</button>
							<button
								on:click={() => changePage(currentPage + 1)}
								disabled={currentPage * itemsPerPage >= resultCount}
								class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 {currentPage *
									itemsPerPage >=
								resultCount
									? 'opacity-50 cursor-not-allowed'
									: ''}"
							>
								Next
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Buy Box Details -->
		{#if selectedProduct && buyBoxInfo}
			<div class="mt-8 bg-white rounded-lg shadow-md overflow-hidden" transition:fade>
				<div class="px-6 py-4 border-b border-gray-200 bg-blue-50">
					<h2 class="text-xl font-semibold">Buy Box Analysis</h2>
					<p class="text-sm text-gray-600">
						Product: {selectedProduct.item_name} ({selectedProduct.seller_sku})
					</p>
				</div>

				<div class="p-6">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div>
							<h3 class="text-lg font-medium mb-2">Product Details</h3>
							<dl class="grid grid-cols-3 gap-2 text-sm">
								<dt class="font-medium text-gray-500">ASIN:</dt>
								<dd class="col-span-2">
									<a
										href={`https://www.amazon.co.uk/dp/${selectedProduct.asin1}`}
										target="_blank"
										rel="noopener noreferrer"
										class="text-blue-600 hover:text-blue-800 hover:underline"
									>
										{selectedProduct.asin1}
									</a>
								</dd>

								<dt class="font-medium text-gray-500">SKU:</dt>
								<dd class="col-span-2">{selectedProduct.seller_sku}</dd>

								<dt class="font-medium text-gray-500">Your Price:</dt>
								<dd class="col-span-2">
									{selectedProduct.price ? `£${selectedProduct.price.toFixed(2)}` : 'N/A'}
								</dd>
							</dl>
						</div>

						<div>
							<h3 class="text-lg font-medium mb-2">Buy Box Status</h3>
							<dl class="grid grid-cols-3 gap-2 text-sm">
								<dt class="font-medium text-gray-500">Buy Box Owner:</dt>
								<dd
									class="col-span-2 font-medium {buyBoxInfo.hasBuyBox
										? 'text-green-600'
										: 'text-red-600'}"
								>
									{buyBoxInfo.buyBoxOwner || 'Unknown'}
								</dd>

								<dt class="font-medium text-gray-500">You Own Buy Box:</dt>
								<dd class="col-span-2">
									<span
										class={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${buyBoxInfo.hasBuyBox ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
									>
										{buyBoxInfo.hasBuyBox ? 'Yes' : 'No'}
									</span>
								</dd>

								<dt class="font-medium text-gray-500">Buy Box Price:</dt>
								<dd class="col-span-2">
									{buyBoxInfo.buyBoxPrice ? `£${buyBoxInfo.buyBoxPrice.toFixed(2)}` : 'N/A'}
								</dd>

								<dt class="font-medium text-gray-500">Price Difference:</dt>
								<dd class="col-span-2">
									{#if buyBoxInfo.buyBoxPrice && selectedProduct.price}
										<span
											class={(buyBoxInfo.priceDifference || 0) > 0
												? 'text-red-600'
												: (buyBoxInfo.priceDifference || 0) < 0
													? 'text-green-600'
													: 'text-gray-600'}
										>
											{(buyBoxInfo.priceDifference || 0) > 0 ? '+' : ''}{(
												buyBoxInfo.priceDifference || 0
											).toFixed(2)}
											({Math.abs(buyBoxInfo.priceDifferencePercent || 0).toFixed(2)}%)
										</span>
									{:else}
										N/A
									{/if}
								</dd>
							</dl>
						</div>
					</div>

					{#if buyBoxInfo.competitorInfo && buyBoxInfo.competitorInfo.length > 0}
						<div class="mt-6">
							<h3 class="text-lg font-medium mb-2">Competitor Analysis</h3>
							<div class="overflow-x-auto">
								<table class="min-w-full divide-y divide-gray-200">
									<thead class="bg-gray-50">
										<tr>
											<th
												scope="col"
												class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Seller</th
											>
											<th
												scope="col"
												class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Price</th
											>
											<th
												scope="col"
												class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Condition</th
											>
											<th
												scope="col"
												class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Fulfillment</th
											>
											<th
												scope="col"
												class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Buy Box</th
											>
										</tr>
									</thead>
									<tbody class="bg-white divide-y divide-gray-200">
										{#each buyBoxInfo.competitorInfo as competitor}
											<tr class={competitor.sellerName === 'Your Store' ? 'bg-yellow-50' : ''}>
												<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
													{competitor.sellerName}
													{#if competitor.sellerName === 'Your Store'}
														<span class="text-yellow-500 ml-1" title="Your Listing">★</span>
													{/if}
												</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
													>£{competitor.price.toFixed(2)}</td
												>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
													>{competitor.condition}</td
												>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
													{competitor.fulfillmentType === 'FBA' ? 'Amazon (FBA)' : 'Merchant'}
												</td>
												<td class="px-6 py-4 whitespace-nowrap">
													<span
														class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${competitor.hasBuyBox ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
													>
														{competitor.hasBuyBox ? 'Yes' : 'No'}
													</span>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
								<div class="mt-2 text-xs text-gray-500 italic px-6 py-2">
									<span class="text-yellow-500 mr-1">★</span> Indicates your own listing
								</div>
							</div>
						</div>
					{/if}

					<!-- Enhanced Margin Analysis Section -->
					{#if buyBoxInfo.cost_data_source && buyBoxInfo.cost_data_source !== 'error' && buyBoxInfo.cost_data_source !== 'unavailable'}
						<div class="mt-6">
							<h3 class="text-lg font-medium mb-4">Margin Analysis</h3>

							<!-- Profit Summary Cards -->
							<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
								<!-- Current Profit -->
								<div class="bg-blue-50 rounded-lg p-4 border border-blue-200">
									<h4 class="text-sm font-medium text-blue-800 mb-2">Current Profit</h4>
									<div class="text-2xl font-bold text-blue-900">
										£{(buyBoxInfo.current_actual_profit || 0).toFixed(2)}
									</div>
									<div class="text-sm text-blue-700 mt-1">
										{(buyBoxInfo.your_margin_percent_at_current_price || 0).toFixed(1)}% margin
									</div>
								</div>

								<!-- Buy Box Profit -->
								<div class="bg-green-50 rounded-lg p-4 border border-green-200">
									<h4 class="text-sm font-medium text-green-800 mb-2">At Buy Box Price</h4>
									<div class="text-2xl font-bold text-green-900">
										£{(buyBoxInfo.buybox_actual_profit || 0).toFixed(2)}
									</div>
									<div class="text-sm text-green-700 mt-1">
										{(buyBoxInfo.margin_percent_at_buybox_price || 0).toFixed(1)}% margin
									</div>
								</div>

								<!-- Profit Opportunity -->
								<div class="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
									<h4 class="text-sm font-medium text-yellow-800 mb-2">Opportunity</h4>
									<div class="text-2xl font-bold text-yellow-900">
										£{(buyBoxInfo.profit_opportunity || 0).toFixed(2)}
									</div>
									<div class="text-sm text-yellow-700 mt-1">
										{buyBoxInfo.profit_opportunity && buyBoxInfo.profit_opportunity > 0
											? 'Additional profit'
											: 'No opportunity'}
									</div>
								</div>
							</div>

							<!-- Cost Breakdown -->
							<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
								<!-- Cost Structure -->
								<div class="bg-gray-50 rounded-lg p-4">
									<h4 class="text-md font-medium mb-3 text-gray-800">Cost Breakdown</h4>
									<div class="space-y-2 text-sm">
										<div class="flex justify-between">
											<span class="text-gray-600">Base Cost:</span>
											<span class="font-medium">£{(buyBoxInfo.your_cost || 0).toFixed(2)}</span>
										</div>
										<div class="flex justify-between">
											<span class="text-gray-600">Box Cost:</span>
											<span class="font-medium">£{(buyBoxInfo.your_box_cost || 0).toFixed(2)}</span>
										</div>
										<div class="flex justify-between">
											<span class="text-gray-600">Material Cost:</span>
											<span class="font-medium">£0.20</span>
										</div>
										<div class="flex justify-between">
											<span class="text-gray-600">VAT:</span>
											<span class="font-medium"
												>£{(buyBoxInfo.your_vat_amount || 0).toFixed(2)}</span
											>
										</div>
										<div class="flex justify-between">
											<span class="text-gray-600">Fragile Charge:</span>
											<span class="font-medium"
												>£{(buyBoxInfo.your_fragile_charge || 0).toFixed(2)}</span
											>
										</div>
										<div class="border-t pt-2 border-gray-300">
											<div class="flex justify-between font-medium">
												<span class="text-gray-800">Material Total:</span>
												<span class="text-gray-900"
													>£{(buyBoxInfo.your_material_total_cost || 0).toFixed(2)}</span
												>
											</div>
										</div>
										<div class="flex justify-between">
											<span class="text-gray-600">Shipping Cost:</span>
											<span class="font-medium"
												>£{(buyBoxInfo.your_shipping_cost || 0).toFixed(2)}</span
											>
										</div>
										<div class="border-t pt-2 border-gray-300">
											<div class="flex justify-between font-bold">
												<span class="text-gray-800">Total Operating Cost:</span>
												<span class="text-gray-900"
													>£{(buyBoxInfo.total_operating_cost || 0).toFixed(2)}</span
												>
											</div>
										</div>
									</div>
								</div>

								<!-- Break-even Analysis -->
								<div class="bg-red-50 rounded-lg p-4">
									<h4 class="text-md font-medium mb-3 text-red-800">Break-even Analysis</h4>
									<div class="space-y-3 text-sm">
										<div>
											<div class="text-gray-600 mb-1">Break-even Price:</div>
											<div class="text-xl font-bold text-red-900">
												£{(buyBoxInfo.break_even_price || 0).toFixed(2)}
											</div>
										</div>

										{#if buyBoxInfo.breakeven_calculation}
											<div class="text-xs text-gray-500 bg-white p-2 rounded border">
												<div class="font-medium mb-1">Calculation:</div>
												<div class="font-mono">{buyBoxInfo.breakeven_calculation}</div>
											</div>
										{/if}

										<div class="text-xs text-gray-600">
											<div class="font-medium">Formula:</div>
											<div>Operating Cost ÷ (1 - Amazon Fee Rate)</div>
											<div class="text-gray-500 mt-1">
												Amazon takes 15% fee, so we need to account for this in break-even
											</div>
										</div>
									</div>
								</div>
							</div>

							<!-- Profit Breakdowns -->
							<div class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
								<div class="bg-blue-50 rounded-lg p-4">
									<h4 class="text-md font-medium mb-2 text-blue-800">Current Price Profit</h4>
									{#if buyBoxInfo.current_profit_breakdown}
										<div class="text-xs font-mono text-blue-700 bg-white p-2 rounded border">
											{buyBoxInfo.current_profit_breakdown}
										</div>
									{/if}
								</div>

								<div class="bg-green-50 rounded-lg p-4">
									<h4 class="text-md font-medium mb-2 text-green-800">Buy Box Price Profit</h4>
									{#if buyBoxInfo.buybox_profit_breakdown}
										<div class="text-xs font-mono text-green-700 bg-white p-2 rounded border">
											{buyBoxInfo.buybox_profit_breakdown}
										</div>
									{/if}
								</div>
							</div>

							<!-- Action Recommendation -->
							{#if buyBoxInfo.recommended_action && buyBoxInfo.recommended_action !== 'data_unavailable'}
								<div class="mt-4">
									<div
										class={`rounded-lg p-4 ${
											buyBoxInfo.recommended_action === 'match_buybox'
												? 'bg-green-50 border border-green-200'
												: buyBoxInfo.recommended_action === 'not_profitable'
													? 'bg-red-50 border border-red-200'
													: buyBoxInfo.recommended_action === 'investigate'
														? 'bg-yellow-50 border border-yellow-200'
														: 'bg-blue-50 border border-blue-200'
										}`}
									>
										<h4
											class={`text-md font-medium mb-2 ${
												buyBoxInfo.recommended_action === 'match_buybox'
													? 'text-green-800'
													: buyBoxInfo.recommended_action === 'not_profitable'
														? 'text-red-800'
														: buyBoxInfo.recommended_action === 'investigate'
															? 'text-yellow-800'
															: 'text-blue-800'
											}`}
										>
											Recommendation: {buyBoxInfo.recommended_action
												.replace('_', ' ')
												.toUpperCase()}
										</h4>
										<div
											class={`text-sm ${
												buyBoxInfo.recommended_action === 'match_buybox'
													? 'text-green-700'
													: buyBoxInfo.recommended_action === 'not_profitable'
														? 'text-red-700'
														: buyBoxInfo.recommended_action === 'investigate'
															? 'text-yellow-700'
															: 'text-blue-700'
											}`}
										>
											{#if buyBoxInfo.recommended_action === 'match_buybox'}
												Consider lowering your price to £{(buyBoxInfo.buyBoxPrice || 0).toFixed(2)} to
												capture the buy box and increase profit by £{(
													buyBoxInfo.profit_opportunity || 0
												).toFixed(2)}.
											{:else if buyBoxInfo.recommended_action === 'not_profitable'}
												The buy box price would result in a margin below 5%. Consider focusing on
												other products or reducing costs.
											{:else if buyBoxInfo.recommended_action === 'investigate'}
												The buy box price offers low margin (5-10%). Review costs and competition
												before adjusting price.
											{:else if buyBoxInfo.recommended_action === 'hold_price'}
												Your current price appears optimal. No significant profit opportunity at buy
												box price.
											{/if}
										</div>
									</div>
								</div>
							{/if}
						</div>
					{:else if buyBoxInfo.cost_data_source === 'unavailable'}
						<div class="mt-6">
							<div class="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
								<h4 class="text-md font-medium mb-2 text-yellow-800">
									Margin Analysis Unavailable
								</h4>
								<p class="text-sm text-yellow-700">
									Cost data not found for this SKU. Margin analysis requires inventory and
									composition data.
								</p>
							</div>
						</div>
					{/if}

					<!-- Recommendations Section -->
					{#if buyBoxInfo.recommendations && buyBoxInfo.recommendations.length > 0}
						<div class="mt-6">
							<h3 class="text-lg font-medium mb-2">Recommendations</h3>
							<div class="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
								<ul class="list-disc pl-5 space-y-2 text-sm">
									{#each buyBoxInfo.recommendations as recommendation}
										<li class="text-gray-700">{recommendation}</li>
									{/each}
								</ul>
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		{#if buyBoxError}
			<div
				class="mt-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4"
				role="alert"
				transition:fade
			>
				<p>{buyBoxError}</p>
			</div>
		{/if}

		{#if isBuyBoxLoading}
			<div class="mt-6 bg-blue-50 p-6 rounded-lg shadow-md text-center" transition:fade>
				<div
					class="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mb-4"
				></div>
				<p class="text-blue-600">Checking Buy Box status...</p>
			</div>
		{/if}
	</div>
</div>
