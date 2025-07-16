<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';

	// Types for buy box management
	interface BuyBoxData {
		id: string;
		asin: string;
		sku: string;
		// product_title removed - now loaded lazily from sku_asin_mapping
		price: number | null; // This is the buybox price (competitor's price)
		your_current_price: number | null; // This is our current listed price
		competitor_price: number | null;
		is_winner: boolean;
		opportunity_flag: boolean;
		captured_at: string;

		// Essential cost fields (others removed to reduce response size)
		your_cost: number | null;
		your_shipping_cost: number | null;
		your_material_total_cost: number | null;
		your_box_cost: number | null;
		your_vat_amount: number | null;
		your_fragile_charge: number | null;
		total_operating_cost: number | null;

		// Current pricing margins
		your_margin_percent_at_current_price: number | null;

		// Competitor analysis
		margin_percent_at_buybox_price: number | null;
		margin_difference: number | null;
		profit_opportunity: number | null;

		// Actual profit calculations
		current_actual_profit: number | null;
		buybox_actual_profit: number | null;

		// Recommendations
		recommended_action: string | null;
		break_even_price: number | null;

		// Removed fields to reduce response size:
		// margin_at_buybox, margin_percent_at_buybox, material_cost_only,
		// your_margin_at_current_price, margin_at_buybox_price,
		// current_profit_breakdown, buybox_profit_breakdown,
		// price_adjustment_needed, margin_calculation_version, cost_data_source
	}

	// State management
	let buyboxData: BuyBoxData[] = [];
	let filteredData: BuyBoxData[] = [];
	let isLoading = true;
	let errorMessage = '';

	// Product title cache and loading state
	let productTitleCache = new Map<string, string>(); // SKU -> product title
	let loadingProductTitles = false;
	let cacheVersion = 0; // Used to trigger reactivity when cache changes

	// Search and filters
	let searchQuery = '';
	let categoryFilter = 'all'; // all, winners, losers, opportunities, profitable, not_profitable, match_buybox, hold_price, investigate
	let sortBy = 'profit_desc'; // profit_desc, profit_asc, margin_desc, margin_asc, sku_asc
	let showOnlyWithMarginData = false;
	let includeNoMarginData = false; // New option to include records without margin data
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

	// UI State
	let alertsExpanded = false;
	let selectedItems = new Set<string>(); // Track selected item IDs for bulk actions
	let filtersExpanded = false;

	// Track active filters for better UX
	let activeCardFilter = ''; // Track which summary card filter is active
	let activePresetFilter = ''; // Track which preset filter is active
	let hasActiveFilters = false; // Track if any filters are applied

	// Filter presets
	const filterPresets = [
		{
			name: 'High Profit Opportunities',
			emoji: '💎',
			filters: { categoryFilter: 'opportunities', minProfitFilter: 2, sortBy: 'profit_desc' }
		},
		{
			name: 'Urgent Price Updates',
			emoji: '🚨',
			filters: { categoryFilter: 'match_buybox', sortBy: 'profit_desc' }
		},
		{
			name: 'New Competition',
			emoji: '⚔️',
			filters: { categoryFilter: 'losers', sortBy: 'profit_desc' }
		},
		{
			name: 'Winning Products',
			emoji: '🏆',
			filters: { categoryFilter: 'winners', sortBy: 'profit_desc' }
		}
	];

	// Initialize and load data
	onMount(async () => {
		await refreshData();
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

	// Wrapper function for UI-triggered loads (no parameters)
	async function refreshData(): Promise<void> {
		await loadBuyBoxData();
	}

	// Load buy box data from API with optional retry limit
	async function loadBuyBoxData(retryLimit: number | null = null): Promise<void> {
		isLoading = true;
		errorMessage = '';

		const requestStartTime = Date.now();
		console.log('🔵 Frontend: Starting Buy Box data request at', new Date().toISOString());

		try {
			// Use retry limit if provided, otherwise use a more conservative limit
			const currentLimit = retryLimit || 3000; // Reduced from 4000 to be safer

			// Get latest data from all jobs - use a more reasonable limit for production
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

			const url = `/api/buybox/results?include_all_jobs=true&limit=${currentLimit}${includeNoMarginData ? '&include_no_margin=true' : ''}`;
			console.log('🔵 Frontend: Requesting URL:', url);
			console.log('🔵 Frontend: Request timeout set to 30 seconds');

			if (retryLimit) {
				console.log(`🔄 Frontend: Retrying with reduced limit: ${retryLimit} (was 4000)`);
			}

			const requestTime = Date.now();
			const response = await fetch(url, {
				signal: controller.signal
			});
			clearTimeout(timeoutId);

			const fetchTime = Date.now() - requestTime;
			console.log('🔵 Frontend: Fetch completed in', fetchTime + 'ms');
			console.log('🔵 Frontend: Response status:', response.status, response.statusText);
			console.log('🔵 Frontend: Response headers:', Object.fromEntries(response.headers.entries()));

			const parseStartTime = Date.now();
			const data = await response.json();
			const parseTime = Date.now() - parseStartTime;

			console.log('🔵 Frontend: JSON parse completed in', parseTime + 'ms');
			console.log('🔵 Frontend: Response data keys:', Object.keys(data));

			if (data.debug) {
				console.log('🔵 Frontend: Server debug info:', data.debug);
			}

			if (!response.ok) {
				console.error('🔴 Frontend: API error response:', data);

				// Handle specific error types
				if (
					data.errorType === 'Function.ResponseSizeTooLarge' &&
					data.autoRetryWith &&
					!retryLimit
				) {
					console.log(`🔄 Frontend: Auto-retrying with suggested limit: ${data.autoRetryWith}`);

					// Show a brief notification about the retry
					errorMessage = `Dataset too large (${data.debug?.actualResults || 'unknown'} records). Automatically reducing to ${data.autoRetryWith} records...`;

					// Wait a brief moment for user to see the message, then retry
					setTimeout(() => {
						loadBuyBoxData(data.autoRetryWith);
					}, 1500);

					return;
				} else if (data.errorType === 'Function.ResponseSizeTooLarge') {
					const suggestions =
						data.suggestions?.join('\n• ') || 'Please try reducing the data size.';
					throw new Error(
						`Dataset too large for single request (${data.debug?.actualResults || 'unknown'} records, ${data.debug?.responseSize || 'unknown size'}).\n\nSuggestions:\n• ${suggestions}`
					);
				} else if (response.status === 413) {
					throw new Error(
						`Response too large: ${data.error || 'Please reduce the limit or add filters'}`
					);
				} else {
					throw new Error(data.error || 'Failed to load buy box data');
				}
			}

			console.log('🔵 Frontend: Processing', data.results?.length || 0, 'results');

			// If we successfully loaded with a reduced limit, show info about it
			if (retryLimit && retryLimit < 4000) {
				console.log(
					`🟢 Frontend: Successfully loaded ${data.results?.length || 0} records with reduced limit of ${retryLimit}`
				);
			}

			buyboxData = data.results;
			allRawData = [...data.results]; // Store all raw data for historical counting

			// Deduplicate to show only latest data per SKU by default
			if (showLatestOnly) {
				const beforeDedup = buyboxData.length;
				buyboxData = deduplicateLatestData(buyboxData);
				console.log(
					'🔵 Frontend: Deduplicated from',
					beforeDedup,
					'to',
					buyboxData.length,
					'records'
				);
			}

			calculateSummaryStats();
			applyFilters();

			const totalTime = Date.now() - requestStartTime;
			console.log('🟢 Frontend: Buy Box data loaded successfully in', totalTime + 'ms');

			// Clear any retry-related error messages on success
			if (retryLimit) {
				errorMessage = '';
			}
		} catch (error: unknown) {
			const totalTime = Date.now() - requestStartTime;
			console.error('🔴 Frontend: Error loading buy box data after', totalTime + 'ms:', error);

			if (error instanceof Error && error.name === 'AbortError') {
				console.error('🔴 Frontend: Request was aborted due to timeout');
				errorMessage =
					'Request timed out. The server is taking too long to respond. Try refreshing or reducing the data range.';
			} else {
				console.error('🔴 Frontend: Request failed with error:', error);
				errorMessage =
					error instanceof Error
						? error.message
						: 'An error occurred while loading data. Please try again.';
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
			filtered = filtered.filter((item) => {
				const matchesSku = item.sku.toLowerCase().includes(query);
				const matchesAsin = item.asin.toLowerCase().includes(query);

				// Check cached product title (loaded from sku_asin_mapping)
				const cachedTitle = getProductTitle(item.sku);
				const matchesTitle = cachedTitle?.toLowerCase().includes(query) ?? false;

				return matchesSku || matchesAsin || matchesTitle;
			});
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

		// Filter out items missing base cost price (your_cost) to avoid inflated profit calculations
		const beforeBaseCostFilter = filtered.length;
		filtered = filtered.filter((item) => {
			const hasBaseCost =
				item.your_cost !== null && item.your_cost !== undefined && item.your_cost > 0;
			if (!hasBaseCost) {
				console.log(`🚫 Filtering out ${item.sku} - missing base cost:`, item.your_cost);
			}
			return hasBaseCost;
		});
		const afterBaseCostFilter = filtered.length;
		console.log(
			`🔍 Base cost filter: ${beforeBaseCostFilter} → ${afterBaseCostFilter} items (removed ${beforeBaseCostFilter - afterBaseCostFilter})`
		);

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

		// Update active filter state
		checkActiveFilters();

		// Force product title loading for new filtered results
		setTimeout(() => {
			if (filteredData.length > 0) {
				loadProductTitlesForPage();
			}
		}, 100);
	}

	// Get paginated data
	$: paginatedData = filteredData.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage
	);

	// Create a reactive map for product titles to force re-renders
	$: reactiveProductTitles = new Map(productTitleCache);

	// Load product titles when paginated data changes or when filtering
	$: if (paginatedData.length > 0) {
		// Use a small delay to ensure the DOM has updated
		setTimeout(() => {
			loadProductTitlesForPage();
		}, 50);
	}

	// Also trigger on filteredData changes to handle filtering
	$: if (filteredData.length > 0 && paginatedData.length > 0) {
		// Check if any items in current page are missing titles
		const missingTitles = paginatedData.some((item) => !productTitleCache.has(item.sku));
		if (missingTitles) {
			setTimeout(() => {
				loadProductTitlesForPage();
			}, 50);
		}
	}

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

	// Load product titles for currently visible items from sku_asin_mapping
	async function loadProductTitlesForPage(): Promise<void> {
		// Prevent concurrent loading
		if (loadingProductTitles) {
			console.log('🔍 Already loading product titles, skipping...');
			return;
		}

		if (paginatedData.length === 0) {
			console.log('🔍 No paginated data, skipping title loading');
			return;
		}

		// Get SKUs that don't have cached titles
		const skusToLoad = paginatedData
			.filter((item) => !productTitleCache.has(item.sku))
			.map((item) => item.sku);

		if (skusToLoad.length === 0) {
			console.log('🔍 No SKUs need titles - all are cached');
			return;
		}

		loadingProductTitles = true;
		console.log(
			`🔍 Loading product titles for ${skusToLoad.length} SKUs after filtering:`,
			skusToLoad
		);

		try {
			// For now, skip batch API and go straight to individual requests since /api/sku-mapping/batch doesn't exist yet
			console.log('🔄 Using individual requests for product titles');
			await loadProductTitlesIndividually(skusToLoad);

			// Force a reactivity update
			productTitleCache = new Map(productTitleCache);
			console.log('✅ Product titles loaded and cache updated');
		} catch (error) {
			console.error('❌ Error loading product titles:', error);
			// Fallback to individual requests if not already using them
			try {
				await loadProductTitlesIndividually(skusToLoad);
				productTitleCache = new Map(productTitleCache);
			} catch (fallbackError) {
				console.error('❌ Fallback title loading also failed:', fallbackError);
			}
		} finally {
			loadingProductTitles = false;
		}
	}

	// Fallback function to load titles individually
	async function loadProductTitlesIndividually(skus: string[]): Promise<void> {
		const maxConcurrent = 3; // Reduced from 5 to limit API load
		const chunks = [];

		for (let i = 0; i < skus.length; i += maxConcurrent) {
			chunks.push(skus.slice(i, i + maxConcurrent));
		}

		for (const chunk of chunks) {
			const promises = chunk.map(async (sku) => {
				try {
					console.log(`🔍 Fetching title for SKU: ${sku}`);
					const response = await fetch(
						`/api/buy-box-monitor/search?query=${encodeURIComponent(sku)}&limit=1`
					);
					const data = await response.json();

					console.log(`📄 Response for ${sku}:`, {
						success: data.success,
						resultsCount: data.results?.length || 0,
						firstResult: data.results?.[0],
						itemName: data.results?.[0]?.item_name
					});

					if (data.success && data.results?.[0]?.item_name) {
						productTitleCache.set(sku, data.results[0].item_name);
						cacheVersion++; // Trigger reactivity
						productTitleCache = productTitleCache; // Force Svelte reactivity
						console.log(`✅ Cached title for ${sku}: ${data.results[0].item_name}`);
					} else {
						console.warn(`⚠️ No title found for SKU ${sku}:`, data);
					}
				} catch (error) {
					console.warn(`❌ Failed to load title for SKU ${sku}:`, error);
				}
			});

			await Promise.all(promises);
			// Small delay between chunks to avoid overwhelming the API
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		console.log(`✅ Loaded product titles individually for ${skus.length} SKUs`);
	}

	// Get product title from cache or return fallback
	function getProductTitle(sku: string): string | null {
		// Reference both cacheVersion and reactiveProductTitles to ensure reactivity
		cacheVersion; // This makes Svelte track when the cache changes
		const cached = reactiveProductTitles.get(sku) || productTitleCache.get(sku);
		console.log(`🔍 getProductTitle(${sku}): ${cached || 'null'} (cache v${cacheVersion})`);
		return cached || null;
	}

	// Comprehensive filter reset function
	function resetAllFilters(): void {
		// Reset all filter variables to defaults
		searchQuery = '';
		categoryFilter = 'all';
		sortBy = 'captured_at';
		minProfitFilter = 0;
		minMarginFilter = 0;
		showOnlyWithMarginData = false;

		// Reset filter state tracking
		activeCardFilter = '';
		activePresetFilter = '';
		hasActiveFilters = false;

		// Clear selections
		selectedItems.clear();
		selectedItems = selectedItems;

		// Apply the reset filters
		applyFilters();
	}

	// Check if any filters are currently active
	function checkActiveFilters(): void {
		hasActiveFilters =
			searchQuery !== '' ||
			categoryFilter !== 'all' ||
			minProfitFilter > 0 ||
			minMarginFilter > 0 ||
			showOnlyWithMarginData ||
			activeCardFilter !== '' ||
			activePresetFilter !== '';
	}

	// Apply filter preset
	function applyFilterPreset(preset: (typeof filterPresets)[0]): void {
		// Reset other active filters first
		activeCardFilter = '';

		// Apply preset filters
		categoryFilter = preset.filters.categoryFilter;
		minProfitFilter = preset.filters.minProfitFilter || 0;
		sortBy = preset.filters.sortBy;

		// Track this preset as active
		activePresetFilter = preset.name;

		applyFilters();
		checkActiveFilters();
	}

	// Handle summary card clicks with improved feedback
	function handleSummaryCardClick(filterType: string): void {
		// Reset other active filters first
		activePresetFilter = '';

		switch (filterType) {
			case 'winners':
				categoryFilter = 'winners';
				activeCardFilter = 'Buy Box Winners';
				break;
			case 'opportunities':
				categoryFilter = 'opportunities';
				activeCardFilter = 'Opportunities';
				break;
			case 'profitable':
				categoryFilter = 'profitable';
				activeCardFilter = 'Profitable Items';
				break;
			case 'analyzed':
				showOnlyWithMarginData = true;
				activeCardFilter = 'Items with Margin Data';
				break;
			case 'high-profit':
			case 'avg-profit':
			case 'potential':
				minProfitFilter = 2;
				sortBy = 'current_actual_profit';
				activeCardFilter = 'High Profit Items';
				break;
			case 'total':
			default:
				// Reset to show all
				resetAllFilters();
				return;
		}

		applyFilters();
		checkActiveFilters();
	}

	// Bulk actions
	function toggleItemSelection(itemId: string): void {
		if (selectedItems.has(itemId)) {
			selectedItems.delete(itemId);
		} else {
			selectedItems.add(itemId);
		}
		selectedItems = selectedItems; // Force reactivity
	}

	function selectAllVisible(): void {
		paginatedData.forEach((item) => selectedItems.add(item.id));
		selectedItems = selectedItems;
	}

	function clearSelection(): void {
		selectedItems.clear();
		selectedItems = selectedItems;
	}

	function bulkMarkForUpdate(): void {
		const selectedProducts = paginatedData.filter((item) => selectedItems.has(item.id));
		console.log(
			'Bulk mark for update:',
			selectedProducts.map((p) => p.sku)
		);
		// TODO: Implement bulk price update functionality
		alert(`Marked ${selectedProducts.length} products for price updates`);
	}

	function bulkAddToWatchlist(): void {
		const selectedProducts = paginatedData.filter((item) => selectedItems.has(item.id));
		console.log(
			'Bulk add to watchlist:',
			selectedProducts.map((p) => p.sku)
		);
		// TODO: Implement bulk watchlist functionality
		alert(`Added ${selectedProducts.length} products to watchlist`);
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
				on:click={refreshData}
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
			<p class="font-medium">Error Loading Data</p>
			<p class="text-sm mt-1">{errorMessage}</p>
			{#if errorMessage.includes('too large') || errorMessage.includes('size')}
				<div class="mt-3 p-3 bg-red-50 rounded text-sm">
					<p class="font-medium text-red-800 mb-2">💡 Tips to reduce data size:</p>
					<ul class="list-disc list-inside space-y-1 text-red-700">
						<li>Use "Latest data only" filter (enabled by default)</li>
						<li>Add search filters for specific SKUs or ASINs</li>
						<li>Filter by category (Winners, Opportunities, etc.)</li>
						<li>Use minimum profit/margin filters</li>
						<li>Contact support if you need access to larger datasets</li>
					</ul>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Consolidated Smart Status Panel -->
	{#if !isLoading && buyboxData.length > 0}
		<div class="bg-white border border-gray-200 rounded-lg mb-6 overflow-hidden">
			<!-- Status Header -->
			<div class="bg-gradient-to-r from-blue-50 to-green-50 px-4 py-3 border-b">
				<div class="flex justify-between items-center">
					<div class="flex items-center gap-3">
						<div class="text-lg font-medium text-gray-900">📊 Dataset Status</div>
						<div class="flex gap-2">
							{#if showLatestOnly}
								<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
									Latest Only
								</span>
							{:else}
								<span class="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">
									Historical Data
								</span>
							{/if}
							{#if !includeNoMarginData}
								<span class="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
									Optimized View
								</span>
							{/if}
						</div>
					</div>
					<button
						on:click={() => (alertsExpanded = !alertsExpanded)}
						class="text-gray-500 hover:text-gray-700 transition-colors"
					>
						{alertsExpanded ? '▼' : '▶'} Details
					</button>
				</div>

				<!-- Quick Summary -->
				<div class="mt-2 text-sm text-gray-600">
					{totalResults} products displayed •
					{totalWinners} wins •
					{totalOpportunities} opportunities • £{totalPotentialProfit.toFixed(0)} potential
				</div>
			</div>

			<!-- Expandable Details -->
			{#if alertsExpanded}
				<div class="p-4 space-y-3 bg-gray-50">
					<!-- Data Mode Info -->
					<div class="flex items-start gap-3">
						<div class="text-blue-500 mt-0.5">📊</div>
						<div class="flex-1">
							<div class="font-medium text-gray-900 mb-1">Data Mode</div>
							{#if showLatestOnly}
								<p class="text-sm text-gray-600">
									Showing latest scan data per SKU. Multiple daily scans are deduplicated.
								</p>
								<button
									on:click={() => {
										showLatestOnly = false;
										refreshData();
									}}
									class="text-blue-600 hover:text-blue-800 text-xs underline mt-1"
								>
									Switch to historical data
								</button>
							{:else}
								<p class="text-sm text-gray-600">
									Showing all scan records including multiple entries per SKU.
								</p>
								<button
									on:click={() => {
										showLatestOnly = true;
										refreshData();
									}}
									class="text-purple-600 hover:text-purple-800 text-xs underline mt-1"
								>
									Switch to latest only
								</button>
							{/if}
						</div>
					</div>

					<!-- Optimization Info -->
					<div class="flex items-start gap-3">
						<div class="text-green-500 mt-0.5">🎯</div>
						<div class="flex-1">
							<div class="font-medium text-gray-900 mb-1">Performance Mode</div>
							{#if !includeNoMarginData}
								<p class="text-sm text-gray-600">
									Only showing products with cost data. Excludes ~50-70% of records without margin
									calculations.
								</p>
								<button
									on:click={() => {
										includeNoMarginData = true;
										refreshData();
									}}
									class="text-green-600 hover:text-green-800 text-xs underline mt-1"
								>
									Include all records (slower)
								</button>
							{:else}
								<p class="text-sm text-gray-600">
									Including all records. This increases load times and may hit size limits.
								</p>
								<button
									on:click={() => {
										includeNoMarginData = false;
										refreshData();
									}}
									class="text-orange-600 hover:text-orange-800 text-xs underline mt-1"
								>
									Use optimized view
								</button>
							{/if}
						</div>
					</div>

					<!-- Base Cost Filtering -->
					{#if !isLoading && buyboxData.length > 0}
						{@const itemsWithoutBaseCost = allRawData.filter(
							(item) => !item.your_cost || item.your_cost <= 0
						).length}
						{#if itemsWithoutBaseCost > 0}
							<div class="flex items-start gap-3">
								<div class="text-blue-500 mt-0.5">💰</div>
								<div class="flex-1">
									<div class="font-medium text-gray-900 mb-1">Cost Data Filtering</div>
									<p class="text-sm text-gray-600">
										Hiding {itemsWithoutBaseCost} items missing base cost data to ensure accurate profit
										calculations.
									</p>
								</div>
							</div>
						{/if}
					{/if}

					<!-- Data Freshness -->
					{#if !isLoading && buyboxData.length > 0}
						{@const oldestData = Math.min(
							...buyboxData.map((item) => new Date(item.captured_at).getTime())
						)}
						{@const oldestAge = Math.floor((Date.now() - oldestData) / (1000 * 60 * 60))}
						{#if oldestAge > 24}
							<div class="flex items-start gap-3">
								<div class="text-yellow-500 mt-0.5">⚠️</div>
								<div class="flex-1">
									<div class="font-medium text-gray-900 mb-1">Data Freshness Warning</div>
									<p class="text-sm text-gray-600">
										Oldest data is {oldestAge} hours old. Consider running a fresh scan.
									</p>
									<div class="flex gap-2 mt-2">
										<a
											href="/buy-box-monitor/jobs"
											class="bg-yellow-600 hover:bg-yellow-700 text-white py-1 px-3 rounded text-xs"
										>
											Run New Scan
										</a>
										<button
											on:click={refreshData}
											class="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded text-xs"
										>
											Refresh Data
										</button>
									</div>
								</div>
							</div>
						{/if}
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Enhanced Summary Statistics Cards -->
	{#if !isLoading && buyboxData.length > 0}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
			<!-- Winners Card -->
			<button
				on:click={() => handleSummaryCardClick('winners')}
				class={`bg-green-50 p-4 rounded-lg border hover:shadow-md transition-shadow text-left ${
					activeCardFilter === 'Buy Box Winners' ? 'ring-2 ring-green-400 bg-green-100' : ''
				}`}
			>
				<h3 class="text-sm font-medium text-gray-500 mb-1">Buy Box Won</h3>
				<p class="text-2xl font-bold text-green-600">{totalWinners}</p>
				<p class="text-xs text-gray-400">
					{activeCardFilter === 'Buy Box Winners'
						? 'Active filter - click to clear'
						: 'Click to filter winners'}
				</p>
			</button>

			<!-- Opportunities Card -->
			<button
				on:click={() => handleSummaryCardClick('opportunities')}
				class={`bg-yellow-50 p-4 rounded-lg border hover:shadow-md transition-shadow text-left ${
					activeCardFilter === 'Opportunities' ? 'ring-2 ring-yellow-400 bg-yellow-100' : ''
				}`}
			>
				<h3 class="text-sm font-medium text-gray-500 mb-1">Opportunities</h3>
				<p class="text-2xl font-bold text-yellow-600">{totalOpportunities}</p>
				<p class="text-xs text-gray-400">
					{activeCardFilter === 'Opportunities'
						? 'Active filter - click to clear'
						: 'Click to find opportunities'}
				</p>
			</button>

			<!-- Profitable Ops Card -->
			<button
				on:click={() => handleSummaryCardClick('profitable')}
				class={`bg-purple-50 p-4 rounded-lg border hover:shadow-md transition-shadow text-left ${
					activeCardFilter === 'Profitable Items' ? 'ring-2 ring-purple-400 bg-purple-100' : ''
				}`}
			>
				<h3 class="text-sm font-medium text-gray-500 mb-1">Profitable Ops</h3>
				<p class="text-2xl font-bold text-purple-600">{totalProfitable}</p>
				<p class="text-xs text-gray-400">
					{activeCardFilter === 'Profitable Items'
						? 'Active filter - click to clear'
						: 'Click for profitable items'}
				</p>
			</button>

			<!-- Analyzed Card -->
			<button
				on:click={() => handleSummaryCardClick('analyzed')}
				class="bg-blue-50 p-4 rounded-lg border hover:shadow-md transition-shadow text-left"
			>
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
			</button>

			<!-- Average Profit Card -->
			<button
				on:click={() => handleSummaryCardClick('avg-profit')}
				class="bg-orange-50 p-4 rounded-lg border hover:shadow-md transition-shadow text-left"
			>
				<h3 class="text-sm font-medium text-gray-500 mb-1">Avg Profit</h3>
				<p
					class={`text-2xl font-bold ${avgProfit >= 2 ? 'text-green-600' : avgProfit >= 0 ? 'text-yellow-600' : 'text-red-600'}`}
				>
					£{avgProfit.toFixed(2)}
				</p>
				<p class="text-xs text-gray-400">Click for high-profit items</p>
			</button>

			<!-- Potential Profit Card -->
			<button
				on:click={() => handleSummaryCardClick('potential')}
				class="bg-indigo-50 p-4 rounded-lg border hover:shadow-md transition-shadow text-left"
			>
				<h3 class="text-sm font-medium text-gray-500 mb-1">Potential</h3>
				<p class="text-2xl font-bold text-indigo-600">£{totalPotentialProfit.toFixed(2)}</p>
				<p class="text-xs text-gray-400">Click for all opportunities</p>
			</button>
		</div>
	{/if}

	<!-- Enhanced Filters and Search -->
	<div class="bg-white rounded-lg shadow p-6 mb-6">
		<div class="flex items-center justify-between mb-4">
			<h2 class="font-semibold">Filters & Search</h2>
			<button
				on:click={() => (filtersExpanded = !filtersExpanded)}
				class="text-gray-500 hover:text-gray-700 transition-colors text-sm"
			>
				{filtersExpanded ? '▼ Collapse' : '▶ Expand All'}
			</button>
		</div>

		<!-- Quick Filter Presets -->
		<div class="mb-6">
			<h3 class="text-sm font-medium text-gray-700 mb-3">Quick Filters</h3>
			<div class="flex flex-wrap gap-2">
				{#each filterPresets as preset}
					<div
						class={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
							activePresetFilter === preset.name
								? 'bg-blue-100 text-blue-800 ring-2 ring-blue-300'
								: 'bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer'
						}`}
					>
						<button on:click={() => applyFilterPreset(preset)} class="flex items-center gap-2">
							<span>{preset.emoji}</span>
							<span>{preset.name}</span>
						</button>
						{#if activePresetFilter === preset.name}
							<button
								on:click={resetAllFilters}
								class="ml-1 text-blue-600 hover:text-blue-800"
								title="Clear this filter"
							>
								×
							</button>
						{/if}
					</div>
				{/each}
				<button
					on:click={resetAllFilters}
					class="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
				>
					🔄 Clear All
				</button>
			</div>
		</div>

		<!-- Active Filters Indicator -->
		{#if hasActiveFilters}
			<div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="text-sm font-medium text-blue-900">Active Filters:</span>
						<div class="flex flex-wrap gap-1">
							{#if activeCardFilter}
								<span
									class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
								>
									📊 {activeCardFilter}
									<button
										on:click={resetAllFilters}
										class="text-blue-600 hover:text-blue-800 ml-1"
										title="Clear this filter"
									>
										×
									</button>
								</span>
							{/if}
							{#if activePresetFilter}
								<span
									class="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
								>
									🎯 {activePresetFilter}
									<button
										on:click={resetAllFilters}
										class="text-green-600 hover:text-green-800 ml-1"
										title="Clear this filter"
									>
										×
									</button>
								</span>
							{/if}
							{#if searchQuery}
								<span
									class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
								>
									🔍 Search: "{searchQuery}"
									<button
										on:click={() => {
											searchQuery = '';
											applyFilters();
										}}
										class="text-yellow-600 hover:text-yellow-800 ml-1"
										title="Clear search"
									>
										×
									</button>
								</span>
							{/if}
							{#if categoryFilter !== 'all'}
								<span
									class="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
								>
									📂 Category: {categoryFilter}
									<button
										on:click={() => {
											categoryFilter = 'all';
											applyFilters();
										}}
										class="text-purple-600 hover:text-purple-800 ml-1"
										title="Clear category filter"
									>
										×
									</button>
								</span>
							{/if}
							{#if minProfitFilter > 0}
								<span
									class="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
								>
									💰 Min Profit: £{minProfitFilter}
									<button
										on:click={() => {
											minProfitFilter = 0;
											applyFilters();
										}}
										class="text-green-600 hover:text-green-800 ml-1"
										title="Clear profit filter"
									>
										×
									</button>
								</span>
							{/if}
							{#if minMarginFilter > 0}
								<span
									class="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
								>
									📊 Min Margin: {minMarginFilter}%
									<button
										on:click={() => {
											minMarginFilter = 0;
											applyFilters();
										}}
										class="text-orange-600 hover:text-orange-800 ml-1"
										title="Clear margin filter"
									>
										×
									</button>
								</span>
							{/if}
						</div>
					</div>
					<button
						on:click={resetAllFilters}
						class="text-blue-600 hover:text-blue-800 text-sm underline"
					>
						Clear All Filters
					</button>
				</div>
			</div>
		{/if}

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

		<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
			<!-- Latest Data Only Filter -->
			<div class="flex items-center">
				<input
					type="checkbox"
					id="latestOnly"
					class="mr-2"
					bind:checked={showLatestOnly}
					on:change={refreshData}
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

			<!-- Include No Margin Data -->
			<div class="flex items-center">
				<input
					type="checkbox"
					id="includeNoMargin"
					class="mr-2"
					bind:checked={includeNoMarginData}
					on:change={refreshData}
				/>
				<label for="includeNoMargin" class="text-sm">
					Include records without cost data
					<span class="text-xs text-gray-500 block"> (Increases data size significantly) </span>
				</label>
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
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
				<div class="flex items-center gap-3 text-sm text-gray-500">
					{#if loadingProductTitles}
						<span class="text-blue-600 flex items-center gap-1">
							<div
								class="animate-spin rounded-full h-3 w-3 border border-blue-600 border-t-transparent"
							></div>
							Loading titles...
						</span>
					{:else}
						<button
							on:click={() => {
								// Force reload product titles for current page
								const skusToReload = paginatedData.map((item) => item.sku);
								skusToReload.forEach((sku) => productTitleCache.delete(sku));
								loadProductTitlesForPage();
							}}
							class="text-blue-600 hover:text-blue-800 underline"
							title="Reload product titles for current page"
						>
							🔄 Refresh Titles
						</button>
					{/if}
					{#if showLatestOnly}
						<button
							on:click={() => {
								showLatestOnly = false;
								refreshData();
							}}
							class="text-blue-600 hover:text-blue-800 underline"
						>
							View history
						</button>
					{:else}
						<button
							on:click={() => {
								showLatestOnly = true;
								refreshData();
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
			<!-- Enhanced Data Table with Bulk Selection -->
			<div class="overflow-x-auto">
				<!-- Bulk Actions Bar -->
				{#if selectedItems.size > 0}
					<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-4">
								<span class="text-sm font-medium text-blue-900">
									{selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
								</span>
								<button
									on:click={selectAllVisible}
									class="text-blue-600 hover:text-blue-800 text-sm underline"
								>
									Select all visible ({paginatedData.length})
								</button>
								<button
									on:click={clearSelection}
									class="text-gray-600 hover:text-gray-800 text-sm underline"
								>
									Clear selection
								</button>
							</div>
							<div class="flex gap-2">
								<button
									on:click={bulkMarkForUpdate}
									class="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded text-sm"
								>
									📝 Mark for Price Update
								</button>
								<button
									on:click={bulkAddToWatchlist}
									class="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm"
								>
									👁️ Add to Watchlist
								</button>
							</div>
						</div>
					</div>
				{/if}

				<table class="min-w-full">
					<thead class="bg-gray-50">
						<tr>
							<th class="py-3 px-3 text-left">
								<input
									type="checkbox"
									checked={selectedItems.size > 0 && selectedItems.size === paginatedData.length}
									on:change={(e) => {
										const target = e.target as HTMLInputElement;
										if (target?.checked) {
											selectAllVisible();
										} else {
											clearSelection();
										}
									}}
									class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
								/>
							</th>
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
									${selectedItems.has(result.id) ? 'ring-2 ring-blue-300' : ''}
								`}
							>
								<!-- Selection Checkbox -->
								<td class="py-4 px-3">
									<input
										type="checkbox"
										checked={selectedItems.has(result.id)}
										on:change={() => toggleItemSelection(result.id)}
										class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
									/>
								</td>

								<!-- Product Info -->
								<td class="py-4 px-6">
									<div class="text-sm">
										{#if getProductTitle(result.sku)}
											{@const cachedTitle = getProductTitle(result.sku)}
											<div
												class="font-medium text-gray-900 mb-1 leading-tight cursor-help"
												title={cachedTitle || ''}
											>
												{truncateTitle(cachedTitle || '')}
											</div>
										{:else if loadingProductTitles}
											<!-- Show loading state -->
											<div class="text-xs text-gray-400 mb-1 italic">Loading product title...</div>
										{:else}
											<!-- Show when no product title is found -->
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
											Our Price: £{result.your_current_price?.toFixed(2) || 'N/A'}
											{#if result.is_winner}
												<span class="text-green-600 ml-1">🏆</span>
											{/if}
										</div>

										<!-- Buy Box Price -->
										{#if result.price && result.price !== result.your_current_price}
											<div class="font-medium text-gray-700">
												Buy Box Price: £{result.price.toFixed(2)}
											</div>
										{:else if result.competitor_price && result.competitor_price !== result.your_current_price}
											<div class="font-medium text-gray-700">
												Buy Box Price: £{result.competitor_price.toFixed(2)}
											</div>
										{:else if result.is_winner && result.your_current_price}
											<div class="font-medium text-green-700">
												Buy Box Price: £{result.your_current_price.toFixed(2)} (You)
											</div>
										{:else}
											<div class="font-medium text-gray-500">
												Buy Box Price: N/A
												<span class="text-xs block text-orange-600">No Buy Box detected</span>
											</div>
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
										{#if result.your_cost && result.your_cost > 0}
											<div>Base: £{result.your_cost.toFixed(2)}</div>
										{:else}
											<div class="text-red-600 font-medium">⚠️ Base: Missing/£0.00</div>
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
										{#if result.your_current_price}
											<div class="text-red-600">
												Amazon Fee (15% of £{result.your_current_price.toFixed(2)}): £{(
													result.your_current_price * 0.15
												).toFixed(2)}
											</div>
										{/if}

										{#if result.total_operating_cost && result.your_current_price}
											<div class="font-bold border-t pt-2 text-orange-800">
												Total Cost After Fees: £{(
													result.total_operating_cost +
													result.your_current_price * 0.15
												).toFixed(2)}
											</div>
											<div class="text-xs text-gray-500">
												(£{result.total_operating_cost.toFixed(2)} + £{(
													result.your_current_price * 0.15
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

										<!-- No competition detected message -->
										{#if !result.is_winner && !result.price && !result.competitor_price}
											<div class="border-t pt-1 mt-2">
												<div class="text-xs font-medium text-green-700 mb-1">
													🏆 No Competition Detected
												</div>
												<div class="text-xs text-green-600">
													You may have the buy box by default - consider checking live pricing
												</div>
											</div>
										{/if}

										<!-- Match Buy Box Exactly (only when there's valid buy box data AND actual competition) -->
										{#if result.buybox_actual_profit !== null && result.buybox_actual_profit !== result.current_actual_profit && (result.price || result.competitor_price) && ((result.price && result.price > 0) || (result.competitor_price && result.competitor_price > 0))}
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
										{/if}

										{#if result.profit_opportunity && result.profit_opportunity > 0}
											<div
												class="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded mt-2"
											>
												+£{result.profit_opportunity.toFixed(2)} opportunity
											</div>
										{/if}
									</div>
								</td>

								<!-- Recommendation -->
								<td class="py-4 px-6">
									{#if !result.price && !result.competitor_price}
										<!-- No competition detected -->
										<span
											class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800"
										>
											🏆 No Competition
										</span>
									{:else if result.recommended_action === 'not_profitable' && !result.price && !result.competitor_price}
										<!-- Not profitable but no competition - suggest investigation -->
										<span
											class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800"
										>
											🔍 Investigate
										</span>
									{:else if result.recommended_action}
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
											{:else if result.recommended_action === 'not_profitable' && (result.price || result.competitor_price)}
												❌ Not Profitable
											{:else if result.recommended_action === 'not_profitable'}
												🔍 Check Live Pricing
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
										<a
											href="/buy-box-monitor?query={encodeURIComponent(result.sku || result.asin)}"
											target="_blank"
											rel="noopener noreferrer"
											class="text-blue-600 hover:text-blue-800 underline text-xs"
										>
											View Details
										</a>
										{#if result.recommended_action === 'match_buybox'}
											<button
												class="text-green-600 hover:text-green-800 underline text-xs"
												on:click={() => markForPriceUpdate(result)}
											>
												Mark for Update
											</button>
										{/if}
										<span class="text-gray-400 text-xs cursor-not-allowed">
											Add to Watchlist (Coming Soon)
										</span>
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
