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

	// Simplified loading state enum - enhanced for progressive loading
	type LoadingState =
		| 'INITIALIZING'
		| 'LOADING_CRITICAL'
		| 'SHOWING_PARTIAL'
		| 'LOADING_BACKGROUND'
		| 'READY'
		| 'ERROR';
	let loadingState: LoadingState = 'INITIALIZING';

	// Progressive enhancement flags
	let criticalDataLoaded = false;
	let backgroundDataLoaded = false;
	let showingSkeleton = false;

	// Data priority tiers for progressive loading
	const DATA_PRIORITIES = {
		CRITICAL: ['currentWeek.linnworks', 'currentWeek.financial'], // Must have at least one
		IMPORTANT: ['employeeHours.current', 'scheduledHours.current'], // Nice to have for current operations
		BACKGROUND: [
			'previousWeek.linnworks',
			'previousWeek.financial',
			'employeeHours.previous',
			'scheduledHours.previous'
		] // For comparisons
	};

	// Data source status for partial success handling
	type DataSourceStatus = 'pending' | 'success' | 'failed' | 'cached';
	interface DataSourceState {
		status: DataSourceStatus;
		data: any;
		error?: string;
		lastUpdated?: Date;
	}

	let dataSourceStates = {
		currentWeek: {
			linnworks: {
				status: 'pending' as DataSourceStatus,
				data: null,
				error: undefined,
				lastUpdated: undefined
			} as DataSourceState,
			financial: {
				status: 'pending' as DataSourceStatus,
				data: null,
				error: undefined,
				lastUpdated: undefined
			} as DataSourceState
		},
		previousWeek: {
			linnworks: {
				status: 'pending' as DataSourceStatus,
				data: null,
				error: undefined,
				lastUpdated: undefined
			} as DataSourceState,
			financial: {
				status: 'pending' as DataSourceStatus,
				data: null,
				error: undefined,
				lastUpdated: undefined
			} as DataSourceState
		},
		employeeHours: {
			current: {
				status: 'pending' as DataSourceStatus,
				data: null,
				error: undefined,
				lastUpdated: undefined
			} as DataSourceState,
			previous: {
				status: 'pending' as DataSourceStatus,
				data: null,
				error: undefined,
				lastUpdated: undefined
			} as DataSourceState
		},
		scheduledHours: {
			current: {
				status: 'pending' as DataSourceStatus,
				data: null,
				error: undefined,
				lastUpdated: undefined
			} as DataSourceState,
			previous: {
				status: 'pending' as DataSourceStatus,
				data: null,
				error: undefined,
				lastUpdated: undefined
			} as DataSourceState
		}
	};

	let preloadedChartData = {
		currentWeek: {
			linnworks: null,
			financial: null
		},
		previousWeek: {
			linnworks: null,
			financial: null
		},
		// Additional week for navigation support (2 weeks ago)
		twoWeeksAgo: {
			linnworks: null,
			financial: null
		},
		employeeHours: {
			current: null as any,
			previous: null as any,
			twoWeeksAgo: null as any
		},
		scheduledHours: {
			current: null as any,
			previous: null as any,
			twoWeeksAgo: null as any
		},
		usePreloaded: false
	};

	// Reset dashboard state on each page load
	function resetDashboardState() {
		dashboardInitialized = false;
		loadingState = 'INITIALIZING';
		error = null;

		// Reset previous week preloading state
		previousWeekPreloaded = false;
		previousWeekPreloading = false;
		previousWeekPreloadPromise = null;

		// Reset data source states
		dataSourceStates = {
			currentWeek: {
				linnworks: { status: 'pending', data: null },
				financial: { status: 'pending', data: null }
			},
			previousWeek: {
				linnworks: { status: 'pending', data: null },
				financial: { status: 'pending', data: null }
			},
			employeeHours: {
				current: { status: 'pending', data: null },
				previous: { status: 'pending', data: null }
			},
			scheduledHours: {
				current: { status: 'pending', data: null },
				previous: { status: 'pending', data: null }
			}
		};

		// Reset chart data
		preloadedChartData = {
			currentWeek: { linnworks: null, financial: null },
			previousWeek: { linnworks: null, financial: null },
			twoWeeksAgo: { linnworks: null, financial: null },
			employeeHours: { current: null, previous: null, twoWeeksAgo: null },
			scheduledHours: { current: null, previous: null, twoWeeksAgo: null },
			usePreloaded: false
		};
	}

	const unsubscribe = userSession.subscribe((s) => {
		// Only run session logic in the browser
		if (!browser) {
			console.log('🚫 Not in browser, skipping session logic');
			return;
		}

		console.log(
			'📱 Dashboard session update:',
			s ? 'session exists' : s === null ? 'no session' : 'undefined'
		);
		console.log('📱 Session value:', s);
		console.log('📱 dashboardInitialized:', dashboardInitialized);
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
		} else {
			console.log('⏸️  Session update skipped:', {
				sessionUndefined: session === undefined,
				alreadyInitialized: dashboardInitialized
			});
		}
	});

	// Loading states for different data sources
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

	// Event-driven data loading
	let dataLoadPromise: Promise<any> | null = null;

	// Previous week preloading state
	let previousWeekPreloaded = false;
	let previousWeekPreloading = false;
	let previousWeekPreloadPromise: Promise<any> | null = null;

	// Separate state for the Linnworks status message
	let showLinnworksStatus = false;
	// Enhanced loading features
	let showDataPreview = false;
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
		} catch (err) {
			console.error('❌ Failed to refresh data:', err);
			handleError(err, 'refresh data');
		}
	}

	// Debug function to force loading completion
	function forceLoadingComplete() {
		console.log('🔧 Force completing loading state...');
		loadingState = 'READY';
		showToast('Loading forcefully completed', 'info');
	}

	// Debug function to test API endpoints manually
	async function testApiEndpoints() {
		console.log('🧪 Testing API endpoints manually...');
		const today = new Date();
		const currentMonday = new Date(today);
		const day = currentMonday.getDay();
		const diff = currentMonday.getDate() - day + (day === 0 ? -6 : 1);
		currentMonday.setDate(diff);

		const mondayStr = currentMonday.toISOString().split('T')[0];
		const sundayStr = new Date(currentMonday.getTime() + 6 * 24 * 60 * 60 * 1000)
			.toISOString()
			.split('T')[0];

		try {
			console.log('📡 Testing Linnworks API...');
			const linnworksUrl = `/api/linnworks/weeklyOrderCounts?startDate=${mondayStr}&endDate=${sundayStr}`;
			console.log('🔗 Linnworks URL:', linnworksUrl);

			const linnworksResponse = await fetch(linnworksUrl);
			console.log('📊 Linnworks response status:', linnworksResponse.status);
			console.log('📊 Linnworks response ok:', linnworksResponse.ok);

			if (linnworksResponse.ok) {
				const linnworksData = await linnworksResponse.json();
				console.log('📊 Linnworks data received:', linnworksData);
			} else {
				console.log('❌ Linnworks error:', await linnworksResponse.text());
			}

			console.log('💰 Testing Financial API...');
			const financialUrl = `/api/linnworks/financialData?startDate=${mondayStr}&endDate=${sundayStr}`;
			console.log('🔗 Financial URL:', financialUrl);

			const financialResponse = await fetch(financialUrl);
			console.log('💰 Financial response status:', financialResponse.status);
			console.log('💰 Financial response ok:', financialResponse.ok);

			if (financialResponse.ok) {
				const financialData = await financialResponse.json();
				console.log('💰 Financial data received:', financialData);
			} else {
				console.log('❌ Financial error:', await financialResponse.text());
			}
		} catch (error) {
			console.error('🚨 API test failed:', error);
		}
	}

	// Simulate the data loading phases that ShipmentChart goes through
	async function initializeDashboard() {
		console.log('🚀 initializeDashboard() called');
		try {
			loadingState = 'LOADING_CRITICAL';
			error = null;

			// Reset loading states
			loadingStates = {
				metrics: true,
				linnworks: true,
				financial: true,
				schedules: true,
				employees: true
			};

			console.log('📊 Loading states reset:', loadingStates);
			updateLoadingMessage();

			// Start the data loading process - this is now event-driven
			dataLoadPromise = loadDashboardData();

			// Mark local metrics/engine setup as complete after a tiny delay
			setTimeout(() => {
				loadingStates.metrics = false;
				animateProgress('metrics', 100, 400);
				updateLoadingMessage();
			}, 400);

			// Wait for actual data loading to complete
			await dataLoadPromise;
		} catch (err) {
			console.error('❌ Dashboard initialization failed:', err);
			loadingState = 'ERROR';
			handleError(err, 'initialize dashboard');
		}
	}

	// Separate function to load actual data
	async function loadDashboardData(): Promise<void> {
		console.log('🔄 Starting actual data loading...');

		try {
			// Start preloading the dashboard data
			await preloadDashboardData();

			// Data validation is now handled progressively
			// loadingState transitions are managed by evaluateProgressiveState()

			// Final state transition (if not already READY from progressive loading)
			if (loadingState === 'LOADING_BACKGROUND') {
				loadingState = 'READY';
			}
			console.log('✅ Data loading completed successfully');
		} catch (err) {
			console.error('❌ Data loading failed:', err);
			loadingState = 'ERROR';
			throw err;
		}
	}

	// Validate loaded data and transition to ready state
	async function validateLoadedData(): Promise<void> {
		console.log('🔍 Validating loaded data...');

		// Check if we have minimal viable data
		const hasMinimalData =
			preloadedChartData.usePreloaded &&
			(preloadedChartData.currentWeek.linnworks || preloadedChartData.currentWeek.financial);

		if (!hasMinimalData) {
			throw new Error('Insufficient data loaded for dashboard');
		}

		// Mark remaining loading states as complete
		loadingStates.linnworks = false;
		loadingStates.financial = false;
		animateProgress('linnworks', 100, 400);
		animateProgress('financial', 100, 350);
		updateLoadingMessage();

		// Small delay for better UX
		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	// Watch for loading state changes and update UI accordingly
	$: {
		if (loadingState === 'READY') {
			// No toast needed - banner shows the status
			console.log('✅ Dashboard loading completed');

			// Start preloading previous week data in the background
			if (!previousWeekPreloaded && !previousWeekPreloading) {
				console.log('🚀 Starting previous week data preloading...');
				previousWeekPreloading = true;
				previousWeekPreloadPromise = preloadPreviousWeekData();
			}
		} else if (loadingState === 'ERROR') {
			// Error state is handled by the template
			console.log('❌ Dashboard loading failed');
		}
	}

	// Enhanced preload that waits for substantial Linnworks data
	async function preloadDashboardData() {
		console.log('🚀 preloadDashboardData() called');

		try {
			await performPreload();
			console.log('✅ preloadDashboardData completed successfully');
		} catch (err) {
			console.error('⚠️ Preload failed:', err);
			// Don't set fallback flags here - let the error bubble up
			throw err;
		}
	}

	async function performPreload() {
		console.log('🔄 performPreload() starting...');
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

			loadingState = 'LOADING_CRITICAL';

			console.log('📡 Making API calls with partial success handling...');

			// Fetch data with individual error handling for partial success
			const dataFetches = [
				// Current week data
				fetch(`/api/linnworks/weeklyOrderCounts?startDate=${mondayStr}&endDate=${sundayStr}`, {
					credentials: 'include'
				})
					.then(async (response) => {
						if (response.ok) {
							const data = await response.json();
							updateDataSourceState(
								'currentWeek',
								'linnworks',
								data.isCached ? 'cached' : 'success',
								data
							);
							return data;
						} else {
							updateDataSourceState(
								'currentWeek',
								'linnworks',
								'failed',
								null,
								`HTTP ${response.status}`
							);
							return null;
						}
					})
					.catch((err) => {
						updateDataSourceState('currentWeek', 'linnworks', 'failed', null, err.message);
						return null;
					}),

				fetch(`/api/linnworks/financialData?startDate=${mondayStr}&endDate=${sundayStr}`, {
					credentials: 'include'
				})
					.then(async (response) => {
						if (response.ok) {
							const data = await response.json();
							updateDataSourceState(
								'currentWeek',
								'financial',
								data.isCached ? 'cached' : 'success',
								data
							);
							return data;
						} else {
							updateDataSourceState(
								'currentWeek',
								'financial',
								'failed',
								null,
								`HTTP ${response.status}`
							);
							return null;
						}
					})
					.catch((err) => {
						updateDataSourceState('currentWeek', 'financial', 'failed', null, err.message);
						return null;
					}),

				// Previous week data
				fetch(
					`/api/linnworks/weeklyOrderCounts?startDate=${previousMondayStr}&endDate=${previousSundayStr}`
				)
					.then(async (response) => {
						if (response.ok) {
							const data = await response.json();
							updateDataSourceState(
								'previousWeek',
								'linnworks',
								data.isCached ? 'cached' : 'success',
								data
							);
							return data;
						} else {
							updateDataSourceState(
								'previousWeek',
								'linnworks',
								'failed',
								null,
								`HTTP ${response.status}`
							);
							return null;
						}
					})
					.catch((err) => {
						updateDataSourceState('previousWeek', 'linnworks', 'failed', null, err.message);
						return null;
					}),

				fetch(
					`/api/linnworks/financialData?startDate=${previousMondayStr}&endDate=${previousSundayStr}`
				)
					.then(async (response) => {
						if (response.ok) {
							const data = await response.json();
							updateDataSourceState(
								'previousWeek',
								'financial',
								data.isCached ? 'cached' : 'success',
								data
							);
							return data;
						} else {
							updateDataSourceState(
								'previousWeek',
								'financial',
								'failed',
								null,
								`HTTP ${response.status}`
							);
							return null;
						}
					})
					.catch((err) => {
						updateDataSourceState('previousWeek', 'financial', 'failed', null, err.message);
						return null;
					})
			];

			// Wait for all API calls to complete (success or failure)
			const [
				currentLinnworksData,
				currentFinancialData,
				previousLinnworksData,
				previousFinancialData
			] = await Promise.all(dataFetches);

			console.log('📊 Fetching employee hours and scheduled hours data...');

			// Import the required services dynamically
			const { getHoursDateRange } = await import('$lib/dailyHoursService');
			const { getScheduledHoursForDateRange } = await import('$lib/schedule/hours-service');

			// Fetch employee and scheduled hours with individual error handling
			const hoursFetches = [
				getHoursDateRange(mondayStr, sundayStr)
					.then((data) => {
						updateDataSourceState('employeeHours', 'current', 'success', data);
						return data;
					})
					.catch((err) => {
						updateDataSourceState('employeeHours', 'current', 'failed', null, err.message);
						return [];
					}),

				getHoursDateRange(previousMondayStr, previousSundayStr)
					.then((data) => {
						updateDataSourceState('employeeHours', 'previous', 'success', data);
						return data;
					})
					.catch((err) => {
						updateDataSourceState('employeeHours', 'previous', 'failed', null, err.message);
						return [];
					}),

				getScheduledHoursForDateRange(currentMonday, new Date(sundayStr))
					.then((data) => {
						updateDataSourceState('scheduledHours', 'current', 'success', data);
						return data;
					})
					.catch((err) => {
						updateDataSourceState('scheduledHours', 'current', 'failed', null, err.message);
						return [];
					}),

				getScheduledHoursForDateRange(previousMonday, new Date(previousSundayStr))
					.then((data) => {
						updateDataSourceState('scheduledHours', 'previous', 'success', data);
						return data;
					})
					.catch((err) => {
						updateDataSourceState('scheduledHours', 'previous', 'failed', null, err.message);
						return [];
					})
			];

			const [
				currentEmployeeHours,
				previousEmployeeHours,
				currentScheduledHours,
				previousScheduledHours
			] = await Promise.all(hoursFetches);

			// Log partial success results
			const successful = getSuccessfulDataSources();
			const failed = getFailedDataSources();

			console.log('✅ Data loading completed with partial success:');
			console.log(`📊 Successful sources (${successful.length}):`, successful);
			if (failed.length > 0) {
				console.log(`❌ Failed sources (${failed.length}):`, failed);
			}

			// Move to validation phase
			loadingState = 'LOADING_BACKGROUND';

			// Check if we can show the dashboard
			if (canShowDashboard()) {
				console.log('🎯 Sufficient data available for dashboard display');
				loadingState = 'READY';

				// Banner shows the status, no need for toast
				if (failed.length > 0) {
					console.log(`⚠️ Dashboard loaded with ${failed.length} data source(s) unavailable`);
				}
			} else {
				console.log('❌ Insufficient data for dashboard display');
				loadingState = 'ERROR';
				error = 'Unable to load sufficient data for dashboard';
			}
		} catch (err) {
			console.error('Error during preload:', err);
			loadingState = 'ERROR';
			error = err instanceof Error ? err.message : 'Unknown error during data loading';
		}
	}

	// Previous week data preloading for enhanced user experience
	async function preloadPreviousWeekData(): Promise<void> {
		try {
			console.log('🔄 Starting previous week navigation data preloading...');

			// Calculate dates for two weeks ago (needed when user navigates to "Previous Week")
			// When showing "Previous Week" view, this becomes the comparison data
			const today = new Date();
			const currentMonday = new Date(today);
			const day = currentMonday.getDay();
			const diff = currentMonday.getDate() - day + (day === 0 ? -6 : 1);
			currentMonday.setDate(diff);

			// Go back 2 weeks (this will be "previous week" when viewing last week)
			const twoWeeksAgoMonday = new Date(currentMonday.getTime() - 14 * 24 * 60 * 60 * 1000);
			const twoWeeksAgoMondayStr = twoWeeksAgoMonday.toISOString().split('T')[0];
			const twoWeeksAgoSundayStr = new Date(twoWeeksAgoMonday.getTime() + 6 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split('T')[0];

			console.log(
				'📅 Preloading comparison data for previous week navigation:',
				twoWeeksAgoMondayStr,
				'to',
				twoWeeksAgoSundayStr
			);

			// Preload Linnworks and financial data for two weeks ago
			// This will be used as "previous week" when user navigates to "Previous Week" view
			const preloadFetches = [
				fetch(
					`/api/linnworks/weeklyOrderCounts?startDate=${twoWeeksAgoMondayStr}&endDate=${twoWeeksAgoSundayStr}`
				)
					.then(async (response) => {
						if (response.ok) {
							const data = await response.json();
							console.log('✅ Previous week Linnworks data preloaded');
							return data;
						}
						return null;
					})
					.catch((err) => {
						console.log('⚠️ Previous week Linnworks preload failed:', err.message);
						return null;
					}),

				fetch(
					`/api/linnworks/financialData?startDate=${twoWeeksAgoMondayStr}&endDate=${twoWeeksAgoSundayStr}`
				)
					.then(async (response) => {
						if (response.ok) {
							const data = await response.json();
							console.log('✅ Previous week financial data preloaded');
							return data;
						}
						return null;
					})
					.catch((err) => {
						console.log('⚠️ Previous week financial preload failed:', err.message);
						return null;
					})
			];

			// Also preload employee hours for that week
			try {
				const { getHoursDateRange } = await import('$lib/dailyHoursService');
				const employeeHoursPromise = getHoursDateRange(twoWeeksAgoMondayStr, twoWeeksAgoSundayStr)
					.then((data) => {
						console.log('✅ Previous week employee hours preloaded');
						return data;
					})
					.catch((err) => {
						console.log('⚠️ Previous week employee hours preload failed:', err.message);
						return [];
					});

				preloadFetches.push(employeeHoursPromise);
			} catch (err) {
				console.log('⚠️ Could not import employee hours service for preload');
			}

			// Wait for all preload requests to complete (success or failure)
			const [twoWeeksAgoLinnworks, twoWeeksAgoFinancial, twoWeeksAgoEmployeeHours] =
				await Promise.all(preloadFetches);

			// Store the preloaded data in the extended structure
			preloadedChartData.twoWeeksAgo.linnworks = twoWeeksAgoLinnworks;
			preloadedChartData.twoWeeksAgo.financial = twoWeeksAgoFinancial;
			preloadedChartData.employeeHours.twoWeeksAgo = twoWeeksAgoEmployeeHours || [];

			// Also preload scheduled hours for 2 weeks ago
			try {
				const { getScheduledHoursForDateRange } = await import('$lib/schedule/hours-service');
				const twoWeeksAgoScheduledHours = await getScheduledHoursForDateRange(
					twoWeeksAgoMonday,
					new Date(twoWeeksAgoSundayStr)
				);
				preloadedChartData.scheduledHours.twoWeeksAgo = twoWeeksAgoScheduledHours;
				console.log('✅ Previous week scheduled hours preloaded');
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'Unknown error';
				console.log('⚠️ Previous week scheduled hours preload failed:', errorMessage);
				preloadedChartData.scheduledHours.twoWeeksAgo = [];
			}

			previousWeekPreloaded = true;
			previousWeekPreloading = false;

			console.log('✅ Previous week data preloading completed');
			console.log('📊 Preloaded data structure:', {
				twoWeeksAgo: {
					linnworks: !!preloadedChartData.twoWeeksAgo.linnworks,
					financial: !!preloadedChartData.twoWeeksAgo.financial,
					employeeHours: preloadedChartData.employeeHours.twoWeeksAgo?.length || 0,
					scheduledHours: preloadedChartData.scheduledHours.twoWeeksAgo?.length || 0
				}
			});
		} catch (err) {
			console.error('❌ Previous week preload failed:', err);
			previousWeekPreloading = false;
		}
	}

	onMount(() => {
		// Only run in browser
		if (!browser) {
			console.log('🚫 onMount: Not in browser, returning');
			return;
		}

		console.log('🏁 Dashboard page mounted');
		console.log('🔍 Initial state:', {
			session,
			dashboardInitialized,
			loadingState
		});

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
		} else {
			console.log('⏸️  Waiting for session or already initialized:', {
				hasSession: !!session,
				alreadyInitialized: dashboardInitialized
			});
		}

		// Cleanup
		return () => {
			clearTimeout(sessionTimeout);
		};
	});

	onDestroy(() => {
		unsubscribe();
	});

	// Timeout to ensure we eventually show completion status
	let loadingTimeout: NodeJS.Timeout | null = null;

	// Start timeout when we begin loading background data
	function startLoadingTimeout() {
		if (loadingTimeout) {
			clearTimeout(loadingTimeout);
		}

		// After 10 seconds, show ready state regardless of background data status
		loadingTimeout = setTimeout(() => {
			if (loadingState === 'LOADING_BACKGROUND') {
				console.log('⏰ Loading timeout reached - showing ready state');
				loadingState = 'READY';
				backgroundDataLoaded = true;
				// Banner shows the status, no need for toast
				console.log('✅ Dashboard loaded with available data');
			}
		}, 10000);
	}

	// Clear timeout when component is destroyed
	onDestroy(() => {
		if (loadingTimeout) {
			clearTimeout(loadingTimeout);
		}
	});

	// Helper functions for partial success handling
	function updateDataSourceState(
		category: keyof typeof dataSourceStates,
		source: string,
		status: DataSourceStatus,
		data: any = null,
		error?: string
	) {
		// Update persistent state
		if (category === 'currentWeek' || category === 'previousWeek') {
			if (source === 'linnworks' || source === 'financial') {
				dataSourceStates[category][source] = {
					status,
					data,
					error,
					lastUpdated: new Date()
				};

				// Sync with preloadedChartData object (for incremental consumption by ShipmentChart)
				if (category === 'currentWeek') {
					if (source === 'linnworks') preloadedChartData.currentWeek.linnworks = data;
					if (source === 'financial') preloadedChartData.currentWeek.financial = data;
				} else if (category === 'previousWeek') {
					if (source === 'linnworks') preloadedChartData.previousWeek.linnworks = data;
					if (source === 'financial') preloadedChartData.previousWeek.financial = data;
				}

				// Trigger reactivity and mark that we are building the cache
				preloadedChartData.usePreloaded = true;
				preloadedChartData = { ...preloadedChartData };

				// Update loading cards for current week data
				if (category === 'currentWeek') {
					if (status === 'success' || status === 'cached' || status === 'failed') {
						loadingStates[source as 'linnworks' | 'financial'] = false;
						animateProgress(source, 100, 500);
						updateLoadingMessage();
					}
				}
			}
		} else if (category === 'employeeHours' || category === 'scheduledHours') {
			const sourceKey = category === 'employeeHours' ? 'employees' : 'schedules';
			const period = source === 'current' ? 'current' : 'previous';

			if (source === 'current' || source === 'previous') {
				dataSourceStates[category][source] = {
					status,
					data,
					error,
					lastUpdated: new Date()
				};

				// Sync with preloadedChartData incrementally
				if (category === 'employeeHours') {
					if (source === 'current') preloadedChartData.employeeHours.current = data;
					if (source === 'previous') preloadedChartData.employeeHours.previous = data;
				} else if (category === 'scheduledHours') {
					if (source === 'current') preloadedChartData.scheduledHours.current = data;
					if (source === 'previous') preloadedChartData.scheduledHours.previous = data;
				}

				preloadedChartData.usePreloaded = true;
				preloadedChartData = { ...preloadedChartData };

				// Update loading cards for current period hours
				if (period === 'current') {
					if (status === 'success' || status === 'cached' || status === 'failed') {
						loadingStates[sourceKey as 'employees' | 'schedules'] = false;
						animateProgress(sourceKey, 100, 500);
						updateLoadingMessage();
					}
				}
			}
		}

		console.log(`📊 Data source updated: ${category}.${source} -> ${status}`, {
			data: !!data,
			error
		});
	}

	function getSuccessfulDataSources(): string[] {
		const successful: string[] = [];
		Object.entries(dataSourceStates).forEach(([category, sources]) => {
			Object.entries(sources).forEach(([source, state]) => {
				if (state.status === 'success' || state.status === 'cached') {
					successful.push(`${category}.${source}`);
				}
			});
		});
		return successful;
	}

	function getFailedDataSources(): string[] {
		const failed: string[] = [];
		Object.entries(dataSourceStates).forEach(([category, sources]) => {
			Object.entries(sources).forEach(([source, state]) => {
				if (state.status === 'failed') {
					failed.push(`${category}.${source}`);
				}
			});
		});
		return failed;
	}

	function hasMinimalDataForDashboard(): boolean {
		// Dashboard can function with just current week data
		const currentLinnworksOk =
			dataSourceStates.currentWeek.linnworks.status === 'success' ||
			dataSourceStates.currentWeek.linnworks.status === 'cached';
		const currentFinancialOk =
			dataSourceStates.currentWeek.financial.status === 'success' ||
			dataSourceStates.currentWeek.financial.status === 'cached';

		return currentLinnworksOk || currentFinancialOk; // Need at least one current week data source
	}

	function canShowDashboard(): boolean {
		const successful = getSuccessfulDataSources();
		const failed = getFailedDataSources();
		const totalSources = 8; // Total number of data sources

		// Can show dashboard if we have minimal data OR if we've tried loading everything
		return hasMinimalDataForDashboard() || successful.length + failed.length >= totalSources;
	}

	// Helper functions for template access to data source states
	function isDataSourceLoaded(category: keyof typeof dataSourceStates, source: string): boolean {
		if (category === 'currentWeek' || category === 'previousWeek') {
			if (source === 'linnworks' || source === 'financial') {
				const state = dataSourceStates[category][source];
				return state?.status === 'success' || state?.status === 'cached';
			}
		} else if (category === 'employeeHours' || category === 'scheduledHours') {
			if (source === 'current' || source === 'previous') {
				const state = dataSourceStates[category][source];
				return state?.status === 'success' || state?.status === 'cached';
			}
		}
		return false;
	}

	function isDataSourceCached(category: keyof typeof dataSourceStates, source: string): boolean {
		if (category === 'currentWeek' || category === 'previousWeek') {
			if (source === 'linnworks' || source === 'financial') {
				const state = dataSourceStates[category][source];
				return state?.status === 'cached';
			}
		} else if (category === 'employeeHours' || category === 'scheduledHours') {
			if (source === 'current' || source === 'previous') {
				const state = dataSourceStates[category][source];
				return state?.status === 'cached';
			}
		}
		return false;
	}

	function hasAnyDataLoaded(): boolean {
		return (
			isDataSourceLoaded('currentWeek', 'linnworks') ||
			isDataSourceLoaded('currentWeek', 'financial') ||
			isDataSourceLoaded('previousWeek', 'linnworks') ||
			isDataSourceLoaded('previousWeek', 'financial')
		);
	}

	// Progressive enhancement helper functions
	function checkCriticalDataLoaded(): boolean {
		return DATA_PRIORITIES.CRITICAL.every((dataPath) => {
			const [category, source] = dataPath.split('.') as [keyof typeof dataSourceStates, string];
			const state = getDataSourceState(category, source);
			return state.status !== 'pending';
		});
	}

	function checkImportantDataLoaded(): boolean {
		return DATA_PRIORITIES.IMPORTANT.some((dataPath) => {
			const [category, source] = dataPath.split('.') as [keyof typeof dataSourceStates, string];
			return isDataSourceLoaded(category, source);
		});
	}

	function checkBackgroundDataLoaded(): boolean {
		return DATA_PRIORITIES.BACKGROUND.every((dataPath) => {
			const [category, source] = dataPath.split('.') as [keyof typeof dataSourceStates, string];
			const state = getDataSourceState(category, source);
			return state.status === 'success' || state.status === 'cached' || state.status === 'failed';
		});
	}

	function getDataSourceState(
		category: keyof typeof dataSourceStates,
		source: string
	): DataSourceState {
		if (category === 'currentWeek' || category === 'previousWeek') {
			if (source === 'linnworks' || source === 'financial') {
				return dataSourceStates[category][source];
			}
		} else if (category === 'employeeHours' || category === 'scheduledHours') {
			if (source === 'current' || source === 'previous') {
				return dataSourceStates[category][source];
			}
		}
		return { status: 'failed', data: null };
	}

	function getLoadingProgress(): { loaded: number; total: number; percentage: number } {
		const allDataSources = [
			...DATA_PRIORITIES.CRITICAL,
			...DATA_PRIORITIES.IMPORTANT,
			...DATA_PRIORITIES.BACKGROUND
		];

		const loaded = allDataSources.filter((dataPath) => {
			const [category, source] = dataPath.split('.') as [keyof typeof dataSourceStates, string];
			return isDataSourceLoaded(category, source);
		}).length;

		return {
			loaded,
			total: allDataSources.length,
			percentage: Math.round((loaded / allDataSources.length) * 100)
		};
	}

	// Progressive state transitions
	function evaluateProgressiveState() {
		const critical = checkCriticalDataLoaded();
		const important = checkImportantDataLoaded();
		const background = checkBackgroundDataLoaded();

		console.log('🎯 Progressive state evaluation:', { critical, important, background });

		if (!critical) {
			if (loadingState === 'LOADING_CRITICAL') {
				// Still waiting for critical data
				return;
			}
		} else if (critical && loadingState === 'LOADING_CRITICAL') {
			// Critical data loaded - show partial dashboard
			console.log('🚀 Critical data loaded - showing partial dashboard');
			loadingState = 'SHOWING_PARTIAL';
			criticalDataLoaded = true;
			// Banner shows the status, no need for toast
			console.log('✅ Dashboard ready with essential data');

			// Continue loading background data
			loadingState = 'LOADING_BACKGROUND';
		} else if (background && loadingState === 'LOADING_BACKGROUND') {
			// All background data loaded - dashboard fully ready
			console.log('✅ All data loaded - dashboard fully enhanced');
			loadingState = 'READY';
			backgroundDataLoaded = true;
			// Banner shows the status, no need for toast
			console.log('✅ Dashboard fully loaded with all comparisons');
		}
	}

	// Watch for data source changes and trigger progressive updates
	$: {
		if (dataSourceStates) {
			evaluateProgressiveState();
		}
	}
