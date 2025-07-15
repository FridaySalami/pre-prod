<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';

	// Types for buy box management
	interface BuyBoxData {
		id: string;
		asin: string;
		sku: string;
		product_title?: string | null;
		price: number | null;
		competitor_price: number | null;
		is_winner: boolean;
		opportunity_flag: boolean;
		margin_at_buybox: number | null;
		margin_percent_at_buybox: number | null;
		captured_at: string;

		// Enhanced margin analysis fields
		your_cost: number | null;
		your_shipping_cost: number | null;
		your_material_total_cost: number | null;
		your_box_cost: number | null;
		your_vat_amount: number | null;
		your_fragile_charge: number | null;
		material_cost_only: number | null;
		total_operating_cost: number | null;

		// Current pricing margins
		your_margin_at_current_price: number | null;
		your_margin_percent_at_current_price: number | null;

		// Competitor analysis
		margin_at_buybox_price: number | null;
		margin_percent_at_buybox_price: number | null;
		margin_difference: number | null;
		profit_opportunity: number | null;

		// Actual profit calculations
		current_actual_profit: number | null;
		buybox_actual_profit: number | null;
		current_profit_breakdown: string | null;
		buybox_profit_breakdown: string | null;

		// Recommendations
		recommended_action: string | null;
		price_adjustment_needed: number | null;
		break_even_price: number | null;

		// Metadata
		margin_calculation_version: string | null;
		cost_data_source: string | null;
	}

	// State management
	let buyboxData: BuyBoxData[] = [];
	let filteredData: BuyBoxData[] = [];
	let isLoading = true;
	let errorMessage = '';

	// Search and filters
	let searchQuery = '';
	let categoryFilter = 'all'; // all, winners, losers, opportunities, profitable, not_profitable, match_buybox, hold_price, investigate
	let sortBy = 'profit_desc'; // profit_desc, profit_asc, margin_desc, margin_asc, sku_asc
	let showOnlyWithMarginData = false;
	let minProfitFilter = 0;
	let minMarginFilter = 0;
	let showLatestOnly = true; // New filter to show only latest data per SKU

	// Pagination
	let currentPage = 1;
	let itemsPerPage = 50;
	let totalResults = 0;

	// Summary stats
	let totalWinners = 0;
	let totalOpportunities = 0;
	let totalProfitable = 0;
	let totalMarginAnalyzed = 0;
	let avgProfit = 0;
	let totalPotentialProfit = 0;

	// Initialize and load data
	onMount(async () => {
		await loadBuyBoxData();
	});

	// Deduplicate data to show only the latest entry per SKU
	function deduplicateLatestData(data: BuyBoxData[]): BuyBoxData[] {
		const skuMap = new Map<string, BuyBoxData>();

		// Sort by captured_at desc to ensure we process latest first
		const sortedData = [...data].sort(
			(a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
		);

		// Keep only the latest entry for each SKU
		sortedData.forEach((item) => {
			if (!skuMap.has(item.sku)) {
				skuMap.set(item.sku, item);
			}
		});

		return Array.from(skuMap.values());
	}

	// Count historical entries for each SKU (used in historical mode)
	function getHistoricalCount(sku: string, allData: BuyBoxData[]): number {
		return allData.filter((item) => item.sku === sku).length;
	}

	// Get all raw data for counting duplicates in historical mode
	let allRawData: BuyBoxData[] = [];

	// Load buy box data from API
	async function loadBuyBoxData(): Promise<void> {
		isLoading = true;
		errorMessage = '';

		try {
			// Get latest data from all jobs - use a more reasonable limit for production
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
			
			const response = await fetch('/api/buybox/results?include_all_jobs=true&limit=10000', {
				signal: controller.signal
			});
			clearTimeout(timeoutId);
			
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to load buy box data');
			}

			buyboxData = data.results;
			allRawData = [...data.results]; // Store all raw data for historical counting

			// Deduplicate to show only latest data per SKU by default
			if (showLatestOnly) {
				buyboxData = deduplicateLatestData(buyboxData);
			}

			calculateSummaryStats();
			applyFilters();
		} catch (error: unknown) {
			console.error('Error loading buy box data:', error);
			if (error instanceof Error && error.name === 'AbortError') {
				errorMessage = 'Request timed out. The server is taking too long to respond. Try refreshing or reducing the data range.';
			} else {
				errorMessage =
					error instanceof Error ? error.message : 'An error occurred while loading data. Please try again.';
			}
		} finally {
			isLoading = false;
		}
	}

	// Calculate summary statistics
	function calculateSummaryStats(): void {
		totalWinners = buyboxData.filter((item) => item.is_winner).length;
		totalOpportunities = buyboxData.filter((item) => item.opportunity_flag).length;
		totalProfitable = buyboxData.filter(
			(item) => item.profit_opportunity && item.profit_opportunity > 0
		).length;
		totalMarginAnalyzed = buyboxData.filter(
			(item) => item.your_margin_percent_at_current_price !== null
		).length;

		const profitableItems = buyboxData.filter((item) => item.current_actual_profit !== null);
		avgProfit =
			profitableItems.length > 0
				? profitableItems.reduce((sum, item) => sum + (item.current_actual_profit || 0), 0) /
					profitableItems.length
				: 0;

		totalPotentialProfit = buyboxData
			.filter((item) => item.profit_opportunity && item.profit_opportunity > 0)
			.reduce((sum, item) => sum + (item.profit_opportunity || 0), 0);
	}

	// Apply filters and sorting
	function applyFilters(): void {
		let filtered = [...buyboxData];

		// Search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(item) =>
					item.sku.toLowerCase().includes(query) ||
					item.asin.toLowerCase().includes(query) ||
					(item.product_title?.toLowerCase().includes(query) ?? false)
			);
		}

		// Category filter
		switch (categoryFilter) {
			case 'winners':
				filtered = filtered.filter((item) => item.is_winner);
				break;
			case 'losers':
				filtered = filtered.filter((item) => !item.is_winner);
				break;
			case 'opportunities':
				filtered = filtered.filter((item) => item.opportunity_flag);
				break;
			case 'profitable':
				filtered = filtered.filter(
					(item) => item.profit_opportunity && item.profit_opportunity > 0
				);
				break;
			case 'not_profitable':
				filtered = filtered.filter((item) => item.recommended_action === 'not_profitable');
				break;
			case 'match_buybox':
				filtered = filtered.filter((item) => item.recommended_action === 'match_buybox');
				break;
			case 'hold_price':
				filtered = filtered.filter((item) => item.recommended_action === 'hold_price');
				break;
			case 'investigate':
				filtered = filtered.filter((item) => item.recommended_action === 'investigate');
				break;
		}

		// Margin data filter
		if (showOnlyWithMarginData) {
			filtered = filtered.filter((item) => item.your_margin_percent_at_current_price !== null);
		}

		// Profit filter
		if (minProfitFilter > 0) {
			filtered = filtered.filter(
				(item) =>
					item.current_actual_profit !== null && item.current_actual_profit >= minProfitFilter
			);
		}

		// Margin filter
		if (minMarginFilter > 0) {
			filtered = filtered.filter(
				(item) =>
					item.your_margin_percent_at_current_price !== null &&
					item.your_margin_percent_at_current_price >= minMarginFilter
			);
		}

		// Sorting
		switch (sortBy) {
			case 'profit_desc':
				filtered.sort((a, b) => (b.current_actual_profit || 0) - (a.current_actual_profit || 0));
				break;
			case 'profit_asc':
				filtered.sort((a, b) => (a.current_actual_profit || 0) - (b.current_actual_profit || 0));
				break;
			case 'margin_desc':
				filtered.sort(
					(a, b) =>
						(b.your_margin_percent_at_current_price || 0) -
						(a.your_margin_percent_at_current_price || 0)
				);
				break;
			case 'margin_asc':
				filtered.sort(
					(a, b) =>
						(a.your_margin_percent_at_current_price || 0) -
						(b.your_margin_percent_at_current_price || 0)
				);
				break;
			case 'sku_asc':
				filtered.sort((a, b) => a.sku.localeCompare(b.sku));
				break;
		}

		filteredData = filtered;
		totalResults = filtered.length;
		currentPage = 1; // Reset to first page when filtering
	}

	// Get paginated data
	$: paginatedData = filteredData.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage
	);

	// Handle pagination
	function changePage(newPage: number): void {
		if (newPage >= 1 && newPage <= Math.ceil(totalResults / itemsPerPage)) {
			currentPage = newPage;
		}
	}

	// Navigate to product details
	function viewProductDetails(asin: string, sku: string): void {
		goto(`/buy-box-monitor?query=${encodeURIComponent(sku || asin)}`);
	}

	// Quick action handlers
	function markForPriceUpdate(item: BuyBoxData): void {
		// TODO: Implement price update functionality
		console.log('Mark for price update:', item.sku);
	}

	function addToWatchlist(item: BuyBoxData): void {
		// TODO: Implement watchlist functionality
		console.log('Add to watchlist:', item.sku);
	}

	// Compare pricing between scanned data and live pricing
	async function comparePricing(item: BuyBoxData): Promise<void> {
		try {
			// Get live pricing data from buy-box-monitor
			const response = await fetch(
				`/api/buy-box-monitor/check?asin=${encodeURIComponent(item.asin)}`
			);
			const liveData = await response.json();

			if (!response.ok) {
				alert(`Error fetching live data: ${liveData.error}`);
				return;
			}

			// Get SKU mapping data to find your actual listed price
			const skuResponse = await fetch(
				`/api/buy-box-monitor/search?query=${encodeURIComponent(item.sku)}&limit=1`
			);
			const skuData = await skuResponse.json();

			let yourActualPrice = null;
			if (skuResponse.ok && skuData.results?.[0]?.price) {
				yourActualPrice = parseFloat(skuData.results[0].price);
			}

			const scannedPrice = item.price;
			const liveBuyBoxPrice = liveData.buyBoxPrice;

			let message = `🔍 PRICING COMPARISON FOR ${item.sku}\n\n`;
			message += `📊 Scanned Data (from database):\n`;
			message += `   Your Price: £${scannedPrice?.toFixed(2) || 'N/A'}\n`;
			message += `   Competitor Price: £${item.competitor_price?.toFixed(2) || 'N/A'}\n`;
			message += `   Captured: ${new Date(item.captured_at).toLocaleString()}\n\n`;

			message += `🔴 Live Data (current Amazon):\n`;
			if (yourActualPrice) {
				message += `   Your Listed Price: £${yourActualPrice.toFixed(2)}\n`;
			}
			message += `   Buy Box Price: £${liveBuyBoxPrice?.toFixed(2) || 'N/A'}\n`;
			message += `   Buy Box Winner: ${liveData.buyBoxWinner || 'Unknown'}\n\n`;

			if (yourActualPrice && scannedPrice && Math.abs(yourActualPrice - scannedPrice) > 0.01) {
				message += `⚠️ PRICE DISCREPANCY DETECTED!\n`;
				message += `   Difference: £${(yourActualPrice - scannedPrice).toFixed(2)}\n`;
				message += `   This suggests the scanner captured old/incorrect data.\n`;
			}

			alert(message);
		} catch (error) {
			console.error('Error comparing pricing:', error);
			alert('Failed to compare pricing. Check console for details.');
		}
	}

	// Format date with time
	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return (
			date.toLocaleDateString() +
			' at ' +
			date.toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit'
			})
		);
	}

	// Truncate long product titles
	function truncateTitle(title: string, maxLength: number = 60): string {
		if (title.length <= maxLength) return title;
		return title.substring(0, maxLength) + '...';
	}
