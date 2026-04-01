<script lang="ts">
	import type { BuyBoxAlert, AlertSeverity } from '$lib/types/buyBoxTypes';
	import { createEventDispatcher } from 'svelte';

	export let alert: BuyBoxAlert;
	export let showActions: boolean = true;

	const dispatch = createEventDispatcher<{
		dismiss: { alertId: string };
		view: { alert: BuyBoxAlert };
		analyze: { alert: BuyBoxAlert };
	}>();

	function getSeverityColor(severity: AlertSeverity): string {
		switch (severity) {
			case 'CRITICAL':
				return 'bg-red-50 border-red-200 text-red-800';
			case 'HIGH':
				return 'bg-orange-50 border-orange-200 text-orange-800';
			case 'MEDIUM':
				return 'bg-yellow-50 border-yellow-200 text-yellow-800';
			case 'LOW':
				return 'bg-blue-50 border-blue-200 text-blue-800';
			default:
				return 'bg-gray-50 border-gray-200 text-gray-800';
		}
	}

	function getSeverityIcon(severity: AlertSeverity): string {
		switch (severity) {
			case 'CRITICAL':
				return '🚨';
			case 'HIGH':
				return '⚠️';
			case 'MEDIUM':
				return '⚡';
			case 'LOW':
				return 'ℹ️';
			default:
				return '📝';
		}
	}

	function getAlertTypeLabel(type: string): string {
		switch (type) {
			case 'BUY_BOX_LOST':
				return 'Buy Box Lost';
			case 'BUY_BOX_WON':
				return 'Buy Box Won';
			case 'PRICE_CHANGE':
				return 'Price Change';
			case 'NEW_COMPETITOR':
				return 'New Competitor';
			case 'RANK_CHANGE':
				return 'Rank Change';
			default:
				return type.replace(/_/g, ' ');
		}
	}

	function formatPrice(amount: number, currency: string = 'USD'): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency
		}).format(amount);
	}

	function formatTimestamp(timestamp: string): string {
		return new Date(timestamp).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getBuyBoxWinner() {
		const winner = alert.data.Offers?.find((offer) => offer.IsBuyBoxWinner);
		return winner;
	}

	function getCompetitorCount(): number {
		return alert.data.Summary?.TotalOfferCount || 0;
	}

	function getCurrentPrice(): number | null {
		const buyBoxPrice = alert.data.Summary?.BuyBoxPrices?.[0];
		return buyBoxPrice?.ListingPrice?.Amount || null;
	}

	function getPreviousPrice(): number | null {
		if (!alert.previousData) return null;
		const previousBuyBoxPrice = alert.previousData.Summary?.BuyBoxPrices?.[0];
		return previousBuyBoxPrice?.ListingPrice?.Amount || null;
	}

	function getPriceChange(): { amount: number; percentage: number } | null {
		const current = getCurrentPrice();
		const previous = getPreviousPrice();

		if (current === null || previous === null) return null;

		const amount = current - previous;
		const percentage = (amount / previous) * 100;

		return { amount, percentage };
	}

	$: buyBoxWinner = getBuyBoxWinner();
	$: competitorCount = getCompetitorCount();
	$: currentPrice = getCurrentPrice();
	$: priceChange = getPriceChange();
</script>

<div class="border rounded-lg p-4 {getSeverityColor(alert.severity)} mb-4">
	<!-- Alert Header -->
	<div class="flex items-start justify-between mb-3">
		<div class="flex items-center space-x-3">
			<span class="text-2xl">{getSeverityIcon(alert.severity)}</span>
			<div>
				<h3 class="font-semibold text-lg">
					{getAlertTypeLabel(alert.alertType)}
				</h3>
				<p class="text-sm opacity-75">
					{alert.productName || alert.asin} • SKU: {alert.sku || 'N/A'}
				</p>
			</div>
		</div>
		<div class="text-right">
			<div class="text-xs opacity-75 mb-1">{formatTimestamp(alert.timestamp)}</div>
			<span class="inline-block px-2 py-1 text-xs font-medium rounded-full bg-white bg-opacity-50">
				{alert.severity}
			</span>
		</div>
	</div>

	<!-- Alert Details -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
		<!-- Current Price -->
		{#if currentPrice !== null}
			<div class="bg-white bg-opacity-50 rounded p-3">
				<div class="text-xs font-medium opacity-75 mb-1">Current Price</div>
				<div class="text-lg font-semibold">
					{formatPrice(currentPrice)}
					{#if priceChange}
						<span class="text-sm ml-2 {priceChange.amount > 0 ? 'text-red-600' : 'text-green-600'}">
							{priceChange.amount > 0 ? '+' : ''}{formatPrice(priceChange.amount)}
							({priceChange.percentage > 0 ? '+' : ''}{priceChange.percentage.toFixed(1)}%)
						</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Buy Box Status -->
		<div class="bg-white bg-opacity-50 rounded p-3">
			<div class="text-xs font-medium opacity-75 mb-1">Buy Box Status</div>
			<div class="text-lg font-semibold">
				{#if buyBoxWinner}
					{#if buyBoxWinner.IsFeaturedMerchant}
						<span class="text-green-600">✓ Won (Featured)</span>
					{:else}
						<span class="text-orange-600">Won (Other)</span>
					{/if}
				{:else}
					<span class="text-red-600">✗ Lost</span>
				{/if}
			</div>
		</div>

		<!-- Competition -->
		<div class="bg-white bg-opacity-50 rounded p-3">
			<div class="text-xs font-medium opacity-75 mb-1">Competition</div>
			<div class="text-lg font-semibold">
				{competitorCount} offers
			</div>
		</div>
	</div>

	<!-- Buy Box Winner Details -->
	{#if buyBoxWinner}
		<div class="bg-white bg-opacity-30 rounded p-3 mb-4">
			<div class="text-xs font-medium opacity-75 mb-2">Buy Box Winner Details</div>
			<div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
				<div>
					<div class="opacity-75">Seller ID</div>
					<div class="font-medium">{buyBoxWinner.SellerId}</div>
				</div>
				<div>
					<div class="opacity-75">Fulfillment</div>
					<div class="font-medium">
						{buyBoxWinner.IsFulfilledByAmazon ? 'Amazon' : 'Merchant'}
					</div>
				</div>
				<div>
					<div class="opacity-75">Prime</div>
					<div class="font-medium">
						{buyBoxWinner.PrimeInformation.IsPrime ? '✓ Prime' : '✗ No Prime'}
					</div>
				</div>
				<div>
					<div class="opacity-75">Rating</div>
					<div class="font-medium">
						{buyBoxWinner.SellerFeedbackRating.SellerPositiveFeedbackRating?.toFixed(1)}% ({buyBoxWinner
							.SellerFeedbackRating.FeedbackCount})
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Recommendations -->
	{#if alert.recommendations && alert.recommendations.length > 0}
		<div class="bg-white bg-opacity-30 rounded p-3 mb-4">
			<div class="text-xs font-medium opacity-75 mb-2">Recommendations</div>
			<ul class="text-sm space-y-1">
				{#each alert.recommendations as recommendation}
					<li class="flex items-start space-x-2">
						<span class="text-blue-600 mt-0.5">•</span>
						<span>{recommendation}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Actions -->
	{#if showActions}
		<div class="flex items-center space-x-2 pt-2 border-t border-white border-opacity-30">
			<button
				class="px-3 py-1 text-xs font-medium bg-white bg-opacity-70 hover:bg-opacity-90 rounded transition-colors"
				on:click={() => dispatch('view', { alert })}
			>
				View Details
			</button>
			<button
				class="px-3 py-1 text-xs font-medium bg-white bg-opacity-70 hover:bg-opacity-90 rounded transition-colors"
				on:click={() => dispatch('analyze', { alert })}
			>
				Analyze Competition
			</button>
			<div class="flex-1"></div>
			<button
				class="px-3 py-1 text-xs font-medium bg-white bg-opacity-50 hover:bg-opacity-70 rounded transition-colors"
				on:click={() => dispatch('dismiss', { alertId: alert.id })}
			>
				Dismiss
			</button>
		</div>
	{/if}
</div>
