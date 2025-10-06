<script lang="ts">
	import { onMount } from 'svelte';
	import Chart from 'chart.js/auto';
	import 'chartjs-adapter-date-fns';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// State
	let activeTab = $state<'sales' | 'price' | 'reviews'>('price');
	let timeRange = $state<'1hour' | '12hours' | '1day' | '7days' | '30days'>('1day');
	let chartCanvas = $state<HTMLCanvasElement | null>(null);
	let chartInstance = $state<Chart | null>(null);

	const OUR_SELLER_ID = 'A2D8NG39VURSL3';

	// Filter history based on selected time range
	const filteredHistory = $derived.by(() => {
		if (!data.history || data.history.length === 0) return [];

		const now = new Date();
		let cutoffDate: Date;

		switch (timeRange) {
			case '1hour':
				cutoffDate = new Date(now.getTime() - 1 * 60 * 60 * 1000);
				break;
			case '12hours':
				cutoffDate = new Date(now.getTime() - 12 * 60 * 60 * 1000);
				break;
			case '1day':
				cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
				break;
			case '7days':
				cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
				break;
			case '30days':
				cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
				break;
			default:
				return data.history;
		}

		return data.history.filter((h: any) => new Date(h.timestamp) >= cutoffDate);
	});

	// Placeholder data (will be populated from APIs later)
	const placeholderMetrics = {
		revenue30d: '$23,556.35',
		unitSales30d: '45,875',
		currentRating: 3.5,
		totalReviews: 1430,
		listingHealthScore: 9.0,
		fbaFee: '$14.02',
		competitiveFbaOffers: 5,
		totalPrimeOffers: 10
	};

	// Get product info
	const productInfo = data.productInfo || {
		item_name: data.asin,
		category: 'Unknown'
	};

	// Get current state metrics
	const currentState = data.currentState || {};
	const yourPrice = currentState.your_price || 0;
	const marketLow = currentState.market_low || 0;
	const yourPosition = currentState.your_position || 0;
	const totalOffers = currentState.total_offers || 0;

	// Calculate price gap percentage
	const priceGap =
		yourPrice && marketLow ? (((yourPrice - marketLow) / marketLow) * 100).toFixed(1) : '0.0';

	// Format currency
	function formatPrice(price: number): string {
		return new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency: 'GBP'
		}).format(price);
	}

	// Format shipping time
	function formatShippingTime(minHours?: number, maxHours?: number): string {
		if (!maxHours && !minHours) return '';

		const hours = maxHours || minHours || 0;

		if (hours <= 24) return '1 day';
		if (hours <= 48) return '1-2 days';
		if (hours <= 72) return '2-3 days';
		if (hours <= 120) return '3-5 days';
		if (hours <= 168) return '5-7 days';
		return '7+ days';
	}

	// Get seller display name
	function getSellerDisplayName(sellerId: string): string {
		if (sellerId === OUR_SELLER_ID) return 'YOU';
		// Truncate long seller IDs for readability
		return sellerId.length > 12 ? `${sellerId.substring(0, 10)}...` : sellerId;
	}

	// Generate a consistent color for each seller
	function getSellerColor(sellerId: string, index: number): string {
		const colors = [
			'rgb(255, 99, 132)', // red
			'rgb(54, 162, 235)', // blue
			'rgb(255, 206, 86)', // yellow
			'rgb(75, 192, 192)', // teal
			'rgb(153, 102, 255)', // purple
			'rgb(255, 159, 64)', // orange
			'rgb(199, 199, 199)', // gray
			'rgb(83, 102, 255)', // indigo
			'rgb(255, 99, 255)', // pink
			'rgb(99, 255, 132)' // green
		];
		return colors[index % colors.length];
	}

	// Create the main chart
	function createChart() {
		if (!chartCanvas || !filteredHistory || filteredHistory.length === 0) {
			console.log('No canvas or filtered history data for chart');
			return;
		}

		// Destroy existing chart
		if (chartInstance) {
			chartInstance.destroy();
		}

		const ctx = chartCanvas.getContext('2d');
		if (!ctx) return;

		// Prepare data based on active tab
		let datasets: any[] = [];

		if (activeTab === 'price') {
			// Calculate absolute market low across filtered history
			const absoluteMarketLow = Math.min(
				...filteredHistory.map((h: any) => h.marketLow || Infinity)
			);

			// Price & BSR chart
			datasets = [
				{
					label: 'Your Price',
					data: filteredHistory.map((h: any) => ({
						x: new Date(h.timestamp),
						y: h.yourOffer?.landedPrice || h.yourPrice || 0
					})),
					borderColor: 'rgb(34, 197, 94)', // Green
					backgroundColor: 'rgba(34, 197, 94, 0.1)',
					borderWidth: 3,
					pointRadius: 4,
					pointHoverRadius: 6,
					tension: 0.4,
					yAxisID: 'yPrice'
				},
				{
					label: 'Market Low',
					data: filteredHistory.map((h: any) => ({
						x: new Date(h.timestamp),
						y: absoluteMarketLow
					})),
					borderColor: 'rgb(220, 38, 38)', // Red
					backgroundColor: 'rgba(220, 38, 38, 0.05)',
					borderWidth: 2,
					pointRadius: 0,
					pointHoverRadius: 0,
					tension: 0,
					yAxisID: 'yPrice',
					borderDash: [8, 4]
				}
			];

			// Add individual competitor price lines
			if (data.competitors && data.competitors.length > 0) {
				console.log('Adding competitor lines for', data.competitors.length, 'competitors');

				// Generate distinct colors for competitors (excluding green)
				const competitorColors = [
					'rgb(239, 68, 68)', // Red
					'rgb(251, 146, 60)', // Orange
					'rgb(234, 179, 8)', // Yellow
					'rgb(14, 165, 233)', // Light Blue
					'rgb(168, 85, 247)', // Purple
					'rgb(236, 72, 153)', // Pink
					'rgb(163, 163, 163)', // Gray
					'rgb(251, 191, 36)', // Amber
					'rgb(59, 130, 246)', // Blue
					'rgb(217, 70, 239)' // Magenta
				];

				// Create a line for each competitor
				data.competitors.slice(0, 10).forEach((competitor: any, index: number) => {
					// Extract this competitor's prices from filtered history
					const competitorPrices = filteredHistory
						.map((h: any) => {
							// Find this competitor in the sellers array of this historical record
							const sellerData = h.competitorPrices?.find(
								(cp: any) => cp.seller === competitor.sellerId
							);
							return {
								x: new Date(h.timestamp),
								y: sellerData?.landedPrice || null
							};
						})
						.filter((point: any) => point.y !== null);

					console.log(
						`Competitor ${competitor.sellerId}: ${competitorPrices.length} price points`,
						competitorPrices
					);

					// Only add line if competitor has price data
					if (competitorPrices.length > 0) {
						const color = competitorColors[index % competitorColors.length];
						datasets.push({
							label: getSellerDisplayName(competitor.sellerId),
							data: competitorPrices,
							borderColor: color,
							backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.1)'),
							borderWidth: 2,
							pointRadius: 3,
							pointHoverRadius: 5,
							tension: 0.4,
							yAxisID: 'yPrice',
							borderDash: [2, 2]
						});
					}
				});

				console.log('Total datasets:', datasets.length);
			}
		}

		chartInstance = new Chart(ctx, {
			type: 'line',
			data: { datasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: 'index',
					intersect: false
				},
				plugins: {
					legend: {
						display: true,
						position: 'top',
						labels: {
							usePointStyle: true,
							padding: 15,
							font: { size: 12 }
						}
					},
					tooltip: {
						backgroundColor: 'rgba(0, 0, 0, 0.9)',
						padding: 16,
						titleFont: { size: 14, weight: 'bold' },
						bodyFont: { size: 13 },
						bodySpacing: 6,
						borderColor: 'rgba(255, 255, 255, 0.1)',
						borderWidth: 1,
						displayColors: true,
						callbacks: {
							title: (tooltipItems) => {
								// Show the timestamp
								const dataIndex = tooltipItems[0].dataIndex;
								const timestamp = new Date(filteredHistory[dataIndex].timestamp);
								return timestamp.toLocaleString('en-GB', {
									month: 'short',
									day: 'numeric',
									hour: '2-digit',
									minute: '2-digit'
								});
							},
							afterTitle: (tooltipItems) => {
								// Show total offers count
								const dataIndex = tooltipItems[0].dataIndex;
								const record = filteredHistory[dataIndex];
								return `${record.offerCount} total offers`;
							},
							label: (context) => {
								const label = context.dataset.label || '';
								const value = context.parsed.y;
								return `${label}: ${formatPrice(value)}`;
							},
							afterBody: (tooltipItems) => {
								// Show position and buy box info for "Your Price" line
								const dataIndex = tooltipItems[0].dataIndex;
								const record = filteredHistory[dataIndex];

								if (!record.yourOffer) return [];

								const lines = [];
								lines.push(''); // Empty line for spacing
								lines.push(`Position: #${record.yourOffer.position}`);

								if (record.yourOffer.isBuyBoxWinner) {
									lines.push('🏆 Buy Box Winner');
								} else {
									const winner = record.buyBoxWinner;
									if (winner) {
										lines.push(`Buy Box: ${getSellerDisplayName(winner)}`);
									}
								}

								return lines;
							}
						}
					}
				},
				scales: {
					x: {
						type: 'time',
						time: {
							unit: 'day',
							displayFormats: {
								day: 'MMM d'
							}
						},
						grid: {
							display: false
						}
					},
					yPrice: {
						type: 'linear',
						display: true,
						position: 'left',
						title: {
							display: true,
							text: 'Price (£)'
						},
						ticks: {
							callback: (value) => formatPrice(Number(value))
						}
					}
				}
			}
		});
	}

	// Change time range filter
	function changeTimeRange(range: typeof timeRange) {
		timeRange = range;
		// Use setTimeout to ensure state update completes before chart recreation
		setTimeout(() => {
			if (chartCanvas) {
				createChart();
			}
		}, 0);
	}

	// Change tab
	function changeTab(tab: typeof activeTab) {
		activeTab = tab;
		// Use setTimeout to ensure state update completes before chart recreation
		setTimeout(() => {
			if (chartCanvas) {
				createChart();
			}
		}, 0);
	}

	// Mount chart
	onMount(() => {
		if (chartCanvas && data.history && data.history.length > 0) {
			createChart();
		}

		return () => {
			if (chartInstance) {
				chartInstance.destroy();
			}
		};
	});