</script>

<svelte:head>
	<title>Buy Box Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-6">
		<div>
			<h1 class="text-3xl font-bold mb-2">Buy Box Manager</h1>
			<p class="text-gray-600">Analyze and manage your Buy Box performance</p>
		</div>
		<div class="flex gap-3">
			<button
				class="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
				on:click={loadBuyBoxData}
			>
				Refresh Data
			</button>
			<a
				href="/buy-box-monitor/jobs"
				class="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded"
			>
				Go to Jobs
			</a>
		</div>
	</div>

	{#if errorMessage}
		<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6" role="alert">
			<p>{errorMessage}</p>
		</div>
	{/if}

	<!-- Data Deduplication Info -->
	{#if !isLoading && buyboxData.length > 0 && showLatestOnly}
		<div
			class="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-6"
			role="alert"
		>
			<div class="flex justify-between items-center">
				<div>
					<p class="font-medium">📊 Showing Latest Data Only</p>
					<p class="text-sm">
						Displaying the most recent scan data for each SKU. Multiple daily scans are
						deduplicated.
					</p>
				</div>
				<button
					on:click={() => {
						showLatestOnly = false;
						loadBuyBoxData();
					}}
					class="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded text-sm"
				>
					Show All Historical Data
				</button>
			</div>
		</div>
	{:else if !isLoading && buyboxData.length > 0 && !showLatestOnly}
		<div
			class="bg-purple-100 border border-purple-400 text-purple-700 px-4 py-3 rounded mb-6"
			role="alert"
		>
			<div class="flex justify-between items-center">
				<div>
					<p class="font-medium">🕒 Showing All Historical Data</p>
					<p class="text-sm">
						Displaying all scan records including multiple entries per SKU from different times.
					</p>
				</div>
				<button
					on:click={() => {
						showLatestOnly = true;
						loadBuyBoxData();
					}}
					class="bg-purple-600 hover:bg-purple-700 text-white py-1 px-3 rounded text-sm"
				>
					Show Latest Only
				</button>
			</div>
		</div>
	{/if}

	<!-- Data Freshness Alert -->
	{#if !isLoading && buyboxData.length > 0}
		{@const oldestData = Math.min(
			...buyboxData.map((item) => new Date(item.captured_at).getTime())
		)}
		{@const oldestAge = Math.floor((Date.now() - oldestData) / (1000 * 60 * 60))}
		{#if oldestAge > 24}
			<div
				class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6"
				role="alert"
			>
				<div class="flex justify-between items-center">
					<div>
						<p class="font-medium">⚠️ Some data may be outdated</p>
						<p class="text-sm">
							Oldest data is {oldestAge} hours old. Consider running a fresh scan for accurate pricing.
						</p>
					</div>
					<div class="flex gap-2">
						<a
							href="/buy-box-monitor/jobs"
							class="bg-yellow-600 hover:bg-yellow-700 text-white py-1 px-3 rounded text-sm"
						>
							Run New Scan
						</a>
						<button
							on:click={loadBuyBoxData}
							class="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded text-sm"
						>
							Refresh Data
						</button>
					</div>
				</div>
			</div>
		{/if}
	{/if}

	<!-- Summary Statistics -->
	<div class="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
		<div class="bg-green-50 p-4 rounded-lg border">
			<h3 class="text-sm font-medium text-gray-500 mb-1">Buy Box Won</h3>
			<p class="text-2xl font-bold text-green-600">{totalWinners}</p>
			<p class="text-xs text-gray-400">Currently winning</p>
		</div>
		<div class="bg-yellow-50 p-4 rounded-lg border">
			<h3 class="text-sm font-medium text-gray-500 mb-1">Opportunities</h3>
			<p class="text-2xl font-bold text-yellow-600">{totalOpportunities}</p>
			<p class="text-xs text-gray-400">Potential gains</p>
		</div>
		<div class="bg-purple-50 p-4 rounded-lg border">
			<h3 class="text-sm font-medium text-gray-500 mb-1">Profitable Ops</h3>
			<p class="text-2xl font-bold text-purple-600">{totalProfitable}</p>
			<p class="text-xs text-gray-400">Worth pursuing</p>
		</div>
		<div class="bg-blue-50 p-4 rounded-lg border">
			<h3 class="text-sm font-medium text-gray-500 mb-1">Analyzed</h3>
			<p class="text-2xl font-bold text-blue-600">{totalMarginAnalyzed}</p>
			<p class="text-xs text-gray-400">
				of {buyboxData.length} SKUs
				{#if showLatestOnly}
					<span class="block text-blue-600">(Latest data only)</span>
				{:else}
					<span class="block text-purple-600">(All historical data)</span>
				{/if}
			</p>
		</div>
		<div class="bg-orange-50 p-4 rounded-lg border">
			<h3 class="text-sm font-medium text-gray-500 mb-1">Avg Profit</h3>
			<p
				class={`text-2xl font-bold ${avgProfit >= 2 ? 'text-green-600' : avgProfit >= 0 ? 'text-yellow-600' : 'text-red-600'}`}
			>
				£{avgProfit.toFixed(2)}
			</p>
			<p class="text-xs text-gray-400">Per SKU</p>
		</div>
		<div class="bg-indigo-50 p-4 rounded-lg border">
			<h3 class="text-sm font-medium text-gray-500 mb-1">Potential</h3>
			<p class="text-2xl font-bold text-indigo-600">£{totalPotentialProfit.toFixed(2)}</p>
			<p class="text-xs text-gray-400">Total opportunity</p>
		</div>
	</div>

	<!-- Filters and Search -->
	<div class="bg-white rounded-lg shadow p-6 mb-6">
		<h2 class="font-semibold mb-4">Filters & Search</h2>

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
			<!-- Search -->
			<div>
				<label for="search" class="block text-sm font-medium text-gray-700 mb-1"
					>Search SKU/ASIN/Product</label
				>
				<input
					id="search"
					type="text"
					placeholder="Enter SKU, ASIN, or Product Title"
					class="w-full border rounded px-3 py-2"
					bind:value={searchQuery}
					on:input={applyFilters}
				/>
			</div>

			<!-- Category Filter -->
			<div>
				<label for="category" class="block text-sm font-medium text-gray-700 mb-1">Category</label>
				<select
					id="category"
					class="w-full border rounded px-3 py-2"
					bind:value={categoryFilter}
					on:change={applyFilters}
				>
					<option value="all">All Products</option>
					<option value="winners">🏆 Buy Box Winners</option>
					<option value="losers">❌ Not Winning</option>
					<option value="opportunities">⚡ Opportunities</option>
					<option value="profitable">💰 Profitable Ops</option>
					<optgroup label="Recommendations">
						<option value="not_profitable">🚫 Not Profitable</option>
						<option value="match_buybox">🎯 Match Buy Box</option>
						<option value="hold_price">✋ Hold Price</option>
						<option value="investigate">🔍 Investigate</option>
					</optgroup>
				</select>
			</div>

			<!-- Sort By -->
			<div>
				<label for="sort" class="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
				<select
					id="sort"
					class="w-full border rounded px-3 py-2"
					bind:value={sortBy}
					on:change={applyFilters}
				>
					<option value="profit_desc">💰 Profit (High to Low)</option>
					<option value="profit_asc">💰 Profit (Low to High)</option>
					<option value="margin_desc">📊 Margin % (High to Low)</option>
					<option value="margin_asc">📊 Margin % (Low to High)</option>
					<option value="sku_asc">📝 SKU (A to Z)</option>
				</select>
			</div>

			<!-- Items per page -->
			<div>
				<label for="perPage" class="block text-sm font-medium text-gray-700 mb-1"
					>Items per page</label
				>
				<select
					id="perPage"
					class="w-full border rounded px-3 py-2"
					bind:value={itemsPerPage}
					on:change={applyFilters}
				>
					<option value={25}>25</option>
					<option value={50}>50</option>
					<option value={100}>100</option>
					<option value={200}>200</option>
				</select>
			</div>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<!-- Latest Data Only Filter -->
			<div class="flex items-center">
				<input
					type="checkbox"
					id="latestOnly"
					class="mr-2"
					bind:checked={showLatestOnly}
					on:change={loadBuyBoxData}
				/>
				<label for="latestOnly" class="text-sm">
					Show only latest data per SKU
					<span class="text-xs text-gray-500 block"> (Hides duplicate scans from same day) </span>
				</label>
			</div>

			<!-- Margin Data Filter -->
			<div class="flex items-center">
				<input
					type="checkbox"
					id="marginData"
					class="mr-2"
					bind:checked={showOnlyWithMarginData}
					on:change={applyFilters}
				/>
				<label for="marginData" class="text-sm">Only show items with margin data</label>
			</div>

			<!-- Min Profit Filter -->
			<div>
				<label for="minProfit" class="block text-sm font-medium text-gray-700 mb-1"
					>Min Profit £</label
				>
				<input
					id="minProfit"
					type="number"
					min="0"
					step="0.5"
					placeholder="0.00"
					class="w-full border rounded px-3 py-2"
					bind:value={minProfitFilter}
					on:input={applyFilters}
				/>
			</div>

			<!-- Min Margin Filter -->
			<div>
				<label for="minMargin" class="block text-sm font-medium text-gray-700 mb-1"
					>Min Margin %</label
				>
				<input
					id="minMargin"
					type="number"
					min="0"
					max="100"
					step="1"
					placeholder="0"
					class="w-full border rounded px-3 py-2"
					bind:value={minMarginFilter}
					on:input={applyFilters}
				/>
			</div>
		</div>
	</div>

	<!-- Results -->
	<div class="bg-white rounded-lg shadow">
		<div class="px-6 py-4 border-b border-gray-200">
			<div class="flex justify-between items-center">
				<h2 class="font-semibold">
					Buy Box Results ({totalResults} items)
					{#if showLatestOnly}
						<span class="text-sm font-normal text-blue-600"> - Latest data only </span>
					{:else}
						<span class="text-sm font-normal text-purple-600"> - All historical data </span>
					{/if}
				</h2>
				<div class="text-sm text-gray-500">
					{#if showLatestOnly}
						<button
							on:click={() => {
								showLatestOnly = false;
								loadBuyBoxData();
							}}
							class="text-blue-600 hover:text-blue-800 underline"
						>
							View history
						</button>
					{:else}
						<button
							on:click={() => {
								showLatestOnly = true;
								loadBuyBoxData();
							}}
							class="text-purple-600 hover:text-purple-800 underline"
						>
							Latest only
						</button>
					{/if}
				</div>
			</div>
		</div>

		{#if isLoading}
			<div class="p-8 text-center">
				<div class="flex flex-col items-center gap-4">
					<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
					<p class="text-lg font-medium">Loading buy box data...</p>
					<p class="text-sm text-gray-500">This may take a few moments for large datasets</p>
				</div>
			</div>
		{:else if paginatedData.length === 0}
			<div class="p-8 text-center">
				<p>No results found with current filters</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full">
					<thead class="bg-gray-50">
						<tr>
							<th
								class="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Product</th
							>
							<th
								class="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Price Analysis</th
							>
							<th
								class="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Cost Breakdown</th
							>
							<th
								class="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Margin Analysis</th
							>
							<th
								class="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Recommendation</th
							>
							<th
								class="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Actions</th
							>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200">
						{#each paginatedData as result}
							<tr
								class={`
									hover:bg-gray-50 
									${result.opportunity_flag ? 'bg-yellow-50' : ''} 
									${result.is_winner ? 'bg-green-50' : ''}
									${result.recommended_action === 'match_buybox' ? 'border-l-4 border-l-blue-500' : ''}
									${result.recommended_action === 'not_profitable' ? 'border-l-4 border-l-red-500' : ''}
								`}
							>
								<!-- Product Info -->
								<td class="py-4 px-6">
									<div class="text-sm">
										{#if result.product_title}
											<div
												class="font-medium text-gray-900 mb-1 leading-tight cursor-help"
												title={result.product_title}
											>
												{truncateTitle(result.product_title)}
											</div>
										{:else}
											<!-- Debug: Show when no product title is found -->
											<div class="text-xs text-gray-400 mb-1 italic">No product title found</div>
										{/if}
										<div>
											<a
												href="https://sellercentral.amazon.co.uk/myinventory/inventory?fulfilledBy=all&page=1&pageSize=50&searchField=all&searchTerm={encodeURIComponent(
													result.sku
												)}&sort=date_created_desc&status=all&ref_=xx_invmgr_favb_xx"
												target="_blank"
												rel="noopener noreferrer"
												class="font-medium text-blue-600 hover:text-blue-800 underline"
												title="Manage price in Amazon Seller Central"
											>
												{result.sku} 📝
											</a>
										</div>
										<div>
											<a
												href="https://amazon.co.uk/dp/{result.asin}"
												target="_blank"
												rel="noopener noreferrer"
												class="text-blue-600 hover:text-blue-800 underline text-xs font-medium"
												title="View on Amazon UK"
											>
												{result.asin} →
											</a>
											{#if !showLatestOnly}
												{@const totalEntries = getHistoricalCount(result.sku, allRawData)}
												<div class="text-xs text-purple-600 font-medium mt-1">
													📅 Scan: {new Date(result.captured_at).toLocaleDateString()}
													{new Date(result.captured_at).toLocaleTimeString([], {
														hour: '2-digit',
														minute: '2-digit'
													})}
													{#if totalEntries > 1}
														<span class="bg-purple-100 text-purple-800 px-1 rounded text-xs ml-1">
															{totalEntries} entries
														</span>
													{/if}
												</div>
											{/if}
											<div class="mt-1">
												{#if result.is_winner}
													<span
														class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
													>
														🏆 Buy Box Winner
													</span>
												{:else if result.opportunity_flag}
													<span
														class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800"
													>
														⚡ Opportunity
													</span>
												{/if}
											</div>
											<div class="text-xs text-gray-400 mt-1">
												Last checked: {formatDate(result.captured_at)}
												{#if showLatestOnly}
													{@const totalEntries = getHistoricalCount(result.sku, allRawData)}
													{#if totalEntries > 1}
														<span class="text-blue-600 ml-1">
															(Latest of {totalEntries} scans)
														</span>
													{/if}
												{/if}
											</div>
										</div>
									</div></td
								>

								<!-- Price Analysis -->
								<td class="py-4 px-6">
									<div class="text-sm space-y-1">
										<!-- Our Price -->
										<div class="font-medium text-gray-900">
											Our Price: £{result.price?.toFixed(2) || 'N/A'}
											{#if result.is_winner}
												<span class="text-green-600 ml-1">🏆</span>
											{/if}
										</div>

										<!-- Buy Box Price -->
										{#if result.competitor_price}
											<div class="font-medium text-gray-700">
												Buy Box Price: £{result.competitor_price.toFixed(2)}
											</div>
										{:else if result.is_winner && result.price}
											<div class="font-medium text-green-700">
												Buy Box Price: £{result.price.toFixed(2)} (You)
											</div>
										{:else}
											<div class="font-medium text-gray-500">Buy Box Price: N/A</div>
										{/if}

										<!-- Break Even Price -->
										{#if result.break_even_price}
											<div class="font-medium text-gray-600">
												Break Even Price: £{result.break_even_price.toFixed(2)}
											</div>
										{:else}
											<div class="font-medium text-gray-500">Break Even Price: N/A</div>
										{/if}

										<!-- Data Freshness Warning -->
										{#if Date.now() - new Date(result.captured_at).getTime() > 24 * 60 * 60 * 1000}
											{@const dataAge = Math.floor(
												(Date.now() - new Date(result.captured_at).getTime()) / (1000 * 60 * 60)
											)}
											<div class="bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
												<div class="text-xs text-yellow-800 font-medium">
													⚠️ Data may be outdated ({dataAge}h old)
												</div>
												<div class="text-xs text-yellow-600 mt-1">
													<a
														href="/buy-box-monitor?query={encodeURIComponent(result.sku)}"
														class="underline hover:text-yellow-800"
														target="_blank"
													>
														Check live pricing →
													</a>
												</div>
											</div>
										{/if}
									</div>
								</td>

								<!-- Cost Breakdown -->
								<td class="py-4 px-6">
									<div class="text-xs space-y-1">
										<div class="font-medium text-gray-700 mb-1">Fixed Costs:</div>
										{#if result.your_cost}
											<div>Base: £{result.your_cost.toFixed(2)}</div>
										{/if}
										{#if result.your_vat_amount}
											<div>VAT: £{result.your_vat_amount.toFixed(2)}</div>
										{/if}
										{#if result.your_box_cost}
											<div>Box: £{result.your_box_cost.toFixed(2)}</div>
										{/if}
										<div>Material: £0.20</div>
										{#if result.your_fragile_charge && result.your_fragile_charge > 0}
											<div>Fragile: £{result.your_fragile_charge.toFixed(2)}</div>
										{/if}
										{#if result.your_shipping_cost}
											<div>Shipping: £{result.your_shipping_cost.toFixed(2)}</div>
										{/if}
										{#if result.total_operating_cost}
											<div class="font-medium border-t pt-1 text-blue-800">
												Total Fixed Costs: £{result.total_operating_cost.toFixed(2)}
											</div>
										{/if}

										<div class="font-medium text-gray-700 mt-2 mb-1">Variable Cost:</div>
										{#if result.price}
											<div class="text-red-600">
												Amazon Fee (15% of £{result.price.toFixed(2)}): £{(
													result.price * 0.15
												).toFixed(2)}
											</div>
										{/if}

										{#if result.total_operating_cost && result.price}
											<div class="font-bold border-t pt-2 text-orange-800">
												Total Cost After Fees: £{(
													result.total_operating_cost +
													result.price * 0.15
												).toFixed(2)}
											</div>
											<div class="text-xs text-gray-500">
												(£{result.total_operating_cost.toFixed(2)} + £{(
													result.price * 0.15
												).toFixed(2)})
											</div>
										{/if}

										{#if result.break_even_price}
											<div class="font-bold border-t pt-2 text-red-800">
												Break-even: £{result.break_even_price.toFixed(2)}
											</div>
											<div class="text-xs text-gray-500">
												(£{result.total_operating_cost?.toFixed(2)} ÷ 0.85)
											</div>
										{/if}
									</div>
								</td>

								<!-- Margin Analysis -->
								<td class="py-4 px-6">
									<div class="text-sm space-y-1">
										{#if result.current_actual_profit !== null}
											<div
												class={`font-bold text-lg ${result.current_actual_profit >= 5 ? 'text-green-600' : result.current_actual_profit >= 1 ? 'text-yellow-600' : result.current_actual_profit >= 0 ? 'text-orange-600' : 'text-red-600'}`}
											>
												£{result.current_actual_profit.toFixed(2)} profit
											</div>
										{/if}
										{#if result.your_margin_percent_at_current_price !== null}
											<div
												class={`font-medium text-xs ${result.your_margin_percent_at_current_price >= 10 ? 'text-green-600' : 'text-red-600'}`}
											>
												📊 Current Price: {result.your_margin_percent_at_current_price.toFixed(1)}%
												margin
											</div>
										{/if}

										<!-- Beat Buy Box by 1p Analysis (only when not winning) -->
										{#if !result.is_winner && result.competitor_price && result.total_operating_cost}
											{@const beatBuyBoxPrice = result.competitor_price - 0.01}
											{@const beatBuyBoxAmazonFee = beatBuyBoxPrice * 0.15}
											{@const beatBuyBoxProfit =
												beatBuyBoxPrice - beatBuyBoxAmazonFee - result.total_operating_cost}
											{@const beatBuyBoxMarginPercent =
												beatBuyBoxPrice > 0 ? (beatBuyBoxProfit / beatBuyBoxPrice) * 100 : 0}

											<div class="border-t pt-1 mt-2">
												<div class="text-xs font-medium text-purple-700 mb-1">
													🎯 Beat Buy Box by 1p (£{beatBuyBoxPrice.toFixed(2)}):
												</div>
												<div
													class={`text-xs font-medium ${beatBuyBoxProfit >= 1 ? 'text-green-600' : beatBuyBoxProfit >= 0 ? 'text-yellow-600' : 'text-red-600'}`}
												>
													£{beatBuyBoxProfit.toFixed(2)} profit ({beatBuyBoxMarginPercent.toFixed(
														1
													)}% margin)
												</div>
												{#if beatBuyBoxProfit > (result.current_actual_profit || 0)}
													<div class="text-xs text-green-600">
														+£{(beatBuyBoxProfit - (result.current_actual_profit || 0)).toFixed(2)} vs
														current
													</div>
												{/if}
											</div>
										{/if}

										<!-- Match Buy Box Exactly (existing calculation) -->
										{#if result.buybox_actual_profit !== null && result.buybox_actual_profit !== result.current_actual_profit}
											<div class="border-t pt-1 mt-1">
												<div class="text-xs font-medium text-gray-700 mb-1">
													🎯 Match Buy Box Exactly:
												</div>
												<div
													class={`text-xs ${result.buybox_actual_profit >= (result.current_actual_profit || 0) ? 'text-green-600' : 'text-gray-600'}`}
												>
													£{result.buybox_actual_profit.toFixed(2)} profit
												</div>
												{#if result.margin_percent_at_buybox_price !== null}
													<div
														class={`text-xs ${result.margin_percent_at_buybox_price >= 10 ? 'text-green-600' : 'text-red-600'}`}
													>
														({result.margin_percent_at_buybox_price.toFixed(1)}% margin)
													</div>
												{/if}
											</div>
										{/if}

										{#if result.profit_opportunity && result.profit_opportunity > 0}
											<div
												class="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded mt-2"
											>
												+£{result.profit_opportunity.toFixed(2)} opportunity
											</div>
										{/if}
										{#if result.margin_difference}
											<div
												class={`text-xs ${result.margin_difference > 0 ? 'text-green-600' : 'text-red-600'}`}
											>
												Difference: {result.margin_difference > 0
													? '+'
													: ''}£{result.margin_difference.toFixed(2)}
											</div>
										{/if}
									</div>
								</td>

								<!-- Recommendation -->
								<td class="py-4 px-6">
									{#if result.recommended_action}
										<span
											class={`inline-flex items-center px-2 py-1 rounded text-xs font-medium
											${result.recommended_action === 'match_buybox' ? 'bg-blue-100 text-blue-800' : ''}
											${result.recommended_action === 'hold_price' ? 'bg-green-100 text-green-800' : ''}
											${result.recommended_action === 'investigate' ? 'bg-yellow-100 text-yellow-800' : ''}
											${result.recommended_action === 'not_profitable' ? 'bg-red-100 text-red-800' : ''}
										`}
										>
											{#if result.recommended_action === 'match_buybox'}
												📈 Match Buy Box
											{:else if result.recommended_action === 'hold_price'}
												✋ Hold Price
											{:else if result.recommended_action === 'investigate'}
												🔍 Investigate
											{:else if result.recommended_action === 'not_profitable'}
												❌ Not Profitable
											{:else}
												{result.recommended_action}
											{/if}
										</span>
									{:else}
										<span class="text-gray-400 text-xs">No data</span>
									{/if}
								</td>

								<!-- Actions -->
								<td class="py-4 px-6">
									<div class="flex flex-col gap-1">
										<button
											class="text-blue-600 hover:text-blue-800 underline text-xs"
											on:click={() => viewProductDetails(result.asin, result.sku)}
										>
											View Details
										</button>
										<a
											href="/buy-box-monitor?query={encodeURIComponent(result.sku)}"
											target="_blank"
											class="text-green-600 hover:text-green-800 underline text-xs"
										>
											Verify Live Price
										</a>
										<button
											class="text-orange-600 hover:text-orange-800 underline text-xs"
											on:click={() => comparePricing(result)}
										>
											🔍 Compare Pricing
										</button>
										{#if result.recommended_action === 'match_buybox'}
											<button
												class="text-green-600 hover:text-green-800 underline text-xs"
												on:click={() => markForPriceUpdate(result)}
											>
												Mark for Update
											</button>
										{/if}
										<button
											class="text-purple-600 hover:text-purple-800 underline text-xs"
											on:click={() => addToWatchlist(result)}
										>
											Add to Watchlist
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			{#if totalResults > itemsPerPage}
				<div class="px-6 py-4 border-t border-gray-200">
					<div class="flex justify-between items-center">
						<div class="text-sm text-gray-500">
							Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(
								currentPage * itemsPerPage,
								totalResults
							)} of {totalResults} results
						</div>
						<div class="flex space-x-1">
							<button
								class="px-3 py-1 rounded border disabled:opacity-50"
								disabled={currentPage === 1}
								on:click={() => changePage(currentPage - 1)}
							>
								Previous
							</button>

							{#each Array(Math.min(5, Math.ceil(totalResults / itemsPerPage))) as _, i}
								{@const pageNumber = Math.max(1, currentPage - 2) + i}
								{#if pageNumber <= Math.ceil(totalResults / itemsPerPage)}
									<button
										class={`px-3 py-1 rounded border ${currentPage === pageNumber ? 'bg-blue-600 text-white' : ''}`}
										on:click={() => changePage(pageNumber)}
									>
										{pageNumber}
									</button>
								{/if}
							{/each}

							<button
								class="px-3 py-1 rounded border disabled:opacity-50"
								disabled={currentPage === Math.ceil(totalResults / itemsPerPage)}
								on:click={() => changePage(currentPage + 1)}
							>
								Next
							</button>
						</div>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>
