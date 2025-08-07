<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';

	// Import Basket Components (UI Framework Only - Not Connected)
	import BasketSidebar from '$lib/components/BasketSidebar.svelte';
	import FilterSidebar from '$lib/components/FilterSidebar.svelte';
	import { basketActions } from '$lib/stores/pricingBasketStore';

	// Toast notification types and management
	interface ToastNotification {
		id: string;
		type: 'success' | 'error' | 'warning' | 'info';
		title: string;
		message: string;
		duration?: number;
		timestamp: Date;
	}

	let toastNotifications: ToastNotification[] = [];
	let toastIdCounter = 0;

	function showToast(
		type: ToastNotification['type'],
		title: string,
		message: string,
		duration: number = 5000
	) {
		const id = `toast-${++toastIdCounter}`;
		const toast: ToastNotification = {
			id,
			type,
			title,
			message,
			duration,
			timestamp: new Date()
		};

		toastNotifications = [toast, ...toastNotifications];

		// Auto-remove after duration
		if (duration > 0) {
			setTimeout(() => {
				removeToast(id);
			}, duration);
		}

		return id;
	}

	function removeToast(id: string) {
		toastNotifications = toastNotifications.filter((toast) => toast.id !== id);
	}

	function removeAllToasts() {
		toastNotifications = [];
	}

	// Convenience functions for different toast types
	function showSuccessToast(title: string, message: string, duration?: number) {
		return showToast('success', title, message, duration);
	}

	function showErrorToast(title: string, message: string, duration?: number) {
		return showToast('error', title, message, duration || 8000); // Errors stay longer
	}

	function showWarningToast(title: string, message: string, duration?: number) {
		return showToast('warning', title, message, duration || 6000);
	}

	function showInfoToast(title: string, message: string, duration?: number) {
		return showToast('info', title, message, duration);
	}

	// Authentication error handler
	function handleAuthError(error: any, context: string = 'API request') {
		console.log('🔐 handleAuthError called with:', { error, context });

		const errorMessage = error?.message || error?.error || String(error);

		console.log('🔐 Checking error message:', errorMessage);

		// Check for session expiry patterns
		if (
			errorMessage.includes('Session expired') ||
			errorMessage.includes('session expired') ||
			errorMessage.includes('Authentication required') ||
			errorMessage.includes('token expired') ||
			errorMessage.includes('authentication token') ||
			errorMessage.includes('invalid session')
		) {
			console.log('🔐 Session expiry detected, redirecting to login');
			showErrorToast('Session Expired', 'Your session has expired. Please log in again.', 5000);

			// Redirect to login page after a short delay
			setTimeout(() => {
				window.location.href = '/login?redirectTo=' + encodeURIComponent(window.location.pathname);
			}, 2000);
			return true; // Indicates this was an auth error
		}

		console.log('🔐 Not a session auth error, continuing with normal error handling');
		return false; // Not a session auth error
	}

	// Session management
	async function checkAndRefreshSession() {
		try {
			console.log('🔐 Checking current session...');
			const {
				data: { session },
				error
			} = await supabase.auth.getSession();

			if (error) {
				console.error('🔐 Session check error:', error);
				return false;
			}

			if (!session) {
				console.log('🔐 No active session found');
				return false;
			}

			console.log('🔐 Session is valid, user:', session.user?.email);
			return true;
		} catch (error) {
			console.error('🔐 Session check failed:', error);
			return false;
		}
	}

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
		price_gap: number | null; // Difference between our price and buy box price
		is_winner: boolean;
		is_buy_box_winner: boolean; // Whether this item is currently winning the buy box
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

		// Price update tracking
		last_price_update?: string | null; // ISO timestamp of last price update via UI
		update_source?: string | null; // Source of last price update (e.g., 'match_buy_box')
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

	// Rate limiter status
	let rateLimiterStatus = {
		queueLength: 0,
		processing: false,
		estimatedWaitTime: 0,
		estimatedWaitTimeFormatted: '0s',
		lastRequestTime: 0,
		requestsPerSecond: 0
	};
	let rateLimiterInterval: NodeJS.Timeout | null = null;

	// Search and filters
	let searchTerm = ''; // Renamed from searchQuery for FilterSidebar compatibility
	let categoryFilter = 'all'; // all, winners, losers, small_gap_losers, opportunities, opportunities_high_margin, opportunities_low_margin, not_profitable, raise_price, reduce_price, match_buybox, investigate
	let shippingFilter = 'all'; // all, prime, standard
	let dateRange = 'all'; // all, today, yesterday, week, month
	let sortBy = 'profit_desc'; // profit_desc, profit_asc, margin_desc, margin_asc, profit_difference_desc, profit_difference_asc, margin_difference_desc, margin_difference_asc, price_gap_asc, price_gap_desc, sku_asc, sku_desc
	let showOnlyWithMarginData = false;
	let includeNoMarginData = false; // New option to include records without margin data
	let minProfitFilter = 0;
	let minMarginFilter = 0;
	let showLatestOnly = true; // New filter to show only latest data per SKU
	let showCostBreakdown = false; // Toggle for cost breakdown column visibility

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

	// Computed property to check if any live updates are in progress
	$: activeUpdates = Array.from(livePricingUpdates.values()).filter((state) => state.isUpdating);

	// Dynamic filter counts based on actual data
	let categoryCounts: {
		winners?: number;
		losers?: number;
		small_gap_losers?: number;
		opportunities?: number;
		opportunities_high_margin?: number;
		opportunities_low_margin?: number;
		not_profitable?: number;
		match_buybox?: number;
		hold_price?: number;
		investigate?: number;
	} = {};
	let shippingCounts: {
		prime?: number;
		standard?: number;
	} = {};

	// Calculate dynamic counts from buyboxData
	$: {
		if (buyboxData && buyboxData.length > 0) {
			// Debug: Let's see what price_gap values we have
			console.log('🔍 Debugging Small Gap Losers:');
			const losers = buyboxData.filter((item) => !item.is_winner);
			console.log(`Total losers: ${losers.length}`);
			
			const losersWithGap = losers.filter((item) => item.price_gap);
			console.log(`Losers with price_gap field: ${losersWithGap.length}`);
			
			const losersWithCalculatedGap = losers.filter((item) => {
				let gap = item.price_gap;
				if (!gap && item.your_current_price && (item.buybox_price || item.price)) {
					gap = item.your_current_price - (item.buybox_price || item.price);
				}
				return gap && gap > 0;
			});
			console.log(`Losers with calculated gap: ${losersWithCalculatedGap.length}`);
			
			const smallGapCandidates = losers.filter((item) => {
				let gap = item.price_gap;
				if (!gap && item.your_current_price && (item.buybox_price || item.price)) {
					gap = item.your_current_price - (item.buybox_price || item.price);
				}
				return gap && gap > 0 && gap <= 0.1;
			});
			console.log(`Small gap candidates: ${smallGapCandidates.length}`);
			
			// Log some sample data
			if (losers.length > 0) {
				const sampleItem = losers[0];
				let calculatedGap = null;
				if (sampleItem.your_current_price && (sampleItem.buybox_price || sampleItem.price)) {
					calculatedGap = sampleItem.your_current_price - (sampleItem.buybox_price || sampleItem.price);
				}
				
				console.log('Sample loser data:', {
					sku: sampleItem.sku,
					is_winner: sampleItem.is_winner,
					price_gap: sampleItem.price_gap,
					calculated_gap: calculatedGap,
					your_current_price: sampleItem.your_current_price,
					price: sampleItem.price,
					buybox_price: sampleItem.buybox_price
				});
			}

			categoryCounts = {
				winners: buyboxData.filter((item) => item.is_winner === true).length,
				losers: buyboxData.filter((item) => item.is_winner === false).length,
				small_gap_losers: buyboxData.filter(
					(item) => {
						if (item.is_winner) return false;
						
						// Try to get price_gap from the field, or calculate it
						let gap = item.price_gap;
						if (!gap && item.your_current_price && (item.buybox_price || item.price)) {
							gap = item.your_current_price - (item.buybox_price || item.price);
						}
						
						return gap && gap > 0 && gap <= 0.1;
					}
				).length,
				opportunities: buyboxData.filter(
					(item) =>
						!item.is_winner &&
						item.margin_percent_at_buybox_price !== null &&
						item.margin_percent_at_buybox_price > 0
				).length,
				opportunities_high_margin: buyboxData.filter(
					(item) =>
						!item.is_winner &&
						item.margin_percent_at_buybox_price !== null &&
						item.margin_percent_at_buybox_price >= 10
				).length,
				opportunities_low_margin: buyboxData.filter(
					(item) =>
						!item.is_winner &&
						item.margin_percent_at_buybox_price !== null &&
						item.margin_percent_at_buybox_price > 0 &&
						item.margin_percent_at_buybox_price < 10
				).length,
				not_profitable: buyboxData.filter(
					(item) =>
						!item.is_winner &&
						item.margin_percent_at_buybox_price !== null &&
						item.margin_percent_at_buybox_price < 0
				).length,
				match_buybox: buyboxData.filter((item) => item.recommended_action === 'match_buybox')
					.length,
				investigate: buyboxData.filter((item) => item.recommended_action === 'investigate').length
			};

			shippingCounts = {
				prime: buyboxData.filter(
					(item) =>
						item.merchant_shipping_group &&
						(item.merchant_shipping_group.toLowerCase().includes('prime') ||
							item.merchant_shipping_group.toLowerCase().includes('next day'))
				).length,
				standard: buyboxData.filter(
					(item) =>
						item.merchant_shipping_group &&
						(item.merchant_shipping_group.toLowerCase().includes('standard') ||
							item.merchant_shipping_group.toLowerCase().includes('uk shipping') ||
							!item.merchant_shipping_group.toLowerCase().includes('prime'))
				).length
			};
		}
	}
	$: hasActiveUpdates = activeUpdates.length > 0;

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

	// Test Environment State
	let testMode = false; // Toggle between production data and sandbox testing
	let testResults = new Map<string, any>(); // Store test results for each ASIN
	let testInProgress = new Set<string>(); // Track which tests are running

	// Production Match Buy Box State
	let matchBuyBoxInProgress = new Set<string>(); // Track which Match Buy Box operations are running
	let matchBuyBoxResults = new Map<string, any>(); // Store Match Buy Box results for each ASIN
	let pendingMatchBuyBoxRequests = new Map<string, Promise<any>>(); // Prevent duplicate requests
	let safetyMarginPercent = 10; // Default 10% safety margin

	// Feed Status Checking State
	let feedStatusChecks = new Map<string, any>(); // feedId -> status info
	let activeFeedChecks = new Set<string>(); // Track which feeds are being checked
	let feedStatusInterval: ReturnType<typeof setInterval> | null = null; // Auto-refresh interval

	// Margin Confirmation Modal State
	let marginConfirmationModal: {
		show: boolean;
		data: {
			asin: string;
			targetPrice: number;
			currentMargin: number | null;
			newMargin: number | null;
			message: string;
		} | null;
	} = { show: false, data: null };

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

			const response = await fetch('/api/live-pricing/update', {
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
					const freshDataResponse = await fetch(`/api/buybox-data/${recordId}`);

					if (freshDataResponse.ok) {
						const fetchedRecord = await freshDataResponse.json();

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
				text: 'Update Live Price',
				class: 'bg-blue-500 hover:bg-blue-600 text-white min-w-[120px]',
				disabled: false,
				error: null
			};
		}

		if (updateState.isUpdating) {
			return {
				isUpdating: true,
				text: 'Updating...',
				class: 'bg-blue-400 text-white cursor-not-allowed min-w-[120px]',
				disabled: true,
				error: null
			};
		}

		if (updateState.success && updateState.lastUpdated) {
			const secondsAgo = Math.floor((Date.now() - updateState.lastUpdated.getTime()) / 1000);
			return {
				isUpdating: false,
				text: `Updated ${secondsAgo}s ago`,
				class: 'bg-green-500 hover:bg-green-600 text-white min-w-[120px]',
				disabled: false,
				error: null
			};
		}

		if (updateState.error) {
			return {
				isUpdating: false,
				text: 'Failed - Retry',
				class: 'bg-red-500 hover:bg-red-600 text-white min-w-[120px]',
				disabled: false,
				error: updateState.error
			};
		}

		return {
			isUpdating: false,
			text: 'Update Live Price',
			class: 'bg-blue-500 hover:bg-blue-600 text-white min-w-[120px]',
			disabled: false,
			error: null
		};
	}

	// Test Environment Functions (Sandbox Amazon API Testing)
	/**
	 * Test Match Buy Box functionality in sandbox environment
	 */
	async function testMatchBuyBox(asin: string, targetPrice: number): Promise<void> {
		console.log(`🧪 Testing Match Buy Box for ASIN: ${asin} at price: £${targetPrice}`);

		testInProgress.add(asin);
		testInProgress = testInProgress; // Trigger reactivity

		try {
			const response = await fetch('/api/test-match-buybox', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					asin: asin,
					targetPrice: targetPrice,
					environment: 'sandbox', // Always use sandbox for testing
					userId: 'test-user' // Test user ID
				})
			});

			const result = await response.json();

			testResults.set(asin, {
				success: response.ok,
				timestamp: new Date(),
				targetPrice: targetPrice,
				result: result,
				status: response.status
			});

			testResults = testResults; // Trigger reactivity

			if (response.ok) {
				console.log(`✅ Test successful for ASIN: ${asin}`, result);
			} else {
				console.error(`❌ Test failed for ASIN: ${asin}`, result);
			}
		} catch (error) {
			console.error(`🚨 Test error for ASIN: ${asin}:`, error);

			testResults.set(asin, {
				success: false,
				timestamp: new Date(),
				targetPrice: targetPrice,
				error: error instanceof Error ? error.message : 'Unknown error',
				status: 0
			});

			testResults = testResults; // Trigger reactivity
		} finally {
			testInProgress.delete(asin);
			testInProgress = testInProgress; // Trigger reactivity
		}
	}

	/**
	 * Test Amazon API connectivity in sandbox
	 */
	async function testAmazonAPIConnectivity(): Promise<void> {
		console.log('🧪 Testing Amazon API connectivity in sandbox...');

		try {
			const response = await fetch('/api/test-amazon-connection', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					environment: 'sandbox'
				})
			});

			const result = await response.json();

			if (response.ok) {
				console.log('✅ Amazon API connectivity test successful:', result);
				alert(
					`✅ Amazon API Test Successful!\n\nEnvironment: ${result.environment}\nStatus: ${result.status}\nListings API: ${result.listingsApi ? 'Working' : 'Not Available'}`
				);
			} else {
				console.error('❌ Amazon API connectivity test failed:', result);
				alert(
					`❌ Amazon API Test Failed!\n\nError: ${result.error || 'Unknown error'}\nStatus: ${result.status || 'No status'}`
				);
			}
		} catch (error) {
			console.error('🚨 Amazon API test error:', error);
			alert(
				`🚨 Amazon API Test Error!\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Create test scenario with sample data
	 */
	function createTestScenario(): BuyBoxData[] {
		const testASINs = [
			'B09T3GDNGT', // Your top ASIN - small gap loser
			'B076B1NF1Q', // Another small gap loser
			'B004BTED72' // Larger gap loser
		];

		return testASINs.map((asin, index) => {
			const buyboxPrice = 19.99 + index;
			let yourPrice, priceGap, marginAtBuybox;

			if (index === 0) {
				// Small gap loser: £0.01 difference - profitable if matched
				yourPrice = buyboxPrice + 0.01;
				priceGap = 0.01;
				marginAtBuybox = 15.2; // Positive margin
			} else if (index === 1) {
				// Small gap loser: £0.05 difference - barely profitable
				yourPrice = buyboxPrice + 0.05;
				priceGap = 0.05;
				marginAtBuybox = 2.1; // Small positive margin
			} else {
				// Larger gap loser: £3.00 difference - NOT profitable if matched
				yourPrice = buyboxPrice + 3.0;
				priceGap = 3.0;
				marginAtBuybox = -5.3; // Negative margin - would lose money
			}

			return {
				id: `test-${asin}`,
				asin: asin,
				sku: `TEST-SKU-${index + 1}`,
				item_name: `Test Product ${index + 1} (${asin}) - Gap: £${priceGap.toFixed(2)}, Margin: ${marginAtBuybox}%`,
				price: null,
				buybox_price: buyboxPrice,
				your_current_price: yourPrice,
				competitor_price: buyboxPrice,
				price_gap: priceGap,
				is_winner: false, // You're not winning
				opportunity_flag: true, // This is an opportunity
				captured_at: new Date().toISOString(),
				merchant_shipping_group: index % 2 === 0 ? 'Nationwide Prime' : 'UK Shipping',

				// Cost data for testing
				your_cost: 10.0 + index,
				your_shipping_cost: 2.5,
				your_material_total_cost: 0.2,
				your_box_cost: 0.5,
				your_vat_amount: 2.0 + index * 0.2,
				your_fragile_charge: 0,
				total_operating_cost: 15.2 + index * 1.2,

				// Margin data
				your_margin_percent_at_current_price: 25.5 + index,
				margin_percent_at_buybox_price: marginAtBuybox,
				margin_difference: -10.3,
				profit_opportunity: 2.5 + index,

				// Profit data
				current_actual_profit: 6.5 + index,
				buybox_actual_profit: 4.0 + index,

				// Recommendations
				recommended_action: 'match_buybox',
				break_even_price: 16.5 + index,

				// Additional fields
				current_margin_calculation: `Test calculation for ${asin}`,
				buybox_margin_calculation: `Buy box calculation for ${asin}`,
				total_investment_current: 18.5 + index,
				total_investment_buybox: 16.2 + index,

				// Price update tracking
				last_price_update:
					index === 0
						? new Date(Date.now() - 15 * 60 * 1000).toISOString() // 15 minutes ago
						: index === 1
							? new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() // 3 hours ago
							: index === 2
								? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
								: null,
				update_source: index <= 2 ? 'match_buy_box' : null,

				run_id: 'test-run-001',
				job_id: 'test-job-001',
				is_skeleton: false
			};
		});
	}

	/**
	 * Check feed status for a specific feed ID
	 */
	async function checkFeedStatus(
		feedId: string,
		recordId?: string,
		sku?: string,
		asin?: string
	): Promise<void> {
		console.log(`🔍 Checking feed status for feed ID: ${feedId}`);

		// Prevent duplicate checks
		if (activeFeedChecks.has(feedId)) {
			console.log(`⏳ Feed status check already in progress for ${feedId}`);
			return;
		}

		activeFeedChecks.add(feedId);
		activeFeedChecks = activeFeedChecks; // Trigger reactivity

		try {
			const response = await fetch('/api/check-feed-status', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					feedId,
					recordId,
					sku,
					asin
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || `HTTP ${response.status}`);
			}

			const result = await response.json();

			// Store the feed status information
			feedStatusChecks.set(feedId, {
				...result,
				lastUpdated: new Date()
			});
			feedStatusChecks = feedStatusChecks; // Trigger reactivity

			console.log(`✅ Feed status updated for ${feedId}:`, result);

			// If the feed is complete, show a notification
			if (result.isComplete) {
				if (result.needsAttention) {
					showWarningToast('Feed Completed with Issues', `Feed ${feedId}: ${result.userStatus}`);
				} else {
					showSuccessToast('Feed Completed Successfully', `Feed ${feedId}: ${result.userStatus}`);
				}
			}

			return result;
		} catch (error: unknown) {
			console.error(`❌ Error checking feed status for ${feedId}:`, error);

			// Store error information
			feedStatusChecks.set(feedId, {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				feedId,
				lastUpdated: new Date()
			});
			feedStatusChecks = feedStatusChecks; // Trigger reactivity

			throw error;
		} finally {
			activeFeedChecks.delete(feedId);
			activeFeedChecks = activeFeedChecks; // Trigger reactivity
		}
	}

	/**
	 * Start automatic feed status checking for all pending feeds
	 */
	function startFeedStatusMonitoring(): void {
		if (feedStatusInterval) {
			clearInterval(feedStatusInterval);
		}

		feedStatusInterval = setInterval(async () => {
			// Check all feeds that are not complete
			const pendingFeeds = Array.from(feedStatusChecks.entries()).filter(
				([feedId, status]) => status.success && !status.isComplete
			);

			console.log(`🔄 Auto-checking ${pendingFeeds.length} pending feeds`);

			for (const [feedId, statusInfo] of pendingFeeds) {
				try {
					await checkFeedStatus(feedId, statusInfo.recordId, statusInfo.sku, statusInfo.asin);
				} catch (error) {
					console.warn(`⚠️ Auto-check failed for feed ${feedId}:`, error);
				}
			}
		}, 30000); // Check every 30 seconds
	}

	/**
	 * Stop automatic feed status checking
	 */
	function stopFeedStatusMonitoring(): void {
		if (feedStatusInterval) {
			clearInterval(feedStatusInterval);
			feedStatusInterval = null;
		}
	}

	/**
	 * Get feed status display information
	 */
	function getFeedStatusDisplay(feedId: string): {
		status: string;
		class: string;
		icon: string;
		showCheckButton: boolean;
		lastChecked: string;
	} {
		const feedInfo = feedStatusChecks.get(feedId);

		if (!feedInfo) {
			return {
				status: 'Unknown',
				class: 'bg-gray-100 text-gray-800',
				icon: '❓',
				showCheckButton: true,
				lastChecked: 'Never'
			};
		}

		if (!feedInfo.success) {
			return {
				status: 'Check Failed',
				class: 'bg-red-100 text-red-800',
				icon: '❌',
				showCheckButton: true,
				lastChecked: feedInfo.lastUpdated ? formatDate(feedInfo.lastUpdated.toISOString()) : 'Never'
			};
		}

		const isChecking = activeFeedChecks.has(feedId);

		return {
			status: isChecking ? 'Checking...' : feedInfo.userStatus,
			class: isChecking ? 'bg-blue-100 text-blue-800' : feedInfo.statusClass,
			icon: isChecking
				? '🔄'
				: feedInfo.isComplete
					? feedInfo.needsAttention
						? '⚠️'
						: '✅'
					: '⏳',
			showCheckButton: !isChecking && !feedInfo.isComplete,
			lastChecked: feedInfo.lastUpdated ? formatDate(feedInfo.lastUpdated.toISOString()) : 'Never'
		};
	}

	/**
	 * Production Match Buy Box - Execute real price update with safety checks
	 */
	async function matchBuyBox(asin: string, targetPrice: number): Promise<void> {
		console.log(`🎯 Executing Match Buy Box for ASIN: ${asin} at price: £${targetPrice}`);
		console.log(`🔍 Target price analysis:`, {
			originalTargetPrice: targetPrice,
			type: typeof targetPrice,
			toFixed2: targetPrice.toFixed(2),
			rounded: Math.round(targetPrice * 100) / 100
		});

		// Check for duplicate requests
		if (pendingMatchBuyBoxRequests.has(asin)) {
			console.log(
				`⚠️ Match Buy Box already in progress for ASIN: ${asin}, waiting for completion...`
			);
			try {
				await pendingMatchBuyBoxRequests.get(asin);
				return;
			} catch (error) {
				console.log(`Previous request failed, proceeding with new request for ASIN: ${asin}`);
			}
		}

		// Find the record to get margin data
		const record = filteredData.find((item) => item.asin === asin);
		if (!record) {
			alert(`❌ Error: Could not find record for ASIN: ${asin}`);
			return;
		}

		console.log(`📊 Record data for ${asin}:`, {
			buybox_price: record.buybox_price,
			competitor_price: record.competitor_price,
			your_current_price: record.your_current_price,
			is_winner: record.is_winner,
			margin_percent_at_buybox_price: record.margin_percent_at_buybox_price
		});

		// Safety Check: Validate 10% minimum margin
		const projectedMargin = record.margin_percent_at_buybox_price;
		if (projectedMargin !== null && projectedMargin < 10) {
			console.log(
				`⚠️ Safety check failed: Margin would be ${projectedMargin?.toFixed(2)}% (below 10% minimum)`
			);

			// Store safety rejection result
			matchBuyBoxResults.set(asin, {
				success: false,
				safetyRejected: true,
				timestamp: new Date(),
				targetPrice: targetPrice,
				projectedMargin: projectedMargin,
				error: `Margin safety check failed: ${projectedMargin?.toFixed(2)}% is below 10% minimum`,
				sellerCentralUrl: `https://sellercentral.amazon.co.uk/inventory/ref=xx_invmgr_dnav_xx?tbla_myitable=sort:%7B%22sortOrder%22%3A%22DESCENDING%22%2C%22sortedColumnId%22%3A%22date%22%7D;search:${asin};pagination:1;`
			});

			matchBuyBoxResults = matchBuyBoxResults; // Trigger reactivity

			// Show safety warning with guidance
			const message =
				`⚠️ Safety Check Failed!\n\n` +
				`ASIN: ${asin}\n` +
				`Target Price: £${targetPrice}\n` +
				`Projected Margin: ${projectedMargin?.toFixed(2)}%\n\n` +
				`🛡️ This price would result in a margin below the 10% safety threshold.\n\n` +
				`✋ Action Required:\n` +
				`Please review and update this price manually in Amazon Seller Central if you wish to proceed.\n\n` +
				`📋 This protects you from accidentally setting unprofitable prices.`;

			if (confirm(message + `\n\n🔗 Would you like to open Amazon Seller Central now?`)) {
				// Open Seller Central for manual update
				window.open(
					`https://sellercentral.amazon.co.uk/inventory/ref=xx_invmgr_dnav_xx?tbla_myitable=sort:%7B%22sortOrder%22%3A%22DESCENDING%22%2C%22sortedColumnId%22%3A%22date%22%7D;search:${asin};pagination:1;`,
					'_blank'
				);
			}
			return;
		}

		// Create the request promise and store it for deduplication
		const requestPromise = performMatchBuyBoxRequest(
			asin,
			targetPrice,
			projectedMargin,
			record.your_current_price,
			record // Pass the record so we don't need to look it up again
		);
		pendingMatchBuyBoxRequests.set(asin, requestPromise);

		try {
			await requestPromise;
		} finally {
			// Clean up the pending request
			pendingMatchBuyBoxRequests.delete(asin);
		}
	}

	/**
	 * Perform the actual Match Buy Box API request
	 * Updated to use proper API endpoint instead of direct import
	 */
	async function performMatchBuyBoxRequest(
		asin: string,
		targetPrice: number,
		projectedMargin: number | null,
		currentPrice: number | null = null,
		record: BuyBoxData
	): Promise<void> {
		// Fetch current rate limiter status before attempting request
		await fetchRateLimiterStatus();

		// Show user feedback about rate limiting if there's a queue
		if (rateLimiterStatus.queueLength > 0) {
			showInfoToast(
				'Rate Limited',
				`Your request is queued (${rateLimiterStatus.queueLength} ahead). Estimated wait: ${rateLimiterStatus.estimatedWaitTimeFormatted}`,
				8000
			);
		} else if (rateLimiterStatus.estimatedWaitTime > 1000) {
			showInfoToast(
				'Rate Limited',
				`Request will be processed in ${rateLimiterStatus.estimatedWaitTimeFormatted}`,
				6000
			);
		}

		// Add to in-progress tracking
		matchBuyBoxInProgress.add(asin);
		matchBuyBoxInProgress = matchBuyBoxInProgress; // Trigger reactivity

		try {
			console.log('🎯 Making API request to /api/match-buy-box');
			console.log('🎯 Request payload:', {
				asin: asin,
				sku: record.sku,
				newPrice: targetPrice,
				recordId: record.id,
				currentPrice: record.your_current_price,
				buyboxPrice: record.buybox_price,
				currentMargin: record.margin_percent_at_buybox_price
			});

			// Make API request to backend endpoint (using same auth method as other working endpoints)
			const response = await fetch('/api/match-buy-box', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					asin: asin,
					sku: record.sku,
					newPrice: targetPrice,
					recordId: record.id
				})
			});

			const result = await response.json();

			console.log('🎯 API response status:', response.status);
			console.log('🎯 API response result:', result);

			// Handle authentication errors
			if (response.status === 401) {
				console.log('🔐 Authentication error detected from match-buy-box endpoint');
				console.log('🔐 Result object for auth error:', result);

				// Instead of redirecting to login, show a helpful error message
				// since this seems to be a backend issue rather than actual session expiry
				showErrorToast(
					'Authentication Issue',
					'The Match Buy Box endpoint is having authentication issues. Try refreshing the page, or contact support if the problem persists.',
					10000
				);

				// Store the error result for debugging
				matchBuyBoxResults.set(asin, {
					success: false,
					timestamp: new Date(),
					targetPrice: targetPrice,
					error: 'Authentication error from backend endpoint',
					status: 401
				});
				matchBuyBoxResults = matchBuyBoxResults; // Trigger reactivity

				return;
			}

			if (result.success) {
				// Store result in the same format as before
				matchBuyBoxResults.set(asin, {
					success: true,
					timestamp: new Date(),
					targetPrice: targetPrice,
					safetyMargin: projectedMargin || 0,
					projectedMargin: projectedMargin,
					feedId: result.feedId,
					newPrice: targetPrice,
					message: result.message
				});

				console.log(`✅ Match Buy Box successful for ASIN: ${asin}`, result);

				// Start feed monitoring if we got a feedId
				if (result.feedId) {
					console.log(`📡 Starting feed monitoring for feed ID: ${result.feedId}`);

					// Initialize feed status tracking
					feedStatusChecks.set(result.feedId, {
						success: true,
						feedId: result.feedId,
						status: 'SUBMITTED',
						userStatus: 'Submitted for Processing',
						statusClass: 'bg-blue-100 text-blue-800',
						isComplete: false,
						needsAttention: false,
						lastChecked: new Date().toISOString(),
						sku: record.sku,
						asin: asin,
						recordId: record.id
					});
					feedStatusChecks = feedStatusChecks; // Trigger reactivity

					// Start auto-monitoring if not already running
					if (!feedStatusInterval) {
						startFeedStatusMonitoring();
					}

					// Do an immediate status check after a short delay
					setTimeout(() => {
						if (result.feedId) {
							checkFeedStatus(result.feedId, record.id, record.sku, asin);
						}
					}, 5000);
				}

				// Show success notification with feed-specific information
				if (result.feedId) {
					showSuccessToast(
						'Match Buy Box Feed Submitted!',
						`ASIN: ${asin} | SKU: ${record.sku} | Price: £${targetPrice} | Feed ID: ${result.feedId}`,
						8000
					);
				} else {
					showSuccessToast(
						'Match Buy Box Successful!',
						`ASIN: ${asin} | Price: £${targetPrice} | Margin: ${projectedMargin?.toFixed(2) || 'Unknown'}%`,
						6000
					);
				}
			} else if (result.error === 'MARGIN_TOO_LOW' && result.requiresConfirmation) {
				// Show confirmation modal for low margin
				console.log('⚠️ Margin too low, showing confirmation modal');
				showMarginConfirmationModal(asin, targetPrice, result);
			} else {
				console.error(`❌ Match Buy Box failed for ASIN: ${asin}`, result);

				// Show specific error based on type
				const errorMessage = result.error || result.message;
				if (errorMessage?.includes('Missing required Amazon API credentials')) {
					showErrorToast(
						'Amazon API Not Configured',
						'Amazon API credentials not configured. Please contact your administrator.',
						10000
					);
				} else {
					showErrorToast(
						'Match Buy Box Failed',
						`ASIN: ${asin} | Error: ${errorMessage || 'Unknown error'}`,
						8000
					);
				}
			}
		} catch (error) {
			console.error(`🚨 Match Buy Box error for ASIN: ${asin}:`, error);

			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			matchBuyBoxResults.set(asin, {
				success: false,
				timestamp: new Date(),
				targetPrice: targetPrice,
				safetyMargin: safetyMarginPercent,
				error: errorMessage,
				status: 0
			});

			matchBuyBoxResults = matchBuyBoxResults; // Trigger reactivity

			// Show specific error based on type
			// First check if this is a session expiry that requires redirect
			if (handleAuthError(error, 'Match Buy Box')) {
				return; // Session auth error handled, exit early
			}

			if (errorMessage.includes('Missing required Amazon API credentials')) {
				showErrorToast(
					'Amazon API Not Configured',
					'Please contact your administrator to set up Amazon API credentials.',
					10000
				);
			} else if (
				errorMessage.includes('HTTP 401') ||
				errorMessage.includes('Authentication required') ||
				errorMessage.includes('Session expired')
			) {
				showErrorToast(
					'Authentication Error',
					'There was an authentication issue with the API request. Please try refreshing the page.',
					8000
				);
			} else if (errorMessage.includes('HTTP 429') || errorMessage.includes('rate limit')) {
				showWarningToast(
					'Rate Limit Exceeded',
					'Too many requests. Please wait a few minutes before trying again.',
					6000
				);
			} else {
				showErrorToast('Match Buy Box Error', `ASIN: ${asin} | Error: ${errorMessage}`, 8000);
			}
		} finally {
			matchBuyBoxInProgress.delete(asin);
			matchBuyBoxInProgress = matchBuyBoxInProgress; // Trigger reactivity
		}
	}

	/**
	 * Show margin confirmation modal for low margin updates
	 */
	function showMarginConfirmationModal(asin: string, targetPrice: number, validationResult: any) {
		const modalData = {
			asin,
			targetPrice,
			currentMargin: validationResult.currentMargin,
			newMargin: validationResult.newMargin,
			message: validationResult.message
		};

		// Show modal
		marginConfirmationModal = { show: true, data: modalData };
	}

	/**
	 * Close margin confirmation modal
	 */
	function closeMarginModal() {
		marginConfirmationModal = { show: false, data: null };
	}

	/**
	 * Confirm low margin update - proceed anyway
	 */
	/**
	 * Fetch current rate limiter status
	 */
	async function fetchRateLimiterStatus() {
		try {
			const response = await fetch('/api/rate-limiter-status');
			if (response.ok) {
				const data = await response.json();
				if (data.success) {
					rateLimiterStatus = data.rateLimiter;
				}
			}
		} catch (error) {
			console.error('Failed to fetch rate limiter status:', error);
		}
	}

	/**
	 * Confirm low margin update after user acknowledges the warning
	 */
	async function confirmLowMarginUpdate() {
		if (!marginConfirmationModal.data) return;

		const { asin, targetPrice }: { asin: string; targetPrice: number } =
			marginConfirmationModal.data;

		// Close modal first
		closeMarginModal();

		// Find the record for this ASIN
		const record = filteredData.find((r) => r.asin === asin);
		if (!record) {
			showErrorToast('Error', 'Record not found');
			return;
		}

		try {
			// Make API request with confirmation flag
			const response = await fetch('/api/match-buy-box', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					asin: asin,
					sku: record.sku,
					newPrice: targetPrice,
					recordId: record.id,
					confirmLowMargin: true // This flag tells the API to proceed despite low margin
				})
			});

			const result = await response.json();

			if (result.success) {
				showSuccessToast(
					'Price Updated (Low Margin)',
					`Price updated to £${targetPrice.toFixed(2)} for ${record.sku} - Margin below 10%`,
					8000
				);
				// Refresh data
				await loadBuyBoxData();
			} else {
				showErrorToast('Update Failed', result.message || 'Failed to update price');
			}
		} catch (error) {
			showErrorToast('Update Failed', 'Network error occurred');
		}
	}

	/**
	 * Toggle test mode and load appropriate data
	 */
	async function toggleTestMode(): Promise<void> {
		testMode = !testMode;

		if (testMode) {
			console.log('🧪 Switching to test mode - loading test scenarios');

			// Load test scenario data
			const testData = createTestScenario();
			buyboxData = testData;
			allRawData = [...testData];

			calculateSummaryStats();
			applyFilters();

			console.log('✅ Test mode activated with sample data');
		} else {
			console.log('📊 Switching back to production data');

			// Reload production data
			await refreshData();
		}
	}

	// Initialize and load data
	onMount(async () => {
		await refreshData();

		// Initial rate limiter status fetch
		await fetchRateLimiterStatus();

		// Start feed monitoring if there are any pending feeds
		if (feedStatusChecks.size > 0) {
			startFeedStatusMonitoring();
		}

		// Poll rate limiter status every 5 seconds
		rateLimiterInterval = setInterval(fetchRateLimiterStatus, 5000);
	});

	// Cleanup on component unmount
	onDestroy(() => {
		stopFeedStatusMonitoring();

		// Clear rate limiter polling interval
		if (rateLimiterInterval) {
			clearInterval(rateLimiterInterval);
			rateLimiterInterval = null;
		}
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
			// Use retry limit if provided, otherwise use limit high enough for all 3700+ records
			const currentLimit = retryLimit || 4000; // Increased to handle all buybox_data records

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

	/**
	 * Format last price update information with relative time, source, and price change
	 */
	function formatLastUpdate(
		sku: BuyBoxData
	): { text: string; class: string; tooltip: string } | null {
		if (!sku.last_price_update || !sku.update_source) {
			return null;
		}

		const updateTime = new Date(sku.last_price_update);
		const now = new Date();
		const diffMs = now.getTime() - updateTime.getTime();
		const diffMinutes = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		let timeText: string;
		let cssClass: string;

		if (diffMinutes < 60) {
			// Less than 1 hour - show minutes, green
			timeText = `${diffMinutes}m ago`;
			cssClass = 'text-xs text-green-600 font-medium';
		} else if (diffHours < 24) {
			// Less than 24 hours - show hours, blue
			timeText = `${diffHours}h ago`;
			cssClass = 'text-xs text-blue-600 font-medium';
		} else if (diffDays < 7) {
			// Less than 7 days - show days, gray
			timeText = `${diffDays}d ago`;
			cssClass = 'text-xs text-gray-600';
		} else {
			// Older than 7 days - show date, light gray
			timeText = updateTime.toLocaleDateString();
			cssClass = 'text-xs text-gray-400';
		}

		// Add source information
		const sourceText =
			sku.update_source === 'match_buy_box' ? 'via UI' : `via ${sku.update_source}`;

		return {
			text: `${timeText} ${sourceText}`,
			class: cssClass,
			tooltip: `Last price update: ${updateTime.toLocaleString()} via ${sku.update_source}`
		};
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
		if (searchTerm.trim()) {
			const query = searchTerm.toLowerCase().trim();
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
			case 'small_gap_losers':
				filtered = filtered.filter(
					(item) => {
						if (item.is_winner) return false;
						
						// Try to get price_gap from the field, or calculate it
						let gap = item.price_gap;
						if (!gap && item.your_current_price && (item.buybox_price || item.price)) {
							gap = item.your_current_price - (item.buybox_price || item.price);
						}
						
						return gap && gap > 0 && gap <= 0.1;
					}
				);
				break;
			case 'opportunities':
				filtered = filtered.filter(
					(item) =>
						!item.is_winner &&
						item.margin_percent_at_buybox_price !== null &&
						item.margin_percent_at_buybox_price > 0
				);
				break;
			case 'opportunities_high_margin':
				filtered = filtered.filter(
					(item) =>
						!item.is_winner &&
						item.margin_percent_at_buybox_price !== null &&
						item.margin_percent_at_buybox_price >= 10
				);
				break;
			case 'opportunities_low_margin':
				filtered = filtered.filter(
					(item) =>
						!item.is_winner &&
						item.margin_percent_at_buybox_price !== null &&
						item.margin_percent_at_buybox_price > 0 &&
						item.margin_percent_at_buybox_price < 10
				);
				break;
			case 'not_profitable':
				filtered = filtered.filter(
					(item) =>
						!item.is_winner &&
						item.margin_percent_at_buybox_price !== null &&
						item.margin_percent_at_buybox_price < 0
				);
				break;
			case 'match_buybox':
				filtered = filtered.filter((item) => item.recommended_action === 'match_buybox');
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
			case 'price_gap_asc':
				// Sort by smallest price gap first - shows easiest wins for buy box losers
				filtered.sort((a, b) => (a.price_gap || 0) - (b.price_gap || 0));
				break;
			case 'price_gap_desc':
				// Sort by largest price gap first
				filtered.sort((a, b) => (b.price_gap || 0) - (a.price_gap || 0));
				break;
			case 'sku_asc':
				filtered.sort((a, b) => a.sku.localeCompare(b.sku));
				break;
			case 'sku_desc':
				filtered.sort((a, b) => b.sku.localeCompare(a.sku));
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

	// Track the previous filter state to detect actual changes
	let previousFilterState = {
		searchTerm: '',
		categoryFilter: 'all',
		shippingFilter: 'all',
		showOnlyWithMarginData: false,
		minProfitFilter: 0,
		minMarginFilter: 0,
		showLatestOnly: false
	};

	// Update filter state when individual filters change
	$: filterState = {
		searchTerm,
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
		(filterState.searchTerm !== previousFilterState.searchTerm ||
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

	// Update total results based on filtered data
	$: totalResults = filteredData.length;

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
		searchTerm = '';
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
			searchTerm !== '' ||
			categoryFilter !== 'all' ||
			shippingFilter !== 'all' ||
			minProfitFilter > 0 ||
			minMarginFilter > 0 ||
			showOnlyWithMarginData ||
			activeCardFilter !== '' ||
			activePresetFilter !== '';

		console.log('🔍 Active filters check:', {
			searchTerm,
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

	// New filter event handlers for FilterSidebar
	function handleFilterChange(event: CustomEvent) {
		const { filterType, value } = event.detail;

		// Reset active states when user manually changes filters
		activeCardFilter = '';
		activePresetFilter = '';

		switch (filterType) {
			case 'searchTerm':
				searchTerm = value;
				break;
			case 'categoryFilter':
				categoryFilter = value;
				break;
			case 'shippingFilter':
				shippingFilter = value;
				break;
			case 'dateRange':
				dateRange = value;
				break;
			case 'minProfitFilter':
				minProfitFilter = value;
				break;
			case 'minMarginFilter':
				minMarginFilter = value;
				break;
			case 'showLatestOnly':
				showLatestOnly = value;
				break;
			case 'sortBy':
				sortBy = value;
				break;
		}

		applyFilters();
		checkActiveFilters();
	}

	function handleFilterPresetApply(event: CustomEvent) {
		const preset = event.detail;
		applyFilterPreset(preset);
	}

	function handleClearFilters() {
		resetAllFilters();
	} // Handle summary card clicks with improved feedback
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

		if (selectedProducts.length === 0) {
			showWarningToast('No Selection', 'No products selected for bulk update.');
			return;
		}

		// Filter for products that have buy box recommendations
		const eligibleProducts = selectedProducts.filter((product) => {
			const targetPrice =
				product.buybox_price && product.buybox_price > 0
					? product.buybox_price
					: product.competitor_price && product.competitor_price > 0
						? product.competitor_price
						: 0;
			return targetPrice > 0 && product.recommended_action === 'match_buybox';
		});

		if (eligibleProducts.length === 0) {
			alert(
				`None of the ${selectedProducts.length} selected products are eligible for automatic price matching.\n\nProducts must have:\n- Valid buy box price data\n- "Match Buy Box" recommendation`
			);
			return;
		}

		const message =
			`🎯 Bulk Match Buy Box\n\n` +
			`Selected: ${selectedProducts.length} products\n` +
			`Eligible: ${eligibleProducts.length} products\n\n` +
			`This will attempt to match buy box prices for all eligible products.\n` +
			`Each product will be validated for the 10% minimum margin requirement.\n\n` +
			`Continue with bulk price updates?`;

		if (!confirm(message)) {
			return;
		}

		// Execute bulk match buy box
		bulkMatchBuyBox(eligibleProducts);
	}

	/**
	 * Execute bulk match buy box operations with proper sequencing
	 */
	async function bulkMatchBuyBox(products: BuyBoxData[]): Promise<void> {
		console.log(`🎯 Starting bulk match buy box for ${products.length} products`);

		let successCount = 0;
		let failureCount = 0;
		let skippedCount = 0;

		// Process products sequentially to avoid overwhelming the API
		for (let i = 0; i < products.length; i++) {
			const product = products[i];
			const targetPrice =
				product.buybox_price && product.buybox_price > 0
					? product.buybox_price
					: product.competitor_price || 0;

			console.log(`🎯 Processing ${i + 1}/${products.length}: ${product.sku} -> £${targetPrice}`);

			try {
				await matchBuyBox(product.asin, targetPrice);

				// Check if it was successful
				const result = matchBuyBoxResults.get(product.asin);
				if (result?.success) {
					successCount++;
				} else if (result?.safetyRejected) {
					skippedCount++;
				} else {
					failureCount++;
				}

				// Add delay between requests to respect rate limits
				if (i < products.length - 1) {
					await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
				}
			} catch (error) {
				console.error(`Failed to process ${product.sku}:`, error);
				failureCount++;
			}
		}

		// Show summary
		const successMessage = `Bulk Match Buy Box Complete: ${successCount} successful, ${skippedCount} skipped, ${failureCount} failed`;

		if (failureCount > 0 || skippedCount > 0) {
			showWarningToast('Bulk Operation Completed', successMessage, 8000);
		} else {
			showSuccessToast('Bulk Operation Successful', successMessage, 6000);
		}

		// Clear selection after bulk operation
		clearSelection();
	}

	function bulkAddToWatchlist(): void {
		const selectedProducts = paginatedData.filter((item) => selectedItems.has(item.id));
		console.log(
			'Bulk add to watchlist:',
			selectedProducts.map((p) => p.sku)
		);
		// TODO: Implement bulk watchlist functionality
		showInfoToast(
			'Added to Watchlist',
			`${selectedProducts.length} products added to watchlist`,
			4000
		);
	}
</script>

<svelte:head>
	<title>Buy Box Manager</title>
</svelte:head>

<!-- Margin Confirmation Modal -->
{#if marginConfirmationModal.show}
	<div class="modal modal-open">
		<div class="modal-box max-w-lg">
			<h3 class="font-bold text-lg text-warning">⚠️ Low Margin Warning</h3>

			{#if marginConfirmationModal.data}
				<div class="py-4">
					<p class="mb-4">{marginConfirmationModal.data.message}</p>

					<div class="stats stats-vertical lg:stats-horizontal shadow mb-4">
						<div class="stat">
							<div class="stat-title">Current Margin</div>
							<div class="stat-value text-sm">
								{marginConfirmationModal.data.currentMargin?.toFixed(1) || 'Unknown'}%
							</div>
						</div>
						<div class="stat">
							<div class="stat-title">New Margin</div>
							<div class="stat-value text-sm text-warning">
								{marginConfirmationModal.data.newMargin?.toFixed(1) || 'Unknown'}%
							</div>
						</div>
					</div>

					<div class="alert alert-warning">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="stroke-current shrink-0 h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.732 0L3.732 19c-.77.833.192 2.5 1.732 2.5z"
							/>
						</svg>
						<span>This price update will result in a margin below 10%</span>
					</div>
				</div>

				<div class="modal-action">
					<button class="btn btn-outline" on:click={closeMarginModal}>Cancel</button>
					<button class="btn btn-warning" on:click={confirmLowMarginUpdate}>
						Proceed Anyway
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Toast Notification Container -->
{#if toastNotifications.length > 0}
	<div
		class="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 space-y-2"
		style="max-width: 500px; width: 90vw;"
	>
		{#each toastNotifications as toast (toast.id)}
			<div
				class="bg-white border-l-4 rounded-lg shadow-xl p-4 transition-all duration-300 ease-in-out transform"
				class:border-green-500={toast.type === 'success'}
				class:border-red-500={toast.type === 'error'}
				class:border-yellow-500={toast.type === 'warning'}
				class:border-blue-500={toast.type === 'info'}
				in:fade={{ duration: 300 }}
				out:fade={{ duration: 200 }}
			>
				<div class="flex items-start justify-between">
					<div class="flex-1">
						<div class="flex items-center gap-2">
							<span class="text-lg">
								{#if toast.type === 'success'}
									✅
								{:else if toast.type === 'error'}
									❌
								{:else if toast.type === 'warning'}
									⚠️
								{:else}
									ℹ️
								{/if}
							</span>
							<div
								class="font-semibold text-sm"
								class:text-green-800={toast.type === 'success'}
								class:text-red-800={toast.type === 'error'}
								class:text-yellow-800={toast.type === 'warning'}
								class:text-blue-800={toast.type === 'info'}
							>
								{toast.title}
							</div>
						</div>
						<div class="text-sm text-gray-700 mt-1 leading-tight">
							{toast.message}
						</div>
						<div class="text-xs text-gray-500 mt-2">
							{toast.timestamp.toLocaleTimeString()}
						</div>
					</div>
					<button
						on:click={() => removeToast(toast.id)}
						class="ml-3 text-gray-400 hover:text-gray-600 transition-colors"
						title="Dismiss"
						aria-label="Dismiss notification"
					>
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
								clip-rule="evenodd"
							></path>
						</svg>
					</button>
				</div>
			</div>
		{/each}
	</div>
{/if}

<!-- Main Page Layout with Filter Sidebar, Main Content, and Pricing Basket -->
<div class="flex h-screen bg-gray-50">
	<!-- Filter Sidebar (Left) -->
	<FilterSidebar
		bind:searchTerm
		bind:categoryFilter
		bind:shippingFilter
		bind:dateRange
		bind:minProfitFilter
		bind:minMarginFilter
		bind:showLatestOnly
		bind:sortBy
		bind:hasActiveFilters
		bind:activePresetFilter
		filteredCount={filteredData.length}
		totalCount={buyboxData.length}
		{categoryCounts}
		{shippingCounts}
		on:filterChange={handleFilterChange}
		on:applyPreset={handleFilterPresetApply}
		on:clearFilters={handleClearFilters}
	/>

	<!-- Main Content Area -->
	<div class="main-content flex-1 overflow-y-auto min-w-0 bg-white">
		<div class="px-4 py-3 max-w-none">
			<!-- Compact Header Section -->
			<div class="flex justify-between items-start mb-3">
				<div class="flex-1">
					<div class="flex items-center gap-3 mb-1">
						<h1 class="text-2xl font-bold">Buy Box Manager</h1>
						{#if testMode}
							<span class="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">
								🧪 SANDBOX MODE
							</span>
						{/if}
						<!-- Live Update Status Indicator (inline) -->
						{#if hasActiveUpdates}
							<div class="flex items-center gap-1 text-blue-600 text-xs" in:fade>
								<svg
									class="animate-spin h-3 w-3"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
								>
									<circle
										class="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										stroke-width="4"
									></circle>
									<path
										class="opacity-75"
										fill="currentColor"
										d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									></path>
								</svg>
								<span class="font-medium">
									{activeUpdates.length} live update{activeUpdates.length !== 1 ? 's' : ''}
								</span>
							</div>
						{/if}
						<!-- Rate Limiter Status Indicator (inline) -->
						{#if rateLimiterStatus.queueLength > 0 || rateLimiterStatus.estimatedWaitTime > 1000}
							<div class="flex items-center gap-1 text-orange-600 text-xs" in:fade>
								<svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
										clip-rule="evenodd"
									/>
								</svg>
								<span class="font-medium">
									Rate Limited ({rateLimiterStatus.queueLength} queued)
								</span>
							</div>
						{/if}
					</div>
					<p class="text-sm text-gray-600">
						{testMode
							? 'Testing environment - Safe to experiment'
							: 'Live Amazon pricing management'}
					</p>
				</div>

				<!-- Compact Action Buttons -->
				<div class="flex flex-wrap gap-2 items-start">
					<!-- Test Mode Toggle -->
					<button
						class="{testMode
							? 'bg-purple-600 hover:bg-purple-700'
							: 'bg-gray-600 hover:bg-gray-700'} text-white py-1.5 px-3 rounded text-sm flex items-center gap-1"
						on:click={toggleTestMode}
						title={testMode
							? 'Switch back to production data'
							: 'Switch to sandbox test environment'}
					>
						🧪 {testMode ? 'Test ON' : 'Test'}
					</button>

					<!-- Test API Connectivity (only show in test mode) -->
					{#if testMode}
						<button
							class="bg-orange-600 hover:bg-orange-700 text-white py-1.5 px-3 rounded text-sm flex items-center gap-1"
							on:click={testAmazonAPIConnectivity}
							title="Test Amazon SP-API connectivity in sandbox"
						>
							🔗 Test API
						</button>
					{/if}

					<button
						class="bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-3 rounded text-sm"
						on:click={refreshData}
					>
						{testMode ? 'Reload' : 'Refresh'}
					</button>

					{#if !testMode}
						<button
							class="bg-green-600 hover:bg-green-700 text-white py-1.5 px-3 rounded text-sm flex items-center gap-1"
							on:click={bulkScanTop100}
						>
							🚀 Top 100
						</button>
					{/if}

					{#if customPrices.size > 0}
						<button
							class="bg-yellow-600 hover:bg-yellow-700 text-white py-1.5 px-3 rounded text-sm flex items-center gap-1"
							on:click={clearAllCustomPrices}
							title="Clear all custom prices"
						>
							🗑️ Clear ({customPrices.size})
						</button>
					{/if}

					{#if !testMode}
						<a
							href="/buy-box-monitor/jobs"
							class="bg-gray-600 hover:bg-gray-700 text-white py-1.5 px-3 rounded text-sm"
						>
							Jobs
						</a>
					{/if}
				</div>
			</div>

			<!-- Safety Margin Control (compact inline version) -->
			{#if !testMode}
				<div
					class="flex items-center gap-2 bg-green-50 border border-green-200 rounded px-3 py-1.5 mb-3"
				>
					<label for="safety-margin" class="text-xs font-medium text-green-800">
						🛡️ Safety Margin:
					</label>
					<select
						id="safety-margin"
						bind:value={safetyMarginPercent}
						class="bg-white border border-green-300 rounded px-2 py-0.5 text-xs text-green-800 focus:outline-none focus:ring-1 focus:ring-green-500"
					>
						<option value={5}>5%</option>
						<option value={10}>10%</option>
						<option value={15}>15%</option>
						<option value={20}>20%</option>
					</select>
					<span class="text-xs text-green-600">Price buffer (10% margin minimum)</span>
				</div>
			{/if}
		</div>

		{#if errorMessage}
			<div
				class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
				role="alert"
			>
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
			<div class="bg-white border border-gray-200 rounded-lg mb-2 overflow-hidden">
				<!-- Status Header -->
				<div class="bg-gradient-to-r from-blue-50 to-green-50 px-3 py-2 border-b">
					<div class="flex justify-between items-center">
						<div class="flex items-center gap-2">
							<div class="text-sm font-medium text-gray-900">📊 Dataset Status</div>
							<div class="flex gap-1">
								{#if showLatestOnly}
									<span class="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs font-medium">
										Latest Only
									</span>
								{:else}
									<span
										class="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-xs font-medium"
									>
										Historical Data
									</span>
								{/if}
								{#if !includeNoMarginData}
									<span
										class="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs font-medium"
									>
										Optimized View
									</span>
								{/if}
							</div>
						</div>
						<button
							on:click={() => (alertsExpanded = !alertsExpanded)}
							class="text-gray-500 hover:text-gray-700 transition-colors text-xs"
						>
							{alertsExpanded ? '▼' : '▶'} Details
						</button>
					</div>

					<!-- Quick Summary -->
					<div class="mt-1 text-xs text-gray-600">
						{totalResults} products • {totalWinners} wins • {totalOpportunities} opportunities • £{totalPotentialProfit.toFixed(
							0
						)} potential
					</div>
				</div>

				<!-- Expandable Details -->
				{#if alertsExpanded}
					<div class="p-3 space-y-2 bg-gray-50">
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

		<!-- Feed Status Monitor -->
		{#if feedStatusChecks.size > 0}
			<div class="bg-white border border-gray-200 rounded-lg mb-4 overflow-hidden">
				<div class="bg-gradient-to-r from-orange-50 to-blue-50 px-4 py-3 border-b">
					<div class="flex justify-between items-center">
						<div class="flex items-center gap-3">
							<div class="text-lg font-medium text-gray-900">📡 Feed Status Monitor</div>
							<div class="flex gap-2">
								<span class="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium">
									{Array.from(feedStatusChecks.values()).filter((f) => f.success && !f.isComplete)
										.length} Active
								</span>
								<span class="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
									{Array.from(feedStatusChecks.values()).filter(
										(f) => f.success && f.isComplete && !f.needsAttention
									).length} Completed
								</span>
								{#if Array.from(feedStatusChecks.values()).filter((f) => f.success && f.isComplete && f.needsAttention).length > 0}
									<span class="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
										{Array.from(feedStatusChecks.values()).filter(
											(f) => f.success && f.isComplete && f.needsAttention
										).length} Issues
									</span>
								{/if}
							</div>
						</div>
						<div class="flex gap-2">
							{#if feedStatusInterval}
								<button
									on:click={stopFeedStatusMonitoring}
									class="text-orange-600 hover:text-orange-800 text-sm px-2 py-1 border border-orange-300 rounded"
								>
									⏸️ Stop Monitoring
								</button>
							{:else}
								<button
									on:click={startFeedStatusMonitoring}
									class="text-green-600 hover:text-green-800 text-sm px-2 py-1 border border-green-300 rounded"
								>
									▶️ Start Monitoring
								</button>
							{/if}
						</div>
					</div>
				</div>

				<div class="overflow-x-auto">
					<table class="min-w-full">
						<thead class="bg-gray-50">
							<tr class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								<th class="py-2 px-3">Feed ID</th>
								<th class="py-2 px-3">SKU</th>
								<th class="py-2 px-3">ASIN</th>
								<th class="py-2 px-3">Status</th>
								<th class="py-2 px-3">Last Checked</th>
								<th class="py-2 px-3">Actions</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{#each Array.from(feedStatusChecks.entries()) as [feedId, feedInfo]}
								{@const statusDisplay = getFeedStatusDisplay(feedId)}
								<tr class="hover:bg-gray-50">
									<td class="py-2 px-3">
										<div class="text-sm font-mono text-gray-900">{feedId}</div>
									</td>
									<td class="py-2 px-3">
										<div class="text-sm text-gray-900">{feedInfo.sku || 'N/A'}</div>
									</td>
									<td class="py-2 px-3">
										<div class="text-sm text-gray-900">{feedInfo.asin || 'N/A'}</div>
									</td>
									<td class="py-2 px-3">
										<div class="flex items-center gap-2">
											<span class="text-sm">{statusDisplay.icon}</span>
											<span
												class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {statusDisplay.class}"
											>
												{statusDisplay.status}
											</span>
										</div>
									</td>
									<td class="py-2 px-3">
										<div class="text-xs text-gray-500">{statusDisplay.lastChecked}</div>
									</td>
									<td class="py-2 px-3">
										<div class="flex gap-2">
											{#if statusDisplay.showCheckButton}
												<button
													on:click={() =>
														checkFeedStatus(feedId, feedInfo.recordId, feedInfo.sku, feedInfo.asin)}
													disabled={activeFeedChecks.has(feedId)}
													class="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
												>
													{activeFeedChecks.has(feedId) ? '🔄 Checking...' : '🔍 Check Now'}
												</button>
											{/if}
											{#if feedInfo.processingReport?.hasResults}
												<button
													class="text-green-600 hover:text-green-800 text-xs px-2 py-1 border border-green-300 rounded"
													title="Processing results available"
												>
													📋 Results
												</button>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<!-- Enhanced Summary Statistics Cards -->
		{#if !isLoading && buyboxData.length > 0}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2 mb-3">
				<!-- Winners Card -->
				<button
					on:click={() => handleSummaryCardClick('winners')}
					class={`bg-green-50 p-3 rounded-lg border hover:shadow-md transition-shadow text-left ${
						activeCardFilter === 'Buy Box Winners' ? 'ring-2 ring-green-400 bg-green-100' : ''
					}`}
				>
					<h3 class="text-xs font-medium text-gray-500 mb-1">Buy Box Won</h3>
					<p class="text-xl font-bold text-green-600">{totalWinners}</p>
					<p class="text-xs text-gray-400 leading-tight">
						{activeCardFilter === 'Buy Box Winners' ? 'Active filter' : 'Click to filter'}
					</p>
				</button>

				<!-- Opportunities Card -->
				<button
					on:click={() => handleSummaryCardClick('opportunities')}
					class={`bg-yellow-50 p-3 rounded-lg border hover:shadow-md transition-shadow text-left ${
						activeCardFilter === 'Opportunities' ? 'ring-2 ring-yellow-400 bg-yellow-100' : ''
					}`}
				>
					<h3 class="text-xs font-medium text-gray-500 mb-1">Opportunities</h3>
					<p class="text-xl font-bold text-yellow-600">{totalOpportunities}</p>
					<p class="text-xs text-gray-400 leading-tight">
						{activeCardFilter === 'Opportunities' ? 'Active filter' : 'Click to find'}
					</p>
				</button>

				<!-- Profitable Ops Card -->
				<button
					on:click={() => handleSummaryCardClick('profitable')}
					class={`bg-purple-50 p-3 rounded-lg border hover:shadow-md transition-shadow text-left ${
						activeCardFilter === 'Profitable Items' ? 'ring-2 ring-purple-400 bg-purple-100' : ''
					}`}
				>
					<h3 class="text-xs font-medium text-gray-500 mb-1">Profitable Ops</h3>
					<p class="text-xl font-bold text-purple-600">{totalProfitable}</p>
					<p class="text-xs text-gray-400 leading-tight">
						{activeCardFilter === 'Profitable Items' ? 'Active filter' : 'Click for profit'}
					</p>
				</button>

				<!-- Analyzed Card -->
				<button
					on:click={() => handleSummaryCardClick('analyzed')}
					class="bg-blue-50 p-3 rounded-lg border hover:shadow-md transition-shadow text-left"
				>
					<h3 class="text-xs font-medium text-gray-500 mb-1">Analyzed</h3>
					<p class="text-xl font-bold text-blue-600">{totalMarginAnalyzed}</p>
					<p class="text-xs text-gray-400 leading-tight">
						of {buyboxData.length} SKUs
						{#if showLatestOnly}
							<span class="block text-blue-600">(Latest)</span>
						{:else}
							<span class="block text-purple-600">(All data)</span>
						{/if}
					</p>
				</button>

				<!-- Average Profit Card -->
				<button
					on:click={() => handleSummaryCardClick('avg-profit')}
					class="bg-orange-50 p-3 rounded-lg border hover:shadow-md transition-shadow text-left"
				>
					<h3 class="text-xs font-medium text-gray-500 mb-1">Avg Profit</h3>
					<p
						class={`text-xl font-bold ${avgProfit >= 2 ? 'text-green-600' : avgProfit >= 0 ? 'text-yellow-600' : 'text-red-600'}`}
					>
						£{avgProfit.toFixed(2)}
					</p>
					<p class="text-xs text-gray-400 leading-tight">Click for high-profit</p>
				</button>

				<!-- Potential Profit Card -->
				<button
					on:click={() => handleSummaryCardClick('potential')}
					class="bg-indigo-50 p-3 rounded-lg border hover:shadow-md transition-shadow text-left"
				>
					<h3 class="text-xs font-medium text-gray-500 mb-1">Potential</h3>
					<p class="text-xl font-bold text-indigo-600">£{totalPotentialProfit.toFixed(2)}</p>
					<p class="text-xs text-gray-400 leading-tight">Click for opportunities</p>
				</button>
			</div>
		{/if}

		<!-- Results -->
		<div class="bg-white rounded-lg shadow" data-results-section>
			<!-- Top Pagination -->
			{#if totalResults > itemsPerPage}
				<div class="px-4 py-2 border-b border-gray-200 bg-gray-50">
					<div class="flex justify-between items-center">
						<div class="flex items-center space-x-4">
							<div class="text-xs text-gray-500">
								Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(
									currentPage * itemsPerPage,
									totalResults
								)} of {totalResults} results
							</div>
							<div class="flex items-center space-x-2">
								<label class="flex items-center cursor-pointer">
									<input
										type="checkbox"
										bind:checked={showCostBreakdown}
										class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
									/>
									<span class="ml-2 text-xs text-gray-600">Cost breakdown view</span>
								</label>
							</div>
						</div>
						<div class="flex space-x-1">
							<button
								class="px-2 py-1 rounded border disabled:opacity-50 bg-white hover:bg-gray-50 text-xs"
								disabled={currentPage === 1}
								on:click={() => changePage(currentPage - 1, false)}
							>
								Previous
							</button>

							{#each Array(Math.min(5, Math.ceil(totalResults / itemsPerPage))) as _, i}
								{@const pageNumber = Math.max(1, currentPage - 2) + i}
								{#if pageNumber <= Math.ceil(totalResults / itemsPerPage)}
									<button
										class={`px-2 py-1 rounded border text-xs ${currentPage === pageNumber ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}
										on:click={() => changePage(pageNumber, false)}
									>
										{pageNumber}
									</button>
								{/if}
							{/each}

							<button
								class="px-2 py-1 rounded border disabled:opacity-50 bg-white hover:bg-gray-50 text-xs"
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
				<div class="p-6 text-center">
					<div class="flex flex-col items-center gap-4">
						<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
						<p class="text-lg font-medium">Loading buy box data...</p>
						<p class="text-sm text-gray-500">This may take a few moments for large datasets</p>
					</div>
				</div>
			{:else if paginatedData.length === 0}
				<div class="p-6 text-center">
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
										🎯 Bulk Match Buy Box
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

					<table class="min-w-full table-fixed">
						<thead class="bg-gray-50">
							<tr>
								<th class="py-3 px-3 text-left w-12">
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
									class="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3 min-w-0"
									>Product</th
								>
								<th
									class="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48 min-w-0"
									>Price Analysis</th
								>
								{#if showCostBreakdown}
									<th
										class="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48 min-w-0"
										>Cost Breakdown</th
									>
								{/if}
								<th
									class="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3 min-w-0"
									>Margin Analysis</th
								>
								<th
									class="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32"
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
									${livePricingUpdates.get(result.id)?.isUpdating ? 'updating-row' : ''}
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
									<td class="py-2 px-4">
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
									<td class="py-2 px-4">
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

											<!-- Last Price Update Info -->
											{#if formatLastUpdate(result)}
												{@const updateInfo = formatLastUpdate(result)!}
												<div class="{updateInfo.class} mt-0.5" title={updateInfo.tooltip}>
													📅 Last updated: {updateInfo.text}
												</div>
											{/if}

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
									{#if showCostBreakdown}
										<td class="py-2 px-4">
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
									{/if}

									<!-- Margin Analysis -->
									<td class="py-2 px-4">
										<div class="text-sm space-y-1">
											<!-- Recommendation Badge -->
											{#if !result.price && !result.competitor_price}
												<!-- No competition detected -->
												<span
													class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800 mb-2"
												>
													🏆 No Competition
												</span>
											{:else if result.recommended_action === 'not_profitable' && !result.price && !result.competitor_price}
												<!-- Not profitable but no competition - suggest investigation -->
												<span
													class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800 mb-2"
												>
													🔍 Investigate
												</span>
											{:else if result.recommended_action}
												<span
													class={`inline-flex items-center px-2 py-1 rounded text-xs font-medium mb-2
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
												<span class="text-gray-400 text-xs mb-2 block">No recommendation</span>
											{/if}

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
										</div>
									</td>

									<!-- Actions -->
									<td class="py-2 px-4">
										<div class="flex flex-col gap-2">
											<!-- Data Age Indicator -->
											{#if result.captured_at}
												{@const freshness = getDataFreshness(result.captured_at)}
												<span
													class="inline-flex items-center px-2 py-1 rounded text-xs font-medium {freshness.class} self-start"
													title={freshness.description}
												>
													{freshness.badge}
												</span>
											{:else}
												<span class="text-gray-400 text-xs">Unknown</span>
											{/if}
											{#if testMode}
												<!-- Test Mode Actions -->
												{#if result.recommended_action === 'match_buybox' && result.buybox_price && result.buybox_price > 0}
													{@const isTestInProgress = testInProgress.has(result.asin)}
													{@const testResult = testResults.get(result.asin)}

													<button
														class="{isTestInProgress
															? 'bg-purple-400 cursor-not-allowed'
															: 'bg-purple-600 hover:bg-purple-700'} text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
														disabled={isTestInProgress}
														on:click={() => testMatchBuyBox(result.asin, result.buybox_price!)}
														title="Test Match Buy Box in sandbox environment"
													>
														{#if isTestInProgress}
															<svg class="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
																<circle
																	class="opacity-25"
																	cx="12"
																	cy="12"
																	r="10"
																	stroke="currentColor"
																	stroke-width="4"
																></circle>
																<path
																	class="opacity-75"
																	fill="currentColor"
																	d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
																></path>
															</svg>
															Testing...
														{:else}
															🧪 Test Match Buy Box
														{/if}
													</button>

													<!-- Test Result Display -->
													{#if testResult}
														<div class="text-xs mt-1">
															{#if testResult.success}
																<span class="text-green-600">✅ Test Passed</span>
															{:else}
																<span class="text-red-600">❌ Test Failed</span>
															{/if}
															<div class="text-gray-500">
																{testResult.timestamp.toLocaleTimeString()}
															</div>
														</div>
													{/if}
												{:else}
													<span class="text-gray-400 text-xs">No test action available</span>
												{/if}
											{:else}
												<!-- Production Mode Actions - Stacked Layout -->
												<div class="flex flex-col gap-1">
													<!-- Update Live Price Button -->
													{#if result.id}
														{@const buttonState = getUpdateButtonState(result.id)}
														<button
															class="px-2 py-1 rounded text-xs font-medium transition-colors {buttonState.class} flex items-center gap-1 w-full justify-center"
															disabled={buttonState.disabled}
															on:click={() => updateLivePrice(result)}
															title={buttonState.error ||
																'Update pricing data with latest Amazon SP-API data'}
														>
															{#if buttonState.isUpdating}
																<svg
																	class="animate-spin h-3 w-3 text-white"
																	fill="none"
																	viewBox="0 0 24 24"
																>
																	<circle
																		class="opacity-25"
																		cx="12"
																		cy="12"
																		r="10"
																		stroke="currentColor"
																		stroke-width="4"
																	></circle>
																	<path
																		class="opacity-75"
																		fill="currentColor"
																		d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
																	></path>
																</svg>
															{/if}
															<span class="whitespace-nowrap">{buttonState.text}</span>
														</button>
													{/if}

													<!-- Add to Basket Button (UI Demo) -->
													{#if result}
														{@const targetPrice = (() => {
															let price = 0;
															if (result.buybox_price && result.buybox_price > 0) {
																price = result.buybox_price;
															} else if (result.competitor_price && result.competitor_price > 0) {
																price = result.competitor_price;
															}
															return Math.round(price * 100) / 100;
														})()}
														{@const isInProgress = matchBuyBoxInProgress.has(result.asin)}

														<button
															class="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 w-full justify-center"
															disabled={isInProgress || targetPrice <= 0}
															on:click={() => {
																// Demo: Add to basket UI (not connected to real backend yet)
																basketActions.addItem({
																	sku: result.sku,
																	asin: result.asin,
																	itemName: result.item_name || 'Product Name Not Available',
																	currentPrice: result.your_current_price || 0,
																	targetPrice: targetPrice,
																	priceChangeAmount: targetPrice - (result.your_current_price || 0),
																	marginAtTarget: result.margin_percent_at_buybox_price || 0,
																	reason: `Match buy box price: £${targetPrice.toFixed(2)}`,
																	status: 'pending'
																});

																// Show success feedback
																showToast(
																	'success',
																	'Added to Basket',
																	`${result.sku} queued for price update to £${targetPrice.toFixed(2)}`
																);
															}}
															title="Add to pricing basket for bulk update"
														>
															{#if isInProgress}
																<div
																	class="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full"
																></div>
																Processing...
															{:else}
																🛒 Add to Basket
															{/if}
														</button>
													{/if}

													<!-- View Details Link -->
													<a
														href="/buy-box-monitor?query={encodeURIComponent(
															result.sku || result.asin
														)}"
														target="_blank"
														rel="noopener noreferrer"
														class="text-blue-600 hover:text-blue-800 underline text-xs text-center w-full block py-1"
													>
														View Details
													</a>

													<!-- Live Price Update Error Display -->
													{#if result.id}
														{@const buttonState = getUpdateButtonState(result.id)}
														{#if buttonState.error}
															<div class="text-xs text-red-600" title={buttonState.error}>
																⚠️ {buttonState.error.length > 30
																	? buttonState.error.substring(0, 30) + '...'
																	: buttonState.error}
															</div>
														{/if}
													{/if}
												</div>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Bottom Pagination -->
				{#if totalResults > itemsPerPage}
					<div class="px-4 py-2 border-t border-gray-200 bg-gray-50">
						<div class="flex justify-between items-center">
							<div class="text-xs text-gray-500">
								Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(
									currentPage * itemsPerPage,
									totalResults
								)} of {totalResults} results
							</div>
							<div class="flex space-x-1">
								<button
									class="px-2 py-1 rounded border disabled:opacity-50 bg-white hover:bg-gray-50 text-xs"
									disabled={currentPage === 1}
									on:click={() => changePage(currentPage - 1)}
								>
									Previous
								</button>

								{#each Array(Math.min(5, Math.ceil(totalResults / itemsPerPage))) as _, i}
									{@const pageNumber = Math.max(1, currentPage - 2) + i}
									{#if pageNumber <= Math.ceil(totalResults / itemsPerPage)}
										<button
											class={`px-2 py-1 rounded border text-xs ${currentPage === pageNumber ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}
											on:click={() => changePage(pageNumber)}
										>
											{pageNumber}
										</button>
									{/if}
								{/each}

								<button
									class="px-2 py-1 rounded border disabled:opacity-50 bg-white hover:bg-gray-50 text-xs"
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

	<!-- Persistent Pricing Basket Sidebar -->
	<BasketSidebar />
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

	/* Row being updated - pulse effect */
	:global(.updating-row) {
		background-color: #dbeafe;
		border-left: 4px solid #3b82f6;
		animation: pulse-update 2s ease-in-out infinite;
	}

	@keyframes pulse-update {
		0%,
		100% {
			background-color: #dbeafe;
		}
		50% {
			background-color: #bfdbfe;
		}
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

	/* Pricing Basket Layout Adjustments */
	:global(.main-content) {
		transition: margin-right 0.3s ease-in-out;
		/* Remove width constraints to use full available space */
	}

	:global(.main-content.basket-open) {
		margin-right: 26rem !important; /* Extra space for sidebar + padding */
		margin-left: 2rem;
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