</script>

<!-- Helium 10 Style Layout -->
<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-6">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<!-- Back Button -->
		<a
			href="/buy-box-alerts/live"
			class="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
		>
			<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 19l-7-7m0 0l7-7m-7 7h18"
				/>
			</svg>
			Back to Live Alerts
		</a>

		<!-- Header -->
		<div class="bg-white rounded-lg shadow-lg p-6 mb-6">
			<div class="flex items-start justify-between">
				<div class="flex-1">
					<div class="flex items-center space-x-3 mb-2">
						<svg
							class="w-8 h-8 text-blue-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
							/>
						</svg>
						<h1 class="text-2xl font-bold text-gray-900">
							Product Summary for "{data.asin}"
						</h1>
						<button class="text-gray-400 hover:text-gray-600" aria-label="Copy ASIN">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
								/>
							</svg>
						</button>
					</div>
					<p class="text-sm text-gray-600">{productInfo.item_name || 'Loading product info...'}</p>
				</div>
				<div class="flex space-x-3">
					<button
						class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
							/>
						</svg>
						<span>Track Competitor</span>
					</button>
					<button
						class="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
							/>
						</svg>
						<span>Save Product</span>
					</button>
				</div>
			</div>
		</div>

		<!-- Summary Cards Row -->
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
			<!-- 30-Day Revenue (Placeholder) -->
			<div class="bg-white rounded-lg shadow p-6">
				<div class="text-sm text-gray-600 mb-1">30-Day Revenue</div>
				<div class="text-3xl font-bold text-gray-900 mb-1">{placeholderMetrics.revenue30d}</div>
				<div class="text-xs text-gray-500">Unit Sales: {placeholderMetrics.unitSales30d}</div>
				<div class="mt-2 flex items-center text-green-600 text-sm">
					<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
						/>
					</svg>
					<span class="text-xs">Data from Amazon Reports API (Coming Soon)</span>
				</div>
			</div>

			<!-- Current Rating (Placeholder) -->
			<div class="bg-white rounded-lg shadow p-6">
				<div class="text-sm text-gray-600 mb-1">Current Rating</div>
				<div class="flex items-center space-x-2 mb-1">
					<div class="flex items-center">
						{#each Array(5) as _, i}
							<svg
								class="w-5 h-5 {i < Math.floor(placeholderMetrics.currentRating)
									? 'text-yellow-400'
									: i < placeholderMetrics.currentRating
										? 'text-yellow-400'
										: 'text-gray-300'}"
								fill="currentColor"
								viewBox="0 0 20 20"
							>
								<path
									d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
								/>
							</svg>
						{/each}
					</div>
					<span class="text-2xl font-bold">{placeholderMetrics.currentRating}</span>
					<span class="text-sm text-gray-500"
						>({placeholderMetrics.totalReviews.toLocaleString()})</span
					>
				</div>
				<button class="text-sm text-blue-600 hover:underline">Analyze Reviews</button>
			</div>

			<!-- Listing Health Score (Placeholder) -->
			<div class="bg-white rounded-lg shadow p-6">
				<div class="text-sm text-gray-600 mb-1">Listing Health Score</div>
				<div class="flex items-center space-x-3">
					<div class="text-4xl font-bold text-green-600">
						{placeholderMetrics.listingHealthScore}
					</div>
					<div class="flex-1">
						<div class="w-full bg-gray-200 rounded-full h-2">
							<div
								class="bg-green-500 h-2 rounded-full"
								style="width: {(placeholderMetrics.listingHealthScore / 10) * 100}%"
							></div>
						</div>
					</div>
				</div>
				<button class="text-sm text-blue-600 hover:underline mt-2 inline-block">Analyze LHS</button>
			</div>

			<!-- Top Keywords (Placeholder) -->
			<div class="bg-white rounded-lg shadow p-6">
				<div class="text-sm text-gray-600 mb-2">Top Keywords</div>
				<div class="text-xs text-gray-700 mb-1">
					Phone Charger, Portable, Household, Magnet, USB
				</div>
				<button class="text-sm text-blue-600 hover:underline">See All Keywords</button>
			</div>
		</div>

		<!-- Main Content Grid -->
		<div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
			<!-- Sidebar - Product Details -->
			<div class="lg:col-span-1 space-y-4">
				<!-- Product Details Card -->
				<div class="bg-white rounded-lg shadow p-6">
					<h3 class="font-semibold text-gray-900 mb-4">Product Details</h3>

					<div class="space-y-3 text-sm">
						<div class="flex justify-between">
							<span class="text-gray-600">FBA Fee</span>
							<span class="font-semibold">{placeholderMetrics.fbaFee}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600">Total Prime Offers</span>
							<span class="font-semibold">{placeholderMetrics.totalPrimeOffers}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600">Competitive FBA Offers</span>
							<span class="font-semibold">{placeholderMetrics.competitiveFbaOffers}</span>
						</div>
					</div>

					<div class="mt-6 pt-6 border-t">
						<h4 class="text-sm font-semibold text-gray-900 mb-3">Current Pricing</h4>
						<div class="space-y-2 text-sm">
							<div class="flex justify-between">
								<span class="text-gray-600">Your Price</span>
								<span class="font-bold text-green-600">{formatPrice(yourPrice)}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-600">Market Low</span>
								<span class="font-semibold text-blue-600">{formatPrice(marketLow)}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-600">Price Gap</span>
								<span
									class="font-semibold {parseFloat(priceGap) > 0
										? 'text-red-600'
										: 'text-green-600'}"
								>
									{priceGap}%
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-600">Your Position</span>
								<span class="font-semibold">#{yourPosition}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-600">Total Offers</span>
								<span class="font-semibold">{totalOffers}</span>
							</div>
						</div>
					</div>

					{#if data.productInfo && data.productInfo.data}
						<!-- Cost Analysis Section -->
						<div class="mt-6 pt-6 border-t">
							<h4 class="text-sm font-semibold text-gray-900 mb-3">Cost Analysis</h4>
							<div class="space-y-2 text-sm">
								{#if data.productInfo.min_profitable_price}
									<div class="flex justify-between">
										<span class="text-gray-600">Min Profitable Price</span>
										<span class="font-semibold text-orange-600"
											>{formatPrice(data.productInfo.min_profitable_price)}</span
										>
									</div>
								{/if}
								{#if data.productInfo.margin_at_buybox !== null && data.productInfo.margin_at_buybox !== undefined}
									<div class="flex justify-between">
										<span class="text-gray-600">Margin @ Buy Box</span>
										<span
											class="font-semibold {data.productInfo.margin_at_buybox >= 0
												? 'text-green-600'
												: 'text-red-600'}"
										>
											{formatPrice(data.productInfo.margin_at_buybox)}
										</span>
									</div>
								{/if}
								{#if data.productInfo.margin_percent_at_buybox !== null && data.productInfo.margin_percent_at_buybox !== undefined}
									<div class="flex justify-between">
										<span class="text-gray-600">Margin %</span>
										<span
											class="font-semibold {data.productInfo.margin_percent_at_buybox >= 0
												? 'text-green-600'
												: 'text-red-600'}"
										>
											{data.productInfo.margin_percent_at_buybox.toFixed(1)}%
										</span>
									</div>
								{/if}
								{#if data.productInfo.opportunity_flag}
									<div class="mt-3 p-3 bg-green-50 border border-green-200 rounded">
										<div class="flex items-start space-x-2">
											<svg
												class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
												fill="currentColor"
												viewBox="0 0 20 20"
											>
												<path
													fill-rule="evenodd"
													d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
													clip-rule="evenodd"
												></path>
											</svg>
											<div>
												<p class="text-xs font-semibold text-green-800">Profit Opportunity!</p>
												<p class="text-xs text-green-700 mt-1">
													You can profitably win the Buy Box
												</p>
											</div>
										</div>
									</div>
								{/if}
								{#if data.productInfo.competitor_price}
									<div class="mt-3 pt-3 border-t">
										<div class="flex justify-between">
											<span class="text-gray-600">Current Buy Box</span>
											<span class="font-semibold"
												>{formatPrice(data.productInfo.competitor_price)}</span
											>
										</div>
										{#if data.productInfo.competitor_name}
											<div class="text-xs text-gray-500 mt-1 text-right">
												{data.productInfo.competitor_name}
											</div>
										{/if}
									</div>
								{/if}
								<div class="mt-3 text-xs text-gray-500">
									Last updated: {data.productInfo.captured_at
										? new Date(data.productInfo.captured_at).toLocaleString('en-GB', {
												day: '2-digit',
												month: 'short',
												hour: '2-digit',
												minute: '2-digit'
											})
										: 'N/A'}
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Main Chart Area -->
			<div class="lg:col-span-3">
				<!-- Tab Navigation -->
				<div class="bg-white rounded-t-lg shadow">
					<div class="border-b border-gray-200">
						<nav class="flex -mb-px">
							<button
								onclick={() => changeTab('sales')}
								class="px-6 py-4 text-sm font-medium border-b-2 {activeTab === 'sales'
									? 'border-blue-600 text-blue-600'
									: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
							>
								Sales
							</button>
							<button
								onclick={() => changeTab('price')}
								class="px-6 py-4 text-sm font-medium border-b-2 {activeTab === 'price'
									? 'border-blue-600 text-blue-600'
									: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
							>
								Price & BSR
							</button>
							<button
								onclick={() => changeTab('reviews')}
								class="px-6 py-4 text-sm font-medium border-b-2 {activeTab === 'reviews'
									? 'border-blue-600 text-blue-600'
									: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
							>
								Rating & Reviews
							</button>
						</nav>
					</div>
				</div>

				<!-- Chart Content -->
				<div class="bg-white rounded-b-lg shadow p-6">
					<!-- Time Range Selector -->
					<div class="flex justify-between items-center mb-6">
						<div class="flex space-x-2">
							<button
								onclick={() => changeTimeRange('1hour')}
								class="px-3 py-1 text-sm rounded {timeRange === '1hour'
									? 'bg-blue-600 text-white'
									: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
							>
								1 Hour
							</button>
							<button
								onclick={() => changeTimeRange('12hours')}
								class="px-3 py-1 text-sm rounded {timeRange === '12hours'
									? 'bg-blue-600 text-white'
									: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
							>
								12 Hours
							</button>
							<button
								onclick={() => changeTimeRange('1day')}
								class="px-3 py-1 text-sm rounded {timeRange === '1day'
									? 'bg-blue-600 text-white'
									: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
							>
								1 Day
							</button>
							<button
								onclick={() => changeTimeRange('7days')}
								class="px-3 py-1 text-sm rounded {timeRange === '7days'
									? 'bg-blue-600 text-white'
									: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
							>
								7 Days
							</button>
							<button
								onclick={() => changeTimeRange('30days')}
								class="px-3 py-1 text-sm rounded {timeRange === '30days'
									? 'bg-blue-600 text-white'
									: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
							>
								30 Days
							</button>
						</div>
					</div>

					<!-- Chart Canvas -->
					<div class="relative" style="height: 400px;">
						{#if data.history && data.history.length > 0}
							<canvas bind:this={chartCanvas}></canvas>
						{:else}
							<div class="flex items-center justify-center h-full bg-gray-50 rounded-lg">
								<div class="text-center">
									<svg
										class="mx-auto h-12 w-12 text-gray-400"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
										/>
									</svg>
									<h3 class="mt-2 text-sm font-medium text-gray-900">No historical data yet</h3>
									<p class="mt-1 text-sm text-gray-500">
										Price tracking data will appear here as notifications are processed
									</p>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Competitor Details Table -->
		{#if data.competitors && data.competitors.length > 0}
			<div id="competitors" class="mt-6 bg-white rounded-lg shadow overflow-hidden">
				<div class="px-6 py-4 border-b border-gray-200">
					<h3 class="text-lg font-semibold text-gray-900">
						Competitor Activity ({data.competitors.length} competitors)
					</h3>
					<p class="text-sm text-gray-500 mt-1">
						Based on {data.history?.length || 0} historical notifications
					</p>
				</div>
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Seller ID
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Current Price
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Lowest Price
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Highest Price
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Avg Price
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Appearances
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Buy Box Wins
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Price Changes
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Type
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>
									Shipping
								</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{#each data.competitors as competitor}
								<tr class="hover:bg-gray-50 {competitor.isYou ? 'bg-green-50' : ''}">
									<td
										class="px-6 py-4 whitespace-nowrap text-sm font-mono {competitor.isYou
											? 'text-green-700 font-bold'
											: 'text-gray-900'}"
									>
										<div class="flex items-center space-x-2">
											<div class="flex flex-col">
												<span>
													{competitor.isYou
														? 'YOU (' + competitor.sellerId + ')'
														: competitor.sellerId}
												</span>
												{#if competitor.shippingType}
													<span class="text-xs text-gray-400 mt-0.5">{competitor.shippingType}</span
													>
												{/if}
											</div>
											{#if competitor.isCurrentBuyBoxWinner}
												<span
													class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm"
													title="Current Buy Box Winner"
												>
													<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
														<path
															d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
														/>
													</svg>
												</span>
											{/if}
										</div>
									</td>
									<td
										class="px-6 py-4 whitespace-nowrap text-sm {competitor.isYou
											? 'text-green-700 font-bold'
											: 'text-blue-600 font-bold'}"
									>
										{formatPrice(competitor.currentPrice)}
									</td>
									<td
										class="px-6 py-4 whitespace-nowrap text-sm {competitor.isYou
											? 'text-green-700 font-bold'
											: 'text-gray-900 font-semibold'}"
									>
										{formatPrice(competitor.lowestPrice)}
									</td>
									<td
										class="px-6 py-4 whitespace-nowrap text-sm {competitor.isYou
											? 'text-green-700'
											: 'text-gray-600'}"
									>
										{formatPrice(competitor.highestPrice)}
									</td>
									<td
										class="px-6 py-4 whitespace-nowrap text-sm {competitor.isYou
											? 'text-green-700'
											: 'text-gray-600'}"
									>
										{formatPrice(competitor.avgPrice)}
									</td>
									<td
										class="px-6 py-4 whitespace-nowrap text-sm {competitor.isYou
											? 'text-green-700'
											: 'text-gray-600'}"
									>
										{competitor.appearances}
									</td>
									<td
										class="px-6 py-4 whitespace-nowrap text-sm {competitor.isYou
											? 'text-green-700'
											: 'text-gray-600'}"
									>
										{competitor.buyBoxWins} ({competitor.buyBoxWinRate.toFixed(0)}%)
									</td>
									<td
										class="px-6 py-4 whitespace-nowrap text-sm {competitor.isYou
											? 'text-green-700'
											: 'text-gray-600'}"
									>
										{competitor.priceChanges}
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<span
											class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full {competitor.isFBA
												? 'bg-purple-100 text-purple-800'
												: 'bg-gray-100 text-gray-800'}"
										>
											{competitor.isFBA ? 'FBA' : 'FBM'}
										</span>
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-xs">
										<div class="flex flex-col space-y-1">
											<div class="flex items-center space-x-1">
												{#if competitor.isPrime}
													<span
														class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800"
													>
														<svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
															<path
																d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
															/>
														</svg>
														Prime
													</span>
												{:else}
													<span class="text-gray-500">Standard</span>
												{/if}
											</div>
											<div
												class={competitor.isYou ? 'text-green-700 font-semibold' : 'text-gray-600'}
											>
												{competitor.currentShipping === 0
													? 'FREE'
													: formatPrice(competitor.currentShipping)}
											</div>
											{#if competitor.shippingMaxHours}
												<div class="text-gray-500">
													{formatShippingTime(
														competitor.shippingMinHours,
														competitor.shippingMaxHours
													)}
												</div>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{:else}
			<!-- No competitors message -->
			<div class="mt-6 bg-white rounded-lg shadow p-8">
				<div class="text-center">
					<svg
						class="mx-auto h-12 w-12 text-gray-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
						/>
					</svg>
					<h3 class="mt-2 text-sm font-medium text-gray-900">No competitor data yet</h3>
					<p class="mt-1 text-sm text-gray-500">
						Competitor activity will appear here as historical notifications are collected.<br />
						Current notifications: {data.history?.length || 0}
					</p>
				</div>
			</div>
		{/if}
	</div>
</div>
