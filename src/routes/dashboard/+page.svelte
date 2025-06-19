<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { userSession } from '$lib/sessionStore';
	import { showToast } from '$lib/toastStore';
	import ShipmentChart from '$lib/ShipmentChart.svelte';
	import ErrorBoundary from '$lib/ErrorBoundary.svelte';

	// Start with session as undefined (unknown)
	let session: any = undefined;
	const unsubscribe = userSession.subscribe((s) => {
		session = s;
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
			// (no timeout here, it's handled by the console monitoring)

			// Phase 5: Financial data (slow) - wait a bit longer since Linnworks timing is variable
			setTimeout(() => {
				loadingStates.financial = false;
				animateProgress('financial', 100, 350);
				updateLoadingMessage();

				// Wait for both Linnworks completion and a minimum display time
				const waitForCompletion = () => {
					if (!loadingStates.linnworks && dashboardReady) {
						// Keep the Linnworks status message visible during final completion
						setTimeout(() => {
							showLinnworksStatus = false; // Hide the status message

							// Add an additional 0.5 second delay before loading the page
							setTimeout(() => {
								console.log('🎯 Dashboard loading complete - Preloaded data ready:', {
									hasLinnworksData: !!preloadedChartData.linnworks,
									hasFinancialData: !!preloadedChartData.financial,
									usePreloaded: preloadedChartData.usePreloaded
								});
								loading = false;
								showToast('Dashboard loaded successfully', 'success');
							}, 500);
						}, 1500);
					} else {
						// Check again in 200ms
						setTimeout(waitForCompletion, 200);
					}
				};
				waitForCompletion();
			}, 3000); // Increased timeout to give more time for Linnworks
		} catch (err) {
			handleError(err, 'initialize dashboard');
			loading = false;
		}
	}

	// Track if Linnworks API has completed its paginated fetch
	let linnworksApiCompleted = false;
	let linnworksDataQuality = { totalOrders: 0, expectedMinimum: 100 }; // Track data quality - expect at least 100 orders for a complete week
	let activePollingInterval: NodeJS.Timeout | null = null; // Track active polling for cleanup

	// Track data source status
	let dataSourceStatus = {
		linnworks: { isCached: false, isLoaded: false },
		financial: { isCached: false, isLoaded: false }
	};
	
	// Store preloaded data for ShipmentChart
	let preloadedChartData = {
		linnworks: null,
		financial: null,
		usePreloaded: false
	};

	// Enhanced preload that waits for substantial Linnworks data
	async function preloadDashboardData() {
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

			console.log('🔄 Starting dashboard data preload for week:', mondayStr, 'to', sundayStr);

			// Make initial API calls
			const [linnworksResponse, financialResponse] = await Promise.all([
				fetch(`/api/linnworks/weeklyOrderCounts?startDate=${mondayStr}&endDate=${sundayStr}`),
				fetch(`/api/linnworks/financialData?startDate=${mondayStr}&endDate=${sundayStr}`)
			]);

			if (!linnworksResponse.ok || !financialResponse.ok) {
				console.warn('Some API calls failed during preload, but continuing...');
				dashboardReady = true;
				return;
			}			const [linnworksData, financialData] = await Promise.all([
				linnworksResponse.json(),
				financialResponse.json()
			]);
			
			// Store preloaded data for ShipmentChart
			preloadedChartData.linnworks = linnworksData;
			preloadedChartData.financial = financialData;
			preloadedChartData.usePreloaded = true;
			
			// Update data source status
			dataSourceStatus.linnworks.isCached = linnworksData.isCached || false;
			dataSourceStatus.linnworks.isLoaded = true;
			dataSourceStatus.financial.isCached = financialData.isCached || false;
			dataSourceStatus.financial.isLoaded = true;

			// Check the quality of Linnworks data to determine if paginated fetch is complete
			const totalOrders = linnworksData.summary?.totalOrders || 0;
			const dailyOrdersCount = linnworksData.dailyOrders?.length || 0;

			console.log('📊 Initial Linnworks data received:', {
				totalOrders,
				dailyOrdersCount,
				hasOrderDetails: !!linnworksData.dailyOrders,
				isCached: dataSourceStatus.linnworks.isCached
			});

			console.log('💰 Financial data received:', {
				isLoaded: dataSourceStatus.financial.isLoaded,
				isCached: dataSourceStatus.financial.isCached
			});

			// Update data quality tracking
			linnworksDataQuality.totalOrders = totalOrders;

			// For a typical week, we expect at least some orders if the business is operating
			// If we have substantial data (> 100 orders for the week), likely paginated fetch is complete
			// If not, we'll poll for better data
			console.log('📊 Evaluating Linnworks data completeness:', {
				totalOrders,
				expectedMinimum: linnworksDataQuality.expectedMinimum,
				isComplete: totalOrders >= linnworksDataQuality.expectedMinimum,
				dailyOrdersStructure: !!linnworksData.dailyOrders
			});

			if (totalOrders >= linnworksDataQuality.expectedMinimum || dailyOrdersCount === 7) {
				console.log('✅ Linnworks data appears complete on first fetch');
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
			} else {
				console.log('⏳ Linnworks data seems incomplete, will poll for updates...');
				// Start polling for better data
				pollForCompleteData(mondayStr, sundayStr);
			}
		} catch (err) {
			console.error('Error preloading dashboard data:', err);
			dashboardReady = true; // Still show dashboard even if preload failed
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
				}				const data = await response.json();
				const totalOrders = data.summary?.totalOrders || 0;
				
				// Update preloaded data with improved data
				preloadedChartData.linnworks = data;
				
				// Update cache status for subsequent polls
				dataSourceStatus.linnworks.isCached = data.isCached || false;

				// Check if data has improved significantly
				const dataImproved = totalOrders > linnworksDataQuality.totalOrders;
				const hasSubstantialData = totalOrders >= linnworksDataQuality.expectedMinimum;

				if (dataImproved) {
					console.log(
						`📈 Linnworks data updated: ${linnworksDataQuality.totalOrders} -> ${totalOrders} orders (${dataSourceStatus.linnworks.isCached ? 'Cached' : 'Fresh'})`
					);
					linnworksDataQuality.totalOrders = totalOrders;
				}

				// Complete if we have substantial data or reached max polls
				if (hasSubstantialData || pollCount >= maxPolls) {
					if (activePollingInterval) {
						clearInterval(activePollingInterval);
						activePollingInterval = null;
					}

					if (hasSubstantialData) {
						console.log('✅ Linnworks data now appears complete');
					} else {
						console.log('⏰ Timeout reached, proceeding with available data');
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
		// Once we know the session, if it's null then redirect
		if (session === null) {
			goto('/login');
		} else if (session) {
			// Only initialize dashboard if we have a valid session
			initializeDashboard();
		}
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
