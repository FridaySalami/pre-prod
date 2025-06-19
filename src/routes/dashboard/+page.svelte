<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { userSession } from '$lib/sessionStore';
	import { showToast } from '$lib/toastStore';
	import ShipmentChart from '$lib/ShipmentChart.svelte';
	import ErrorBoundary from '$lib/ErrorBoundary.svelte';

	// Start with session as undefined (unknown)
	let session: any = undefined;
	let dashboardInitialized = false;

	// Reset dashboard state on each page load
	function resetDashboardState() {
		dashboardInitialized = false;
		loading = true;
		error = null;
		dashboardReady = false;
		apiResponsesComplete = false;
		dataValidationPassed = false;
		minimumLoadTimeElapsed = false;
		linnworksApiCompleted = false;
	}

	const unsubscribe = userSession.subscribe((s) => {
		// Only run session logic in the browser
		if (!browser) return;

		console.log(
			'📱 Dashboard session update:',
			s ? 'session exists' : s === null ? 'no session' : 'undefined'
		);
		session = s;

		// Handle session changes and initialize dashboard
		if (session !== undefined && !dashboardInitialized) {
			console.log('✅ Session resolved, proceeding with dashboard');
			if (session === null) {
				console.log('❌ No session found, redirecting to login');
				goto('/login');
			} else if (session) {
				console.log('🚀 Valid session found, initializing dashboard');
				dashboardInitialized = true;
				initializeDashboard();
			}
		}
	});

	// Loading states for different data sources
	let loading = true;
	let error: string | null = null;
	let hasGlobalError = false;
	let retryCount = 0;
	const MAX_RETRIES = 3;

	// Enhanced loading states tracking different API calls
	let loadingStates = {
		metrics: true,
		linnworks: true,
		financial: true,
		schedules: true,
		employees: true
	};

	let loadingMessage = 'Loading dashboard...';

	// Progress tracking for visual indicators
	let loadingProgress: Record<string, number> = {
		metrics: 0,
		linnworks: 0,
		financial: 0,
		schedules: 0,
		employees: 0
	};

	// Separate state for the Linnworks status message
	let showLinnworksStatus = false;
	// Enhanced loading features
	let showDataPreview = false;
	let dashboardReady = false; // New flag to control when dashboard shows
	let shipmentChartRef: any; // Reference to the ShipmentChart component

	// Animate progress bars smoothly
	function animateProgress(metric: string, targetValue: number, duration: number = 300) {
		const startValue = loadingProgress[metric];
		const increment = (targetValue - startValue) / (duration / 16); // 60fps

		const animate = () => {
			if (loadingProgress[metric] < targetValue) {
				loadingProgress[metric] = Math.min(loadingProgress[metric] + increment, targetValue);
				requestAnimationFrame(animate);
			}
		};
		animate();
	}

	function updateLoadingMessage() {
		const loadingItems = Object.entries(loadingStates)
			.filter(([_, isLoading]) => isLoading)
			.map(([key, _]) => key);

		if (loadingItems.length === 0) {
			loadingMessage = 'All systems ready - Loading dashboard...';
		} else if (loadingItems.length === 1) {
			const item = loadingItems[0];
			const contextMessages: Record<string, string> = {
				metrics: 'Setting up dashboard metrics and calculations',
				employees: 'Retrieving employee data and schedules',
				schedules: 'Loading schedule information and availability',
				linnworks: 'Connecting to Linnworks API for order data',
				financial: 'Processing financial metrics and sales data'
			};
			loadingMessage = contextMessages[item] || `Loading ${item}...`;
		} else {
			loadingMessage = `Loading multiple components: ${loadingItems.join(', ')}`;
		}
	}

	// Enhanced error handling
	function handleError(err: unknown, context: string): void {
		console.error(`Error in ${context}:`, err);
		const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
		error = `${context}: ${errorMessage}`;
		showToast(`Failed to ${context.toLowerCase()}: ${errorMessage}`, 'error');
	}

	function handleGlobalError(event: CustomEvent) {
		console.error('Global error caught:', event.detail.error);
		hasGlobalError = true;
		error = 'A critical error occurred. Please refresh the page.';
	}

	async function retryOperation(
		operation: () => Promise<void>,
		operationName: string
	): Promise<void> {
		try {
			await operation();
			retryCount = 0; // Reset on success
		} catch (err) {
			retryCount++;
			if (retryCount < MAX_RETRIES) {
				showToast(`Retrying ${operationName} (${retryCount}/${MAX_RETRIES})...`, 'info');
				setTimeout(() => retryOperation(operation, operationName), 1000 * retryCount);
			} else {
				handleError(err, operationName);
			}
		}
	}

	// Clear cache and refresh dashboard data
	async function clearCacheAndRefresh() {
		console.log('🗑️ Clearing cache and refreshing dashboard data...');
		showToast('Clearing cache and refreshing data...', 'info');

		try {
			// Reset all dashboard state
			resetDashboardState();

			// Mark that we need to re-initialize
			dashboardInitialized = false;

			// Clear any cached data by forcing a fresh initialization
			await initializeDashboard();

			showToast('Data refreshed successfully!', 'success');
		} catch (err) {
			console.error('❌ Failed to refresh data:', err);
			handleError(err, 'refresh data');
		}
	}

	// Simulate the data loading phases that ShipmentChart goes through
	async function initializeDashboard() {
		try {
			loading = true;
			error = null;

			// Reset loading states
			loadingStates = {
				metrics: true,
				linnworks: true,
				financial: true,
				schedules: true,
				employees: true
			};

			updateLoadingMessage();

			// Start preloading the dashboard data in the background
			// This creates a hidden ShipmentChart that loads data while we show loading screen
			preloadDashboardData();

			// We simulate the phases for UX while real data loads in background

			// Phase 1: Basic metrics setup (fast)
			setTimeout(() => {
				loadingStates.metrics = false;
				animateProgress('metrics', 100, 200);
				updateLoadingMessage();
			}, 300);

			// Phase 2: Employee data (medium)
			setTimeout(() => {
				loadingStates.employees = false;
				animateProgress('employees', 100, 250);
				updateLoadingMessage();
			}, 600);

			// Phase 3: Schedule data (medium)
			setTimeout(() => {
				loadingStates.schedules = false;
				animateProgress('schedules', 100, 300);
				updateLoadingMessage();
			}, 900);

			// Phase 4: Linnworks API - will be completed when API actually finishes
			// (handled by the comprehensive validation system)

			// Phase 5: Financial data (slow) - wait a bit longer since Linnworks timing is variable
			setTimeout(() => {
				loadingStates.financial = false;
				animateProgress('financial', 100, 350);
				updateLoadingMessage();

				// Financial loading is complete, check if ready to render
				checkIfReadyToRender();
			}, 3000); // Increased timeout to give more time for Linnworks
		} catch (err) {
			handleError(err, 'initialize dashboard');
			// Ensure we don't get stuck in loading state
			apiResponsesComplete = true;
			dataValidationPassed = true;
			dashboardReady = true;
			loading = false;
		}
	}

	// Track if Linnworks API has completed its paginated fetch
	let linnworksApiCompleted = false;
	let linnworksDataQuality = { totalOrders: 0, expectedMinimum: 100 }; // Track data quality - expect at least 100 orders for a complete week
	let activePollingInterval: NodeJS.Timeout | null = null; // Track active polling for cleanup

	// Enhanced validation flags
	let dataValidationPassed = false;
	let minimumLoadTimeElapsed = false;
	let apiResponsesComplete = false;

	// Comprehensive data validation
	function validateDataCompleteness(linnworksData: any, financialData: any): boolean {
		console.log('🔍 Running comprehensive data validation...');

		// Check 1: Basic structure validation
		if (
			!linnworksData ||
			!linnworksData.dailyOrders ||
			!financialData ||
			!financialData.dailyData
		) {
			console.log('❌ Validation failed: Missing basic data structure');
			return false;
		}

		// Check 2: Order count validation
		const totalOrders = linnworksData.summary?.totalOrders || 0;
		if (totalOrders < linnworksDataQuality.expectedMinimum) {
			console.log('❌ Validation failed: Insufficient order count', {
				totalOrders,
				expected: linnworksDataQuality.expectedMinimum
			});
			return false;
		}

		// Check 3: Daily data completeness (should have 7 days)
		const dailyOrdersCount = linnworksData.dailyOrders?.length || 0;
		if (dailyOrdersCount < 7) {
			console.log('❌ Validation failed: Incomplete daily data', { days: dailyOrdersCount });
			return false;
		}

		// Check 4: Data distribution validation (at least some days should have orders)
		const daysWithOrders = linnworksData.dailyOrders.filter((day: any) => day.count > 0).length;
		if (daysWithOrders === 0) {
			console.log('❌ Validation failed: No days with orders found');
			return false;
		}

		// Check 5: Channel data validation (should have channel breakdown)
		const hasChannelData = linnworksData.dailyOrders.some(
			(day: any) =>
				day.channels &&
				(day.channels.amazon > 0 || day.channels.ebay > 0 || day.channels.shopify > 0)
		);
		if (!hasChannelData && totalOrders > 0) {
			console.log('⚠️  Warning: No channel breakdown data found, but proceeding...');
		}

		// Check 6: Financial data validation
		const financialDaysCount = financialData.dailyData?.length || 0;
		if (financialDaysCount < 7) {
			console.log('❌ Validation failed: Incomplete financial data', {
				financialDays: financialDaysCount
			});
			return false;
		}

		console.log('✅ All data validation checks passed:', {
			totalOrders,
			dailyOrdersCount,
			daysWithOrders,
			hasChannelData,
			financialDaysCount
		});

		return true;
	}

	// Ensure minimum loading time for better UX
	function enforceMinimumLoadTime() {
		setTimeout(() => {
			minimumLoadTimeElapsed = true;
			console.log('⏱️  Minimum load time elapsed');
			checkIfReadyToRender();
		}, 1500); // Reduced to 1.5 seconds minimum loading time

		// Emergency fallback - force render after maximum wait time
		setTimeout(() => {
			if (!dashboardReady) {
				console.warn('🚨 Emergency fallback: Forcing dashboard render after timeout');
				loading = false;
				dashboardReady = true;
				minimumLoadTimeElapsed = true;
				apiResponsesComplete = true;
				dataValidationPassed = true;
			}
		}, 8000); // Maximum 8 seconds wait time
	}

	// Check if all conditions are met to render the dashboard
	function checkIfReadyToRender() {
		const allConditionsMet =
			dataValidationPassed &&
			minimumLoadTimeElapsed &&
			apiResponsesComplete &&
			linnworksApiCompleted &&
			dashboardReady;

		console.log('🎯 Checking render readiness:', {
			dataValidationPassed,
			minimumLoadTimeElapsed,
			apiResponsesComplete,
			linnworksApiCompleted,
			dashboardReady,
			allConditionsMet
		});

		if (allConditionsMet) {
			console.log('🚀 All conditions met - Ready to render dashboard');
			// Final delay before showing dashboard
			setTimeout(() => {
				loading = false;
				showToast('Dashboard loaded successfully', 'success');
			}, 500);
		}
	}

	// Track data source status
	let dataSourceStatus = {
		linnworks: { isCached: false, isLoaded: false },
		financial: { isCached: false, isLoaded: false }
	};

	// Store preloaded data for ShipmentChart
	let preloadedChartData = {
		currentWeek: {
			linnworks: null,
			financial: null
		},
		previousWeek: {
			linnworks: null,
			financial: null
		},
		employeeHours: {
			current: null as any,
			previous: null as any
		},
		scheduledHours: {
			current: null as any,
			previous: null as any
		},
		usePreloaded: false
	};

	// Enhanced preload that waits for substantial Linnworks data
	async function preloadDashboardData() {
		const PRELOAD_TIMEOUT = 10000; // 10 second timeout

		try {
			// Add timeout wrapper
			const preloadPromise = performPreload();
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => reject(new Error('Preload timeout')), PRELOAD_TIMEOUT);
			});

			await Promise.race([preloadPromise, timeoutPromise]);
		} catch (err) {
			console.error('⚠️ Preload failed, falling back to basic loading:', err);
			// Set fallback state to allow dashboard to load without preloaded data
			apiResponsesComplete = true;
			dataValidationPassed = true;
			dashboardReady = true;
		}
	}

	async function performPreload() {
		try {
			// Get the current week's Monday using the same logic as ShipmentChart
			const today = new Date();
			const currentMonday = new Date(today);
			const day = currentMonday.getDay();
			const diff = currentMonday.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
			currentMonday.setDate(diff);

			const mondayStr = currentMonday.toISOString().split('T')[0];
			const sundayStr = new Date(currentMonday.getTime() + 6 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split('T')[0];

			// Calculate previous week dates
			const previousMonday = new Date(currentMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
			const previousMondayStr = previousMonday.toISOString().split('T')[0];
			const previousSundayStr = new Date(previousMonday.getTime() + 6 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split('T')[0];

			console.log('🔄 Starting comprehensive dashboard data preload...');
			console.log('Current week:', mondayStr, 'to', sundayStr);
			console.log('Previous week:', previousMondayStr, 'to', previousSundayStr);
			console.log('Previous Monday object:', previousMonday);
			console.log('Current Monday object:', currentMonday);
			console.log('Today is:', today.toISOString().split('T')[0]);

			// Start minimum load time enforcement
			enforceMinimumLoadTime();

			// Make ALL API calls in parallel for maximum efficiency
			const [
				currentLinnworksResponse,
				currentFinancialResponse,
				previousLinnworksResponse,
				previousFinancialResponse
			] = await Promise.all([
				// Current week data
				fetch(`/api/linnworks/weeklyOrderCounts?startDate=${mondayStr}&endDate=${sundayStr}`),
				fetch(`/api/linnworks/financialData?startDate=${mondayStr}&endDate=${sundayStr}`),
				// Previous week data
				fetch(
					`/api/linnworks/weeklyOrderCounts?startDate=${previousMondayStr}&endDate=${previousSundayStr}`
				),
				fetch(
					`/api/linnworks/financialData?startDate=${previousMondayStr}&endDate=${previousSundayStr}`
				)
			]);

			if (!currentLinnworksResponse.ok || !currentFinancialResponse.ok) {
				console.warn('Some API calls failed during preload, but continuing...');
				apiResponsesComplete = true;
				dashboardReady = true;
				checkIfReadyToRender();
				return;
			}

			const [
				currentLinnworksData,
				currentFinancialData,
				previousLinnworksData,
				previousFinancialData
			] = await Promise.all([
				currentLinnworksResponse.json(),
				currentFinancialResponse.json(),
				previousLinnworksResponse.ok ? previousLinnworksResponse.json() : null,
				previousFinancialResponse.ok ? previousFinancialResponse.json() : null
			]);

			console.log('🔍 Dashboard preload results:');
			console.log('Current week Linnworks:', currentLinnworksData);
			console.log('Current week Financial:', currentFinancialData);
			console.log('Previous week Linnworks:', previousLinnworksData);
			console.log('Previous week Financial:', previousFinancialData);

			// Now fetch employee hours and scheduled hours data
			console.log('📊 Fetching employee hours and scheduled hours data...');

			// Import the required services dynamically to avoid bundling issues
			const { getHoursDateRange } = await import('$lib/dailyHoursService');
			const { getScheduledHoursForDateRange } = await import('$lib/schedule/hours-service');

			// Fetch employee hours for both weeks
			const [
				currentEmployeeHours,
				previousEmployeeHours,
				currentScheduledHours,
				previousScheduledHours
			] = await Promise.all([
				getHoursDateRange(mondayStr, sundayStr).catch((err) => {
					console.warn('Failed to fetch current week employee hours:', err);
					return [];
				}),
				getHoursDateRange(previousMondayStr, previousSundayStr).catch((err) => {
					console.warn('Failed to fetch previous week employee hours:', err);
					return [];
				}),
				getScheduledHoursForDateRange(currentMonday, new Date(sundayStr)).catch((err) => {
					console.warn('Failed to fetch current week scheduled hours:', err);
					return [];
				}),
				getScheduledHoursForDateRange(previousMonday, new Date(previousSundayStr)).catch((err) => {
					console.warn('Failed to fetch previous week scheduled hours:', err);
					return [];
				})
			]);

			// Mark API responses as complete
			apiResponsesComplete = true;

			// Store ALL preloaded data for ShipmentChart
			preloadedChartData = {
				currentWeek: {
					linnworks: currentLinnworksData,
					financial: currentFinancialData
				},
				previousWeek: {
					linnworks: previousLinnworksData,
					financial: previousFinancialData
				},
				employeeHours: {
					current: currentEmployeeHours,
					previous: previousEmployeeHours
				},
				scheduledHours: {
					current: currentScheduledHours,
					previous: previousScheduledHours
				},
				usePreloaded: true
			};

			// Update data source status
			dataSourceStatus.linnworks.isCached = currentLinnworksData.isCached || false;
			dataSourceStatus.linnworks.isLoaded = true;
			dataSourceStatus.financial.isCached = currentFinancialData.isCached || false;
			dataSourceStatus.financial.isLoaded = true;

			// Run comprehensive data validation
			dataValidationPassed = validateDataCompleteness(currentLinnworksData, currentFinancialData);

			// Check the quality of Linnworks data to determine if paginated fetch is complete
			const totalOrders = currentLinnworksData.summary?.totalOrders || 0;
			const dailyOrdersCount = currentLinnworksData.dailyOrders?.length || 0;

			console.log('📊 Initial Linnworks data received:', {
				totalOrders,
				dailyOrdersCount,
				hasOrderDetails: !!currentLinnworksData.dailyOrders,
				isCached: dataSourceStatus.linnworks.isCached
			});

			console.log('💰 Financial data received:', {
				isLoaded: dataSourceStatus.financial.isLoaded,
				isCached: dataSourceStatus.financial.isCached
			});

			console.log('👥 Employee and scheduled hours data received:', {
				currentEmployeeHours: currentEmployeeHours?.length || 0,
				previousEmployeeHours: previousEmployeeHours?.length || 0,
				currentScheduledHours: currentScheduledHours?.length || 0,
				previousScheduledHours: previousScheduledHours?.length || 0
			});

			// Debug: Log sample employee hours data
			if (currentEmployeeHours && currentEmployeeHours.length > 0) {
				console.log('📋 Sample current employee hours data:', currentEmployeeHours.slice(0, 3));
				console.log('📋 Current week date range in data:', {
					firstEntry: currentEmployeeHours[0],
					lastEntry: currentEmployeeHours[currentEmployeeHours.length - 1]
				});
			} else {
				console.log('⚠️ NO current employee hours data returned from getHoursDateRange!');
			}
			if (previousEmployeeHours && previousEmployeeHours.length > 0) {
				console.log('📋 Sample previous employee hours data:', previousEmployeeHours.slice(0, 3));
			} else {
				console.log('⚠️ NO previous employee hours data returned from getHoursDateRange!');
			}

			// Debug: Log sample employee hours data to check structure
			if (currentEmployeeHours?.length > 0) {
				console.log('👥 Sample current employee hours entry:', currentEmployeeHours[0]);
			}
			if (previousEmployeeHours?.length > 0) {
				console.log('👥 Sample previous employee hours entry:', previousEmployeeHours[0]);
			}

			// Update data quality tracking
			linnworksDataQuality.totalOrders = totalOrders;

			// If data validation passed and we have substantial data, mark as complete
			if (dataValidationPassed && totalOrders >= linnworksDataQuality.expectedMinimum) {
				console.log('✅ Linnworks data validation passed on first fetch');
				linnworksApiCompleted = true;

				// Mark the Linnworks loading phase as complete
				if (loadingStates.linnworks) {
					loadingStates.linnworks = false;
					animateProgress('linnworks', 100, 400);
					showLinnworksStatus = true;
					showDataPreview = true;
					updateLoadingMessage();
				}

				dashboardReady = true;
				checkIfReadyToRender();
			} else {
				console.log('⏳ Data validation failed or insufficient data, will poll for updates...');
				// Start polling for better data
				pollForCompleteData(mondayStr, sundayStr);
			}
		} catch (err) {
			console.error('Error preloading dashboard data:', err);
			// Set flags to allow rendering even if preload failed
			apiResponsesComplete = true;
			dataValidationPassed = true;
			dashboardReady = true;
			checkIfReadyToRender();
		}
	}

	// Poll for complete Linnworks data
	async function pollForCompleteData(mondayStr: string, sundayStr: string) {
		// Clear any existing polling interval
		if (activePollingInterval) {
			clearInterval(activePollingInterval);
		}

		const maxPolls = 20; // Poll for up to 20 attempts (about 10 seconds)
		let pollCount = 0;

		activePollingInterval = setInterval(async () => {
			pollCount++;

			try {
				console.log(`🔄 Polling attempt ${pollCount}/${maxPolls} for complete Linnworks data...`);

				const response = await fetch(
					`/api/linnworks/weeklyOrderCounts?startDate=${mondayStr}&endDate=${sundayStr}`
				);
				if (!response.ok) {
					throw new Error('API call failed');
				}
				const data = await response.json();
				const totalOrders = data.summary?.totalOrders || 0;

				// Update preloaded data with improved data
				preloadedChartData.currentWeek.linnworks = data;

				// Update cache status for subsequent polls
				dataSourceStatus.linnworks.isCached = data.isCached || false;

				// Re-validate data with updated information
				dataValidationPassed = validateDataCompleteness(
					data,
					preloadedChartData.currentWeek.financial
				);

				// Check if data has improved significantly
				const dataImproved = totalOrders > linnworksDataQuality.totalOrders;
				const hasSubstantialData = totalOrders >= linnworksDataQuality.expectedMinimum;

				if (dataImproved) {
					console.log(
						`📈 Linnworks data updated: ${linnworksDataQuality.totalOrders} -> ${totalOrders} orders (${dataSourceStatus.linnworks.isCached ? 'Cached' : 'Fresh'})`
					);
					linnworksDataQuality.totalOrders = totalOrders;
				}

				// Complete if validation passes and we have substantial data, or reached max polls
				if ((dataValidationPassed && hasSubstantialData) || pollCount >= maxPolls) {
					if (activePollingInterval) {
						clearInterval(activePollingInterval);
						activePollingInterval = null;
					}

					if (dataValidationPassed && hasSubstantialData) {
						console.log('✅ Linnworks data validation passed during polling');
					} else {
						console.log('⏰ Timeout reached, proceeding with available data');
						// Force validation to pass if we timeout to prevent infinite loading
						dataValidationPassed = true;
					}

					linnworksApiCompleted = true;

					// Mark the Linnworks loading phase as complete
					if (loadingStates.linnworks) {
						loadingStates.linnworks = false;
						animateProgress('linnworks', 100, 400);
						showLinnworksStatus = true;
						showDataPreview = true;
						updateLoadingMessage();
					}

					dashboardReady = true;
					checkIfReadyToRender();
				}
			} catch (err) {
				console.error('Error during Linnworks polling:', err);
				// Continue polling unless we've reached max attempts
				if (pollCount >= maxPolls) {
					if (activePollingInterval) {
						clearInterval(activePollingInterval);
						activePollingInterval = null;
					}
					console.log('⏰ Max polling attempts reached, proceeding with available data');
					linnworksApiCompleted = true;
					dashboardReady = true;

					// Mark the Linnworks loading phase as complete
					if (loadingStates.linnworks) {
						loadingStates.linnworks = false;
						animateProgress('linnworks', 100, 400);
						showLinnworksStatus = true;
						showDataPreview = true;
						updateLoadingMessage();
					}
				}
			}
		}, 500); // Poll every 500ms
	}

	onMount(() => {
		// Only run in browser
		if (!browser) return;

		console.log('🏁 Dashboard page mounted');

		// Reset state for fresh initialization
		resetDashboardState();

		// Set a timeout to prevent hanging if session never resolves
		const sessionTimeout = setTimeout(() => {
			if (!dashboardInitialized && session === undefined) {
				console.warn('🚨 Session timeout - redirecting to login');
				goto('/login');
			}
		}, 5000); // 5 second timeout for session resolution

		// If we already have a session when mounting, initialize immediately
		if (session && !dashboardInitialized) {
			console.log('🚀 Session already available on mount, initializing dashboard');
			dashboardInitialized = true;
			initializeDashboard();
			clearTimeout(sessionTimeout);
		}

		// Cleanup
		return () => {
			clearTimeout(sessionTimeout);
		};
	});

	onDestroy(() => {
		unsubscribe();
		// Cleanup any active polling interval
		if (activePollingInterval) {
			clearInterval(activePollingInterval);
			activePollingInterval = null;
		}
	});
</script>

{#if session === undefined || loading}
	<div class="loading">
		<svg class="spinner" viewBox="0 0 50 50">
			<circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
		</svg>
		<p class="loading-message">{loadingMessage}</p>

		<!-- Progress indicators for different loading states -->
		{#if loading}
			<div class="loading-progress">
				<div
					class="progress-item"
					class:completed={!loadingStates.metrics}
					class:active={loadingStates.metrics}
				>
					<span class="progress-check">
						{#if !loadingStates.metrics}✓{:else}⟳{/if}
					</span>
					<span class="progress-label">Dashboard Metrics</span>
					<div class="progress-bar">
						<div class="progress-fill" style="width: {loadingProgress.metrics}%"></div>
					</div>
				</div>
				<div
					class="progress-item"
					class:completed={!loadingStates.employees}
					class:active={loadingStates.employees}
				>
					<span class="progress-check">
						{#if !loadingStates.employees}✓{:else}⟳{/if}
					</span>
					<span class="progress-label">Employee Data</span>
					<div class="progress-bar">
						<div class="progress-fill" style="width: {loadingProgress.employees}%"></div>
					</div>
				</div>
				<div
					class="progress-item"
					class:completed={!loadingStates.schedules}
					class:active={loadingStates.schedules}
				>
					<span class="progress-check">
						{#if !loadingStates.schedules}✓{:else}⟳{/if}
					</span>
					<span class="progress-label">Schedule Data</span>
					<div class="progress-bar">
						<div class="progress-fill" style="width: {loadingProgress.schedules}%"></div>
					</div>
				</div>
				<div
					class="progress-item"
					class:completed={!loadingStates.linnworks}
					class:active={loadingStates.linnworks}
				>
					<span class="progress-check">
						{#if !loadingStates.linnworks}✓{:else}⟳{/if}
					</span>
					<span class="progress-label">Linnworks API</span>
					<div class="progress-bar">
						<div class="progress-fill" style="width: {loadingProgress.linnworks}%"></div>
					</div>
				</div>
				<div
					class="progress-item"
					class:completed={!loadingStates.financial}
					class:active={loadingStates.financial}
				>
					<span class="progress-check">
						{#if !loadingStates.financial}✓{:else}⟳{/if}
					</span>
					<span class="progress-label">Financial Data</span>
					<div class="progress-bar">
						<div class="progress-fill" style="width: {loadingProgress.financial}%"></div>
					</div>
				</div>
			</div>

			<!-- Skeleton loader for dashboard preview -->
			<div class="skeleton-dashboard">
				<div class="skeleton-header">
					<div class="skeleton-title"></div>
					<div class="skeleton-nav">
						<div class="skeleton-button"></div>
						<div class="skeleton-button"></div>
					</div>
				</div>
				<div class="skeleton-content">
					<div class="skeleton-chart"></div>
					<div class="skeleton-metrics">
						<div class="skeleton-metric"></div>
						<div class="skeleton-metric"></div>
						<div class="skeleton-metric"></div>
					</div>
				</div>
			</div>

			<!-- Data preview when Linnworks loads -->
			{#if showDataPreview}
				<div class="data-preview fade-in">
					<div class="preview-item">
						<span class="preview-icon">📦</span>
						<span class="preview-text">Orders data synced</span>
					</div>
					<div class="preview-item">
						<span class="preview-icon">💰</span>
						<span class="preview-text">Sales metrics ready</span>
					</div>
				</div>
			{/if}

			<!-- Data source status -->
			{#if dataSourceStatus.linnworks.isLoaded || dataSourceStatus.financial.isLoaded}
				<div class="data-source-status fade-in">
					<div class="status-header">
						<span class="status-title">Data Sources</span>
					</div>
					<div class="status-grid">
						{#if dataSourceStatus.linnworks.isLoaded}
							<div class="status-item">
								<span class="status-icon">📦</span>
								<span class="status-name">Linnworks API</span>
								<span
									class="status-badge"
									class:cached={dataSourceStatus.linnworks.isCached}
									class:fresh={!dataSourceStatus.linnworks.isCached}
								>
									{dataSourceStatus.linnworks.isCached ? 'Cached' : 'Fresh'}
								</span>
							</div>
						{/if}
						{#if dataSourceStatus.financial.isLoaded}
							<div class="status-item">
								<span class="status-icon">💰</span>
								<span class="status-name">Financial Data</span>
								<span
									class="status-badge"
									class:cached={dataSourceStatus.financial.isCached}
									class:fresh={!dataSourceStatus.financial.isCached}
								>
									{dataSourceStatus.financial.isCached ? 'Cached' : 'Fresh'}
								</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Percentage increase visual for Linnworks data -->
			{#if showLinnworksStatus}
				<div class="api-status fade-in">
					<div class="status-indicator">
						<span class="status-icon">📈</span>
						<span class="status-text">Linnworks data loaded - Processing financial metrics...</span>
					</div>
				</div>
			{/if}
		{/if}
	</div>
{:else if session === null}
	<!-- When session is null, onMount should have redirected already -->
	<div>Redirecting to login...</div>
{:else if hasGlobalError}
	<ErrorBoundary
		title="Critical Error"
		showDetails={true}
		retryAction={() => {
			hasGlobalError = false;
			error = null;
			retryOperation(initializeDashboard, 'reload dashboard');
		}}
		on:error={handleGlobalError}
	/>
{:else if error}
	<ErrorBoundary
		title="Dashboard Error"
		showDetails={false}
		retryAction={() => {
			error = null;
			retryOperation(initializeDashboard, 'reload dashboard data');
		}}
	/>
{:else if session}
	<!-- Dashboard Header -->
	<div class="dashboard-actions">
		<div class="dashboard-title">
			<h1>Operations Dashboard</h1>
			<p>Real-time metrics and analytics</p>
		</div>
		<div class="action-buttons">
			<button
				class="clear-cache-btn"
				on:click={clearCacheAndRefresh}
				disabled={loading}
				title="Clear all cached data and fetch fresh data from APIs"
			>
				{#if loading}
					🔄 Refreshing...
				{:else}
					🗑️ Clear Cache & Refresh
				{/if}
			</button>
		</div>
	</div>

	<ShipmentChart preloadedData={preloadedChartData} />
{:else}
	<!-- When session is null, onMount should have redirected already -->
	<div>Redirecting...</div>
{/if}

<style>
	:root {
		--apple-blue: #0071e3;
		--apple-blue-hover: #0077ed;
		--apple-gray: #f5f5f7;
		--apple-dark-gray: #86868b;
		--apple-light-gray: #d2d2d7;
		--apple-black: #1d1d1f;
		--apple-success: #39ca74;
		--apple-warning: #ff9f0a;
		--apple-error: #ff3b30;
	}

	.dashboard-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 2rem;
		background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
		border-bottom: 1px solid #e2e8f0;
		margin-bottom: 1rem;
		border-radius: 8px 8px 0 0;
	}

	.dashboard-title h1 {
		margin: 0 0 0.25rem 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--apple-black);
	}

	.dashboard-title p {
		margin: 0;
		font-size: 0.875rem;
		color: var(--apple-dark-gray);
	}

	.action-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.clear-cache-btn {
		background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 2px 4px rgba(255, 107, 107, 0.2);
	}

	.clear-cache-btn:hover:not(:disabled) {
		background: linear-gradient(135deg, #ee5a24 0%, #c44569 100%);
		transform: translateY(-1px);
		box-shadow: 0 4px 8px rgba(255, 107, 107, 0.3);
	}

	.clear-cache-btn:active:not(:disabled) {
		transform: translateY(0);
		box-shadow: 0 2px 4px rgba(255, 107, 107, 0.2);
	}

	.clear-cache-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	.loading {
		padding: 3rem;
		text-align: center;
		background: #f9fafb;
		border-radius: 10px;
		margin: 2rem auto;
		max-width: 600px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.loading p {
		font-size: 1.1rem;
		color: var(--apple-dark-gray);
		margin: 0;
		font-weight: 500;
	}

	.loading-message {
		transition: all 0.3s ease;
		animation: fadeInSlide 0.5s ease;
	}

	@keyframes fadeInSlide {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.fade-in {
		animation: fadeIn 0.5s ease;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.spinner {
		animation: rotate 2s linear infinite;
		width: 40px;
		height: 40px;
	}

	.path {
		stroke: var(--apple-blue);
		stroke-linecap: round;
		animation: dash 1.5s ease-in-out infinite;
	}

	@keyframes rotate {
		100% {
			transform: rotate(360deg);
		}
	}

	@keyframes dash {
		0% {
			stroke-dasharray: 1, 150;
			stroke-dashoffset: 0;
		}
		50% {
			stroke-dasharray: 90, 150;
			stroke-dashoffset: -35;
		}
		100% {
			stroke-dasharray: 90, 150;
			stroke-dashoffset: -124;
		}
	}

	/* Loading state improvements */
	.loading-progress {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 20px;
		width: 100%;
		max-width: 400px;
	}

	.progress-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background: white;
		border-radius: 12px;
		transition: all 0.3s ease;
		border: 1px solid var(--apple-light-gray);
	}

	.progress-item.completed {
		background: var(--apple-gray);
		border-color: var(--apple-success);
		transform: scale(1.02);
	}

	.progress-check {
		min-width: 20px;
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--apple-dark-gray);
	}

	.progress-item.completed .progress-check {
		color: var(--apple-success);
	}

	.progress-label {
		flex: 1;
		text-align: left;
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--apple-black);
	}

	.progress-bar {
		width: 60px;
		height: 4px;
		background: var(--apple-light-gray);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--apple-blue), var(--apple-success));
		border-radius: 2px;
		transition: width 0.3s ease;
	}
	.progress-item.completed .progress-fill {
		background: var(--apple-success);
	}

	.progress-item.active {
		animation: pulse 2s infinite;
		border-color: var(--apple-blue);
	}

	@keyframes pulse {
		0%,
		100% {
			transform: scale(1);
			opacity: 1;
		}
		50% {
			transform: scale(1.02);
			opacity: 0.9;
		}
	}

	.data-preview {
		margin-top: 16px;
		display: flex;
		gap: 12px;
		justify-content: center;
	}

	.preview-item {
		display: flex;
		align-items: center;
		gap: 6px;
		background: white;
		padding: 8px 12px;
		border-radius: 20px;
		border: 1px solid var(--apple-success);
		animation: slideInUp 0.5s ease;
	}

	.preview-icon {
		font-size: 1rem;
	}

	.preview-text {
		font-size: 0.8rem;
		color: var(--apple-success);
		font-weight: 600;
	}

	@keyframes slideInUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.api-status {
		margin-top: 16px;
		padding: 12px 20px;
		background: linear-gradient(135deg, #e3f2fd, #f3e5f5);
		border-radius: 12px;
		border: 1px solid var(--apple-blue);
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.status-icon {
		font-size: 1.2rem;
	}

	.status-text {
		font-size: 0.9rem;
		color: var(--apple-blue);
		font-weight: 500;
	}

	/* Data source status styles */
	.data-source-status {
		margin-top: 16px;
		padding: 16px 20px;
		background: white;
		border-radius: 12px;
		border: 1px solid #e5e5e7;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.status-header {
		margin-bottom: 12px;
		text-align: center;
	}

	.status-title {
		font-size: 0.9rem;
		font-weight: 600;
		color: #1d1d1f;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.status-grid {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.status-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 0;
	}

	.status-item .status-icon {
		font-size: 1rem;
		margin-right: 8px;
	}

	.status-name {
		flex: 1;
		font-size: 0.85rem;
		font-weight: 500;
		color: #424245;
	}

	.status-badge {
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		border: 1px solid;
	}

	.status-badge.cached {
		background: #f0f9ff;
		color: #0369a1;
		border-color: #bae6fd;
	}

	.status-badge.fresh {
		background: #f0fdf4;
		color: #166534;
		border-color: #bbf7d0;
	}

	/* Skeleton loader styles */
	.skeleton-dashboard {
		margin-top: 24px;
		padding: 20px;
		background: white;
		border-radius: 12px;
		border: 1px solid var(--apple-light-gray);
		animation: fadeIn 0.5s ease;
	}

	.skeleton-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.skeleton-title {
		width: 200px;
		height: 24px;
		background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 4px;
	}

	.skeleton-nav {
		display: flex;
		gap: 12px;
	}

	.skeleton-button {
		width: 80px;
		height: 32px;
		background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 6px;
	}

	.skeleton-content {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.skeleton-chart {
		width: 100%;
		height: 120px;
		background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 8px;
	}

	.skeleton-metrics {
		display: flex;
		gap: 12px;
		justify-content: space-between;
	}

	.skeleton-metric {
		flex: 1;
		height: 60px;
		background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 6px;
	}

	@keyframes shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}
</style>