</script>

{#if session === undefined}
	<div class="initial-session-loading">
		<div class="loading-spinner"></div>
		<span>Establishing secure session...</span>
	</div>
{:else if session === null}
	<div class="redirect-notice">Redirecting to login...</div>
{:else if hasGlobalError || error}
	<div class="dashboard-container">
		<div class="persistent-status-bar">
			<div class="status-content error">
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="10" />
					<line x1="15" y1="9" x2="9" y2="15" />
					<line x1="9" y1="9" x2="15" y2="15" />
				</svg>
				<span>{error || 'A critical error occurred'}</span>
				<div class="status-details">
					<button class="retry-button" on:click={clearCacheAndRefresh}>Retry Loading</button>
				</div>
			</div>
		</div>
		<div class="dashboard-skeleton">
			<div class="skeleton-header">
				<div class="skeleton-title"></div>
				<div class="skeleton-subtitle"></div>
			</div>
			<div class="skeleton-chart">
				<div class="skeleton-bars">
					{#each Array(7) as _, i}
						<div class="skeleton-bar" style="height: {30 + Math.random() * 60}%"></div>
					{/each}
				</div>
			</div>
		</div>
	</div>
{:else}
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
				disabled={loadingState === 'LOADING_BACKGROUND'}
				title="Clear all cached data and fetch fresh data from APIs"
			>
				{#if loadingState === 'LOADING_BACKGROUND'}
					🔄 Refreshing...
				{:else}
					🗑️ Clear Cache & Refresh
				{/if}
			</button>
		</div>
	</div>

	<!-- Main Dashboard Content -->
	<div class="dashboard-container">
		<!-- Persistent Status Container -->
		<div class="status-container">
			{#if loadingState === 'SHOWING_PARTIAL'}
				<div class="status-banner partial-loaded">
					<div class="status-content">
						<div class="status-icon">⚡</div>
						<div class="status-text">
							<h4>Dashboard Ready</h4>
							<p>Essential data loaded • Background data loading...</p>
						</div>
						<div class="status-progress">
							<div class="progress-meter">
								<div class="progress-fill" style="width: {getLoadingProgress().percentage}%"></div>
							</div>
						</div>
					</div>
				</div>
			{:else if loadingState === 'LOADING_BACKGROUND'}
				<div class="status-banner loading">
					<div class="status-content">
						<div class="status-icon">🔄</div>
						<div class="status-text">
							<h4>Enhancing Dashboard</h4>
							<p>Loading historical comparisons and additional metrics...</p>
						</div>
						<div class="status-progress">
							<div class="progress-meter">
								<div class="progress-fill" style="width: {getLoadingProgress().percentage}%"></div>
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Dashboard Content Grid -->
		<div
			class="dashboard-content"
			class:partial-loaded={loadingState === 'SHOWING_PARTIAL' ||
				loadingState === 'LOADING_BACKGROUND'}
		>
			<!-- Persistent Data Status Bar -->
			<div class="persistent-status-bar">
				{#if loadingState === 'READY'}
					<div class="status-content success">
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
							<polyline points="22,4 12,14.01 9,11.01" />
						</svg>
						<span>All dashboard data loaded successfully</span>
						{#if previousWeekPreloading}
							<div class="preload-indicator">
								<div class="mini-spinner"></div>
								<span class="preload-text">Loading comparisons...</span>
							</div>
						{/if}
					</div>
				{:else if loadingState === 'LOADING_BACKGROUND' || loadingState === 'SHOWING_PARTIAL'}
					<div class="status-content info">
						<div class="mini-spinner"></div>
						<span>Updating dashboard with historical data...</span>
					</div>
				{:else if (loadingState as LoadingState) === 'ERROR'}
					<div class="status-content error">
						<span>Error loading data</span>
						<button class="retry-button" on:click={clearCacheAndRefresh}>Retry</button>
					</div>
				{:else}
					<div class="status-content loading">
						<div class="mini-spinner"></div>
						<span>{loadingMessage}</span>
					</div>
				{/if}
			</div>

			{#if criticalDataLoaded || loadingState === 'SHOWING_PARTIAL' || loadingState === 'LOADING_BACKGROUND' || loadingState === 'READY'}
				<!-- ShipmentChart with Progressive Data -->
				<ShipmentChart preloadedData={preloadedChartData} />

				{#if !backgroundDataLoaded}
					<div class="missing-data-notice">
						<div class="notice-content">
							<div class="notice-icon">⏳</div>
							<div class="notice-text">
								<h4>Loading Comparisons</h4>
								<p>Historical data is being loaded to show WoW trends</p>
							</div>
						</div>
					</div>
				{/if}
			{:else}
				<!-- Skeleton Loader for Critical Data -->
				<div class="dashboard-skeleton">
					<div class="skeleton-header">
						<div class="skeleton-title"></div>
						<div class="skeleton-subtitle"></div>
					</div>
					<div class="skeleton-chart">
						<div class="skeleton-bars">
							{#each Array(7) as _, i}
								<div class="skeleton-bar" style="height: {30 + Math.random() * 60}%"></div>
							{/each}
						</div>
					</div>
					<div class="skeleton-metrics">
						{#each Array(6) as _, i}
							<div class="skeleton-metric"></div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Modern CSS Variables */
	:root {
		--primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		--secondary-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
		--success-gradient: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
		--warning-gradient: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
		--dark-gradient: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);

		--surface-primary: #ffffff;
		--surface-secondary: #f8fafc;
		--surface-tertiary: #f1f5f9;
		--surface-glass: rgba(255, 255, 255, 0.9);
		--surface-elevated: rgba(255, 255, 255, 0.95);

		--text-primary: #1e293b;
		--text-secondary: #64748b;
		--text-tertiary: #94a3b8;
		--text-inverse: #ffffff;

		--border-light: rgba(226, 232, 240, 0.6);
		--border-medium: rgba(148, 163, 184, 0.3);
		--border-accent: rgba(102, 126, 234, 0.2);

		--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
		--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
		--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
		--shadow-glow: 0 0 20px rgba(102, 126, 234, 0.3);

		--radius-sm: 6px;
		--radius-md: 12px;
		--radius-lg: 16px;
		--radius-xl: 24px;

		--spacing-xs: 0.25rem;
		--spacing-sm: 0.5rem;
		--spacing-md: 1rem;
		--spacing-lg: 1.5rem;
		--spacing-xl: 2rem;
		--spacing-2xl: 3rem;
	}

	/* Initial Session Loading */
	.initial-session-loading {
		height: 40vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-md);
		color: var(--text-secondary);
		background: var(--surface-secondary);
		border-radius: var(--radius-lg);
		margin: var(--spacing-md);
		border: 1px solid var(--border-light);
	}

	.redirect-notice {
		padding: var(--spacing-xl);
		text-align: center;
		color: var(--text-secondary);
		font-style: italic;
	}

	/* Dashboard Header (maintained) */
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
		color: var(--text-primary);
	}

	.dashboard-title p {
		margin: 0;
		font-size: 0.875rem;
		color: var(--text-secondary);
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

	/* Dashboard Container & Grid */
	.dashboard-container {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
		padding: 0 var(--spacing-md);
	}

	.status-container {
		min-height: 0;
		transition: all 0.3s ease;
	}

	.status-banner {
		padding: var(--spacing-md);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-sm);
		animation: slideDown 0.4s ease-out;
		border: 1px solid transparent;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.status-banner.partial-loaded {
		background: linear-gradient(135deg, rgba(79, 172, 254, 0.05) 0%, rgba(0, 242, 254, 0.05) 100%);
		border-color: rgba(79, 172, 254, 0.2);
	}

	.status-banner.loading {
		background: var(--surface-tertiary);
		border-color: var(--border-light);
	}

	.status-content {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
	}

	.status-icon {
		font-size: 1.25rem;
	}

	.status-text h4 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.status-text p {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.status-progress {
		margin-left: auto;
		width: 150px;
	}

	.progress-meter {
		height: 4px;
		background: var(--border-light);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--primary-gradient);
		transition: width 0.5s ease;
	}

	/* Persistent Status Bar */
	.persistent-status-bar {
		margin-bottom: 16px;
		min-height: 48px;
		display: flex;
		align-items: center;
		border-radius: 8px;
		transition: all 0.3s ease;
	}

	.status-content.success {
		background: #f0f9ff;
		border: 1px solid #0ea5e9;
		color: #0c4a6e;
		padding: 8px 16px;
		border-radius: 8px;
		font-size: 0.875rem;
		width: 100%;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.status-content.info {
		background: #fefce8;
		border: 1px solid #facc15;
		color: #a16207;
		padding: 8px 16px;
		border-radius: 8px;
		font-size: 0.875rem;
		width: 100%;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.status-content.error {
		background: #fef2f2;
		border: 1px solid #fecaca;
		color: #b91c1c;
		padding: 8px 16px;
		border-radius: 8px;
		font-size: 0.875rem;
		width: 100%;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.status-content.loading {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		color: #6b7280;
		padding: 8px 16px;
		border-radius: 8px;
		font-size: 0.875rem;
		width: 100%;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.mini-spinner {
		width: 14px;
		height: 14px;
		border: 2px solid rgba(0, 0, 0, 0.1);
		border-top: 2px solid currentColor;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	/* Skeleton Styles */
	.dashboard-skeleton {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
		padding: var(--spacing-lg);
		background: var(--surface-glass);
		backdrop-filter: blur(10px);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-light);
	}

	.skeleton-header {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.skeleton-title {
		width: 200px;
		height: 24px;
		background: var(--surface-tertiary);
		border-radius: 4px;
		animation: pulse 1.5s infinite;
	}

	.skeleton-subtitle {
		width: 300px;
		height: 14px;
		background: var(--surface-tertiary);
		border-radius: 4px;
		animation: pulse 1.5s infinite;
	}

	.skeleton-chart {
		height: 300px;
		background: #f8fafc;
		border-radius: var(--radius-md);
		padding: var(--spacing-xl);
		display: flex;
		align-items: flex-end;
	}

	.skeleton-bars {
		display: flex;
		align-items: flex-end;
		gap: var(--spacing-md);
		width: 100%;
		height: 100%;
	}

	.skeleton-bar {
		flex: 1;
		background: var(--surface-tertiary);
		border-radius: 4px 4px 0 0;
		animation: pulse 1.5s infinite;
	}

	.skeleton-metrics {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--spacing-md);
	}

	.skeleton-metric {
		height: 100px;
		background: var(--surface-tertiary);
		border-radius: var(--radius-md);
		animation: pulse 1.5s infinite;
	}

	/* Utilities */
	.missing-data-notice {
		padding: var(--spacing-lg);
		background: #fefce8;
		border: 1px solid #facc15;
		border-radius: var(--radius-md);
		margin-top: var(--spacing-md);
	}

	.notice-content {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
	}

	.notice-icon {
		font-size: 1.5rem;
	}

	.notice-text h4 {
		margin: 0;
		color: #854d0e;
	}

	.notice-text p {
		margin: 0;
		font-size: 0.875rem;
		color: #a16207;
	}

	.loading-spinner {
		width: 24px;
		height: 24px;
		border: 3px solid var(--border-light);
		border-top: 3px solid var(--primary-gradient);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}

	.retry-button {
		margin-left: auto;
		background: var(--text-primary);
		color: white;
		border: none;
		padding: 4px 12px;
		border-radius: 4px;
		font-size: 0.75rem;
		cursor: pointer;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.skeleton-metrics {
			grid-template-columns: 1fr;
		}
		.status-progress {
			display: none;
		}
	}
</style>
