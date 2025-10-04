<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { Chart, registerables } from 'chart.js';
	import 'chartjs-adapter-date-fns';

	// Register Chart.js components
	Chart.register(...registerables);

	let { data }: { data: PageData } = $props();

	// Reactive state
	let timeRange = $state<'24h' | '7d' | '30d' | 'all'>('7d');
	let chartCanvas = $state<HTMLCanvasElement>();
	let priceChart: Chart | null = null;
	let selectedPoint = $state<any>(null);

	// Get filtered history based on time range
	function getFilteredHistory() {
		if (!data.history || data.history.length === 0) return [];

		const now = new Date();
		const cutoffTimes = {
			'24h': new Date(now.getTime() - 24 * 60 * 60 * 1000),
			'7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
			'30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
			all: new Date(0)
		};

		return data.history.filter((h: any) => new Date(h.timestamp) >= cutoffTimes[timeRange]);
	}

	// Create price chart
	function createChart() {
		if (!chartCanvas || !data.history) return;

		const history = getFilteredHistory();

		if (history.length === 0) {
			console.warn('No data to display in chart');
			return;
		}

		// Prepare data for chart (reverse to show chronological order)
		const reversedHistory = [...history].reverse();
		const timestamps = reversedHistory.map((h: any) => new Date(h.timestamp));

		const yourPrices = reversedHistory.map((h: any) => h.yourOffer?.landedPrice || null);
		const marketLows = reversedHistory.map((h: any) => h.marketLow);
		const marketHighs = reversedHistory.map((h: any) => h.marketHigh);

		// Destroy existing chart if it exists
		if (priceChart) {
			priceChart.destroy();
		}

		// Create new chart
		priceChart = new Chart(chartCanvas, {
			type: 'line',
			data: {
				labels: timestamps,
				datasets: [
					{
						label: 'Your Price',
						data: yourPrices,
						borderColor: 'rgb(34, 197, 94)',
						backgroundColor: 'rgba(34, 197, 94, 0.1)',
						borderWidth: 2,
						pointRadius: 4,
						pointHoverRadius: 6,
						tension: 0.1
					},
					{
						label: 'Market Low',
						data: marketLows,
						borderColor: 'rgb(59, 130, 246)',
						backgroundColor: 'rgba(59, 130, 246, 0.1)',
						borderWidth: 2,
						pointRadius: 3,
						pointHoverRadius: 5,
						tension: 0.1
					},
					{
						label: 'Market High',
						data: marketHighs,
						borderColor: 'rgb(239, 68, 68)',
						backgroundColor: 'rgba(239, 68, 68, 0.1)',
						borderWidth: 1,
						borderDash: [5, 5],
						pointRadius: 2,
						pointHoverRadius: 4,
						tension: 0.1
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: 'index',
					intersect: false
				},
				plugins: {
					title: {
						display: true,
						text: 'Price History',
						font: { size: 16, weight: 'bold' }
					},
					tooltip: {
						callbacks: {
							title: (context) => {
								const date = new Date(context[0].parsed.x);
								return date.toLocaleString();
							},
							label: (context) => {
								const label = context.dataset.label || '';
								const value = context.parsed.y;
								return `${label}: £${value?.toFixed(2) || 'N/A'}`;
							},
							afterLabel: (context) => {
								const index = context.dataIndex;
								const historyItem = reversedHistory[index];
								if (historyItem && historyItem.yourOffer) {
									return [
										`Position: #${historyItem.yourOffer.position}`,
										`Total Offers: ${historyItem.offerCount}`,
										`Buy Box: ${historyItem.yourOffer.isBuyBoxWinner ? 'Won ✓' : 'Lost'}`
									];
								}
								return [];
							}
						}
					},
					legend: {
						display: true,
						position: 'top'
					}
				},
				scales: {
					x: {
						type: 'time',
						time: {
							unit: timeRange === '24h' ? 'hour' : timeRange === '7d' ? 'day' : 'day',
							displayFormats: {
								hour: 'HH:mm',
								day: 'MMM d'
							}
						},
						title: {
							display: true,
							text: 'Time'
						}
					},
					y: {
						beginAtZero: false,
						title: {
							display: true,
							text: 'Price (£)'
						},
						ticks: {
							callback: (value) => `£${value}`
						}
					}
				}
			}
		});
	}

	// Update chart when time range changes
	$effect(() => {
		if (chartCanvas && data.history) {
			createChart();
		}
	});

	// Initialize chart on mount
	onMount(() => {
		if (chartCanvas && data.history) {
			createChart();
		}
	});

	// Format currency
	function formatPrice(amount: number): string {
		return new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency: 'GBP'
		}).format(amount);
	}

	// Format date
	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleString();
	}

	// Format relative time
	function formatRelativeTime(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours}h ago`;
		const diffDays = Math.floor(diffHours / 24);
		return `${diffDays}d ago`;
	}
</script>

<div class="container mx-auto px-4 py-6 max-w-7xl">
	<!-- Header -->
	<div class="mb-6">
		<a
			href="/buy-box-alerts/live"
			class="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
		>
			← Back to Live Alerts
		</a>
		<h1 class="text-3xl font-bold text-gray-900">Product Analysis: {data.asin}</h1>
		{#if data.productInfo}
			<p class="text-gray-600 mt-2">{data.productInfo.item_name || 'Product Details'}</p>
		{/if}
	</div>

	{#if !data.currentState && (!data.history || data.history.length === 0)}
		<!-- No data available -->
		<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
			<h2 class="text-xl font-semibold text-yellow-800 mb-2">No Data Available</h2>
			<p class="text-yellow-700">
				No historical notifications found for ASIN <strong>{data.asin}</strong>.
			</p>
			<p class="text-yellow-600 mt-2">
				This product may not be actively monitored, or notifications haven't been received yet.
			</p>
		</div>
	{:else}
		<!-- Current State Card -->
		{#if data.currentState}
			<div class="bg-white rounded-lg shadow-md p-6 mb-6">
				<h2 class="text-xl font-semibold mb-4">Current State</h2>
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
					<div class="text-center p-4 bg-green-50 rounded-lg">
						<div class="text-sm text-gray-600 mb-1">Your Price</div>
						<div class="text-2xl font-bold text-green-600">
							{formatPrice(parseFloat(data.currentState.your_price))}
						</div>
					</div>
					<div class="text-center p-4 bg-blue-50 rounded-lg">
						<div class="text-sm text-gray-600 mb-1">Market Low</div>
						<div class="text-2xl font-bold text-blue-600">
							{formatPrice(parseFloat(data.currentState.market_low))}
						</div>
					</div>
					<div class="text-center p-4 bg-purple-50 rounded-lg">
						<div class="text-sm text-gray-600 mb-1">Position</div>
						<div class="text-2xl font-bold text-purple-600">
							#{data.currentState.your_position}
						</div>
					</div>
					<div class="text-center p-4 bg-gray-50 rounded-lg">
						<div class="text-sm text-gray-600 mb-1">Total Offers</div>
						<div class="text-2xl font-bold text-gray-600">
							{data.currentState.total_offers}
						</div>
					</div>
				</div>
				<div class="mt-4 flex items-center justify-between">
					<div class="flex items-center gap-4">
						<span class="text-sm text-gray-600">
							Severity:
							<span
								class="font-semibold"
								class:text-red-600={data.currentState.severity === 'critical'}
								class:text-orange-600={data.currentState.severity === 'high'}
								class:text-yellow-600={data.currentState.severity === 'warning'}
								class:text-green-600={data.currentState.severity === 'success'}
							>
								{data.currentState.severity?.toUpperCase()}
							</span>
						</span>
						<span class="text-sm text-gray-600">
							Buy Box:
							<span
								class:text-green-600={data.currentState.buy_box_winner}
								class:text-gray-500={!data.currentState.buy_box_winner}
							>
								{data.currentState.buy_box_winner ? 'Won ✓' : 'Not Won'}
							</span>
						</span>
					</div>
					<div class="text-sm text-gray-500">
						Updated {formatRelativeTime(data.currentState.last_updated)}
					</div>
				</div>
			</div>
		{/if}

		<!-- Analytics Cards -->
		{#if data.analytics}
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
				<div class="bg-white rounded-lg shadow p-4">
					<div class="text-xs text-gray-500 mb-1">Avg Price</div>
					<div class="text-lg font-bold">{formatPrice(data.analytics.avgPrice)}</div>
				</div>
				<div class="bg-white rounded-lg shadow p-4">
					<div class="text-xs text-gray-500 mb-1">Price Changes</div>
					<div class="text-lg font-bold">{data.analytics.priceChanges}</div>
				</div>
				<div class="bg-white rounded-lg shadow p-4">
					<div class="text-xs text-gray-500 mb-1">Buy Box Win Rate</div>
					<div class="text-lg font-bold">{data.analytics.buyBoxWinRate.toFixed(1)}%</div>
				</div>
				<div class="bg-white rounded-lg shadow p-4">
					<div class="text-xs text-gray-500 mb-1">Avg Competitors</div>
					<div class="text-lg font-bold">{data.analytics.avgCompetitors.toFixed(1)}</div>
				</div>
			</div>
		{/if}

		<!-- Price Chart -->
		{#if data.history && data.history.length > 0}
			<div class="bg-white rounded-lg shadow-md p-6 mb-6">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-xl font-semibold">Price History</h2>
					<div class="flex gap-2">
						<button
							onclick={() => (timeRange = '24h')}
							class="px-3 py-1 rounded text-sm {timeRange === '24h'
								? 'bg-blue-600 text-white'
								: 'bg-gray-200 text-gray-700'}"
						>
							24h
						</button>
						<button
							onclick={() => (timeRange = '7d')}
							class="px-3 py-1 rounded text-sm {timeRange === '7d'
								? 'bg-blue-600 text-white'
								: 'bg-gray-200 text-gray-700'}"
						>
							7d
						</button>
						<button
							onclick={() => (timeRange = '30d')}
							class="px-3 py-1 rounded text-sm {timeRange === '30d'
								? 'bg-blue-600 text-white'
								: 'bg-gray-200 text-gray-700'}"
						>
							30d
						</button>
						<button
							onclick={() => (timeRange = 'all')}
							class="px-3 py-1 rounded text-sm {timeRange === 'all'
								? 'bg-blue-600 text-white'
								: 'bg-gray-200 text-gray-700'}"
						>
							All
						</button>
					</div>
				</div>
				<div class="h-96">
					<canvas bind:this={chartCanvas}></canvas>
				</div>
			</div>
		{/if}

		<!-- Competitor Activity -->
		{#if data.competitors && data.competitors.length > 0}
			<div class="bg-white rounded-lg shadow-md p-6 mb-6">
				<h2 class="text-xl font-semibold mb-4">Competitor Activity</h2>
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b">
								<th class="text-left py-2 px-4">Seller ID</th>
								<th class="text-left py-2 px-4">Status</th>
								<th class="text-right py-2 px-4">Lowest Price</th>
								<th class="text-right py-2 px-4">Highest Price</th>
								<th class="text-right py-2 px-4">Appearances</th>
								<th class="text-right py-2 px-4">Price Changes</th>
								<th class="text-center py-2 px-4">FBA</th>
								<th class="text-right py-2 px-4">Buy Box Wins</th>
							</tr>
						</thead>
						<tbody>
							{#each data.competitors as competitor}
								<tr class="border-b hover:bg-gray-50">
									<td class="py-2 px-4 font-mono text-sm"
										>{competitor.sellerId.substring(0, 10)}...</td
									>
									<td class="py-2 px-4">
										{#if competitor.currentlyActive}
											<span
												class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800"
											>
												Active
											</span>
										{:else}
											<span
												class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600"
											>
												Inactive
											</span>
										{/if}
									</td>
									<td class="py-2 px-4 text-right">{formatPrice(competitor.lowestPrice)}</td>
									<td class="py-2 px-4 text-right">{formatPrice(competitor.highestPrice)}</td>
									<td class="py-2 px-4 text-right">{competitor.appearances}</td>
									<td class="py-2 px-4 text-right">{competitor.priceChanges}</td>
									<td class="py-2 px-4 text-center">
										{#if competitor.isFBA}
											<span class="text-blue-600">✓</span>
										{:else}
											<span class="text-gray-400">—</span>
										{/if}
									</td>
									<td class="py-2 px-4 text-right">
										{competitor.buyBoxWins}
										<span class="text-xs text-gray-500"
											>({competitor.buyBoxWinRate.toFixed(0)}%)</span
										>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<!-- Recent Notifications -->
		{#if data.history && data.history.length > 0}
			<div class="bg-white rounded-lg shadow-md p-6">
				<h2 class="text-xl font-semibold mb-4">Recent Notifications ({data.meta.totalRecords})</h2>
				<div class="space-y-3 max-h-96 overflow-y-auto">
					{#each data.history.slice(0, 20) as notification}
						<div class="border rounded-lg p-4 hover:bg-gray-50">
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<div class="text-sm text-gray-500">{formatDate(notification.timestamp)}</div>
									<div class="mt-2 grid grid-cols-4 gap-4 text-sm">
										<div>
											<span class="text-gray-600">Your Price:</span>
											<span class="font-semibold">
												{notification.yourOffer
													? formatPrice(notification.yourOffer.landedPrice)
													: 'N/A'}
											</span>
										</div>
										<div>
											<span class="text-gray-600">Position:</span>
											<span class="font-semibold">
												{notification.yourOffer ? `#${notification.yourOffer.position}` : 'N/A'}
											</span>
										</div>
										<div>
											<span class="text-gray-600">Market Low:</span>
											<span class="font-semibold">{formatPrice(notification.marketLow)}</span>
										</div>
										<div>
											<span class="text-gray-600">Offers:</span>
											<span class="font-semibold">{notification.offerCount}</span>
										</div>
									</div>
								</div>
								{#if notification.yourOffer?.isBuyBoxWinner}
									<span class="ml-4 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
										Buy Box ✓
									</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
