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

	// Simplified loading state enum
	type LoadingState = 'INITIALIZING' | 'LOADING_DATA' | 'VALIDATING' | 'READY' | 'ERROR';
	let loadingState: LoadingState = 'INITIALIZING';

	// Reset dashboard state on each page load
	function resetDashboardState() {
		dashboardInitialized = false;
		loadingState = 'INITIALIZING';
		error = null;
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

	// Separate state for the Linnworks status message
	let showLinnworksStatus = false;
	// Enhanced loading features
	let showDataPreview = false;
	let shipmentChartRef: any; // Reference to the ShipmentChart component

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
			loadingState = 'LOADING_DATA';
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

			// Start the UI loading simulation for better UX
			simulateLoadingPhases();

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

			// Validate the loaded data
			loadingState = 'VALIDATING';
			await validateLoadedData();

			// Mark as ready
			loadingState = 'READY';
			console.log('✅ Data loading completed successfully');
		} catch (err) {
			console.error('❌ Data loading failed:', err);
			loadingState = 'ERROR';
			throw err;
		}
	}

	// Simulate loading phases for better UX while real data loads
	function simulateLoadingPhases() {
		// Phase 1: Basic metrics setup (fast)
		setTimeout(() => {
			if (loadingState === 'LOADING_DATA') {
				console.log('✅ Phase 1: Metrics complete');
				loadingStates.metrics = false;
				animateProgress('metrics', 100, 200);
				updateLoadingMessage();
			}
		}, 300);

		// Phase 2: Employee data (medium)
		setTimeout(() => {
			if (loadingState === 'LOADING_DATA') {
				console.log('✅ Phase 2: Employees complete');
				loadingStates.employees = false;
				animateProgress('employees', 100, 250);
				updateLoadingMessage();
			}
		}, 600);

		// Phase 3: Schedule data (medium)
		setTimeout(() => {
			if (loadingState === 'LOADING_DATA') {
				console.log('✅ Phase 3: Schedules complete');
				loadingStates.schedules = false;
				animateProgress('schedules', 100, 300);
				updateLoadingMessage();
			}
		}, 900);
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
			// Brief delay for smooth transition
			setTimeout(() => {
				showToast('Dashboard loaded successfully', 'success');
			}, 300);
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

			console.log('📡 Making API calls...');

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

			console.log('📡 API responses received:', {
				currentLinnworks: currentLinnworksResponse.status,
				currentFinancial: currentFinancialResponse.status,
				previousLinnworks: previousLinnworksResponse.status,
				previousFinancial: previousFinancialResponse.status
			});

			// Parse successful responses
			const [
				currentLinnworksData,
				currentFinancialData,
				previousLinnworksData,
				previousFinancialData
			] = await Promise.all([
				currentLinnworksResponse.ok ? currentLinnworksResponse.json() : null,
				currentFinancialResponse.ok ? currentFinancialResponse.json() : null,
				previousLinnworksResponse.ok ? previousLinnworksResponse.json() : null,
				previousFinancialResponse.ok ? previousFinancialResponse.json() : null
			]);

			console.log('🔍 Dashboard preload results:');
			console.log('Current week Linnworks:', currentLinnworksData ? 'Success' : 'Failed');
			console.log('Current week Financial:', currentFinancialData ? 'Success' : 'Failed');
			console.log('Previous week Linnworks:', previousLinnworksData ? 'Success' : 'Failed');
			console.log('Previous week Financial:', previousFinancialData ? 'Success' : 'Failed');

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
			dataSourceStatus.linnworks.isCached = currentLinnworksData?.isCached || false;
			dataSourceStatus.linnworks.isLoaded = !!currentLinnworksData;
			dataSourceStatus.financial.isCached = currentFinancialData?.isCached || false;
			dataSourceStatus.financial.isLoaded = !!currentFinancialData;

			console.log('✅ Preload completed successfully');
		} catch (err) {
			console.error('Error preloading dashboard data:', err);
			throw err;
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
</script>

{#if session === undefined || loadingState !== 'READY'}
	<div class="loading-container">
		<div class="loading-content">
			<!-- Main Content Grid -->
			<div class="loading-main-grid">
				<!-- Left Column: Header and Spinner -->
				<div class="loading-left-panel">
					<!-- Header Section -->
					<div class="loading-header">
						<div class="logo-section">
							<div class="logo-icon">
								<svg width="40" height="40" viewBox="0 0 40 40" fill="none">
									<rect width="40" height="40" rx="12" fill="url(#gradient1)" />
									<path
										d="M12 20L18 26L28 14"
										stroke="white"
										stroke-width="3"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
									<defs>
										<linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
											<stop offset="0%" style="stop-color:#667eea" />
											<stop offset="100%" style="stop-color:#764ba2" />
										</linearGradient>
									</defs>
								</svg>
							</div>
							<div class="logo-text">
								<h1>Operations Dashboard</h1>
								<p>Initializing your workspace</p>
							</div>
						</div>
					</div>

					<!-- Main Spinner Section -->
					<div class="spinner-section">
						<div class="spinner-container">
							<svg class="main-spinner" viewBox="0 0 100 100">
								<defs>
									<linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
										<stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
										<stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
									</linearGradient>
								</defs>
								<circle class="spinner-track" cx="50" cy="50" r="45" />
								<circle class="spinner-path" cx="50" cy="50" r="45" />
							</svg>
							<div class="spinner-center">
								<div class="pulse-dot"></div>
							</div>
						</div>
						<div class="loading-message-container">
							<p class="loading-message">{loadingMessage}</p>
							<div class="message-indicator">
								<span></span>
								<span></span>
								<span></span>
							</div>
						</div>
					</div>
				</div>

				<!-- Right Column: Progress Cards -->
				<div class="loading-right-panel">
					{#if loadingState !== 'READY'}
						<div class="progress-grid">
							<div
								class="progress-card"
								class:completed={!loadingStates.metrics}
								class:active={loadingStates.metrics}
							>
								<div class="card-header">
									<div class="card-icon metrics-icon">
										<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
											<path
												d="M3 3v18h18"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
											/>
											<path
												d="M18 9l-5 5-4-4-5 5"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
										</svg>
									</div>
									<div class="card-status">
										{#if !loadingStates.metrics}
											<div class="status-complete">✓</div>
										{:else}
											<div class="status-loading">
												<div class="mini-spinner"></div>
											</div>
										{/if}
									</div>
								</div>
								<div class="card-content">
									<h3>Dashboard Metrics</h3>
									<p>Setting up analytics engine</p>
									<div class="progress-track">
										<div class="progress-bar" style="width: {loadingProgress.metrics}%"></div>
									</div>
								</div>
							</div>

							<div
								class="progress-card"
								class:completed={!loadingStates.employees}
								class:active={loadingStates.employees}
							>
								<div class="card-header">
									<div class="card-icon employees-icon">
										<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
											<path
												d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
												stroke="currentColor"
												stroke-width="2"
											/>
											<circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2" />
											<path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" stroke-width="2" />
											<path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="2" />
										</svg>
									</div>
									<div class="card-status">
										{#if !loadingStates.employees}
											<div class="status-complete">✓</div>
										{:else}
											<div class="status-loading">
												<div class="mini-spinner"></div>
											</div>
										{/if}
									</div>
								</div>
								<div class="card-content">
									<h3>Employee Data</h3>
									<p>Loading team information</p>
									<div class="progress-track">
										<div class="progress-bar" style="width: {loadingProgress.employees}%"></div>
									</div>
								</div>
							</div>

							<div
								class="progress-card"
								class:completed={!loadingStates.schedules}
								class:active={loadingStates.schedules}
							>
								<div class="card-header">
									<div class="card-icon schedules-icon">
										<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
											<rect
												x="3"
												y="4"
												width="18"
												height="18"
												rx="2"
												ry="2"
												stroke="currentColor"
												stroke-width="2"
											/>
											<line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2" />
											<line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2" />
											<line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2" />
										</svg>
									</div>
									<div class="card-status">
										{#if !loadingStates.schedules}
											<div class="status-complete">✓</div>
										{:else}
											<div class="status-loading">
												<div class="mini-spinner"></div>
											</div>
										{/if}
									</div>
								</div>
								<div class="card-content">
									<h3>Schedule Data</h3>
									<p>Syncing work schedules</p>
									<div class="progress-track">
										<div class="progress-bar" style="width: {loadingProgress.schedules}%"></div>
									</div>
								</div>
							</div>

							<div
								class="progress-card"
								class:completed={!loadingStates.linnworks}
								class:active={loadingStates.linnworks}
							>
								<div class="card-header">
									<div class="card-icon linnworks-icon">
										<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
											<path
												d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
												stroke="currentColor"
												stroke-width="2"
											/>
											<polyline
												points="3.27,6.96 12,12.01 20.73,6.96"
												stroke="currentColor"
												stroke-width="2"
											/>
											<line
												x1="12"
												y1="22.08"
												x2="12"
												y2="12"
												stroke="currentColor"
												stroke-width="2"
											/>
										</svg>
									</div>
									<div class="card-status">
										{#if !loadingStates.linnworks}
											<div class="status-complete">✓</div>
										{:else}
											<div class="status-loading">
												<div class="mini-spinner"></div>
											</div>
										{/if}
									</div>
								</div>
								<div class="card-content">
									<h3>Linnworks API</h3>
									<p>Fetching order data</p>
									<div class="progress-track">
										<div class="progress-bar" style="width: {loadingProgress.linnworks}%"></div>
									</div>
								</div>
							</div>

							<div
								class="progress-card"
								class:completed={!loadingStates.financial}
								class:active={loadingStates.financial}
							>
								<div class="card-header">
									<div class="card-icon financial-icon">
										<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
											<line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" stroke-width="2" />
											<path
												d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
												stroke="currentColor"
												stroke-width="2"
											/>
										</svg>
									</div>
									<div class="card-status">
										{#if !loadingStates.financial}
											<div class="status-complete">✓</div>
										{:else}
											<div class="status-loading">
												<div class="mini-spinner"></div>
											</div>
										{/if}
									</div>
								</div>
								<div class="card-content">
									<h3>Financial Data</h3>
									<p>Processing sales metrics</p>
									<div class="progress-track">
										<div class="progress-bar" style="width: {loadingProgress.financial}%"></div>
									</div>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Enhanced Dashboard Preview -->
			<div class="dashboard-preview">
				<div class="preview-header">
					<div class="preview-title">
						<div class="shimmer-box title-shimmer"></div>
						<div class="shimmer-box subtitle-shimmer"></div>
					</div>
					<div class="preview-actions">
						<div class="shimmer-box button-shimmer"></div>
						<div class="shimmer-box button-shimmer"></div>
					</div>
				</div>
				<div class="preview-content">
					<div class="preview-chart">
						<div class="chart-header">
							<div class="shimmer-box chart-title"></div>
							<div class="shimmer-box chart-legend"></div>
						</div>
						<div class="chart-body">
							<div class="chart-bars">
								<div class="chart-bar" style="height: 60%"></div>
								<div class="chart-bar" style="height: 85%"></div>
								<div class="chart-bar" style="height: 45%"></div>
								<div class="chart-bar" style="height: 75%"></div>
								<div class="chart-bar" style="height: 90%"></div>
								<div class="chart-bar" style="height: 55%"></div>
								<div class="chart-bar" style="height: 70%"></div>
							</div>
						</div>
					</div>
					<div class="preview-metrics">
						<div class="metric-card">
							<div class="shimmer-box metric-icon"></div>
							<div class="metric-content">
								<div class="shimmer-box metric-value"></div>
								<div class="shimmer-box metric-label"></div>
							</div>
						</div>
						<div class="metric-card">
							<div class="shimmer-box metric-icon"></div>
							<div class="metric-content">
								<div class="shimmer-box metric-value"></div>
								<div class="shimmer-box metric-label"></div>
							</div>
						</div>
						<div class="metric-card">
							<div class="shimmer-box metric-icon"></div>
							<div class="metric-content">
								<div class="shimmer-box metric-value"></div>
								<div class="shimmer-box metric-label"></div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Status Notifications -->
			{#if showDataPreview}
				<div class="status-notifications fade-in">
					<div class="notification success">
						<div class="notification-icon">
							<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
								<path
									d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
									fill="currentColor"
								/>
							</svg>
						</div>
						<div class="notification-content">
							<h4>Orders Data Synced</h4>
							<p>Successfully connected to order management system</p>
						</div>
					</div>
					<div class="notification success">
						<div class="notification-icon">
							<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
								<path
									d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"
									fill="currentColor"
								/>
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
									clip-rule="evenodd"
									fill="currentColor"
								/>
							</svg>
						</div>
						<div class="notification-content">
							<h4>Sales Metrics Ready</h4>
							<p>Financial data processing completed</p>
						</div>
					</div>
				</div>
			{/if}

			<!-- Data Source Status Panel -->
			{#if dataSourceStatus.linnworks.isLoaded || dataSourceStatus.financial.isLoaded}
				<div class="data-sources-panel fade-in">
					<div class="panel-header">
						<h3>Data Sources</h3>
						<div class="panel-indicator">
							<div class="indicator-dot active"></div>
							<span>Live</span>
						</div>
					</div>
					<div class="sources-grid">
						{#if dataSourceStatus.linnworks.isLoaded}
							<div class="source-item">
								<div class="source-icon linnworks">
									<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
										<path
											d="M17.5 13.333V6.667a1.667 1.667 0 00-.833-1.442l-5.834-3.334a1.667 1.667 0 00-1.666 0L3.333 5.225A1.667 1.667 0 002.5 6.667v6.666a1.667 1.667 0 00.833 1.442l5.834 3.334a1.667 1.667 0 001.666 0l5.834-3.334a1.667 1.667 0 00.833-1.442z"
											stroke="currentColor"
											stroke-width="1.5"
										/>
										<path
											d="M2.725 5.8L10 10.008l7.275-4.208M10 18.4V10"
											stroke="currentColor"
											stroke-width="1.5"
										/>
									</svg>
								</div>
								<div class="source-details">
									<h4>Linnworks API</h4>
									<p>Order management system</p>
								</div>
								<div
									class="source-status {dataSourceStatus.linnworks.isCached ? 'cached' : 'fresh'}"
								>
									{dataSourceStatus.linnworks.isCached ? 'Cached' : 'Fresh'}
								</div>
							</div>
						{/if}
						{#if dataSourceStatus.financial.isLoaded}
							<div class="source-item">
								<div class="source-icon financial">
									<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
										<path
											d="M10 .833L10 19.167M14.167 4.167H7.917a2.917 2.917 0 000 5.833h4.166a2.917 2.917 0 010 5.833H5"
											stroke="currentColor"
											stroke-width="1.5"
										/>
									</svg>
								</div>
								<div class="source-details">
									<h4>Financial Data</h4>
									<p>Sales and revenue metrics</p>
								</div>
								<div
									class="source-status {dataSourceStatus.financial.isCached ? 'cached' : 'fresh'}"
								>
									{dataSourceStatus.financial.isCached ? 'Cached' : 'Fresh'}
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Processing Status -->
			{#if showLinnworksStatus}
				<div class="processing-status fade-in">
					<div class="status-content">
						<div class="status-icon-animated">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
								<path
									d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
									stroke="currentColor"
									stroke-width="2"
									stroke-linejoin="round"
								/>
							</svg>
						</div>
						<div class="status-text">
							<h4>Processing Complete</h4>
							<p>Linnworks data loaded - Finalizing financial metrics</p>
						</div>
					</div>
					<div class="processing-bar">
						<div class="processing-fill"></div>
					</div>
				</div>
			{/if}

			<!-- Debug Tools (only show during loading) -->
			{#if loadingState !== 'READY'}
				<div class="debug-section fade-in" style="margin-top: 2rem;">
					<button
						class="debug-btn"
						on:click={forceLoadingComplete}
						title="Force complete loading if stuck (development tool)"
					>
						🔧 Force Complete Loading
					</button>
					<button
						class="debug-btn"
						on:click={testApiEndpoints}
						title="Test API endpoints manually (development tool)"
						style="margin-left: 1rem;"
					>
						🧪 Test APIs
					</button>
					<p class="debug-text">Debug tools: Force completion or test API endpoints manually</p>
				</div>
			{/if}
		</div>
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
				disabled={loadingState !== 'READY'}
				title="Clear all cached data and fetch fresh data from APIs"
			>
				{#if loadingState !== 'READY'}
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

	/* Main Layout Grid */
	.loading-main-grid {
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: var(--spacing-xl);
		margin-bottom: var(--spacing-lg);
	}

	.loading-left-panel {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		text-align: center;
	}

	.loading-right-panel {
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	/* Loading Container */
	.loading-container {
		min-height: 50vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
		padding: var(--spacing-md);
		border-radius: var(--radius-lg);
		margin: var(--spacing-sm);
		position: relative;
		overflow: hidden;
	}

	.loading-container::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background:
			radial-gradient(circle at 20% 50%, rgba(102, 126, 234, 0.1) 0%, transparent 50%),
			radial-gradient(circle at 80% 20%, rgba(118, 75, 162, 0.1) 0%, transparent 50%),
			radial-gradient(circle at 40% 80%, rgba(240, 147, 251, 0.1) 0%, transparent 50%);
		animation: backgroundShift 20s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes backgroundShift {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.8;
		}
	}

	.loading-content {
		position: relative;
		max-width: 900px;
		width: 100%;
		background: var(--surface-glass);
		backdrop-filter: blur(20px);
		border-radius: var(--radius-xl);
		padding: var(--spacing-lg);
		box-shadow:
			var(--shadow-xl),
			0 0 40px rgba(0, 0, 0, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.8);
		animation: containerFadeIn 0.8s ease-out;
	}

	@keyframes containerFadeIn {
		from {
			opacity: 0;
			transform: translateY(30px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	/* Header Section */
	.loading-header {
		text-align: center;
		margin-bottom: var(--spacing-md);
	}

	.logo-section {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-sm);
	}

	.logo-icon {
		animation: logoFloat 3s ease-in-out infinite;
	}

	@keyframes logoFloat {
		0%,
		100% {
			transform: translateY(0px);
		}
		50% {
			transform: translateY(-5px);
		}
	}

	.logo-text h1 {
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
		color: var(--text-primary);
		background: var(--primary-gradient);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.logo-text p {
		margin: var(--spacing-xs) 0 0 0;
		font-size: 1rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	/* Main Spinner Section */
	.spinner-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-lg);
	}

	.spinner-container {
		position: relative;
		width: 80px;
		height: 80px;
	}

	.main-spinner {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
		animation: spinRotate 3s linear infinite;
	}

	.spinner-track {
		fill: none;
		stroke: rgba(102, 126, 234, 0.1);
		stroke-width: 3;
	}

	.spinner-path {
		fill: none;
		stroke: url(#spinnerGradient);
		stroke-width: 3;
		stroke-linecap: round;
		stroke-dasharray: 283;
		stroke-dashoffset: 283;
		animation: spinProgress 2s ease-in-out infinite;
	}

	@keyframes spinRotate {
		from {
			transform: rotate(-90deg);
		}
		to {
			transform: rotate(270deg);
		}
	}

	@keyframes spinProgress {
		0% {
			stroke-dashoffset: 283;
		}
		50% {
			stroke-dashoffset: 70;
		}
		100% {
			stroke-dashoffset: 283;
		}
	}

	.spinner-center {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	.pulse-dot {
		width: 16px;
		height: 16px;
		background: var(--primary-gradient);
		border-radius: 50%;
		animation: pulseGlow 2s ease-in-out infinite;
		box-shadow: 0 0 20px rgba(102, 126, 234, 0.4);
	}

	@keyframes pulseGlow {
		0%,
		100% {
			transform: scale(1);
			box-shadow: 0 0 20px rgba(102, 126, 234, 0.4);
		}
		50% {
			transform: scale(1.2);
			box-shadow: 0 0 30px rgba(102, 126, 234, 0.8);
		}
	}

	/* Loading Message */
	.loading-message-container {
		text-align: center;
	}

	.loading-message {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 var(--spacing-md) 0;
		animation: messageSlide 0.5s ease-out;
	}

	@keyframes messageSlide {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.message-indicator {
		display: flex;
		justify-content: center;
		gap: 6px;
	}

	.message-indicator span {
		width: 8px;
		height: 8px;
		background: var(--primary-gradient);
		border-radius: 50%;
		animation: dotBounce 1.4s ease-in-out infinite both;
	}

	.message-indicator span:nth-child(1) {
		animation-delay: -0.32s;
	}
	.message-indicator span:nth-child(2) {
		animation-delay: -0.16s;
	}
	.message-indicator span:nth-child(3) {
		animation-delay: 0;
	}

	@keyframes dotBounce {
		0%,
		80%,
		100% {
			transform: scale(0.8);
			opacity: 0.5;
		}
		40% {
			transform: scale(1.2);
			opacity: 1;
		}
	}

	/* Progress Grid */
	.progress-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--spacing-sm);
		margin-bottom: 0;
	}

	.progress-card {
		background: var(--surface-elevated);
		backdrop-filter: blur(10px);
		border-radius: var(--radius-md);
		padding: var(--spacing-sm);
		border: 1px solid var(--border-light);
		box-shadow: var(--shadow-md);
		transition: all 0.3s ease;
		position: relative;
		overflow: hidden;
	}

	.progress-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: var(--border-light);
		transition: all 0.3s ease;
	}

	.progress-card.active {
		border-color: var(--border-accent);
		box-shadow: var(--shadow-lg), var(--shadow-glow);
		transform: translateY(-2px);
	}

	.progress-card.active::before {
		background: var(--primary-gradient);
	}

	.progress-card.completed {
		background: linear-gradient(135deg, rgba(79, 172, 254, 0.05) 0%, rgba(0, 242, 254, 0.05) 100%);
		border-color: rgba(79, 172, 254, 0.3);
		transform: scale(1.02);
	}

	.progress-card.completed::before {
		background: var(--success-gradient);
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--spacing-sm);
	}

	.card-icon {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		transition: all 0.3s ease;
	}

	.metrics-icon {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	}
	.employees-icon {
		background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
	}
	.schedules-icon {
		background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
	}
	.linnworks-icon {
		background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
	}
	.financial-icon {
		background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
	}

	.card-status {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.status-complete {
		width: 28px;
		height: 28px;
		background: var(--success-gradient);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-weight: 700;
		font-size: 12px;
		animation: checkmarkPop 0.5s ease-out;
	}

	@keyframes checkmarkPop {
		0% {
			transform: scale(0);
			opacity: 0;
		}
		50% {
			transform: scale(1.2);
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	.status-loading {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.mini-spinner {
		width: 18px;
		height: 18px;
		border: 2px solid var(--border-light);
		border-top: 2px solid #667eea;
		border-radius: 50%;
		animation: miniSpin 1s linear infinite;
	}

	@keyframes miniSpin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.card-content h3 {
		margin: 0 0 var(--spacing-xs) 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.card-content p {
		margin: 0 0 var(--spacing-sm) 0;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.progress-track {
		width: 100%;
		height: 6px;
		background: var(--border-light);
		border-radius: 3px;
		overflow: hidden;
	}

	.progress-bar {
		height: 100%;
		background: var(--primary-gradient);
		border-radius: 3px;
		transition: width 0.3s ease;
		position: relative;
	}

	.progress-bar::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		right: 0;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
		animation: progressShine 2s ease-in-out infinite;
	}

	@keyframes progressShine {
		0% {
			transform: translateX(-100%);
		}
		50%,
		100% {
			transform: translateX(100%);
		}
	}

	/* Dashboard Preview */
	.dashboard-preview {
		background: var(--surface-elevated);
		backdrop-filter: blur(10px);
		border-radius: var(--radius-lg);
		padding: var(--spacing-lg);
		margin-bottom: var(--spacing-lg);
		border: 1px solid var(--border-light);
		box-shadow: var(--shadow-md);
	}

	.preview-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-lg);
	}

	.preview-title {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.title-shimmer {
		width: 240px;
		height: 28px;
	}

	.subtitle-shimmer {
		width: 180px;
		height: 16px;
	}

	.preview-actions {
		display: flex;
		gap: var(--spacing-sm);
	}

	.button-shimmer {
		width: 100px;
		height: 36px;
	}

	.preview-content {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.preview-chart {
		border-radius: var(--radius-md);
		border: 1px solid var(--border-light);
		padding: var(--spacing-md);
		background: var(--surface-primary);
	}

	.chart-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-md);
	}

	.chart-title {
		width: 160px;
		height: 20px;
	}

	.chart-legend {
		width: 120px;
		height: 16px;
	}

	.chart-body {
		height: 120px;
		display: flex;
		align-items: end;
		justify-content: center;
		padding: var(--spacing-md);
	}

	.chart-bars {
		display: flex;
		align-items: end;
		gap: 12px;
		height: 100%;
		width: 100%;
		max-width: 400px;
	}

	.chart-bar {
		flex: 1;
		background: var(--primary-gradient);
		border-radius: 4px 4px 0 0;
		min-height: 20px;
		animation: barGrow 1.5s ease-out;
		animation-fill-mode: both;
		opacity: 0.8;
		transition: opacity 0.3s ease;
	}

	.chart-bar:hover {
		opacity: 1;
	}

	.chart-bar:nth-child(1) {
		animation-delay: 0.1s;
	}
	.chart-bar:nth-child(2) {
		animation-delay: 0.2s;
	}
	.chart-bar:nth-child(3) {
		animation-delay: 0.3s;
	}
	.chart-bar:nth-child(4) {
		animation-delay: 0.4s;
	}
	.chart-bar:nth-child(5) {
		animation-delay: 0.5s;
	}
	.chart-bar:nth-child(6) {
		animation-delay: 0.6s;
	}
	.chart-bar:nth-child(7) {
		animation-delay: 0.7s;
	}

	@keyframes barGrow {
		from {
			height: 0;
			opacity: 0;
		}
		to {
			opacity: 0.8;
		}
	}

	.preview-metrics {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: var(--spacing-md);
	}

	.metric-card {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-md);
		background: var(--surface-primary);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-light);
		box-shadow: var(--shadow-sm);
	}

	.metric-icon {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-sm);
	}

	.metric-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.metric-value {
		width: 80px;
		height: 20px;
	}

	.metric-label {
		width: 120px;
		height: 14px;
	}

	/* Shimmer Animation */
	.shimmer-box {
		background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: var(--radius-sm);
	}

	@keyframes shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}

	/* Status Notifications */
	.status-notifications {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-2xl);
	}

	.notification {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		padding: var(--spacing-lg);
		background: var(--surface-elevated);
		backdrop-filter: blur(10px);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-light);
		box-shadow: var(--shadow-md);
		animation: notificationSlide 0.5s ease-out;
	}

	.notification.success {
		border-color: rgba(79, 172, 254, 0.3);
		background: linear-gradient(135deg, rgba(79, 172, 254, 0.05) 0%, rgba(0, 242, 254, 0.05) 100%);
	}

	@keyframes notificationSlide {
		from {
			opacity: 0;
			transform: translateX(-20px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	.notification-icon {
		width: 40px;
		height: 40px;
		background: var(--success-gradient);
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		flex-shrink: 0;
	}

	.notification-content h4 {
		margin: 0 0 var(--spacing-xs) 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.notification-content p {
		margin: 0;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	/* Data Sources Panel */
	.data-sources-panel {
		background: var(--surface-elevated);
		backdrop-filter: blur(10px);
		border-radius: var(--radius-lg);
		padding: var(--spacing-xl);
		margin-bottom: var(--spacing-2xl);
		border: 1px solid var(--border-light);
		box-shadow: var(--shadow-md);
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-lg);
	}

	.panel-header h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.panel-indicator {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.indicator-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #22c55e;
		animation: dotPulse 2s ease-in-out infinite;
	}

	@keyframes dotPulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.sources-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.source-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		padding: var(--spacing-lg);
		background: var(--surface-primary);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-light);
		box-shadow: var(--shadow-sm);
		transition: all 0.3s ease;
	}

	.source-item:hover {
		box-shadow: var(--shadow-md);
		transform: translateY(-1px);
	}

	.source-icon {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		flex-shrink: 0;
	}

	.source-icon.linnworks {
		background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
	}

	.source-icon.financial {
		background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
	}

	.source-details {
		flex: 1;
	}

	.source-details h4 {
		margin: 0 0 var(--spacing-xs) 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.source-details p {
		margin: 0;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.source-status {
		padding: var(--spacing-xs) var(--spacing-md);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		border: 1px solid;
	}

	.source-status.cached {
		background: linear-gradient(135deg, #dbeafe 0%, #e0f2fe 100%);
		color: #0369a1;
		border-color: #7dd3fc;
	}

	.source-status.fresh {
		background: linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%);
		color: #166534;
		border-color: #86efac;
	}

	/* Processing Status */
	.processing-status {
		background: var(--surface-elevated);
		backdrop-filter: blur(10px);
		border-radius: var(--radius-lg);
		padding: var(--spacing-xl);
		border: 1px solid var(--border-accent);
		box-shadow: var(--shadow-lg), var(--shadow-glow);
		position: relative;
		overflow: hidden;
	}

	.processing-status::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: var(--primary-gradient);
	}

	.status-content {
		display: flex;
		align-items: center;
		gap: var(--spacing-lg);
		margin-bottom: var(--spacing-lg);
	}

	.status-icon-animated {
		width: 48px;
		height: 48px;
		background: var(--primary-gradient);
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		animation: iconFloat 2s ease-in-out infinite;
	}

	@keyframes iconFloat {
		0%,
		100% {
			transform: translateY(0px) rotate(0deg);
		}
		50% {
			transform: translateY(-3px) rotate(5deg);
		}
	}

	.status-text h4 {
		margin: 0 0 var(--spacing-xs) 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.status-text p {
		margin: 0;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.processing-bar {
		width: 100%;
		height: 4px;
		background: var(--border-light);
		border-radius: 2px;
		overflow: hidden;
	}

	.processing-fill {
		height: 100%;
		background: var(--primary-gradient);
		border-radius: 2px;
		animation: processingFlow 2s ease-in-out infinite;
	}

	@keyframes processingFlow {
		0% {
			width: 0%;
		}
		50% {
			width: 70%;
		}
		100% {
			width: 100%;
		}
	}

	/* Debug Section */
	.debug-section {
		text-align: center;
		padding: var(--spacing-lg);
		background: rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-md);
		border: 1px dashed rgba(255, 255, 255, 0.3);
	}

	.debug-btn {
		background: linear-gradient(135deg, #ff9500 0%, #ff6b6b 100%);
		color: white;
		border: none;
		padding: var(--spacing-sm) var(--spacing-lg);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: var(--shadow-sm);
	}

	.debug-btn:hover {
		background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
		transform: translateY(-1px);
		box-shadow: 0 4px 8px rgba(255, 107, 107, 0.3);
	}

	.debug-btn:active:not(:disabled) {
		transform: translateY(0);
		box-shadow: 0 2px 4px rgba(255, 107, 107, 0.2);
	}

	.clear-cache-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	.debug-text {
		margin: var(--spacing-sm) 0 0 0;
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.7);
		font-style: italic;
	}

	/* Fade In Animation */
	.fade-in {
		animation: fadeIn 0.8s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Dashboard Actions (existing styles maintained) */
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

	/* Responsive Design */
	@media (max-width: 768px) {
		.loading-main-grid {
			grid-template-columns: 1fr;
			gap: var(--spacing-lg);
		}

		.loading-container {
			margin: var(--spacing-sm);
			padding: var(--spacing-md);
			min-height: 50vh;
		}

		.loading-content {
			padding: var(--spacing-md);
		}

		.logo-section {
			flex-direction: column;
			gap: var(--spacing-sm);
		}

		.logo-text h1 {
			font-size: 1.5rem;
		}

		.progress-grid {
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: var(--spacing-sm);
		}

		.preview-metrics {
			grid-template-columns: 1fr;
		}

		.chart-body {
			height: 100px;
		}

		.panel-header {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--spacing-sm);
		}
	}

	@media (max-width: 480px) {
		.loading-container {
			margin: var(--spacing-xs);
			padding: var(--spacing-sm);
			min-height: 45vh;
		}

		.loading-content {
			padding: var(--spacing-sm);
		}

		.progress-grid {
			grid-template-columns: 1fr;
		}

		.spinner-container {
			width: 60px;
			height: 60px;
		}

		.logo-text h1 {
			font-size: 1.25rem;
		}

		.notification {
			flex-direction: column;
			text-align: center;
		}

		.debug-section {
			flex-direction: column;
			gap: var(--spacing-sm);
		}

		.debug-btn {
			margin-left: 0 !important;
		}
	}
</style>
