<script lang="ts">
	import type { Offer, BuyBoxData } from '$lib/types/buyBoxTypes';
	import { createEventDispatcher } from 'svelte';

	export let buyBoxData: BuyBoxData;
	export let showActions: boolean = true;

	const dispatch = createEventDispatcher<{
		selectCompetitor: { competitor: Offer };
		viewDetails: { competitor: Offer };
	}>();

	type SortField = 'price' | 'rating' | 'feedbackCount' | 'prime' | 'fulfillment' | 'condition';
	type SortDirection = 'asc' | 'desc';

	let sortField: SortField = 'price';
	let sortDirection: SortDirection = 'asc';

	function formatPrice(amount: number, currency: string = 'USD'): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency
		}).format(amount);
	}

	function calculateTotalPrice(offer: Offer): number {
		const listingPrice = offer.ListingPrice?.Amount || 0;
		const shippingPrice = offer.Shipping?.Amount || 0;
		return listingPrice + shippingPrice;
	}

	function sortOffers(offers: Offer[]): Offer[] {
		return [...offers].sort((a, b) => {
			let aValue: any, bValue: any;

			switch (sortField) {
				case 'price':
					aValue = calculateTotalPrice(a);
					bValue = calculateTotalPrice(b);
					break;
				case 'rating':
					aValue = a.SellerFeedbackRating?.SellerPositiveFeedbackRating || 0;
					bValue = b.SellerFeedbackRating?.SellerPositiveFeedbackRating || 0;
					break;
				case 'feedbackCount':
					aValue = a.SellerFeedbackRating?.FeedbackCount || 0;
					bValue = b.SellerFeedbackRating?.FeedbackCount || 0;
					break;
				case 'prime':
					aValue = a.PrimeInformation?.IsPrime ? 1 : 0;
					bValue = b.PrimeInformation?.IsPrime ? 1 : 0;
					break;
				case 'fulfillment':
					aValue = a.IsFulfilledByAmazon ? 1 : 0;
					bValue = b.IsFulfilledByAmazon ? 1 : 0;
					break;
				case 'condition':
					aValue = a.SubCondition || '';
					bValue = b.SubCondition || '';
					break;
				default:
					return 0;
			}

			if (aValue < bValue) {
				return sortDirection === 'asc' ? -1 : 1;
			}
			if (aValue > bValue) {
				return sortDirection === 'asc' ? 1 : -1;
			}
			return 0;
		});
	}

	function handleSort(field: SortField) {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = 'asc';
		}
	}

	function getSortIcon(field: SortField): string {
		if (sortField !== field) return '↕️';
		return sortDirection === 'asc' ? '↑' : '↓';
	}

	function getCompetitiveAdvantage(offer: Offer, allOffers: Offer[]): string {
		const advantages: string[] = [];

		if (offer.IsBuyBoxWinner) advantages.push('Buy Box Winner');
		if (offer.IsFeaturedMerchant) advantages.push('Featured Merchant');
		if (offer.PrimeInformation?.IsPrime) advantages.push('Prime');
		if (offer.IsFulfilledByAmazon) advantages.push('FBA');

		const totalPrice = calculateTotalPrice(offer);
		const lowestPrice = Math.min(...allOffers.map(calculateTotalPrice));
		if (Math.abs(totalPrice - lowestPrice) < 0.01) advantages.push('Lowest Price');

		const highestRating = Math.max(
			...allOffers.map((o) => o.SellerFeedbackRating?.SellerPositiveFeedbackRating || 0)
		);
		if (offer.SellerFeedbackRating?.SellerPositiveFeedbackRating === highestRating) {
			advantages.push('Highest Rating');
		}

		return advantages.join(', ') || 'None';
	}

	function getThreatLevel(offer: Offer, allOffers: Offer[]): 'HIGH' | 'MEDIUM' | 'LOW' {
		let score = 0;

		// Price competitiveness (40% weight)
		const totalPrice = calculateTotalPrice(offer);
		const lowestPrice = Math.min(...allOffers.map(calculateTotalPrice));
		const priceRatio = totalPrice / lowestPrice;
		if (priceRatio <= 1.05) score += 40;
		else if (priceRatio <= 1.15) score += 25;
		else if (priceRatio <= 1.3) score += 10;

		// Prime eligibility (25% weight)
		if (offer.PrimeInformation?.IsPrime) score += 25;

		// Fulfillment (20% weight)
		if (offer.IsFulfilledByAmazon) score += 20;

		// Seller rating (15% weight)
		const rating = offer.SellerFeedbackRating?.SellerPositiveFeedbackRating || 0;
		if (rating >= 95) score += 15;
		else if (rating >= 90) score += 10;
		else if (rating >= 85) score += 5;

		if (score >= 70) return 'HIGH';
		if (score >= 40) return 'MEDIUM';
		return 'LOW';
	}

	function getThreatColor(threat: string): string {
		switch (threat) {
			case 'HIGH':
				return 'text-red-600 bg-red-50';
			case 'MEDIUM':
				return 'text-orange-600 bg-orange-50';
			case 'LOW':
				return 'text-green-600 bg-green-50';
			default:
				return 'text-gray-600 bg-gray-50';
		}
	}

	$: sortedOffers = sortOffers(buyBoxData.Offers || []);
</script>

