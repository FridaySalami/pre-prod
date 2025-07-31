<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';

	// Types for buy box management
	interface BuyBoxData {
		id: string;
		asin: string;
		sku: string;
		item_name?: string; // Product title from buy box data
		price: number | null; // This is the buybox price (competitor's price) - legacy field
		buybox_price: number | null; // Preferred field for buy box price
		your_current_price: number | null; // This is our current listed price
		competitor_price: number | null;
		is_winner: boolean;
		opportunity_flag: boolean;
		captured_at: string;
		merchant_shipping_group?: string; // Prime or Standard shipping type

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

		// Margin calculation breakdowns (new ROI-based method)
		current_margin_calculation: string | null;
		buybox_margin_calculation: string | null;
		total_investment_current: number | null;
		total_investment_buybox: number | null;

		// Additional fields for completeness
		run_id?: string | null;
		job_id?: string | null;
		is_skeleton?: boolean; // Flag to identify skeleton entries

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

	// Search and filters
	let searchQuery = '';
	let categoryFilter = 'all'; // all, winners, losers, opportunities, profitable, not_profitable, match_buybox, hold_price, investigate
	let shippingFilter = 'all'; // all, prime, standard
	let sortBy = 'profit_desc'; // profit_desc, profit_asc, margin_desc, margin_asc, profit_difference_desc, profit_difference_asc, margin_difference_desc, margin_difference_asc, sku_asc
	let showOnlyWithMarginData = false;
	let includeNoMarginData = false; // New option to include records without margin data
	let minProfitFilter = 0;
	let minMarginFilter = 0;
	let showLatestOnly = true; // New filter to show only latest data per SKU

	// View modes
	let viewMode = 'individual'; // 'individual', 'grouped', or 'bestsellers'
	let groupedData: Map<string, BuyBoxData[]> = new Map();
	let bestSellersData: BuyBoxData[] = [];
	let bestSellersGrouped: Map<string, BuyBoxData[]> = new Map();

	// Custom price simulation
	let customPrices = new Map<string, number>(); // SKU -> custom price
	let showCustomPriceInputs = new Map<string, boolean>(); // SKU -> show input state

	// Recently updated items that should bypass filters temporarily
	let recentlyUpdatedItems = new Set<string>(); // Set of record IDs that were recently updated
	let recentUpdateTimeout = new Map<string, ReturnType<typeof setTimeout>>(); // record ID -> timeout ID for cleanup
	let isPerformingLiveUpdate = false; // Flag to prevent reactive applyFilters during live updates
	let isPaginating = false; // Flag to prevent reactive applyFilters during pagination

	// Live pricing update functionality
	let livePricingUpdates = new Map<
		string,
		{
			isUpdating: boolean;
			lastUpdated: Date | null;
			error: string | null;
			success: boolean;
		}
	>(); // recordId -> update status
	let updatedRows = new Set<string>(); // recordId set for animation tracking

	// Best sellers list (top 100 ASINs from business report)
	const top100ASINs = [
		'B09T3GDNGT',
		'B076B1NF1Q',
		'B004BTED72',
		'B01B7GJX5I',
		'B01DDG8LDK',
		'B08TM1BDC6',
		'B0DBQXVZ1T',
		'B0D92T6K1P',
		'B0D33TYL4R',
		'B07QDB3FLX',
		'B0B46GGBBP',
		'B0D92Q4179',
		'B0DVS6YBJW',
		'B0CXTCGDDT',
		'B0DQ1BG9JQ',
		'B0D26J2KWX',
		'B0CM9YYM7J',
		'B08TRJRNWK',
		'B0BDS1J64S',
		'B00CS6K6AS',
		'B0CD2QKD7V',
		'B0CXR2TTDK',
		'B0CV7Z6WJX',
		'B005TG9OJI',
		'B0DHSTJ7K2',
		'B004BLBWXI',
		'B077BJ882X',
		'B0CFB5M7BH',
		'B0DVHWT7NG',
		'B0D1CND51R',
		'B01B7GJWSQ',
		'B078VB2BF7',
		'B0DJ95JVD3',
		'B0DNR97JSD',
		'B08BPBPYTF',
		'B0B99329X1',
		'B0D7J2JD91',
		'B0F7MNF5WY',
		'B08J856MT8',
		'B0CLM82JMF',
		'B003QNVCEG',
		'B01AAABOZE',
		'B00BEVBS50',
		'B00G6DMN82',
		'B0CP9JP9NG',
		'B0D8C3WGTL',
		'B07M9WN9JH',
		'B0104R0FRG',
		'B08TQPBQLV',
		'B0BQZ3GQTF',
		'B0DNN38WRW',
		'B008X6CR0O',
		'B00FXMJ15U',
		'B085PN6X4C',
		'B01B7GJWHW',
		'B0DPJ458LV',
		'B0B8DLRH3X',
		'B079GZW2B1',
		'B008F66BK4',
		'B073WRG21Q',
		'B0027XXHSK',
		'B0968DH592',
		'B08WHKR88F',
		'B01N9OZZBH',
		'B0CWLM5T7R',
		'B0CTTNW46W',
		'B00CBJX6I6',
		'B0CNXWKKDX',
		'B00JRCZ6CY',
		'B0B61D6XB1',
		'B01H5GE1PG',
		'B087BJQVYX',
		'B0CYPZMDR4',
		'B01EX17U5O',
		'B0087OSN0A',
		'B0CTQQZLW5',
		'B0CV852337',
		'B0CTMZ5B7C',
		'B0CRL8N9X9',
		'B01FR0OGNY',
		'B0D45NPK7W',
		'B01ITOKA6W',
		'B016AH1U9G',
		'B01G1WQB3U',
		'B019U61K62',
		'B006R5YH56',
		'B0DVJ17T8C',
		'B0DK253NT9',
		'B0F254MHL3',
		'B0CPJRP1FJ',
		'B0BLZJZLW6',
		'B0CJQJJT1X',
		'B01DDG8Q7G',
		'B094Y2WTTP',
		'B005NN9TCY',
		'B003ZG3G7U',
		'B008JYGOPE',
		'B0DHSTJ7K2',
		'B0F7MNF5WY',
		'B0D33TYL4R',
		'B0D92T6K1P',
		'B0DVS6YBJW'
	];

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
		},
		{
			name: 'Prime Shipping',
			emoji: '⚡',
			filters: { shippingFilter: 'prime', sortBy: 'profit_desc' }
		},
		{
			name: 'Standard Shipping',
			emoji: '📦',
			filters: { shippingFilter: 'standard', sortBy: 'profit_desc' }
		}
	];

	// Live Pricing Update Functions (Phase 2)
	/**
	 * Get data freshness indicator for a record
	 */
	function getDataFreshness(capturedAt: string): {
		badge: string;
		class: string;
		description: string;
	} {
		const now = new Date();
		const captured = new Date(capturedAt);
		const hoursAgo = (now.getTime() - captured.getTime()) / (1000 * 60 * 60);

		if (hoursAgo <= 2) {
			return {
				badge: '⚡ Live',
				class: 'bg-green-100 text-green-800',
				description: 'Fresh data (0-2 hours)'
			};
		} else if (hoursAgo <= 8) {
			return {
				badge: '🕐 Recent',
				class: 'bg-yellow-100 text-yellow-800',
				description: 'Recent data (2-8 hours)'
			};
		} else {
			return {
				badge: '📅 Stale',
				class: 'bg-red-100 text-red-800',
				description: 'Stale data (>8 hours)'
			};
		}
	}

	/**
	 * Update live price for a single item
	 */
	async function updateLivePrice(item: BuyBoxData): Promise<void> {
		const recordId = item.id;

		// Set flag to prevent reactive applyFilters from resetting page
		isPerformingLiveUpdate = true;

		// Initialize update state
		livePricingUpdates.set(recordId, {
			isUpdating: true,
			lastUpdated: null,
			error: null,
			success: false
		});
		livePricingUpdates = livePricingUpdates; // Trigger reactivity

		try {
			console.log(`🔄 Updating live price for SKU: ${item.sku}, Record: ${recordId}`);

			const response = await fetch('http://localhost:3001/api/live-pricing/update', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					sku: item.sku,
					recordId: recordId,
					userId: 'user-123' // TODO: Get from auth context
				})
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Update failed');
			}

			console.log(`✅ Live pricing update successful for SKU: ${item.sku}, fetching fresh data...`);

			// Wait a moment for Supabase to commit the transaction
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Fetch the updated record from database with retry mechanism
			let freshRecord = null;
			let retryCount = 0;
			const maxRetries = 3;

			while (!freshRecord && retryCount < maxRetries) {
				try {
					console.log(
						`🔄 Fetching fresh data for SKU: ${item.sku} (attempt ${retryCount + 1}/${maxRetries})`
					);
					const freshDataResponse = await fetch(
						`http://localhost:3001/api/buybox-record/${recordId}`
					);

					if (freshDataResponse.ok) {
						const responseData = await freshDataResponse.json();
						const fetchedRecord = responseData.data;

						// Verify the record has actually been updated by checking if captured_at is recent
						const capturedAt = new Date(fetchedRecord.captured_at);
						const now = new Date();
						const timeDiff = now.getTime() - capturedAt.getTime();

						// If the record was updated within the last 5 minutes, consider it fresh
						if (timeDiff < 5 * 60 * 1000) {
							freshRecord = fetchedRecord;
							console.log(
								`✅ Fresh data retrieved for SKU: ${item.sku} (updated ${Math.round(timeDiff / 1000)}s ago)`
							);
						} else {
							console.log(
								`⏰ Record not fresh enough for SKU: ${item.sku} (${Math.round(timeDiff / 1000)}s old), retrying...`
							);
						}
					} else {
						console.log(
							`❌ Failed to fetch fresh data for SKU: ${item.sku}, status: ${freshDataResponse.status}`
						);
					}
				} catch (fetchError) {
					console.error(`❌ Error fetching fresh data for SKU: ${item.sku}:`, fetchError);
				}

				retryCount++;
				if (!freshRecord && retryCount < maxRetries) {
					// Wait longer between retries
					await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
				}
			}

			if (freshRecord) {
				// Update the item in our local array with fresh data from database
				const itemIndex = buyboxData.findIndex((d) => d.id === recordId);
				if (itemIndex !== -1) {
					console.log(`🔄 Before update - old data:`, buyboxData[itemIndex]);

					// Create a completely new array with the updated record to ensure reactivity
					buyboxData = [
						...buyboxData.slice(0, itemIndex),
						freshRecord,
						...buyboxData.slice(itemIndex + 1)
					];

					console.log(`🔄 After update - new data:`, buyboxData[itemIndex]);
					console.log(`🔄 Updated local record for SKU: ${item.sku} with fresh database data`);
					console.log(`🔄 Fresh record captured_at:`, freshRecord.captured_at);
					console.log(`🔄 Fresh record price:`, freshRecord.your_current_price);

					// Force re-apply filters to update the UI
					console.log(
						`🔄 About to apply filters with page preservation. Current page: ${currentPage}`
					);
					applyFilters(true); // Preserve page position for live updates
					console.log(`🔄 Applied filters after live pricing update. Current page: ${currentPage}`);
					console.log(`🔄 Filtered data length:`, filteredData.length);
					console.log(
						`🔄 Updated item in filtered data:`,
						filteredData.find((d) => d.id === recordId)
					);

					// Force reactive updates by reassigning reactive variables
					filteredData = [...filteredData];
					console.log(`🔄 Forced filteredData reactivity`);
				}
			} else {
				// Fallback: use the updatedData from live pricing API response
				console.log(
					`⚠️ Could not fetch fresh data after ${maxRetries} attempts, using API response data for SKU: ${item.sku}`
				);
				const itemIndex = buyboxData.findIndex((d) => d.id === recordId);
				if (itemIndex !== -1) {
					console.log(`🔄 Before fallback update - old data:`, buyboxData[itemIndex]);

					// Create a completely new record object to ensure reactivity
					const updatedRecord = { ...buyboxData[itemIndex], ...result.updatedData };

					// Create a completely new array with the updated record
					buyboxData = [
						...buyboxData.slice(0, itemIndex),
						updatedRecord,
						...buyboxData.slice(itemIndex + 1)
					];

					console.log(`🔄 After fallback update - new data:`, buyboxData[itemIndex]);

					// Force re-apply filters to update the UI
					applyFilters(true); // Preserve page position for live updates
					console.log(`🔄 Applied filters after fallback live pricing update`);
				}
			}

			// Update state
			livePricingUpdates.set(recordId, {
				isUpdating: false,
				lastUpdated: new Date(),
				error: null,
				success: true
			});

			// Mark this item as recently updated to bypass filters temporarily
			recentlyUpdatedItems.add(recordId);
			console.log(
				`🔄 Added item ${recordId} (SKU: ${item.sku}) to recently updated bypass list. Current list:`,
				[...recentlyUpdatedItems]
			);

			// Clear any existing timeout for this item
			if (recentUpdateTimeout.has(recordId)) {
				clearTimeout(recentUpdateTimeout.get(recordId));
			}

			// Set up automatic cleanup after 30 seconds
			const timeoutId = setTimeout(() => {
				recentlyUpdatedItems.delete(recordId);
				recentUpdateTimeout.delete(recordId);
				// Reapply filters to potentially hide the item if it no longer matches
				applyFilters(true); // Preserve page position even during cleanup
				console.log(`🔄 Removed recently updated bypass for SKU: ${item.sku} after 30 seconds`);
			}, 30000); // 30 seconds

			recentUpdateTimeout.set(recordId, timeoutId);

			// Add to animation tracking
			updatedRows.add(recordId);
			setTimeout(() => {
				updatedRows.delete(recordId);
				updatedRows = updatedRows;
			}, 3000); // Remove animation after 3 seconds

			console.log(
				`✅ Successfully updated live price for SKU: ${item.sku} (will bypass filters for 30s)`
			);
		} catch (error: unknown) {
			console.error(`❌ Failed to update live price for SKU: ${item.sku}:`, error);

			// Handle specific error types
			let errorMessage = (error as Error).message || 'Unknown error';
			if ((error as Error).message?.includes('RECENTLY_UPDATED')) {
				errorMessage = (error as Error).message.replace('RECENTLY_UPDATED: ', '');
			} else if ((error as Error).message?.includes('RATE_LIMITED')) {
				errorMessage = 'Too many requests. Please wait a moment.';
			} else if ((error as Error).message?.includes('ACCESS_DENIED')) {
				errorMessage = 'API access denied. Check credentials.';
			}

			livePricingUpdates.set(recordId, {
				isUpdating: false,
				lastUpdated: null,
				error: errorMessage,
				success: false
			});

			// Clear error after 10 seconds
			setTimeout(() => {
				const current = livePricingUpdates.get(recordId);
				if (current && current.error) {
					livePricingUpdates.set(recordId, { ...current, error: null });
					livePricingUpdates = livePricingUpdates;
				}
			}, 10000);
		}

		// Clear the live update flag to re-enable reactive filtering
		isPerformingLiveUpdate = false;

		livePricingUpdates = livePricingUpdates; // Trigger reactivity
	}

	/**
	 * Get update button state for a record
	 */
	function getUpdateButtonState(recordId: string): {
		isUpdating: boolean;
		text: string;
		class: string;
		disabled: boolean;
		error: string | null;
	} {
		const updateState = livePricingUpdates.get(recordId);

		if (!updateState) {
			return {
				isUpdating: false,
				text: '🔄 Update Live Price',
				class: 'bg-blue-500 hover:bg-blue-600 text-white',
				disabled: false,
				error: null
			};
		}

		if (updateState.isUpdating) {
			return {
				isUpdating: true,
				text: '⏳ Fetching...',
				class: 'bg-gray-400 text-white cursor-not-allowed',
				disabled: true,
				error: null
			};
		}

		if (updateState.success && updateState.lastUpdated) {
			const secondsAgo = Math.floor((Date.now() - updateState.lastUpdated.getTime()) / 1000);
			return {
				isUpdating: false,
				text: `✅ Updated ${secondsAgo}s ago`,
				class: 'bg-green-500 hover:bg-green-600 text-white',
				disabled: false,
				error: null
			};
		}

		if (updateState.error) {
			return {
				isUpdating: false,
				text: '❌ Failed - Retry',
				class: 'bg-red-500 hover:bg-red-600 text-white',
				disabled: false,
				error: updateState.error
			};
		}

		return {
			isUpdating: false,
			text: '🔄 Update Live Price',
			class: 'bg-blue-500 hover:bg-blue-600 text-white',
			disabled: false,
			error: null
		};
	}

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

	// Custom price calculation functions
	function calculateCustomMargin(sku: BuyBoxData, customPrice: number): number | null {
		if (!sku.total_operating_cost || customPrice <= 0) return null;

		// Calculate margin: (Revenue - Costs) / Revenue * 100
		const revenue = customPrice;
		const margin = ((revenue - sku.total_operating_cost) / revenue) * 100;
		return margin;
	}

	function calculateCustomProfit(sku: BuyBoxData, customPrice: number): number | null {
		if (!sku.total_operating_cost || customPrice <= 0) return null;

		// Calculate profit: Revenue - Costs
		const profit = customPrice - sku.total_operating_cost;
		return profit;
	}

	function getEffectivePrice(sku: BuyBoxData): number {
		// Return custom price if set, otherwise current price
		const customPrice = customPrices.get(sku.sku);
		if (customPrice !== undefined && customPrice > 0) {
			return customPrice;
		}
		return sku.your_current_price || 0;
	}

	function getEffectiveMargin(sku: BuyBoxData): number | null {
		const customPrice = customPrices.get(sku.sku);
		if (customPrice !== undefined && customPrice > 0) {
			return calculateCustomMargin(sku, customPrice);
		}
		return sku.your_margin_percent_at_current_price;
	}

	function getEffectiveProfit(sku: BuyBoxData): number | null {
		const customPrice = customPrices.get(sku.sku);
		if (customPrice !== undefined && customPrice > 0) {
			return calculateCustomProfit(sku, customPrice);
		}
		return sku.current_actual_profit;
	}

	function toggleCustomPriceInput(sku: string): void {
		const current = showCustomPriceInputs.get(sku) || false;
		showCustomPriceInputs.set(sku, !current);
		showCustomPriceInputs = new Map(showCustomPriceInputs); // Trigger reactivity

		// If hiding the input, clear the custom price
		if (current) {
			customPrices.delete(sku);
			customPrices = new Map(customPrices); // Trigger reactivity
		}
	}

	function updateCustomPrice(sku: string, priceStr: string): void {
		const price = parseFloat(priceStr);
		if (!isNaN(price) && price > 0) {
			customPrices.set(sku, price);
		} else {
			customPrices.delete(sku);
		}
		customPrices = new Map(customPrices); // Trigger reactivity
	}

	function resetCustomPrice(sku: string): void {
		customPrices.delete(sku);
		customPrices = new Map(customPrices); // Trigger reactivity
		showCustomPriceInputs.set(sku, false);
		showCustomPriceInputs = new Map(showCustomPriceInputs); // Trigger reactivity
	}

	function clearAllCustomPrices(): void {
		customPrices.clear();
		customPrices = new Map(customPrices); // Trigger reactivity
		showCustomPriceInputs.clear();
		showCustomPriceInputs = new Map(showCustomPriceInputs); // Trigger reactivity
	}

	// Detect if we're matching buy box price but not winning (competitor took it)
	function isPriceMatchedButLostBuyBox(sku: BuyBoxData): boolean {
		if (sku.is_winner) return false; // Already winning
		if (!sku.your_current_price || sku.your_current_price === 0) return false; // Out of stock

		// Check if there's actually a buy box available (not null or 0)
		const buyboxPrice = sku.buybox_price;
		if (!buyboxPrice || buyboxPrice === null || buyboxPrice === 0) return false; // No competition found

		const tolerance = 0.005; // 0.5p tolerance for price matching
		const priceMatch = Math.abs(sku.your_current_price - buyboxPrice) <= tolerance;

		return priceMatch && !sku.is_winner;
	}

	// Get status information for a SKU
	function getSkuStatus(sku: BuyBoxData): {
		type: string;
		label: string;
		description: string;
		bgClass: string;
		textClass: string;
	} {
		if (sku.is_winner) {
			return {
				type: 'winner',
				label: '🏆 Winner',
				description: 'You have the buy box',
				bgClass: 'bg-green-100',
				textClass: 'text-green-800'
			};
		}

		if (isPriceMatchedButLostBuyBox(sku)) {
			return {
				type: 'price_matched_lost',
				label: '⚠️ Price Matched',
				description: 'Same price as buy box but competitor won. Lower by £0.01 to regain.',
				bgClass: 'bg-orange-100',
				textClass: 'text-orange-800'
			};
		}

		if (sku.opportunity_flag) {
			return {
				type: 'opportunity',
				label: '💡 Opportunity',
				description: 'Profitable opportunity to match buy box price',
				bgClass: 'bg-yellow-100',
				textClass: 'text-yellow-800'
			};
		}

		return {
			type: 'losing',
			label: '❌ Losing',
			description: 'Not competitive with current pricing',
			bgClass: 'bg-red-100',
			textClass: 'text-red-800'
		};
	}

	// Apply filters and sorting
	function applyFilters(preservePage = false): void {
		let filtered = [...buyboxData]; 
		
		// Enhanced search filter - searches across multiple fields
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase().trim();
			filtered = filtered.filter((item) => {
				// Helper function to safely check if a field contains the query
				const contains = (field: string | null | undefined): boolean => {
					if (!field) return false;
					return field.toLowerCase().includes(query);
				};

				// Search across multiple product fields using correct database column names
				const matchesSku = contains(item.sku);
				const matchesAsin = contains(item.asin);
				const matchesItemName = contains(item.item_name); // This is the product title
				
				return matchesSku || matchesAsin || matchesItemName;
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

		// Shipping filter
		switch (shippingFilter) {
			case 'prime':
				filtered = filtered.filter((item) => item.merchant_shipping_group === 'Nationwide Prime');
				break;
			case 'standard':
				filtered = filtered.filter((item) => item.merchant_shipping_group === 'UK Shipping');
				break;
			// 'all' case - no filtering needed
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
			case 'profit_difference_desc':
				// Filter for items where we're losing by being priced HIGHER than buy box
				filtered = filtered.filter((item) => {
					// Must have valid current price (not out of stock)
					if (!item.your_current_price || item.your_current_price <= 0) return false;

					// Must have valid buy box price to compare against
					if (!item.buybox_price || item.buybox_price <= 0) return false;

					// Skip if already winning the buy box
					if (item.is_winner) return false;

					// Only show items where WE are priced HIGHER than the buy box (losing)
					const priceDiff = item.your_current_price - item.buybox_price;
					console.log(
						`Debug ${item.sku}: our_price=${item.your_current_price}, buybox_price=${item.buybox_price}, diff=${priceDiff}`
					);
					return priceDiff > 0; // Positive means we're priced higher (losing)
				});

				// Sort by biggest price difference first (largest losses)
				filtered.sort((a, b) => {
					const aDiff = (a.your_current_price || 0) - (a.buybox_price || 0);
					const bDiff = (b.your_current_price || 0) - (b.buybox_price || 0);
					return bDiff - aDiff; // Biggest difference first
				});
				break;
			case 'profit_difference_asc':
				// Filter for items where we're losing by being priced HIGHER than buy box
				filtered = filtered.filter((item) => {
					if (!item.your_current_price || item.your_current_price <= 0) return false;
					if (!item.buybox_price || item.buybox_price <= 0) return false;
					if (item.is_winner) return false;

					// Only show items where WE are priced HIGHER than the buy box (losing)
					const priceDiff = item.your_current_price - item.buybox_price;
					return priceDiff > 0; // Positive means we're priced higher (losing)
				});

				// Sort by smallest price difference first (easy wins - 1p, 2p losses)
				filtered.sort((a, b) => {
					const aDiff = (a.your_current_price || 0) - (a.buybox_price || 0);
					const bDiff = (b.your_current_price || 0) - (b.buybox_price || 0);
					return aDiff - bDiff; // Smallest difference first (easy wins)
				});
				break;
			case 'margin_difference_desc':
				// Filter for items where we're losing by being priced HIGHER than buy box
				filtered = filtered.filter((item) => {
					if (!item.your_current_price || item.your_current_price <= 0) return false;
					if (!item.buybox_price || item.buybox_price <= 0) return false;
					if (item.is_winner) return false;

					// Only show items where WE are priced HIGHER than the buy box (losing)
					const priceDiff = item.your_current_price - item.buybox_price;
					return priceDiff > 0; // Positive means we're priced higher (losing)
				});

				// Sort by biggest price difference first (largest losses)
				filtered.sort((a, b) => {
					const aDiff = (a.your_current_price || 0) - (a.buybox_price || 0);
					const bDiff = (b.your_current_price || 0) - (b.buybox_price || 0);
					return bDiff - aDiff; // Biggest difference first
				});
				break;
			case 'margin_difference_asc':
				// Filter for items where we're losing by being priced HIGHER than buy box
				filtered = filtered.filter((item) => {
					if (!item.your_current_price || item.your_current_price <= 0) return false;
					if (!item.buybox_price || item.buybox_price <= 0) return false;
					if (item.is_winner) return false;

					// Only show items where WE are priced HIGHER than the buy box (losing)
					const priceDiff = item.your_current_price - item.buybox_price;
					return priceDiff > 0; // Positive means we're priced higher (losing)
				});

				// Sort by smallest price difference first (easy wins - 1p, 2p losses)
				filtered.sort((a, b) => {
					const aDiff = (a.your_current_price || 0) - (a.buybox_price || 0);
					const bDiff = (b.your_current_price || 0) - (b.buybox_price || 0);
					return aDiff - bDiff; // Smallest difference first (easy wins)
				});
				break;
			case 'sku_asc':
				filtered.sort((a, b) => a.sku.localeCompare(b.sku));
				break;
		}

		// Add recently updated items even if they don't match current filters
		// This prevents updated items from "disappearing" when their status changes
		if (recentlyUpdatedItems.size > 0) {
			console.log(`🔄 Checking recently updated items. Count: ${recentlyUpdatedItems.size}`, [
				...recentlyUpdatedItems
			]);
			console.log(`🔄 Current filtered results count: ${filtered.length}`);

			const recentlyUpdatedRecords = buyboxData.filter(
				(item) =>
					recentlyUpdatedItems.has(item.id) &&
					!filtered.some((filteredItem) => filteredItem.id === item.id)
			);

			console.log(
				`🔄 Recently updated records to add: ${recentlyUpdatedRecords.length}`,
				recentlyUpdatedRecords.map((r) => ({ sku: r.sku, id: r.id, is_winner: r.is_winner }))
			);

			if (recentlyUpdatedRecords.length > 0) {
				console.log(
					`🔄 Adding ${recentlyUpdatedRecords.length} recently updated items that don't match current filters:`,
					recentlyUpdatedRecords.map((r) => r.sku)
				);

				// Add them at the top of the filtered results so they're visible
				filtered = [...recentlyUpdatedRecords, ...filtered];
			}
		} else {
			console.log(`🔄 No recently updated items to check`);
		}

		filteredData = filtered;

		// Only reset to page 1 if not preserving page position
		if (!preservePage) {
			currentPage = 1; // Reset to first page when filtering
		}

		// Update active filter state
		checkActiveFilters();
	}

	// Wrapper function for event handlers that need to call applyFilters without parameters
	function applyFiltersFromEvent() {
		applyFilters(); // Don't preserve page for user-initiated filter changes
	}

	// Get paginated data
	$: paginatedData = filteredData.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage
	);

	// Group data by ASIN for grouped view
	function groupDataByAsin(data: BuyBoxData[]): Map<string, BuyBoxData[]> {
		const grouped = new Map<string, BuyBoxData[]>();

		data.forEach((item) => {
			if (!grouped.has(item.asin)) {
				grouped.set(item.asin, []);
			}
			grouped.get(item.asin)!.push(item);
		});

		// Sort SKUs within each ASIN group by sales performance or profit
		grouped.forEach((skus) => {
			skus.sort((a, b) => {
				// Sort by profit descending, then by shipping type (Prime first)
				const profitDiff = (b.current_actual_profit || 0) - (a.current_actual_profit || 0);
				if (profitDiff !== 0) return profitDiff;

				// Prime shipping first
				const aShipping = a.merchant_shipping_group === 'Nationwide Prime' ? 1 : 0;
				const bShipping = b.merchant_shipping_group === 'Nationwide Prime' ? 1 : 0;
				return bShipping - aShipping;
			});
		});

		return grouped;
	}

	// Filter data for best sellers (top 100 ASINs)
	function filterBestSellers(data: BuyBoxData[]): BuyBoxData[] {
		return data.filter((item) => top100ASINs.includes(item.asin));
	}

	// Create skeleton entries for missing ASINs
	function createSkeletonEntry(asin: string): BuyBoxData {
		return {
			id: `skeleton-${asin}`,
			asin: asin,
			sku: `skeleton-${asin}`,
			captured_at: new Date().toISOString(),
			is_winner: false,
			opportunity_flag: false,
			price: null,
			buybox_price: null,
			your_current_price: null,
			competitor_price: null,
			break_even_price: null,
			your_cost: null,
			your_shipping_cost: null,
			your_material_total_cost: null,
			your_box_cost: null,
			your_vat_amount: null,
			your_fragile_charge: null,
			total_operating_cost: null,
			current_actual_profit: null,
			buybox_actual_profit: null,
			your_margin_percent_at_current_price: null,
			margin_percent_at_buybox_price: null,
			margin_difference: null,
			profit_opportunity: null,
			recommended_action: null,
			current_margin_calculation: null,
			buybox_margin_calculation: null,
			total_investment_current: null,
			total_investment_buybox: null,
			merchant_shipping_group: undefined,
			run_id: undefined,
			job_id: undefined,
			is_skeleton: true
		};
	}

	// Get best sellers data with skeletons for missing ASINs
	function getBestSellersWithSkeletons(data: BuyBoxData[]): BuyBoxData[] {
		const existingData = filterBestSellers(data);
		const existingASINs = new Set(existingData.map((item) => item.asin));

		// Create skeleton entries for missing ASINs
		const skeletonEntries = top100ASINs
			.filter((asin) => !existingASINs.has(asin))
			.map((asin) => createSkeletonEntry(asin));

		return [...existingData, ...skeletonEntries];
	}

	// Function to fetch single ASIN data
	async function fetchSingleASIN(asin: string): Promise<void> {
		console.log(`🔄 Fetching data for ASIN: ${asin}`);

		try {
			const response = await fetch(`http://localhost:3001/api/single-asin/${asin}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					source: `ui_single_asin_${new Date().toISOString().split('T')[0]}`,
					notes: `Single ASIN fetch from Best Sellers view at ${new Date().toLocaleString()}`
				})
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();
			console.log(`✅ Successfully initiated fetch for ASIN: ${asin}`, result);

			// Enable "include no margin data" since single ASIN fetches often don't have cost data
			if (!includeNoMarginData) {
				console.log(`🔧 Enabling 'include no margin data' to show single ASIN fetch results`);
				includeNoMarginData = true;
			}

			// Refresh the buy box data to show the new data
			// Instead of reloading the page, refresh just the data
			setTimeout(async () => {
				console.log(`🔄 Refreshing buy box data after fetching ASIN: ${asin}`);
				await refreshData();
			}, 2000);
		} catch (error) {
			console.error(`❌ Error fetching ASIN ${asin}:`, error);
			alert(`Failed to fetch data for ASIN ${asin}. Please try again.`);
		}
	}

	// Function to bulk scan top 100 ASINs
	async function bulkScanTop100(): Promise<void> {
		console.log(`🚀 Starting bulk scan for ${top100ASINs.length} top ASINs`);

		try {
			const response = await fetch(`http://localhost:3001/api/bulk-scan/start`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					source: `ui_bulk_top100_${new Date().toISOString().split('T')[0]}`,
					filterType: 'custom',
					customAsins: top100ASINs,
					notes: `Bulk scan of top 100 ASINs from Best Sellers view at ${new Date().toLocaleString()}`
				})
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();
			console.log(`✅ Successfully started bulk scan:`, result);

			// Enable "include no margin data" to ensure we see all results
			if (!includeNoMarginData) {
				console.log(`🔧 Enabling 'include no margin data' for bulk scan results`);
				includeNoMarginData = true;
			}

			// Show success message
			alert(
				`✅ Bulk scan started successfully!\n\nJob ID: ${result.job_id}\nASINs to process: ${result.total_asins}\n\nEstimated completion: ${result.estimated_completion_time || '30-45 minutes'}\n\nThe page will refresh automatically when complete.`
			);

			// Poll for completion (check every 30 seconds)
			pollForBulkScanCompletion(result.job_id);
		} catch (error) {
			console.error(`❌ Error starting bulk scan:`, error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			alert(`Failed to start bulk scan. Please try again.\n\nError: ${errorMessage}`);
		}
	}

	// Function to poll for bulk scan completion
	async function pollForBulkScanCompletion(jobId: string): Promise<void> {
		const maxPolls = 120; // Poll for up to 1 hour (120 * 30s = 3600s)
		let pollCount = 0;

		const pollInterval = setInterval(async () => {
			pollCount++;
			console.log(`🔄 Polling bulk scan status (${pollCount}/${maxPolls})...`);

			try {
				const response = await fetch(`http://localhost:3001/api/bulk-scan/status/${jobId}`);
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				const status = await response.json();
				console.log(`📊 Bulk scan status:`, status);

				if (status.status === 'completed' || status.status === 'failed') {
					clearInterval(pollInterval);

					if (status.status === 'completed') {
						console.log(`✅ Bulk scan completed! Refreshing data...`);
						await refreshData();
						alert(
							`✅ Bulk scan completed successfully!\n\nProcessed: ${status.successful_asins || 0} ASINs\nFailed: ${status.failed_asins || 0} ASINs\n\nData has been refreshed.`
						);
					} else {
						console.error(`❌ Bulk scan failed:`, status.error_message);
						alert(`❌ Bulk scan failed: ${status.error_message || 'Unknown error'}`);
					}
				}
			} catch (error) {
				console.error(`❌ Error polling bulk scan status:`, error);
				if (pollCount >= maxPolls) {
					clearInterval(pollInterval);
					alert(
						`⚠️ Bulk scan status polling timed out. The scan may still be running in the background.`
					);
				}
			}

			// Stop polling after max attempts
			if (pollCount >= maxPolls) {
				clearInterval(pollInterval);
				console.warn(`⚠️ Bulk scan polling timed out after ${maxPolls} attempts`);
			}
		}, 30000); // Poll every 30 seconds
	}

	// Update grouped data when filtered data changes
	$: groupedData = groupDataByAsin(filteredData);
	$: bestSellersData = getBestSellersWithSkeletons(buyboxData);
	$: bestSellersGrouped = groupDataByAsin(bestSellersData);

	// Track the previous filter state to detect actual changes
	let previousFilterState = {
		searchQuery: '',
		categoryFilter: 'all',
		shippingFilter: 'all',
		showOnlyWithMarginData: false,
		minProfitFilter: 0,
		minMarginFilter: 0,
		showLatestOnly: false
	};

	// Update filter state when individual filters change
	$: filterState = {
		searchQuery,
		categoryFilter,
		shippingFilter,
		showOnlyWithMarginData,
		minProfitFilter,
		minMarginFilter,
		showLatestOnly
	};

	// Apply filters when filter values actually change
	$: if (
		buyboxData &&
		!isPerformingLiveUpdate &&
		!isPaginating &&
		(filterState.searchQuery !== previousFilterState.searchQuery ||
			filterState.categoryFilter !== previousFilterState.categoryFilter ||
			filterState.shippingFilter !== previousFilterState.shippingFilter ||
			filterState.showOnlyWithMarginData !== previousFilterState.showOnlyWithMarginData ||
			filterState.minProfitFilter !== previousFilterState.minProfitFilter ||
			filterState.minMarginFilter !== previousFilterState.minMarginFilter ||
			filterState.showLatestOnly !== previousFilterState.showLatestOnly)
	) {
		console.log(
			`🔄 Filter values changed, applying filters. isPaginating: ${isPaginating}, isPerformingLiveUpdate: ${isPerformingLiveUpdate}`
		);

		// Update previous state first
		previousFilterState = { ...filterState };

		// Then apply filters
		applyFilters(); // Reset to page 1 when user changes filters
	}

	// Update total results based on view mode
	$: totalResults =
		viewMode === 'grouped'
			? groupedData.size
			: viewMode === 'bestsellers'
				? bestSellersGrouped.size
				: filteredData.length;

	// Handle pagination
	function changePage(newPage: number, scrollToTop: boolean = true): void {
		console.log(
			`🔄 changePage called: ${currentPage} → ${newPage}. isPaginating before: ${isPaginating}`
		);
		if (newPage >= 1 && newPage <= Math.ceil(totalResults / itemsPerPage)) {
			isPaginating = true; // Prevent reactive filtering during pagination
			console.log(`🔄 isPaginating set to true`);

			// Update the page
			currentPage = newPage;
			console.log(`🔄 currentPage updated to: ${currentPage}`);

			// Scroll to top of records table if requested
			if (scrollToTop) {
				// Find the results section and scroll to it
				setTimeout(() => {
					const resultsSection = document.querySelector('[data-results-section]');
					if (resultsSection) {
						resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
					}
				}, 50);
			}

			// Clear the flag after all reactive statements have processed
			setTimeout(() => {
				isPaginating = false;
				console.log(`🔄 Pagination flag cleared`);
			}, 50);
		}
	} // Navigate to product details
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
			message += `   Your Price: ${scannedPrice === 0 ? 'Out of Stock' : `£${scannedPrice?.toFixed(2) || 'N/A'}`}\n`;
			message += `   Competitor Price: £${item.competitor_price?.toFixed(2) || 'N/A'}\n`;
			message += `   Captured: ${new Date(item.captured_at).toLocaleString()}\n\n`;

			message += `🔴 Live Data (current Amazon):\n`;
			if (yourActualPrice) {
				message += `   Your Listed Price: ${yourActualPrice === 0 ? 'Out of Stock' : `£${yourActualPrice.toFixed(2)}`}\n`;
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

	// Comprehensive filter reset function
	function resetAllFilters(): void {
		// Reset all filter variables to defaults
		searchQuery = '';
		categoryFilter = 'all';
		shippingFilter = 'all';
		sortBy = 'profit_desc'; // Reset to default sort
		minProfitFilter = 0;
		minMarginFilter = 0;
		showOnlyWithMarginData = false;
		currentPage = 1; // Reset to first page

		// Clear active filter tracking
		activeCardFilter = '';
		activePresetFilter = '';

		// Apply filters to refresh the display
		applyFilters();

		console.log('🔄 All filters reset to defaults');
	}

	// Check if any filters are currently active
	function checkActiveFilters(): void {
		hasActiveFilters =
			searchQuery !== '' ||
			categoryFilter !== 'all' ||
			shippingFilter !== 'all' ||
			minProfitFilter > 0 ||
			minMarginFilter > 0 ||
			showOnlyWithMarginData ||
			activeCardFilter !== '' ||
			activePresetFilter !== '';

		console.log('🔍 Active filters check:', {
			searchQuery,
			categoryFilter,
			shippingFilter,
			minProfitFilter,
			minMarginFilter,
			showOnlyWithMarginData,
			activeCardFilter,
			activePresetFilter,
			hasActiveFilters
		});
	}

	// Apply filter preset
	function applyFilterPreset(preset: (typeof filterPresets)[0]): void {
		// Reset other active filters first
		activeCardFilter = '';

		// Apply preset filters
		if (preset.filters.categoryFilter) {
			categoryFilter = preset.filters.categoryFilter;
		}
		if (preset.filters.shippingFilter) {
			shippingFilter = preset.filters.shippingFilter;
		}
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
			<button
				class="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded flex items-center gap-2"
				on:click={bulkScanTop100}
			>
				🚀 Update Top 100
			</button>
			{#if customPrices.size > 0}
				<button
					class="bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded flex items-center gap-2"
					on:click={clearAllCustomPrices}
					title="Clear all custom prices"
				>
					🗑️ Clear Custom Prices ({customPrices.size})
				</button>
			{/if}
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
							{#if shippingFilter !== 'all'}
								<span
									class="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
								>
									{shippingFilter === 'prime' ? '⚡' : '📦'}
									{shippingFilter === 'prime' ? 'Prime' : 'Standard'} Shipping
									<button
										on:click={() => {
											shippingFilter = 'all';
											applyFilters();
										}}
										class="text-orange-600 hover:text-orange-800 ml-1"
										title="Clear shipping filter"
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
									📊 Min ROI Margin: {minMarginFilter}%
									<button
										on:click={() => {
											minMarginFilter = 0;
											applyFilters();
										}}
										class="text-orange-600 hover:text-orange-800 ml-1"
										title="Clear ROI margin filter"
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
					on:input={applyFiltersFromEvent}
				/>
			</div>

			<!-- Category Filter -->
			<div>
				<label for="category" class="block text-sm font-medium text-gray-700 mb-1">Category</label>
				<select
					id="category"
					class="w-full border rounded px-3 py-2"
					bind:value={categoryFilter}
					on:change={applyFiltersFromEvent}
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
					on:change={applyFiltersFromEvent}
				>
					<option value="profit_desc">💰 Profit (High to Low)</option>
					<option value="profit_asc">💰 Profit (Low to High)</option>
					<option value="margin_desc">📊 ROI Margin % (High to Low)</option>
					<option value="margin_asc">📊 ROI Margin % (Low to High)</option>
					<option value="profit_difference_desc">💸 Losing by Most (Biggest Price Gap)</option>
					<option value="profit_difference_asc">🎯 Quick Wins (Smallest Price Gap)</option>
					<option value="margin_difference_desc">📊 Margin Opportunities (Biggest First)</option>
					<option value="margin_difference_asc">📊 Margin Opportunities (Smallest First)</option>
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
					on:change={applyFiltersFromEvent}
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
					on:change={applyFiltersFromEvent}
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
					on:input={applyFiltersFromEvent}
				/>
			</div>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
			<!-- Min Margin Filter -->
			<div>
				<label for="minMargin" class="block text-sm font-medium text-gray-700 mb-1"
					>Min ROI Margin %</label
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
					on:input={applyFiltersFromEvent}
				/>
			</div>
		</div>
	</div>

	<!-- Results -->
	<div class="bg-white rounded-lg shadow" data-results-section>
		<div class="px-6 py-4 border-b border-gray-200">
			<div class="flex justify-between items-center">
				<div class="flex items-center gap-4">
					<h2 class="font-semibold">
						Buy Box Results ({totalResults} items)
						{#if showLatestOnly}
							<span class="text-sm font-normal text-blue-600"> - Latest data only </span>
						{:else}
							<span class="text-sm font-normal text-purple-600"> - All historical data </span>
						{/if}
					</h2>

					<!-- View Mode Toggle -->
					<div class="flex bg-gray-100 rounded-lg p-1">
						<button
							on:click={() => {
								viewMode = 'individual';
								currentPage = 1;
							}}
							class={`px-3 py-1 rounded text-sm font-medium transition-colors ${
								viewMode === 'individual'
									? 'bg-white text-blue-600 shadow-sm'
									: 'text-gray-600 hover:text-gray-800'
							}`}
						>
							📋 Individual SKUs
						</button>
						<button
							on:click={() => {
								viewMode = 'grouped';
								currentPage = 1;
							}}
							class={`px-3 py-1 rounded text-sm font-medium transition-colors ${
								viewMode === 'grouped'
									? 'bg-white text-blue-600 shadow-sm'
									: 'text-gray-600 hover:text-gray-800'
							}`}
						>
							📦 Grouped by ASIN
						</button>
						<button
							on:click={() => {
								viewMode = 'bestsellers';
								currentPage = 1;
							}}
							class={`px-3 py-1 rounded text-sm font-medium transition-colors ${
								viewMode === 'bestsellers'
									? 'bg-white text-orange-600 shadow-sm'
									: 'text-gray-600 hover:text-gray-800'
							}`}
						>
							🏆 Top 100 Best Sellers
						</button>
					</div>
				</div>
				<div class="flex items-center gap-3 text-sm text-gray-500">
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

		<!-- Top Pagination -->
		{#if totalResults > itemsPerPage}
			<div class="px-6 py-3 border-b border-gray-200 bg-gray-50">
				<div class="flex justify-between items-center">
					<div class="text-sm text-gray-500">
						Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(
							currentPage * itemsPerPage,
							totalResults
						)} of {totalResults} results
					</div>
					<div class="flex space-x-1">
						<button
							class="px-3 py-1 rounded border disabled:opacity-50 bg-white hover:bg-gray-50"
							disabled={currentPage === 1}
							on:click={() => changePage(currentPage - 1, false)}
						>
							Previous
						</button>

						{#each Array(Math.min(5, Math.ceil(totalResults / itemsPerPage))) as _, i}
							{@const pageNumber = Math.max(1, currentPage - 2) + i}
							{#if pageNumber <= Math.ceil(totalResults / itemsPerPage)}
								<button
									class={`px-3 py-1 rounded border ${currentPage === pageNumber ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}
									on:click={() => changePage(pageNumber, false)}
								>
									{pageNumber}
								</button>
							{/if}
						{/each}

						<button
							class="px-3 py-1 rounded border disabled:opacity-50 bg-white hover:bg-gray-50"
							disabled={currentPage === Math.ceil(totalResults / itemsPerPage)}
							on:click={() => changePage(currentPage + 1, false)}
						>
							Next
						</button>
					</div>
				</div>
			</div>
		{/if}

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
			{#if viewMode === 'individual'}
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
									>Live Update</th
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
									${updatedRows.has(result.id) ? 'updated-row' : ''}
									${recentlyUpdatedItems.has(result.id) ? 'recently-updated-bypass' : ''}
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
											<!-- Shipping Type Badge -->
											{#if result.merchant_shipping_group}
												<div class="mb-2">
													<span
														class={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
															result.merchant_shipping_group === 'Nationwide Prime'
																? 'bg-blue-100 text-blue-800'
																: 'bg-gray-100 text-gray-800'
														}`}
													>
														{result.merchant_shipping_group === 'Nationwide Prime'
															? '⚡ Prime'
															: '📦 Standard'}
													</span>
												</div>
											{/if}

											<div class="font-medium text-gray-900 mb-1 leading-tight">
												SKU: {result.sku}
												{#if recentlyUpdatedItems.has(result.id)}
													<span
														class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200"
														title="Recently updated - visible despite current filters"
													>
														🔄 Recently Updated
													</span>
												{/if}
											</div>
											{#if result.item_name}
												<!-- Show item name from buybox data -->
												<div class="text-xs text-gray-600 mb-1">
													{result.item_name}
												</div>
											{:else}
												<!-- Show when no item name is available -->
												<div class="text-xs text-gray-400 mb-1 italic">
													No product title available
												</div>
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
												{#if result.your_current_price === 0}
													<span class="text-red-600">Out of Stock</span>
												{:else}
													Our Price: £{result.your_current_price?.toFixed(2) || 'N/A'}
												{/if}
												{#if result.is_winner}
													<span class="text-green-600 ml-1">🏆</span>
												{/if}
											</div>

											<!-- Buy Box Price -->
											{#if result.is_winner && result.your_current_price}
												<!-- You're winning the buy box -->
												<div class="font-medium text-green-700">
													Buy Box Price: £{result.your_current_price.toFixed(2)} (You)
												</div>
											{:else if !result.is_winner && result.buybox_price && result.buybox_price > 0}
												<!-- You're losing - show actual buy box price -->
												<div class="font-medium text-red-700">
													Buy Box Price: £{result.buybox_price.toFixed(2)} (Competitor)
												</div>
											{:else if !result.is_winner && result.competitor_price && result.competitor_price > 0}
												<!-- Fallback: use competitor_price if buybox_price not available -->
												<div class="font-medium text-red-700">
													Buy Box Price: £{result.competitor_price.toFixed(2)} (Competitor)
												</div>
											{:else}
												<!-- No Buy Box available -->
												<div class="font-medium text-orange-600">
													Buy Box Price: No Buy Box Available
													<span class="text-xs block text-orange-500"
														>May be due to listing quality, pricing, or sales history</span
													>
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
												{@const feeRate = result.your_current_price < 10 ? 0.08 : 0.15}
												{@const feePercent = result.your_current_price < 10 ? 8 : 15}
												<div class="text-red-600">
													Amazon Fee ({feePercent}% of £{result.your_current_price.toFixed(2)}): £{(
														result.your_current_price * feeRate
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
												{@const feeRate = (result.your_current_price ?? 0) < 10 ? 0.08 : 0.15}
												{@const netRate = (1 - feeRate).toFixed(2)}
												<div class="font-bold border-t pt-2 text-red-800">
													Break-even: £{result.break_even_price.toFixed(2)}
												</div>
												<div class="text-xs text-gray-500">
													(£{result.total_operating_cost?.toFixed(2)} ÷ {netRate})
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
													📊 Current Price: {result.your_margin_percent_at_current_price.toFixed(
														1
													)}% margin
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

											<!-- Margin Calculation Breakdown -->
											{#if result.current_margin_calculation || result.buybox_margin_calculation}
												<div class="border-t pt-2 mt-2">
													<div class="text-xs font-medium text-gray-700 mb-2">
														📈 ROI Margin Calculation:
													</div>
													{#if result.current_margin_calculation}
														<div class="text-xs text-gray-600 mb-1">
															<span class="font-medium">Current:</span>
															{result.current_margin_calculation}
														</div>
													{/if}
													{#if result.buybox_margin_calculation}
														<div class="text-xs text-gray-600 mb-1">
															<span class="font-medium">Buy Box:</span>
															{result.buybox_margin_calculation}
														</div>
													{/if}
													<div class="text-xs text-gray-500 italic mt-1">
														ROI Margin % = Profit ÷ Total Investment (Costs + Fees)
													</div>
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

									<!-- Live Update Column -->
									<td class="py-4 px-6">
										<div class="flex flex-col gap-2">
											<!-- Data Freshness Badge -->
											{#if result.captured_at}
												{@const freshness = getDataFreshness(result.captured_at)}
												<span
													class="inline-flex items-center px-2 py-1 rounded text-xs font-medium {freshness.class}"
													title={freshness.description}
												>
													{freshness.badge}
												</span>
											{/if}

											<!-- Update Button -->
											{#if result.id}
												{@const buttonState = getUpdateButtonState(result.id)}
												<button
													class="px-3 py-2 rounded text-xs font-medium transition-colors {buttonState.class}"
													disabled={buttonState.disabled}
													on:click={() => updateLivePrice(result)}
													title={buttonState.error ||
														'Update pricing data with latest Amazon SP-API data'}
												>
													{buttonState.text}
												</button>

												<!-- Error Message -->
												{#if buttonState.error}
													<div class="text-xs text-red-600 mt-1" title={buttonState.error}>
														⚠️ {buttonState.error.length > 20
															? buttonState.error.substring(0, 20) + '...'
															: buttonState.error}
													</div>
												{/if}
											{/if}
										</div>
									</td>

									<!-- Actions -->
									<td class="py-4 px-6">
										<div class="flex flex-col gap-1">
											<a
												href="/buy-box-monitor?query={encodeURIComponent(
													result.sku || result.asin
												)}"
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
			{:else if viewMode === 'bestsellers'}
				<!-- Top 100 Best Sellers View -->
				<div class="space-y-6 p-6">
					<div
						class="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg p-4 mb-6"
					>
						<div class="flex items-center gap-3">
							<span class="text-2xl">🏆</span>
							<div>
								<h3 class="text-lg font-semibold text-orange-800">Top 100 Best Sellers</h3>
								<p class="text-sm text-orange-600">
									Based on sales data from July 16, 2025 business report. Showing {bestSellersGrouped.size}
									ASINs with buy box data available.
								</p>
							</div>
						</div>
					</div>

					{#each Array.from(bestSellersGrouped.entries()).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) as [asin, skus]}
						<div class="bg-white border border-gray-200 rounded-lg shadow-sm">
							<!-- ASIN Header -->
							<div
								class={`px-6 py-4 border-b border-gray-200 ${
									skus[0]?.is_skeleton
										? 'bg-gradient-to-r from-gray-50 to-gray-100'
										: (() => {
												const winners = skus.filter((s) => s.is_winner).length;
												const total = skus.length;
												const winRate = total > 0 ? winners / total : 0;

												if (winRate >= 0.5) {
													// Winning: 50% or more of SKUs have buy box (includes 1/2, 2/2, etc.)
													return 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200';
												} else if (winRate > 0) {
													// Partial: Some SKUs winning but less than half
													return 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200';
												} else {
													// Losing: No SKUs have buy box
													return 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200';
												}
											})()
								}`}
							>
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-4">
										<h3 class="text-lg font-semibold text-gray-900">ASIN: {asin}</h3>
										{#if skus[0]?.is_skeleton}
											<span
												class="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium"
											>
												📊 No Data Available
											</span>
										{:else}
											<span
												class={(() => {
													const winners = skus.filter((s) => s.is_winner).length;
													const total = skus.length;
													const winRate = total > 0 ? winners / total : 0;

													if (winRate >= 0.5) {
														// Winning: Green badge
														return 'bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium';
													} else if (winRate > 0) {
														// Partial: Yellow badge
														return 'bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium';
													} else {
														// Losing: Red badge
														return 'bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium';
													}
												})()}
											>
												{(() => {
													const winners = skus.filter((s) => s.is_winner).length;
													const total = skus.length;
													const winRate = total > 0 ? winners / total : 0;

													if (winRate >= 0.5) {
														return '🏆 Buy Box Winner';
													} else if (winRate > 0) {
														return '⚠️ Partial Winner';
													} else {
														return '❌ Buy Box Loser';
													}
												})()}
											</span>
										{/if}
										<span
											class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium"
										>
											{skus[0]?.is_skeleton
												? 'Data Missing'
												: `${skus.length} SKU${skus.length !== 1 ? 's' : ''}`}
										</span>
										<a
											href="/buy-box-monitor?query={asin}"
											target="_blank"
											rel="noopener noreferrer"
											class="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium hover:bg-purple-200 transition-colors"
											title="Monitor buy box for this ASIN"
										>
											📈 Monitor
										</a>
										{#if skus[0]?.is_skeleton}
											<button
												on:click={() => fetchSingleASIN(asin)}
												class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
											>
												🔄 Fetch Data
											</button>
										{/if}
									</div>
									<div class="flex items-center gap-2">
										{#if !skus[0]?.is_skeleton}
											{#if skus.some((s) => s.merchant_shipping_group === 'Nationwide Prime')}
												<span
													class="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium"
												>
													⚡ Prime Available
												</span>
											{/if}
											{#if skus.some((s) => s.merchant_shipping_group === 'UK Shipping')}
												<span
													class="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-medium"
												>
													📦 Standard
												</span>
											{/if}
										{:else}
											<span
												class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium"
											>
												⚠️ Click "Fetch Data" to analyze
											</span>
										{/if}
									</div>
								</div>

								<!-- ASIN Summary Stats -->
								{#if !skus[0]?.is_skeleton}
									<div class="mt-3 grid grid-cols-5 gap-4 text-sm">
										<div>
											<span class="text-gray-500">Total Profit:</span>
											<span class="font-medium">
												£{skus
													.reduce((sum, s) => sum + (s.current_actual_profit || 0), 0)
													.toFixed(2)}
											</span>
										</div>
										<div>
											<span class="text-gray-500">Winners:</span>
											<span class="font-medium text-green-600">
												{skus.filter((s) => s.is_winner).length}/{skus.length}
											</span>
										</div>
										<div>
											<span class="text-gray-500">Price Matched:</span>
											<span class="font-medium text-orange-600">
												{skus.filter((s) => isPriceMatchedButLostBuyBox(s)).length}
											</span>
										</div>
										<div>
											<span class="text-gray-500">Opportunities:</span>
											<span class="font-medium text-blue-600">
												{skus.filter((s) => s.opportunity_flag).length}
											</span>
										</div>
										<div>
											<span class="text-gray-500">Last Updated:</span>
											<span class="font-medium">
												{new Date(
													Math.max(...skus.map((s) => new Date(s.captured_at).getTime()))
												).toLocaleDateString()}
											</span>
										</div>
									</div>
								{:else}
									<div class="mt-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
										<div class="flex items-center gap-2">
											<span class="text-yellow-600">⚡</span>
											<div>
												<p class="text-sm font-medium text-yellow-800">
													Buy Box Data Not Available
												</p>
												<p class="text-xs text-yellow-600">
													This ASIN is in your top 100 best sellers but hasn't been analyzed yet.
													Click "Fetch Data" to get current buy box information.
												</p>
											</div>
										</div>
									</div>
								{/if}
							</div>

							<!-- SKUs Table or Skeleton -->
							{#if !skus[0]?.is_skeleton}
								<div class="overflow-x-auto">
									<table class="min-w-full">
										<thead class="bg-gray-50">
											<tr
												class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>
												<th class="py-3 px-6">SKU</th>
												<th class="py-3 px-6">Shipping</th>
												<th class="py-3 px-6">Our Price</th>
												<th class="py-3 px-6">Buy Box</th>
												<th class="py-3 px-6">
													<div>Buy Box Profit</div>
													<div class="text-xs font-normal text-gray-400">If matched</div>
												</th>
												<th class="py-3 px-6">
													<div>ROI Margin %</div>
													<div class="text-xs font-normal text-gray-400">If matched buy box</div>
												</th>
												<th class="py-3 px-6">Status</th>
												<th class="py-3 px-6">Live Update</th>
												<th class="py-3 px-6">Action</th>
											</tr>
										</thead>
										<tbody class="bg-white divide-y divide-gray-200">
											{#each skus as sku}
												<tr
													class="hover:bg-gray-50 {updatedRows.has(sku.id)
														? 'updated-row'
														: ''} {recentlyUpdatedItems.has(sku.id)
														? 'recently-updated-bypass'
														: ''}"
												>
													<td class="py-4 px-6">
														<div class="text-sm">
															<a
																href="https://sellercentral.amazon.co.uk/myinventory/inventory?fulfilledBy=all&page=1&pageSize=50&searchField=all&searchTerm={encodeURIComponent(
																	sku.sku
																)}&sort=date_created_desc&status=all&ref_=xx_invmgr_favb_xx"
																target="_blank"
																rel="noopener noreferrer"
																class="font-medium text-blue-600 hover:text-blue-800 underline"
																title="Manage price in Amazon Seller Central"
															>
																{sku.sku} 📝
															</a>
														</div>
														<div class="mt-1">
															<a
																href="https://amazon.co.uk/dp/{sku.asin}"
																target="_blank"
																rel="noopener noreferrer"
																class="text-blue-600 hover:text-blue-800 underline text-xs font-medium"
																title="View on Amazon UK"
															>
																{sku.asin} →
															</a>
														</div>
														<div class="text-xs text-gray-500 mt-1 max-w-xs">
															<span class="block truncate">
																SKU: {sku.sku}
																{#if recentlyUpdatedItems.has(sku.id)}
																	<span
																		class="ml-1 inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200"
																		title="Recently updated - visible despite current filters"
																	>
																		🔄
																	</span>
																{/if}
															</span>
														</div>
													</td>
													<td class="py-4 px-6 whitespace-nowrap">
														{#if sku.merchant_shipping_group === 'Nationwide Prime'}
															<span
																class="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium whitespace-nowrap"
															>
																⚡ Prime
															</span>
														{:else if sku.merchant_shipping_group === 'UK Shipping'}
															<span
																class="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-medium whitespace-nowrap"
															>
																📦 Standard
															</span>
														{:else}
															<span class="text-gray-400 text-xs whitespace-nowrap">Unknown</span>
														{/if}
													</td>
													<td class="py-4 px-6">
														<div class="text-sm">
															{#if sku.your_current_price === 0}
																<span class="text-red-600">Out of Stock</span>
															{:else}
																<div class="flex items-center gap-2">
																	<div class="flex flex-col">
																		{#if showCustomPriceInputs.get(sku.sku)}
																			<!-- Custom price input -->
																			<div class="flex items-center gap-1 mb-1">
																				<input
																					type="number"
																					step="0.01"
																					min="0"
																					placeholder={sku.your_current_price?.toFixed(2) || '0.00'}
																					value={customPrices.get(sku.sku) || ''}
																					on:input={(e) =>
																						updateCustomPrice(
																							sku.sku,
																							(e.target as HTMLInputElement)?.value || ''
																						)}
																					class="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
																				/>
																				<span class="text-xs text-gray-500">£</span>
																			</div>
																			<div class="flex items-center gap-1">
																				<button
																					on:click={() => resetCustomPrice(sku.sku)}
																					class="text-xs text-gray-500 hover:text-gray-700 underline"
																					title="Reset to current price"
																				>
																					Reset
																				</button>
																				<button
																					on:click={() => toggleCustomPriceInput(sku.sku)}
																					class="text-xs text-gray-500 hover:text-gray-700"
																					title="Hide custom price input"
																				>
																					✕
																				</button>
																			</div>
																		{:else}
																			<!-- Current price display -->
																			<div class="flex items-center gap-1">
																				<span
																					class={customPrices.has(sku.sku)
																						? 'line-through text-gray-400'
																						: ''}
																				>
																					£{sku.your_current_price?.toFixed(2) || 'N/A'}
																				</span>
																				{#if customPrices.has(sku.sku)}
																					<span class="text-blue-600 font-medium">
																						→ £{customPrices.get(sku.sku)?.toFixed(2)}
																					</span>
																				{/if}
																			</div>
																			<button
																				on:click={() => toggleCustomPriceInput(sku.sku)}
																				class="text-xs text-blue-600 hover:text-blue-800 underline mt-0.5"
																				title="Test custom price"
																			>
																				{customPrices.has(sku.sku) ? 'Edit' : 'Test Price'}
																			</button>
																		{/if}
																	</div>
																	{#if sku.is_winner}
																		<span class="text-green-600 ml-1">🏆</span>
																	{/if}
																</div>
															{/if}
														</div>
													</td>
													<td class="py-4 px-6">
														<div class="text-sm">
															{#if sku.buybox_price && sku.buybox_price > 0}
																<!-- Always show actual Buy Box price -->
																£{sku.buybox_price.toFixed(2)}
																{#if sku.is_winner}
																	<span class="text-green-600 ml-1" title="You have the Buy Box"
																		>🏆</span
																	>
																{/if}
															{:else if sku.competitor_price && sku.competitor_price > 0}
																<!-- Fallback: use competitor_price if buybox_price not available -->
																£{sku.competitor_price.toFixed(2)}
																{#if sku.is_winner}
																	<span class="text-green-600 ml-1" title="You have the Buy Box"
																		>🏆</span
																	>
																{/if}
															{:else}
																<!-- No buy box data available - don't show your price here -->
																<span class="text-gray-500 italic">No Buy Box</span>
															{/if}
														</div>
													</td>
													<td class="py-4 px-6">
														<div class="text-sm">
															{#if customPrices.has(sku.sku)}
																<!-- Custom price profit -->
																{@const customProfit = getEffectiveProfit(sku)}
																{#if customProfit !== null}
																	<div class="flex flex-col gap-1">
																		<span
																			class={customProfit >= 0
																				? 'text-blue-600 font-medium'
																				: 'text-red-600 font-medium'}
																			title="Profit at custom price"
																		>
																			£{customProfit.toFixed(2)}
																		</span>
																		<span class="text-xs text-gray-500">
																			(Custom: £{customPrices.get(sku.sku)?.toFixed(2)})
																		</span>
																	</div>
																{:else}
																	<span class="text-gray-400">N/A</span>
																{/if}
															{:else if sku.is_winner}
																<!-- Winner: Show current profit since you already have buy box -->
																{#if sku.current_actual_profit !== null}
																	<span
																		class={sku.current_actual_profit >= 0
																			? 'text-green-600'
																			: 'text-red-600'}
																		title="Current profit (you have the buy box)"
																	>
																		£{sku.current_actual_profit.toFixed(2)}
																	</span>
																{:else}
																	<span class="text-gray-400">N/A</span>
																{/if}
															{:else}
																<!-- Loser: Show what profit would be if you matched buy box -->
																{#if sku.buybox_actual_profit !== null}
																	<span
																		class={sku.buybox_actual_profit >= 0
																			? 'text-green-600'
																			: 'text-red-600'}
																		title="Profit if you matched buy box price"
																	>
																		£{sku.buybox_actual_profit.toFixed(2)}
																	</span>
																{:else if sku.current_actual_profit !== null}
																	<span
																		class="text-gray-500"
																		title="Current profit (not competitive)"
																	>
																		£{sku.current_actual_profit.toFixed(2)}
																	</span>
																{:else}
																	<span class="text-gray-400">N/A</span>
																{/if}
															{/if}
														</div>
													</td>
													<td class="py-4 px-6">
														<div class="text-sm">
															{#if customPrices.has(sku.sku)}
																<!-- Custom price margin -->
																{@const customMargin = getEffectiveMargin(sku)}
																{#if customMargin !== null}
																	<div class="flex flex-col gap-1">
																		<span
																			class={customMargin >= 20
																				? 'text-blue-600 font-medium'
																				: customMargin >= 10
																					? 'text-yellow-600 font-medium'
																					: 'text-red-600 font-medium'}
																			title="Margin at custom price"
																		>
																			{customMargin.toFixed(1)}%
																		</span>
																		<span class="text-xs text-gray-500"> (Custom) </span>
																	</div>
																{:else}
																	<span class="text-gray-400">N/A</span>
																{/if}
															{:else if sku.is_winner}
																<!-- Winner: Show current margin since you already have buy box -->
																{#if sku.your_margin_percent_at_current_price !== null}
																	<span
																		class={sku.your_margin_percent_at_current_price >= 20
																			? 'text-green-600'
																			: sku.your_margin_percent_at_current_price >= 10
																				? 'text-yellow-600'
																				: 'text-red-600'}
																		title="Current ROI margin % (you have the buy box)"
																	>
																		{sku.your_margin_percent_at_current_price.toFixed(1)}%
																	</span>
																{:else}
																	<span class="text-gray-400">N/A</span>
																{/if}
															{:else}
																<!-- Loser: Show what margin would be if you matched buy box -->
																{#if sku.margin_percent_at_buybox_price !== null}
																	<span
																		class={sku.margin_percent_at_buybox_price >= 20
																			? 'text-green-600'
																			: sku.margin_percent_at_buybox_price >= 10
																				? 'text-yellow-600'
																				: 'text-red-600'}
																		title="ROI margin % if you matched buy box price"
																	>
																		{sku.margin_percent_at_buybox_price.toFixed(1)}%
																	</span>
																{:else if sku.your_margin_percent_at_current_price !== null}
																	<span
																		class="text-gray-500"
																		title="Current ROI margin % (not competitive for buy box)"
																	>
																		{sku.your_margin_percent_at_current_price.toFixed(1)}%
																	</span>
																{:else}
																	<span class="text-gray-400">N/A</span>
																{/if}
															{/if}
														</div>
													</td>
													<td class="py-4 px-6 whitespace-nowrap">
														{#if true}
															{@const status = getSkuStatus(sku)}
															<span
																class="{status.bgClass} {status.textClass} px-2 py-1 rounded text-xs font-medium whitespace-nowrap inline-block"
																title={status.description}
															>
																{status.label}
															</span>
														{/if}
													</td>
													<td class="py-4 px-6 whitespace-nowrap">
														<div class="flex flex-col gap-2">
															<!-- Data Freshness Badge -->
															{#if sku.captured_at}
																{@const freshness = getDataFreshness(sku.captured_at)}
																<span
																	class="inline-flex items-center px-2 py-1 rounded text-xs font-medium {freshness.class}"
																	title={freshness.description}
																>
																	{freshness.badge}
																</span>
															{/if}

															<!-- Update Button -->
															{#if sku.id}
																{@const buttonState = getUpdateButtonState(sku.id)}
																<button
																	class="px-2 py-1 rounded text-xs font-medium transition-colors {buttonState.class}"
																	disabled={buttonState.disabled}
																	on:click={() => updateLivePrice(sku)}
																	title={buttonState.error ||
																		'Update pricing data with latest Amazon SP-API data'}
																>
																	{buttonState.text}
																</button>

																<!-- Error Message -->
																{#if buttonState.error}
																	<div class="text-xs text-red-600 mt-1" title={buttonState.error}>
																		⚠️ {buttonState.error.length > 15
																			? buttonState.error.substring(0, 15) + '...'
																			: buttonState.error}
																	</div>
																{/if}
															{/if}
														</div>
													</td>
													<td class="py-4 px-6 whitespace-nowrap">
														<a
															href="/buy-box-monitor?query={encodeURIComponent(sku.sku)}"
															class="text-blue-600 hover:text-blue-800 text-sm underline"
															target="_blank"
														>
															Check Live
														</a>
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{:else}
								<!-- Skeleton view for missing ASIN data -->
								<div class="p-6">
									<div class="flex items-center justify-center py-8">
										<div class="text-center">
											<div
												class="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full"
											>
												<span class="text-2xl">📊</span>
											</div>
											<h3 class="text-lg font-medium text-gray-900 mb-2">
												No Buy Box Data Available
											</h3>
											<p class="text-sm text-gray-500 mb-4">
												This ASIN appears in your top 100 best sellers but hasn't been analyzed for
												buy box opportunities yet.
											</p>
											<div class="flex items-center justify-center gap-3">
												<a
													href="https://amazon.co.uk/dp/{asin}"
													target="_blank"
													rel="noopener noreferrer"
													class="text-blue-600 hover:text-blue-800 underline text-sm"
													title="View on Amazon UK"
												>
													{asin} → View Product
												</a>
												<span class="text-gray-300">|</span>
												<button
													on:click={() => fetchSingleASIN(asin)}
													class="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md transition-colors"
												>
													🔄 Analyze This ASIN
												</button>
											</div>
										</div>
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			<!-- Bottom Pagination -->
			{#if totalResults > itemsPerPage}
				<div class="px-6 py-4 border-t border-gray-200 bg-gray-50">
					<div class="flex justify-between items-center">
						<div class="text-sm text-gray-500">
							Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(
								currentPage * itemsPerPage,
								totalResults
							)} of {totalResults} results
						</div>
						<div class="flex space-x-1">
							<button
								class="px-3 py-1 rounded border disabled:opacity-50 bg-white hover:bg-gray-50"
								disabled={currentPage === 1}
								on:click={() => changePage(currentPage - 1)}
							>
								Previous
							</button>

							{#each Array(Math.min(5, Math.ceil(totalResults / itemsPerPage))) as _, i}
								{@const pageNumber = Math.max(1, currentPage - 2) + i}
								{#if pageNumber <= Math.ceil(totalResults / itemsPerPage)}
									<button
										class={`px-3 py-1 rounded border ${currentPage === pageNumber ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}
										on:click={() => changePage(pageNumber)}
									>
										{pageNumber}
									</button>
								{/if}
							{/each}

							<button
								class="px-3 py-1 rounded border disabled:opacity-50 bg-white hover:bg-gray-50"
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

<style>
	/* Row animation for successful updates */
	:global(.updated-row) {
		animation: flash-green 2s ease-in-out;
	}

	/* Recently updated items that bypass filters */
	:global(.recently-updated-bypass) {
		border-left: 3px solid #a855f7 !important;
		background-color: #faf5ff !important;
	}

	@keyframes flash-green {
		0% {
			background-color: transparent;
		}
		20% {
			background-color: #dcfce7;
			border-left: 4px solid #22c55e;
		}
		100% {
			background-color: transparent;
			border-left: none;
		}
	}

	/* Smooth transitions for button states */
	:global(.live-update-button) {
		transition: all 0.2s ease-in-out;
	}

	/* Data freshness badge animations */
	:global(.freshness-badge) {
		animation: pulse-subtle 3s ease-in-out infinite;
	}

	@keyframes pulse-subtle {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.8;
		}
	}
</style>
