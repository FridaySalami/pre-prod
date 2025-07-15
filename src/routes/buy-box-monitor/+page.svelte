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