<div class="bg-white rounded-lg shadow-sm border">
	<div class="px-6 py-4 border-b border-gray-200">
		<h3 class="text-lg font-semibold text-gray-900">Competitor Analysis</h3>
		<p class="text-sm text-gray-600 mt-1">
			{buyBoxData.Offers?.length || 0} competitors for ASIN: {buyBoxData.ASIN}
		</p>
	</div>

	<div class="overflow-x-auto">
		<table class="min-w-full divide-y divide-gray-200">
			<thead class="bg-gray-50">
				<tr>
					<th
						class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
					>
						Status
					</th>
					<th
						class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
					>
						<button
							class="flex items-center space-x-1 hover:text-gray-700"
							on:click={() => handleSort('price')}
						>
							<span>Total Price</span>
							<span class="text-gray-400">{getSortIcon('price')}</span>
						</button>
					</th>
					<th
						class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
					>
						Seller Details
					</th>
					<th
						class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
					>
						<button
							class="flex items-center space-x-1 hover:text-gray-700"
							on:click={() => handleSort('rating')}
						>
							<span>Rating</span>
							<span class="text-gray-400">{getSortIcon('rating')}</span>
						</button>
					</th>
					<th
						class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
					>
						<button
							class="flex items-center space-x-1 hover:text-gray-700"
							on:click={() => handleSort('fulfillment')}
						>
							<span>Fulfillment</span>
							<span class="text-gray-400">{getSortIcon('fulfillment')}</span>
						</button>
					</th>
					<th
						class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
					>
						Advantages
					</th>
					<th
						class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
					>
						Threat Level
					</th>
					{#if showActions}
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
						>
							Actions
						</th>
					{/if}
				</tr>
			</thead>
			<tbody class="bg-white divide-y divide-gray-200">
				{#each sortedOffers as offer, index}
					{@const totalPrice = calculateTotalPrice(offer)}
					{@const advantages = getCompetitiveAdvantage(offer, sortedOffers)}
					{@const threatLevel = getThreatLevel(offer, sortedOffers)}
					<tr class="hover:bg-gray-50 {offer.IsBuyBoxWinner ? 'bg-blue-50' : ''}">
						<td class="px-6 py-4 whitespace-nowrap">
							<div class="flex items-center space-x-2">
								{#if offer.IsBuyBoxWinner}
									<span
										class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
									>
										👑 Buy Box
									</span>
								{:else}
									<span
										class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
									>
										#{index + 1}
									</span>
								{/if}
								{#if offer.IsFeaturedMerchant}
									<span class="text-xs text-blue-600">⭐</span>
								{/if}
							</div>
						</td>
						<td class="px-6 py-4 whitespace-nowrap">
							<div class="text-sm">
								<div class="font-medium text-gray-900">
									{formatPrice(totalPrice)}
								</div>
								<div class="text-gray-500 text-xs">
									{formatPrice(offer.ListingPrice?.Amount || 0)} + {formatPrice(
										offer.Shipping?.Amount || 0
									)} shipping
								</div>
							</div>
						</td>
						<td class="px-6 py-4 whitespace-nowrap">
							<div class="text-sm">
								<div class="font-medium text-gray-900 truncate max-w-32" title={offer.SellerId}>
									{offer.SellerId}
								</div>
								<div class="text-gray-500 text-xs">
									{offer.SubCondition || 'New'}
								</div>
							</div>
						</td>
						<td class="px-6 py-4 whitespace-nowrap">
							<div class="text-sm">
								<div class="font-medium text-gray-900">
									{offer.SellerFeedbackRating?.SellerPositiveFeedbackRating?.toFixed(1) || 'N/A'}%
								</div>
								<div class="text-gray-500 text-xs">
									{offer.SellerFeedbackRating?.FeedbackCount || 0} reviews
								</div>
							</div>
						</td>
						<td class="px-6 py-4 whitespace-nowrap">
							<div class="flex flex-col space-y-1">
								{#if offer.IsFulfilledByAmazon}
									<span
										class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800"
									>
										📦 FBA
									</span>
								{:else}
									<span
										class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
									>
										🚚 Merchant
									</span>
								{/if}
								{#if offer.PrimeInformation?.IsPrime}
									<span
										class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
									>
										⚡ Prime
									</span>
								{/if}
							</div>
						</td>
						<td class="px-6 py-4">
							<div class="text-xs text-gray-600 max-w-40">
								{advantages}
							</div>
						</td>
						<td class="px-6 py-4 whitespace-nowrap">
							<span
								class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getThreatColor(
									threatLevel
								)}"
							>
								{threatLevel}
							</span>
						</td>
						{#if showActions}
							<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
								<div class="flex space-x-2">
									<button
										class="text-blue-600 hover:text-blue-900 text-xs"
										on:click={() => dispatch('viewDetails', { competitor: offer })}
									>
										Details
									</button>
									<button
										class="text-green-600 hover:text-green-900 text-xs"
										on:click={() => dispatch('selectCompetitor', { competitor: offer })}
									>
										Analyze
									</button>
								</div>
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if !buyBoxData.Offers || buyBoxData.Offers.length === 0}
		<div class="text-center py-12">
			<div class="text-gray-400 text-lg mb-2">📊</div>
			<h3 class="text-sm font-medium text-gray-900">No competitor data available</h3>
			<p class="text-sm text-gray-500 mt-1">
				No offers found for this ASIN or data may still be loading.
			</p>
		</div>
	{/if}
</div>
