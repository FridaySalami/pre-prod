<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import type {
		SkuAsinMapping,
		BuyBoxResponse,
		CompetitiveAsin,
		CompetitorBuyBoxInfo
	} from '$lib/types/buybox';

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

	// Competitive analysis state
	let competitors: CompetitiveAsin[] = [];
	let competitorBuyBoxData: CompetitorBuyBoxInfo[] = [];
	let isLoadingCompetitors = false;
	let competitorError = '';
	let showAddCompetitorForm = false;
	let showCompetitorsList = false; // Collapsed by default
	let isRefreshingPricing = false; // For refresh pricing functionality
	let lastPricingUpdate: Date | null = null; // Track when pricing was last updated
	let newCompetitorAsin = '';
	let newCompetitorType = 'direct_competitor';
	let newCompetitorNotes = '';
	let isAddingCompetitor = false;

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

			// After getting buy box info, load competitors
			await loadCompetitors(product.asin1 || '');
		} catch (error: unknown) {
			console.error('Buy Box check error:', error);
			buyBoxError = error instanceof Error ? error.message : 'Failed to check Buy Box ownership';
		} finally {
			isBuyBoxLoading = false;
		}
	}

	// Load competitors for the selected ASIN
	async function loadCompetitors(asin: string): Promise<void> {
		if (!asin) return;

		isLoadingCompetitors = true;
		competitorError = '';

		try {
			const response = await fetch(
				`/api/buy-box-monitor/competitors?asin=${encodeURIComponent(asin)}`
			);
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to load competitors');
			}

			competitors = data.competitors || [];

			// Check buy box for all competitors
			await checkCompetitorBuyBoxes(asin);
		} catch (error: unknown) {
			console.error('Error loading competitors:', error);
			competitorError = error instanceof Error ? error.message : 'Failed to load competitors';
		} finally {
			isLoadingCompetitors = false;
		}
	}

	// Check buy box status for all competitor ASINs
	async function checkCompetitorBuyBoxes(primaryAsin: string): Promise<void> {
		if (competitors.length === 0) return;

		const competitorChecks = competitors.map(async (competitor) => {
			try {
				const response = await fetch(
					`/api/buy-box-monitor/check?asin=${encodeURIComponent(competitor.competitive_asin)}`
				);
				const data = await response.json();

				if (response.ok) {
					console.log(`Buy box data for ${competitor.competitive_asin}:`, data);
					return {
						...data,
						asin: competitor.competitive_asin,
						competitiveRelationship: competitor
					} as CompetitorBuyBoxInfo;
				}
			} catch (error) {
				console.error(`Error checking competitor ${competitor.competitive_asin}:`, error);
			}
			return null;
		});

		const results = await Promise.all(competitorChecks);
		competitorBuyBoxData = results.filter((result) => result !== null) as CompetitorBuyBoxInfo[];
		lastPricingUpdate = new Date(); // Track when pricing was updated
		console.log('Final competitive buy box data:', competitorBuyBoxData);
	}

	// Add a new competitor
	async function addCompetitor(): Promise<void> {
		if (!selectedProduct?.asin1 || !newCompetitorAsin.trim()) return;

		isAddingCompetitor = true;

		try {
			const response = await fetch('/api/buy-box-monitor/competitors', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					primaryAsin: selectedProduct.asin1,
					competitiveAsin: newCompetitorAsin.trim(),
					relationshipType: newCompetitorType,
					notes: newCompetitorNotes.trim() || null
				})
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to add competitor');
			}

			// Reset form
			newCompetitorAsin = '';
			newCompetitorNotes = '';
			newCompetitorType = 'direct_competitor';
			showAddCompetitorForm = false;

			// Reload competitors
			await loadCompetitors(selectedProduct.asin1);
		} catch (error: unknown) {
			console.error('Error adding competitor:', error);
			competitorError = error instanceof Error ? error.message : 'Failed to add competitor';
		} finally {
			isAddingCompetitor = false;
		}
	}

	// Remove a competitor
	async function removeCompetitor(competitorId: string): Promise<void> {
		if (!selectedProduct?.asin1) return;

		try {
			const response = await fetch(
				`/api/buy-box-monitor/competitors?id=${encodeURIComponent(competitorId)}`,
				{
					method: 'DELETE'
				}
			);

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to remove competitor');
			}

			// Reload competitors
			await loadCompetitors(selectedProduct.asin1);
		} catch (error: unknown) {
			console.error('Error removing competitor:', error);
			competitorError = error instanceof Error ? error.message : 'Failed to remove competitor';
		}
	}

	// Refresh competitive pricing data
	async function refreshCompetitivePricing(): Promise<void> {
		if (!selectedProduct?.asin1 || competitors.length === 0) return;

		isRefreshingPricing = true;
		competitorError = '';

		try {
			// Re-fetch current buy box data for all competitors
			await checkCompetitorBuyBoxes(selectedProduct.asin1);
		} catch (error: unknown) {
			console.error('Error refreshing pricing:', error);
			competitorError =
				error instanceof Error ? error.message : 'Failed to refresh competitive pricing';
		} finally {
			isRefreshingPricing = false;
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

			<!-- Competitive Analysis Section -->
			<div class="mt-8 bg-white rounded-lg shadow-md overflow-hidden" transition:fade>
				<div class="px-6 py-4 border-b border-gray-200 bg-purple-50">
					<div class="flex justify-between items-center">
						<div>
							<h2 class="text-xl font-semibold">Competitive Analysis</h2>
							<p class="text-sm text-gray-600">
								Monitor competitor ASINs for: {selectedProduct.item_name}
							</p>
						</div>
						<div class="flex gap-2">
							{#if competitors.length > 0}
								<button
									on:click={refreshCompetitivePricing}
									disabled={isRefreshingPricing || isLoadingCompetitors}
									class="bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 disabled:opacity-50 text-xs flex items-center gap-1"
									title="Refresh live pricing data"
								>
									{#if isRefreshingPricing}
										<span class="inline-block animate-spin">⟳</span>
									{:else}
										<span>🔄</span>
									{/if}
									Refresh
								</button>
							{/if}
							<button
								on:click={() => (showAddCompetitorForm = !showAddCompetitorForm)}
								class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-sm"
								disabled={isLoadingCompetitors}
							>
								{showAddCompetitorForm ? 'Cancel' : '+ Add Competitor'}
							</button>
						</div>
					</div>
				</div>

				<div class="p-6">
					<!-- Add Competitor Form -->
					{#if showAddCompetitorForm}
						<div class="mb-6 p-4 border border-purple-200 rounded-lg bg-purple-50" transition:fade>
							<h4 class="font-medium mb-3">Add Competitive ASIN</h4>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label
										for="competitor-asin-input"
										class="block text-sm font-medium text-gray-700 mb-1"
									>
										Competitor ASIN
									</label>
									<input
										id="competitor-asin-input"
										type="text"
										bind:value={newCompetitorAsin}
										placeholder="B0123456789"
										class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
									/>
								</div>
								<div>
									<label
										for="relationship-type-select"
										class="block text-sm font-medium text-gray-700 mb-1"
									>
										Relationship Type
									</label>
									<select
										id="relationship-type-select"
										bind:value={newCompetitorType}
										class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
									>
										<option value="direct_competitor">Direct Competitor</option>
										<option value="alternative">Alternative Product</option>
										<option value="substitute">Substitute Product</option>
										<option value="related">Related Product</option>
									</select>
								</div>
							</div>
							<div class="mt-3">
								<label
									for="competitor-notes-textarea"
									class="block text-sm font-medium text-gray-700 mb-1"
								>
									Notes (Optional)
								</label>
								<textarea
									id="competitor-notes-textarea"
									bind:value={newCompetitorNotes}
									placeholder="Why is this a competitor? Any specific notes..."
									rows="2"
									class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
								></textarea>
							</div>
							<div class="mt-4 flex gap-3">
								<button
									on:click={addCompetitor}
									disabled={!newCompetitorAsin.trim() || isAddingCompetitor}
									class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 text-sm"
								>
									{#if isAddingCompetitor}
										<span class="inline-block animate-spin mr-2">⟳</span>Adding...
									{:else}
										Add Competitor
									{/if}
								</button>
								<button
									on:click={() => {
										showAddCompetitorForm = false;
										newCompetitorAsin = '';
										newCompetitorNotes = '';
									}}
									class="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 text-sm"
								>
									Cancel
								</button>
							</div>
						</div>
					{/if}

					<!-- Competitor Error -->
					{#if competitorError}
						<div class="mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4" transition:fade>
							<p>{competitorError}</p>
						</div>
					{/if}

					<!-- Loading State -->
					{#if isLoadingCompetitors}
						<div class="text-center py-8">
							<div
								class="animate-spin inline-block w-6 h-6 border-4 border-purple-600 border-t-transparent rounded-full mb-4"
							></div>
							<p class="text-purple-600">Loading competitive analysis...</p>
						</div>
					{/if}

					<!-- Competitors List -->
					{#if competitors.length > 0 && !isLoadingCompetitors}
						<div class="mb-6">
							<button
								on:click={() => (showCompetitorsList = !showCompetitorsList)}
								class="flex items-center justify-between w-full text-left font-medium mb-3 hover:text-purple-600 transition-colors"
							>
								<span>Tracked Competitors ({competitors.length})</span>
								<svg
									class="w-5 h-5 transform transition-transform {showCompetitorsList
										? 'rotate-180'
										: ''}"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 9l-7 7-7-7"
									></path>
								</svg>
							</button>

							{#if showCompetitorsList}
								<div class="space-y-3" transition:fade>
									{#each competitors as competitor}
										<div
											class="border border-gray-200 rounded-lg p-3 flex justify-between items-center"
										>
											<div class="flex-1">
												<div class="flex items-center gap-3">
													<a
														href={`https://www.amazon.co.uk/dp/${competitor.competitive_asin}`}
														target="_blank"
														rel="noopener noreferrer"
														class="text-blue-600 hover:text-blue-800 hover:underline font-medium"
													>
														{competitor.competitive_asin}
													</a>
													<span class="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
														{competitor.relationship_type.replace('_', ' ')}
													</span>
												</div>

												<!-- Product Title Display -->
												{#if competitor.competitive_product_title && !competitor.competitive_product_title.startsWith('Product ')}
													<p
														class="text-sm text-gray-700 mt-1 font-medium break-words leading-tight"
													>
														{competitor.competitive_product_title}
													</p>
												{:else}
													<div class="flex items-center gap-2 mt-1">
														<p class="text-sm text-gray-500 italic">Product title not available</p>
														<button
															class="text-xs text-blue-600 hover:text-blue-800 underline"
															on:click={() =>
																window.open(
																	`https://www.amazon.co.uk/dp/${competitor.competitive_asin}`,
																	'_blank'
																)}
														>
															View on Amazon
														</button>
													</div>
												{/if}

												{#if competitor.notes}
													<p class="text-sm text-gray-600 mt-1">{competitor.notes}</p>
												{/if}
												<p class="text-xs text-gray-500 mt-1">
													Added {new Date(competitor.created_at).toLocaleDateString()}
												</p>
											</div>
											<button
												on:click={() => removeCompetitor(competitor.id)}
												class="text-red-600 hover:text-red-800 text-sm ml-4"
												title="Remove competitor"
											>
												✕
											</button>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}

					<!-- Competitive Buy Box Analysis -->
					{#if competitorBuyBoxData.length > 0}
						<div>
							<div class="flex justify-between items-center mb-3">
								<div>
									<h4 class="font-medium">Competitive Buy Box Analysis</h4>
									{#if lastPricingUpdate}
										<p class="text-xs text-gray-500 mt-1">
											Last updated: {lastPricingUpdate.toLocaleTimeString()} on {lastPricingUpdate.toLocaleDateString()}
										</p>
									{/if}
								</div>
								<button
									on:click={refreshCompetitivePricing}
									disabled={isRefreshingPricing}
									class="bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 disabled:opacity-50 text-sm flex items-center gap-2"
									title="Refresh live pricing data for all competitors"
								>
									{#if isRefreshingPricing}
										<span class="inline-block animate-spin">⟳</span>Refreshing...
									{:else}
										<span>🔄</span>Refresh Pricing
									{/if}
								</button>
							</div>
							<div class="overflow-x-auto">
								<table class="min-w-full divide-y divide-gray-200">
									<thead class="bg-gray-50">
										<tr>
											<th
												class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>
												ASIN
											</th>
											<th
												class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>
												Product Title
											</th>
											<th
												class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>
												Relationship
											</th>
											<th
												class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>
												Buy Box Price
											</th>
											<th
												class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>
												Buy Box Owner
											</th>
											<th
												class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>
												Price vs. Yours
											</th>
											<th
												class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>
												Status
											</th>
										</tr>
									</thead>
									<tbody class="bg-white divide-y divide-gray-200">
										{#each competitorBuyBoxData as competitorData}
											{@const title =
												competitorData.competitiveRelationship.competitive_product_title}
											<tr>
												<td class="px-6 py-4 whitespace-nowrap text-sm">
													<a
														href={`https://www.amazon.co.uk/dp/${competitorData.asin}`}
														target="_blank"
														rel="noopener noreferrer"
														class="text-blue-600 hover:text-blue-800 hover:underline font-medium"
													>
														{competitorData.asin}
													</a>
												</td>
												<td class="px-6 py-4 text-sm text-gray-900 max-w-xs">
													{#if title && !title.startsWith('Product ')}
														<div class="break-words leading-tight" {title}>
															{title}
														</div>
													{:else}
														<div class="text-gray-500 italic" title="Product title not available">
															Title not available
														</div>
													{/if}
												</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
													{competitorData.competitiveRelationship.relationship_type.replace(
														'_',
														' '
													)}
												</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
													{competitorData.buyBoxPrice
														? `£${competitorData.buyBoxPrice.toFixed(2)}`
														: 'No Buy Box'}
												</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
													{competitorData.buyBoxOwner || 'Unknown'}
												</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm">
													{#if competitorData.buyBoxPrice && selectedProduct?.price}
														{@const priceDiff = competitorData.buyBoxPrice - selectedProduct.price}
														<span
															class={priceDiff > 0
																? 'text-green-600'
																: priceDiff < 0
																	? 'text-red-600'
																	: 'text-gray-600'}
														>
															{priceDiff > 0 ? '+' : ''}{priceDiff.toFixed(2)}
														</span>
													{:else}
														N/A
													{/if}
												</td>
												<td class="px-6 py-4 whitespace-nowrap">
													<span
														class={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
														${competitorData.hasBuyBox ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
													>
														{competitorData.hasBuyBox ? 'Has Buy Box' : 'No Buy Box'}
													</span>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}

					{#if competitors.length === 0 && !isLoadingCompetitors}
						<div class="text-center py-8">
							<p class="text-gray-500 mb-4">No competitors tracked for this ASIN yet.</p>
							<button
								on:click={() => (showAddCompetitorForm = true)}
								class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
							>
								Add Your First Competitor
							</button>
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
