<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { writable } from 'svelte/store';
	import BuyBoxAlert from '$lib/components/BuyBoxAlert.svelte';
	import CompetitorAnalysisTable from '$lib/components/CompetitorAnalysisTable.svelte';
	import type { BuyBoxAlert as BuyBoxAlertType, BuyBoxData } from '$lib/types/buyBoxTypes';

	interface BuyBoxStatus {
		asin: string;
		sku?: string;
		title?: string;
		has_buy_box: boolean;
		current_price?: number;
		our_price?: number;
		buy_box_winner?: string;
		competitor_count: number;
		merchant_shipping_group?: string;
		priority: number;
		last_checked: string;
		alert_count_24h: number;
		status: 'success' | 'warning' | 'danger';
	}

	interface DashboardSummary {
		total_asins: number;
		has_buy_box: number;
		lost_buy_box: number;
		warnings: number;
	}

	interface DashboardData {
		success: boolean;
		data: BuyBoxStatus[];
		summary: DashboardSummary;
		last_updated: string;
		error?: string;
	}

	interface ValidationMismatch {
		asin: string;
		currentSku: string;
		correctSku: string;
		notFound: boolean;
	}

	// Reactive stores
	const dashboardData = writable<DashboardData | null>(null);
	const isLoading = writable(true);
	const error = writable<string | null>(null);
	const lastUpdate = writable<string>('Never');
	const autoRefresh = writable(true);

	// Buy box alert management
	const activeAlerts = writable<BuyBoxAlertType[]>([]);
	const selectedCompetitorData = writable<BuyBoxData | null>(null);
	const showCompetitorAnalysis = writable(false);

	let refreshInterval: NodeJS.Timeout | null = null;
	const REFRESH_INTERVAL = 30000; // 30 seconds
	const API_BASE_URL = 'http://localhost:3001'; // Your Express server

	// Load dashboard data
	async function loadDashboard() {
		try {
			isLoading.set(true);
			error.set(null);

			const response = await fetch(`${API_BASE_URL}/api/buybox-status/dashboard`);
			const result: DashboardData = await response.json();

			if (!result.success) {
				throw new Error(result.error || 'Failed to load dashboard data');
			}

			dashboardData.set(result);
			lastUpdate.set(new Date().toLocaleTimeString());

			// Generate alerts from dashboard data
			const alerts = generateAlertsFromDashboard(result.data);
			activeAlerts.set(alerts);
		} catch (err: any) {
			console.error('Error loading dashboard:', err);
			error.set(err.message);
		} finally {
			isLoading.set(false);
		}
	}

	// Setup auto-refresh
	function setupAutoRefresh() {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}

		autoRefresh.subscribe((enabled) => {
			if (enabled) {
				refreshInterval = setInterval(loadDashboard, REFRESH_INTERVAL);
			} else if (refreshInterval) {
				clearInterval(refreshInterval);
				refreshInterval = null;
			}
		});
	}

	// Format helpers
	function formatPrice(price: number | undefined): string {
		return price ? `£${price.toFixed(2)}` : 'N/A';
	}

	function formatTimeAgo(dateString: string): string {
		if (!dateString) return 'Never checked';

		const now = new Date();
		const date = new Date(dateString);
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		return `${diffDays}d ago`;
	}

	function getStatusInfo(status: string, hasBuyBox: boolean) {
		switch (status) {
			case 'success':
				return {
					text: hasBuyBox ? 'Has Buy Box' : 'OK',
					emoji: hasBuyBox ? '✅' : '✅',
					bgClass: 'bg-green-50',
					textClass: 'text-green-800',
					borderClass: 'border-l-green-500'
				};
			case 'warning':
				return {
					text: 'Warning',
					emoji: '⚠️',
					bgClass: 'bg-yellow-50',
					textClass: 'text-yellow-800',
					borderClass: 'border-l-yellow-500'
				};
			case 'danger':
				return {
					text: 'Lost Buy Box',
					emoji: '❌',
					bgClass: 'bg-red-50',
					textClass: 'text-red-800',
					borderClass: 'border-l-red-500'
				};
			default:
				return {
					text: 'Unknown',
					emoji: '❓',
					bgClass: 'bg-gray-50',
					textClass: 'text-gray-800',
					borderClass: 'border-l-gray-500'
				};
		}
	}

	function truncateText(text: string | undefined, maxLength: number): string {
		if (!text) return '';
		return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
	}

	// Generate alerts from dashboard data
	function generateAlertsFromDashboard(data: BuyBoxStatus[]): BuyBoxAlertType[] {
		const alerts: BuyBoxAlertType[] = [];

		data.forEach((status) => {
			// Generate buy box lost alerts
			if (!status.has_buy_box && status.status === 'danger') {
				alerts.push({
					id: `alert-${status.asin}-buybox-lost`,
					asin: status.asin,
					productName: status.title,
					sku: status.sku,
					timestamp: new Date().toISOString(),
					alertType: 'BUY_BOX_LOST',
					severity: 'CRITICAL',
					data: createMockBuyBoxData(status),
					recommendations: [
						'Review pricing strategy immediately',
						'Check if competitors have better shipping terms',
						'Consider adjusting inventory levels'
					]
				});
			}

			// Generate price change warnings
			if (status.status === 'warning' && status.current_price && status.our_price) {
				const priceDiff = Math.abs(status.current_price - status.our_price);
				if (priceDiff > status.our_price * 0.05) {
					// 5% price difference
					alerts.push({
						id: `alert-${status.asin}-price-change`,
						asin: status.asin,
						productName: status.title,
						sku: status.sku,
						timestamp: new Date().toISOString(),
						alertType: 'PRICE_CHANGE',
						severity: 'HIGH',
						data: createMockBuyBoxData(status),
						recommendations: [
							`Current market price is £${status.current_price.toFixed(2)} vs your price £${status.our_price.toFixed(2)}`,
							'Consider price adjustment to remain competitive'
						]
					});
				}
			}
		});

		return alerts;
	}

	// Create mock buy box data from dashboard status
	function createMockBuyBoxData(status: BuyBoxStatus): BuyBoxData {
		return {
			ASIN: status.asin,
			status: 'Success',
			ItemCondition: 'New',
			marketplaceId: 'A1F83G8C2ARO7P',
			Identifier: {
				ASIN: status.asin,
				ItemCondition: 'New',
				MarketplaceId: 'A1F83G8C2ARO7P'
			},
			Summary: {
				TotalOfferCount: status.competitor_count,
				BuyBoxPrices: status.current_price
					? [
							{
								condition: 'New',
								LandedPrice: { Amount: status.current_price, CurrencyCode: 'GBP' },
								ListingPrice: { Amount: status.current_price, CurrencyCode: 'GBP' },
								Shipping: { Amount: 0.0, CurrencyCode: 'GBP' }
							}
						]
					: [],
				LowestPrices: [],
				SalesRankings: [],
				NumberOfOffers: [
					{
						condition: 'New',
						OfferCount: status.competitor_count,
						fulfillmentChannel: 'Amazon'
					}
				],
				BuyBoxEligibleOffers: [],
				CompetitivePriceThreshold: { Amount: status.current_price || 0, CurrencyCode: 'GBP' }
			},
			Offers: []
		};
	}

	// Component event handlers
	function handleAlertDismiss(event: CustomEvent<{ alertId: string }>) {
		activeAlerts.update((alerts) => alerts.filter((a) => a.id !== event.detail.alertId));
	}

	function handleAlertView(event: CustomEvent<{ alert: BuyBoxAlertType }>) {
		// Navigate to detailed view or open modal
		console.log('Viewing alert details:', event.detail.alert);
	}

	function handleAlertAnalyze(event: CustomEvent<{ alert: BuyBoxAlertType }>) {
		selectedCompetitorData.set(event.detail.alert.data);
		showCompetitorAnalysis.set(true);
	}

	function handleCompetitorSelect(event: CustomEvent<{ competitor: any }>) {
		console.log('Selected competitor for analysis:', event.detail.competitor);
		// Open detailed competitor analysis
	}

	function handleCompetitorDetails(event: CustomEvent<{ competitor: any }>) {
		console.log('Viewing competitor details:', event.detail.competitor);
		// Show competitor detail modal
	}

	// ASIN-SKU mapping validation and fix functionality
	async function validateAndFixSkuMappings() {
		if (
			!confirm(
				'This will check and fix any incorrect ASIN-to-SKU mappings in your monitoring configurations. Continue?'
			)
		) {
			return;
		}

		try {
			isLoading.set(true);

			// First validate to see what needs fixing
			const validateResponse = await fetch(`${API_BASE_URL}/api/asin-sku/validate`);
			const validateData = await validateResponse.json();

			if (!validateResponse.ok) {
				throw new Error(validateData.error || 'Failed to validate SKU mappings');
			}

			if (validateData.isValid) {
				alert('✅ All ASIN-to-SKU mappings are already correct!');
				return;
			}

			// Show what will be fixed
			const mismatches = validateData.mismatches.filter((m: ValidationMismatch) => !m.notFound);
			const notFound = validateData.mismatches.filter((m: ValidationMismatch) => m.notFound);

			let message = `Found ${mismatches.length} SKU mappings that need correction:\n\n`;
			mismatches.slice(0, 5).forEach((m: ValidationMismatch) => {
				message += `• ASIN ${m.asin}: ${m.currentSku} → ${m.correctSku}\n`;
			});

			if (mismatches.length > 5) {
				message += `... and ${mismatches.length - 5} more\n`;
			}

			if (notFound.length > 0) {
				message += `\n⚠️ ${notFound.length} ASINs not found in amazon_listings (will be skipped)\n`;
			}

			message += `\nProceed with fixing ${mismatches.length} configurations?`;

			if (!confirm(message)) {
				return;
			}

			// Apply the fixes
			const fixResponse = await fetch(`${API_BASE_URL}/api/asin-sku/fix-all`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			const fixData = await fixResponse.json();

			if (!fixResponse.ok) {
				throw new Error(fixData.error || 'Failed to fix SKU mappings');
			}

			// Show results
			alert(
				`✅ SKU mapping fix completed!\n\n` +
					`Updated: ${fixData.results.updated}\n` +
					`Errors: ${fixData.results.errors}\n` +
					`Not found: ${fixData.results.notFound}`
			);

			// Reload the dashboard to show updated data
			await loadDashboard();
		} catch (error) {
			console.error('Error fixing SKU mappings:', error);
			alert(
				`❌ Failed to fix SKU mappings: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		} finally {
			isLoading.set(false);
		}
	}

	// Lifecycle
	onMount(() => {
		loadDashboard();
		setupAutoRefresh();
	});

	onDestroy(() => {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
	});
</script>

<svelte:head>
	<title>Real-time Buy Box Monitoring</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
	<!-- Header -->
	<div class="mb-6">
		<div class="flex items-center justify-between mb-4">
			<div>
				<h1 class="text-2xl font-bold text-gray-900 mb-2">Real-time Buy Box Monitoring</h1>
				<p class="text-gray-600">Live ASIN monitoring and buy box status tracking</p>
			</div>
			<div class="flex gap-3">
				<a
					href="/buy-box-alerts"
					class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
				>
					⚙️ Configure
				</a>
				<a
					href="/buy-box-alerts/demo"
					class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium"
				>
					📊 View Demo
				</a>
			</div>
		</div>
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4">
				<div class="flex items-center gap-2 text-sm text-gray-500">
					<input
						type="checkbox"
						id="autoRefresh"
						bind:checked={$autoRefresh}
						on:change={setupAutoRefresh}
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<label for="autoRefresh">Auto-refresh (30s)</label>
				</div>
				<button
					on:click={validateAndFixSkuMappings}
					disabled={$isLoading}
					class="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
					title="Check and fix any incorrect ASIN-to-SKU mappings"
				>
					{$isLoading ? 'Fixing...' : 'Fix SKU Mappings'}
				</button>
				<button
					on:click={loadDashboard}
					disabled={$isLoading}
					class="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
				>
					{$isLoading ? 'Loading...' : 'Refresh'}
				</button>
			</div>
		</div>
	</div>

	<!-- Summary Stats -->
	{#if $dashboardData?.summary}
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
			<div class="bg-white rounded-lg border p-4">
				<div class="text-2xl font-bold text-blue-600">
					{$dashboardData.summary.total_asins || 0}
				</div>
				<div class="text-sm text-gray-600">Total ASINs</div>
			</div>
			<div class="bg-white rounded-lg border p-4">
				<div class="text-2xl font-bold text-green-600">
					{$dashboardData.summary.has_buy_box || 0}
				</div>
				<div class="text-sm text-gray-600">Has Buy Box</div>
			</div>
			<div class="bg-white rounded-lg border p-4">
				<div class="text-2xl font-bold text-red-600">
					{$dashboardData.summary.lost_buy_box || 0}
				</div>
				<div class="text-sm text-gray-600">Lost Buy Box</div>
			</div>
			<div class="bg-white rounded-lg border p-4">
				<div class="text-2xl font-bold text-yellow-600">{$dashboardData.summary.warnings || 0}</div>
				<div class="text-sm text-gray-600">Warnings</div>
			</div>
		</div>
	{/if}

	<!-- Active Alerts Section -->
	{#if $activeAlerts.length > 0}
		<div class="mb-6">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-semibold text-gray-900">Active Alerts</h2>
				<span
					class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"
				>
					{$activeAlerts.length} alert{$activeAlerts.length !== 1 ? 's' : ''}
				</span>
			</div>
			<div class="space-y-4 max-h-96 overflow-y-auto">
				{#each $activeAlerts as alert}
					<BuyBoxAlert
						{alert}
						on:dismiss={handleAlertDismiss}
						on:view={handleAlertView}
						on:analyze={handleAlertAnalyze}
					/>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Competitor Analysis Modal/Section -->
	{#if $showCompetitorAnalysis && $selectedCompetitorData}
		<div class="mb-6">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-semibold text-gray-900">Competitor Analysis</h2>
				<button
					on:click={() => showCompetitorAnalysis.set(false)}
					class="text-gray-400 hover:text-gray-600 text-sm"
				>
					✕ Close
				</button>
			</div>
			<CompetitorAnalysisTable
				buyBoxData={$selectedCompetitorData}
				on:selectCompetitor={handleCompetitorSelect}
				on:viewDetails={handleCompetitorDetails}
			/>
		</div>
	{/if}

	<!-- Status and last update -->
	<div class="mb-4 flex items-center justify-between text-sm text-gray-500">
		<div>
			{#if $error}
				<span class="text-red-600">Error: {$error}</span>
			{:else if $isLoading}
				<span>Loading buy box data...</span>
			{:else}
				<span>Last updated: {$lastUpdate}</span>
			{/if}
		</div>
		{#if $dashboardData?.data}
			<div>Showing {$dashboardData.data.length} monitored ASINs</div>
		{/if}
	</div>

	<!-- Main Data Table -->
	{#if $dashboardData?.data && $dashboardData.data.length > 0}
		<div class="bg-white rounded-lg border overflow-hidden">
			<div class="overflow-x-auto">
				<table class="min-w-full table-fixed">
					<thead class="bg-gray-50">
						<tr>
							<th
								class="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5"
							>
								Product
							</th>
							<th
								class="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40"
							>
								Buy Box Status
							</th>
							<th
								class="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40"
							>
								Price Analysis
							</th>
							<th
								class="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4"
							>
								Competition
							</th>
							<th
								class="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32"
							>
								Shipping
							</th>
							<th
								class="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28"
							>
								Monitoring
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each $dashboardData.data as asin}
							{@const statusInfo = getStatusInfo(asin.status, asin.has_buy_box)}
							<tr class="hover:bg-gray-50 border-l-4 {statusInfo.borderClass}">
								<!-- Product Column -->
								<td class="py-4 px-4">
									<div class="flex flex-col">
										<div class="text-sm font-medium text-gray-900 truncate">
											{truncateText(asin.title || asin.asin, 50)}
										</div>
										<div class="text-xs text-gray-500 font-mono">
											{asin.asin}{asin.sku ? ` • ${asin.sku}` : ''}
										</div>
									</div>
								</td>

								<!-- Buy Box Status Column -->
								<td class="py-4 px-4">
									<div class="flex items-center gap-2">
										<span class="text-lg">{statusInfo.emoji}</span>
										<div class="flex flex-col">
											<span
												class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium {statusInfo.bgClass} {statusInfo.textClass}"
											>
												{statusInfo.text}
											</span>
											{#if asin.buy_box_winner && asin.buy_box_winner !== 'Unknown'}
												<div class="text-xs text-gray-500 mt-1">
													Winner: {truncateText(asin.buy_box_winner, 20)}
												</div>
											{/if}
										</div>
									</div>
								</td>

								<!-- Price Analysis Column -->
								<td class="py-4 px-4">
									<div class="flex flex-col gap-1">
										{#if asin.current_price}
											<div class="text-sm">
												<span class="text-gray-500">Buy Box:</span>
												<span class="font-medium text-gray-900"
													>{formatPrice(asin.current_price)}</span
												>
											</div>
										{/if}
										{#if asin.our_price}
											<div class="text-sm">
												<span class="text-gray-500">Our Price:</span>
												<span class="font-medium text-blue-600">{formatPrice(asin.our_price)}</span>
											</div>
										{/if}
										{#if !asin.current_price && !asin.our_price}
											<span class="text-sm text-gray-400">No pricing data</span>
										{/if}
									</div>
								</td>

								<!-- Competition Column -->
								<td class="py-4 px-4">
									<div class="flex items-center gap-3">
										<div class="flex flex-col">
											<div class="text-sm font-medium text-gray-900">
												{asin.competitor_count || 0} Competitors
											</div>
											{#if asin.alert_count_24h > 0}
												<div class="text-xs text-orange-600">
													{asin.alert_count_24h} alerts (24h)
												</div>
											{/if}
										</div>
									</div>
								</td>

								<!-- Shipping Column -->
								<td class="py-4 px-4">
									<div class="flex flex-col gap-1">
										{#if asin.merchant_shipping_group}
											<span
												class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
											>
												{asin.merchant_shipping_group}
											</span>
										{:else}
											<span class="text-xs text-gray-400">No shipping info</span>
										{/if}
									</div>
								</td>

								<!-- Monitoring Column -->
								<td class="py-4 px-4">
									<div class="flex flex-col gap-1 text-xs text-gray-500">
										<div>Priority: {asin.priority || 5}</div>
										<div>{formatTimeAgo(asin.last_checked)}</div>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{:else if !$isLoading && $dashboardData}
		<div class="bg-white rounded-lg border p-8 text-center">
			<div class="text-gray-500 mb-2">
				<svg class="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
					/>
				</svg>
			</div>
			<h3 class="text-lg font-medium text-gray-900 mb-2">No monitoring data available</h3>
			<p class="text-gray-500">Start the monitoring job to see real-time buy box status</p>
		</div>
	{:else if $isLoading}
		<div class="bg-white rounded-lg border p-8 text-center">
			<div class="animate-spin mx-auto h-8 w-8 border-b-2 border-blue-600 rounded-full mb-4"></div>
			<p class="text-gray-500">Loading buy box data...</p>
		</div>
	{/if}
</div>
