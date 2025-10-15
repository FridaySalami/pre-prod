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

	// Check if we have actual price data (not just empty records)
	const hasPriceData = $derived.by(() => {
		if (!filteredHistory || filteredHistory.length === 0) return false;

		// Check if at least one record has price information
		return filteredHistory.some(
			(h: any) =>
				h.yourOffer?.landedPrice ||
				h.yourPrice ||
				h.marketLow ||
				(h.competitorPrices && h.competitorPrices.length > 0)
		);
	});

	// Get real offer metrics from API
	const offerMetrics = data.offerMetrics || {};
	const totalPrimeOffers = offerMetrics.totalPrimeOffers || 0;
	const competitiveFbaOffers = offerMetrics.competitiveFbaOffers || 0;
	const totalFbaOffers = offerMetrics.totalFbaOffers || 0;

	// Get product info
	const productInfo = data.productInfo || {
		item_name: data.asin,
		category: 'Unknown'
	};

	// Get catalog data from Amazon Catalog API
	const catalogData = data.catalogData || null;
	const productTitle = catalogData?.title || productInfo.item_name || data.asin;
	const productBrand = catalogData?.brand || 'Unknown Brand';
	const productCategory = catalogData?.category || productInfo.category || 'Unknown';
	const productImages = catalogData?.images || [];
	const mainProductImage = catalogData?.mainImage || productImages[0]?.link;

	// Get fees data from Amazon Fees API
	const feesData = data.feesData || null;

	// Get listing health score
	const healthScore = data.healthScore || null;

	// Get sales data from Amazon Reports API
	const salesData = data.salesData || null;

	// Get current state metrics
	const currentState = data.currentState || {};
	const yourPrice =
		typeof currentState.your_price === 'number'
			? currentState.your_price
			: parseFloat(currentState.your_price) || 0;
	const marketLow =
		typeof currentState.market_low === 'number'
			? currentState.market_low
			: parseFloat(currentState.market_low) || 0;
	const yourPosition =
		typeof currentState.your_position === 'number'
			? currentState.your_position
			: parseInt(currentState.your_position) || 0;
	const totalOffers =
		typeof currentState.total_offers === 'number'
			? currentState.total_offers
			: parseInt(currentState.total_offers) || 0;

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

	// Convert weight to kg
	function convertToKg(value: number, unit: string): number {
		const lowerUnit = unit.toLowerCase();
		if (lowerUnit === 'kg' || lowerUnit === 'kilograms') {
			return value;
		} else if (lowerUnit === 'g' || lowerUnit === 'grams') {
			return value / 1000;
		} else if (lowerUnit === 'lb' || lowerUnit === 'lbs' || lowerUnit === 'pounds') {
			return value * 0.453592;
		} else if (lowerUnit === 'oz' || lowerUnit === 'ounces') {
			return value * 0.0283495;
		}
		// Default: assume it's already in kg
		return value;
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
					tension: 0, // No curve - straight lines between points
					yAxisID: 'yPrice',
					stepped: false
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
							tension: 0, // No curve - straight lines between points
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
		<!-- Header -->
		<div class="bg-white rounded-lg shadow-lg p-6 mb-6">
			<div class="flex items-start justify-between">
				<div class="flex items-start space-x-4 flex-1">
					<!-- Product Image -->
					{#if mainProductImage}
						<div class="flex-shrink-0">
							<img
								src={mainProductImage}
								alt={productTitle}
								class="w-24 h-24 object-contain rounded-lg border border-gray-200"
							/>
						</div>
					{:else}
						<div
							class="flex-shrink-0 w-24 h-24 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center"
						>
							<svg
								class="w-12 h-12 text-gray-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
								/>
							</svg>
						</div>
					{/if}

					<!-- Product Info -->
					<div class="flex-1">
						<div class="flex items-center space-x-3 mb-2">
							<h1 class="text-2xl font-bold text-gray-900">
								{productTitle}
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
						<div class="flex items-center space-x-4 text-sm text-gray-600">
							<span class="flex items-center">
								<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
									/>
								</svg>
								ASIN: {data.asin}
							</span>
							<span class="flex items-center">
								<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
									/>
								</svg>
								{productBrand}
							</span>
							<span class="flex items-center">
								<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
									/>
								</svg>
								{productCategory}
							</span>
						</div>
					</div>
				</div>
				<div class="flex flex-col space-y-3">
					<a
						href="https://sellercentral.amazon.co.uk/myinventory/inventory?fulfilledBy=all&page=1&pageSize=50&searchField=all&searchTerm={data.asin}&sort=date_created_desc&status=all&ref_=xx_invmgr_favb_xx"
						target="_blank"
						rel="noopener noreferrer"
						class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
							/>
						</svg>
						<span>Manage Amazon Listing</span>
					</a>
					<a
						href="https://www.amazon.co.uk/dp/{data.asin}"
						target="_blank"
						rel="noopener noreferrer"
						class="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
							/>
						</svg>
						<span>Amazon Product Page</span>
					</a>
				</div>
			</div>
		</div>
		<!-- Summary Cards Row -->
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
			<!-- Product Images Gallery (if available) -->
			{#if productImages.length > 1}
				<div class="md:col-span-4 bg-white rounded-lg shadow p-6">
					<h3 class="font-semibold text-gray-900 mb-4">Product Images</h3>
					<div class="flex space-x-4 overflow-x-auto pb-2">
						{#each productImages.slice(0, 8) as image}
							<div class="flex-shrink-0">
								<img
									src={image.link}
									alt="{productTitle} - {image.variant}"
									class="w-32 h-32 object-contain rounded-lg border border-gray-200 hover:border-blue-500 cursor-pointer transition-colors"
									title={image.variant}
								/>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- 30-Day Revenue (Real Data from Amazon Reports API) -->
			<div
				class="bg-white rounded-lg shadow p-6 border-l-4 {salesData
					? 'border-green-500'
					: 'border-gray-300'}"
			>
				<div class="text-sm text-gray-600 mb-1">30-Day Revenue</div>
				{#if salesData}
					<div class="text-3xl font-bold text-gray-900 mb-2">
						£{salesData.totalRevenue.toLocaleString('en-GB', {
							minimumFractionDigits: 2,
							maximumFractionDigits: 2
						})}
					</div>
					<div class="text-sm text-gray-600 mb-3">
						Unit Sales: <span class="font-semibold"
							>{salesData.totalUnits.toLocaleString('en-GB')}</span
						>
					</div>

					<!-- Key Metrics Grid -->
					<div class="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
						<div>
							<div class="text-xs text-gray-500">Sessions</div>
							<div class="text-sm font-semibold text-gray-900">
								{salesData.totalSessions.toLocaleString('en-GB')}
							</div>
						</div>
						<div>
							<div class="text-xs text-gray-500">Page Views</div>
							<div class="text-sm font-semibold text-gray-900">
								{salesData.totalPageViews.toLocaleString('en-GB')}
							</div>
						</div>
						<div>
							<div class="text-xs text-gray-500">Buy Box %</div>
							<div class="text-sm font-semibold text-gray-900">
								{salesData.avgBuyBoxPercentage}%
							</div>
						</div>
						<div>
							<div class="text-xs text-gray-500">Conversion</div>
							<div class="text-sm font-semibold text-gray-900">
								{salesData.avgConversionRate}%
							</div>
						</div>
					</div>
				{:else}
					<div class="text-2xl font-semibold text-gray-400 mb-2">—</div>
					<div class="text-xs text-gray-400 mb-3">Unit Sales: —</div>
					<div class="mt-2 flex items-center text-gray-500 text-sm bg-gray-100 p-2 rounded">
						<svg
							class="w-4 h-4 mr-2 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span class="text-xs">No sales data available for the last 30 days</span>
					</div>
				{/if}
			</div>

			<!-- Listing Health Score -->
			<div class="bg-white rounded-lg shadow p-6 md:col-span-2">
				<div class="text-sm text-gray-600 mb-1">Listing Health Score</div>
				{#if healthScore}
					<div class="flex items-center space-x-3 mb-3">
						<div
							class="text-4xl font-bold {healthScore.overall >= 8
								? 'text-green-600'
								: healthScore.overall >= 6
									? 'text-blue-600'
									: healthScore.overall >= 4
										? 'text-yellow-600'
										: 'text-red-600'}"
						>
							{healthScore.overall.toFixed(1)}
						</div>
						<div class="flex-1">
							<div class="w-full bg-gray-200 rounded-full h-2">
								<div
									class="{healthScore.overall >= 8
										? 'bg-green-500'
										: healthScore.overall >= 6
											? 'bg-blue-500'
											: healthScore.overall >= 4
												? 'bg-yellow-500'
												: 'bg-red-500'} h-2 rounded-full transition-all"
									style="width: {(healthScore.overall / 10) * 100}%"
								></div>
							</div>
							<div class="text-xs text-gray-500 mt-1">
								{'●'.repeat(Math.round(healthScore.overall))}{'○'.repeat(
									10 - Math.round(healthScore.overall)
								)}
								<span class="ml-2 font-medium">{healthScore.grade}</span>
							</div>
						</div>
					</div>

					<!-- Component Breakdown - Two Column Layout -->
					<div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
						<div class="flex justify-between items-center">
							<span class="text-gray-600">Content</span>
							<span
								class="font-medium {healthScore.breakdown.content.percentage >= 80
									? 'text-green-600'
									: healthScore.breakdown.content.percentage >= 60
										? 'text-blue-600'
										: 'text-yellow-600'}"
							>
								{healthScore.breakdown.content.score}/{healthScore.breakdown.content.maxScore}
								({healthScore.breakdown.content.percentage}%)
							</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-gray-600">Images</span>
							<span
								class="font-medium {healthScore.breakdown.images.percentage >= 80
									? 'text-green-600'
									: healthScore.breakdown.images.percentage >= 60
										? 'text-blue-600'
										: 'text-yellow-600'}"
							>
								{healthScore.breakdown.images.score}/{healthScore.breakdown.images.maxScore}
								({healthScore.breakdown.images.percentage}%)
							</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-gray-600">Competitive</span>
							<span
								class="font-medium {healthScore.breakdown.competitive.percentage >= 70
									? 'text-green-600'
									: healthScore.breakdown.competitive.percentage >= 50
										? 'text-blue-600'
										: 'text-yellow-600'}"
							>
								{healthScore.breakdown.competitive.score}/{healthScore.breakdown.competitive
									.maxScore}
								({healthScore.breakdown.competitive.percentage}%)
							</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-gray-600">Buy Box</span>
							<span
								class="font-medium {healthScore.breakdown.buybox.percentage >= 70
									? 'text-green-600'
									: healthScore.breakdown.buybox.percentage >= 50
										? 'text-blue-600'
										: 'text-yellow-600'}"
							>
								{healthScore.breakdown.buybox.score}/{healthScore.breakdown.buybox.maxScore}
								({healthScore.breakdown.buybox.percentage}%)
							</span>
						</div>
					</div>

					<!-- Top Recommendations -->
					{#if healthScore.recommendations && healthScore.recommendations.length > 0}
						<div class="mt-4 pt-4 border-t">
							<div class="text-xs font-semibold text-gray-700 mb-2">Top Improvements:</div>
							<div class="space-y-2">
								{#each healthScore.recommendations.slice(0, 3) as rec}
									<div class="flex items-start space-x-2">
										<span
											class="inline-block w-2 h-2 rounded-full mt-1.5 flex-shrink-0 {rec.priority ===
											'high'
												? 'bg-red-500'
												: rec.priority === 'medium'
													? 'bg-yellow-500'
													: 'bg-blue-500'}"
										></span>
										<div class="flex-1 min-w-0">
											<div class="text-xs font-medium text-gray-800">{rec.title}</div>
											<div class="text-xs text-gray-600 mt-0.5 leading-relaxed">
												{rec.description}
											</div>
											<div class="flex items-center mt-1 space-x-2">
												<span class="text-xs text-green-600 font-medium">{rec.impact}</span>
												<span class="text-xs text-gray-400">•</span>
												<span class="text-xs text-gray-500 capitalize">{rec.priority} priority</span
												>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{:else}
					<div class="flex items-center space-x-3">
						<div class="text-4xl font-bold text-gray-400">—</div>
						<div class="flex-1">
							<div class="w-full bg-gray-200 rounded-full h-2">
								<div class="bg-gray-300 h-2 rounded-full" style="width: 0%"></div>
							</div>
							<div class="text-xs text-gray-400 mt-1">Calculating...</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Top Keywords -->
			<div class="bg-white rounded-lg shadow p-6">
				<div class="text-sm text-gray-600 mb-2">Top Keywords</div>
				{#if catalogData?.keywords}
					<div class="flex flex-wrap gap-2 mb-3">
						{#each catalogData.keywords.primary as keyword}
							<span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
								{keyword.charAt(0).toUpperCase() + keyword.slice(1)}
							</span>
						{/each}
					</div>
					{#if catalogData.keywords.secondary.length > 0}
						<div class="text-xs text-gray-500 mb-2">
							Related: {catalogData.keywords.secondary
								.slice(0, 3)
								.map((k) => k.charAt(0).toUpperCase() + k.slice(1))
								.join(', ')}
						</div>
					{/if}
				{:else}
					<div class="text-xs text-gray-400 mb-1">No keywords extracted yet</div>
				{/if}
			</div>
		</div>

		<!-- Main Content Grid -->
		<div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
			<!-- Sidebar - Product Details -->
			<div class="lg:col-span-1 space-y-4">
				<!-- Product Details Card -->
				<div class="bg-white rounded-lg shadow p-6">
					<h3 class="font-semibold text-gray-900 mb-4">Product Details</h3>

					<!-- Amazon Catalog Data -->
					{#if catalogData}
						<div class="mb-4 pb-4 border-b">
							{#if catalogData.packageQuantity}
								<div class="flex justify-between text-sm mb-2">
									<span class="text-gray-600">Package Quantity</span>
									<span class="font-semibold">{catalogData.packageQuantity}</span>
								</div>
							{/if}
							{#if catalogData.dimensions}
								<div class="text-xs text-gray-500 mt-2">
									{#if catalogData.dimensions.weight}
										Weight: {convertToKg(
											catalogData.dimensions.weight.value,
											catalogData.dimensions.weight.unit
										).toFixed(1)}kg
									{/if}
									{#if catalogData.dimensions.length && catalogData.dimensions.width && catalogData.dimensions.height}
										<br />Size: {catalogData.dimensions.length.value.toFixed(1)} × {catalogData.dimensions.width.value.toFixed(
											1
										)} × {catalogData.dimensions.height.value.toFixed(1)}
										{catalogData.dimensions.length.unit}
									{/if}
								</div>
							{/if}
						</div>
					{/if}

					<!-- Fees from Amazon Fees API -->
					{#if feesData}
						<div class="mb-4 pb-4 border-b">
							<h4 class="text-sm font-semibold text-gray-900 mb-3">
								Fee Breakdown @ £{(yourPrice || 0).toFixed(2)}
								<span class="text-xs font-normal text-gray-500">
									({feesData.fbaFee > 0 ? 'FBA' : 'FBM'})
								</span>
							</h4>
							<div class="space-y-2 text-sm">
								{#if feesData.fbaFee > 0}
									<div class="flex justify-between">
										<span class="text-gray-600">FBA Fee</span>
										<span class="font-semibold text-orange-600">{formatPrice(feesData.fbaFee)}</span
										>
									</div>
								{/if}
								<div class="flex justify-between">
									<span class="text-gray-600">Referral Fee</span>
									<span class="font-semibold text-purple-600"
										>{formatPrice(feesData.referralFee)}</span
									>
								</div>
								{#if feesData.variableClosingFee > 0}
									<div class="flex justify-between">
										<span class="text-gray-600">Closing Fee</span>
										<span class="font-semibold text-gray-600"
											>{formatPrice(feesData.variableClosingFee)}</span
										>
									</div>
								{/if}
								<div class="flex justify-between font-bold pt-2 border-t">
									<span class="text-gray-900">Total Fees</span>
									<span class="text-red-600">{formatPrice(feesData.totalFees)}</span>
								</div>
								<div class="flex justify-between font-bold">
									<span class="text-gray-900">You Receive</span>
									<span class="text-green-600">{formatPrice(feesData.estimatedProceeds)}</span>
								</div>
							</div>
						</div>
					{/if}

					<!-- Market Metrics -->
					<div class="space-y-3 text-sm">
						<div class="flex justify-between">
							<span class="text-gray-600">Total Prime Offers</span>
							<span class="font-semibold">{totalPrimeOffers}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600">Competitive FBA Offers</span>
							<span class="font-semibold">{competitiveFbaOffers}</span>
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

					{#if data.productInfo}
						<!-- Cost Analysis Section -->
						<div class="mt-6 pt-6 border-t">
							<h4 class="text-sm font-semibold text-gray-900 mb-3">Cost & Margin Analysis</h4>

							<!-- Cost Breakdown -->
							{#if data.productInfo.your_cost || data.productInfo.material_cost_only}
								<div class="mb-4 pb-3 border-b">
									<div class="text-xs font-semibold text-gray-700 mb-2">Cost Breakdown</div>
									<div class="space-y-1.5 text-xs">
										{#if data.productInfo.material_cost_only}
											<div class="flex justify-between">
												<span class="text-gray-600">Material Cost</span>
												<span class="font-medium"
													>{formatPrice(data.productInfo.material_cost_only)}</span
												>
											</div>
										{/if}
										{#if data.productInfo.your_shipping_cost}
											<div class="flex justify-between">
												<span class="text-gray-600">Shipping Cost</span>
												<span class="font-medium"
													>{formatPrice(data.productInfo.your_shipping_cost)}</span
												>
											</div>
										{/if}
										{#if data.productInfo.your_box_cost}
											<div class="flex justify-between">
												<span class="text-gray-600">Box/Packaging</span>
												<span class="font-medium"
													>{formatPrice(data.productInfo.your_box_cost)}</span
												>
											</div>
										{/if}
										{#if data.productInfo.your_fragile_charge}
											<div class="flex justify-between">
												<span class="text-gray-600">Fragile Charge</span>
												<span class="font-medium"
													>{formatPrice(data.productInfo.your_fragile_charge)}</span
												>
											</div>
										{/if}
										{#if data.productInfo.your_vat_amount}
											<div class="flex justify-between">
												<span class="text-gray-600">VAT</span>
												<span class="font-medium"
													>{formatPrice(data.productInfo.your_vat_amount)}</span
												>
											</div>
										{/if}
										{#if data.productInfo.total_operating_cost}
											<div class="flex justify-between font-semibold pt-1.5 border-t">
												<span class="text-gray-900">Total Cost</span>
												<span class="text-orange-600"
													>{formatPrice(data.productInfo.total_operating_cost)}</span
												>
											</div>
										{/if}
									</div>
								</div>
							{/if}

							<!-- Margin Analysis -->
							<div class="space-y-2 text-sm">
								{#if data.productInfo.your_margin_at_current_price !== null && data.productInfo.your_margin_at_current_price !== undefined}
									<div class="flex justify-between">
										<span class="text-gray-600">Current Margin</span>
										<span
											class="font-semibold {data.productInfo.your_margin_at_current_price >= 0
												? 'text-green-600'
												: 'text-red-600'}"
										>
											{formatPrice(data.productInfo.your_margin_at_current_price)}
										</span>
									</div>
								{/if}
								{#if data.productInfo.your_margin_percent_at_current_price !== null && data.productInfo.your_margin_percent_at_current_price !== undefined}
									<div class="flex justify-between">
										<span class="text-gray-600">Current Margin %</span>
										<span
											class="font-semibold {data.productInfo.your_margin_percent_at_current_price >=
											0
												? 'text-green-600'
												: 'text-red-600'}"
										>
											{data.productInfo.your_margin_percent_at_current_price.toFixed(1)}%
										</span>
									</div>
								{/if}
								{#if data.productInfo.min_profitable_price}
									<div class="flex justify-between">
										<span class="text-gray-600">Min Profitable Price</span>
										<span class="font-semibold text-orange-600"
											>{formatPrice(data.productInfo.min_profitable_price)}</span
										>
									</div>
								{/if}
							</div>

							<!-- Buy Box Margin -->
							{#if data.productInfo.margin_at_buybox_price !== null && data.productInfo.margin_at_buybox_price !== undefined}
								<div class="mt-3 pt-3 border-t">
									<div class="text-xs font-semibold text-gray-700 mb-2">If Matching Buy Box</div>
									<div class="space-y-1.5 text-sm">
										<div class="flex justify-between">
											<span class="text-gray-600">Margin @ Buy Box</span>
											<span
												class="font-semibold {data.productInfo.margin_at_buybox_price >= 0
													? 'text-green-600'
													: 'text-red-600'}"
											>
												{formatPrice(data.productInfo.margin_at_buybox_price)}
											</span>
										</div>
										{#if data.productInfo.margin_percent_at_buybox_price !== null && data.productInfo.margin_percent_at_buybox_price !== undefined}
											<div class="flex justify-between">
												<span class="text-gray-600">Margin %</span>
												<span
													class="font-semibold {data.productInfo.margin_percent_at_buybox_price >= 0
														? 'text-green-600'
														: 'text-red-600'}"
												>
													{data.productInfo.margin_percent_at_buybox_price.toFixed(1)}%
												</span>
											</div>
										{/if}
										{#if data.productInfo.profit_opportunity}
											<div class="flex justify-between">
												<span class="text-gray-600">Profit Impact</span>
												<span
													class="font-semibold {data.productInfo.profit_opportunity >= 0
														? 'text-green-600'
														: 'text-red-600'}"
												>
													{data.productInfo.profit_opportunity >= 0 ? '+' : ''}{formatPrice(
														data.productInfo.profit_opportunity
													)}
												</span>
											</div>
										{/if}
									</div>
								</div>
							{/if}

							<!-- Opportunity Flag -->
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
											<p class="text-xs text-green-700 mt-1">You can profitably win the Buy Box</p>
										</div>
									</div>
								</div>
							{/if}

							<!-- Competitor Info -->
							{#if data.productInfo.competitor_price}
								<div class="mt-3 pt-3 border-t">
									<div class="flex justify-between text-sm">
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
						{#if data.history && data.history.length > 0 && hasPriceData}
							<canvas bind:this={chartCanvas}></canvas>
						{:else if data.history && data.history.length > 0 && !hasPriceData}
							<!-- Has history but no price data -->
							<div
								class="flex items-center justify-center h-full bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
							>
								<div class="text-center px-6">
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
									<h3 class="mt-3 text-sm font-medium text-gray-900">No Price Changes Recorded</h3>
									<p class="mt-2 text-sm text-gray-500 max-w-sm">
										{#if timeRange === '1hour'}
											No price changes in the last hour. Try selecting a longer time range.
										{:else if timeRange === '12hours'}
											No price changes in the last 12 hours. Try selecting a longer time range.
										{:else if timeRange === '1day'}
											No price changes in the last 24 hours. Try selecting a longer time range.
										{:else}
											Price monitoring data will appear here when price changes are detected for
											this product.
										{/if}
									</p>
									<div class="mt-4">
										<button
											onclick={() => changeTimeRange('30days')}
											class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
										>
											<svg
												class="mr-2 h-4 w-4"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
												/>
											</svg>
											View Last 30 Days
										</button>
									</div>
								</div>
							</div>
						{:else}
							<!-- No history at all -->
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

				<!-- Product Features (from Catalog API) -->
				{#if catalogData?.bulletPoints && catalogData.bulletPoints.length > 0}
					<div class="bg-gray-50 rounded-lg shadow p-6 mt-6">
						<h3 class="font-semibold text-gray-900 mb-4">Product Features</h3>
						<ul class="space-y-2">
							{#each catalogData.bulletPoints.slice(0, 5) as bulletPoint}
								<li class="text-sm text-gray-700 flex items-start">
									<svg
										class="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0"
										fill="currentColor"
										viewBox="0 0 20 20"
									>
										<path
											fill-rule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
											clip-rule="evenodd"
										/>
									</svg>
									<span>{bulletPoint}</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
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
