<script lang="ts">
	import BuyBoxAlert from '$lib/components/BuyBoxAlert.svelte';
	import CompetitorAnalysisTable from '$lib/components/CompetitorAnalysisTable.svelte';
	import type { BuyBoxAlert as BuyBoxAlertType, BuyBoxData } from '$lib/types/buyBoxTypes';

	// Sample buy box data based on your provided API response
	const sampleBuyBoxData: BuyBoxData = {
		ASIN: 'B0CLNZR3VV',
		status: 'Success',
		ItemCondition: 'New',
		marketplaceId: 'A1F83G8C2ARO7P',
		Identifier: {
			ASIN: 'B0CLNZR3VV',
			ItemCondition: 'New',
			MarketplaceId: 'A1F83G8C2ARO7P'
		},
		Summary: {
			TotalOfferCount: 5,
			BuyBoxPrices: [
				{
					condition: 'New',
					LandedPrice: { Amount: 24.99, CurrencyCode: 'GBP' },
					ListingPrice: { Amount: 24.99, CurrencyCode: 'GBP' },
					Shipping: { Amount: 0.0, CurrencyCode: 'GBP' }
				}
			],
			LowestPrices: [
				{
					condition: 'New',
					LandedPrice: { Amount: 22.5, CurrencyCode: 'GBP' },
					ListingPrice: { Amount: 22.5, CurrencyCode: 'GBP' },
					Shipping: { Amount: 0.0, CurrencyCode: 'GBP' },
					fulfillmentChannel: 'Amazon'
				}
			],
			SalesRankings: [
				{
					Rank: 15432,
					ProductCategoryId: 'home_garden'
				}
			],
			NumberOfOffers: [
				{
					condition: 'New',
					OfferCount: 5,
					fulfillmentChannel: 'Amazon'
				}
			],
			BuyBoxEligibleOffers: [
				{
					condition: 'New',
					OfferCount: 3,
					fulfillmentChannel: 'Amazon'
				}
			],
			CompetitivePriceThreshold: { Amount: 23.75, CurrencyCode: 'GBP' }
		},
		Offers: [
			{
				SellerId: 'A2Q3Y263D00KWC',
				ListingPrice: { Amount: 24.99, CurrencyCode: 'GBP' },
				Shipping: { Amount: 0.0, CurrencyCode: 'GBP' },
				ShipsFrom: { Country: 'GB' },
				SubCondition: 'New',
				IsBuyBoxWinner: true,
				IsFeaturedMerchant: true,
				IsFulfilledByAmazon: true,
				PrimeInformation: {
					IsPrime: true,
					IsNationalPrime: true
				},
				SellerFeedbackRating: {
					FeedbackCount: 12847,
					SellerPositiveFeedbackRating: 97.5
				},
				ShippingTime: {
					minimumHours: 24,
					maximumHours: 48,
					availabilityType: 'NOW'
				}
			},
			{
				SellerId: 'A3RXQV425EXSM2',
				ListingPrice: { Amount: 22.5, CurrencyCode: 'GBP' },
				Shipping: { Amount: 3.99, CurrencyCode: 'GBP' },
				ShipsFrom: { Country: 'GB' },
				SubCondition: 'New',
				IsBuyBoxWinner: false,
				IsFeaturedMerchant: false,
				IsFulfilledByAmazon: false,
				PrimeInformation: {
					IsPrime: false,
					IsNationalPrime: false
				},
				SellerFeedbackRating: {
					FeedbackCount: 3245,
					SellerPositiveFeedbackRating: 89.2
				},
				ShippingTime: {
					minimumHours: 72,
					maximumHours: 120,
					availabilityType: 'NOW'
				}
			},
			{
				SellerId: 'A1RKKUPIHCS9HS',
				ListingPrice: { Amount: 26.99, CurrencyCode: 'GBP' },
				Shipping: { Amount: 0.0, CurrencyCode: 'GBP' },
				ShipsFrom: { Country: 'GB' },
				SubCondition: 'New',
				IsBuyBoxWinner: false,
				IsFeaturedMerchant: false,
				IsFulfilledByAmazon: true,
				PrimeInformation: {
					IsPrime: true,
					IsNationalPrime: true
				},
				SellerFeedbackRating: {
					FeedbackCount: 5672,
					SellerPositiveFeedbackRating: 94.8
				},
				ShippingTime: {
					minimumHours: 24,
					maximumHours: 48,
					availabilityType: 'NOW'
				}
			}
		]
	};

	// Sample alerts
	const sampleAlerts: BuyBoxAlertType[] = [
		{
			id: 'alert-001',
			asin: 'B0CLNZR3VV',
			productName: 'Premium Kitchen Organizer Set',
			sku: 'KIT-ORG-001',
			timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 minutes ago
			alertType: 'BUY_BOX_LOST',
			severity: 'CRITICAL',
			data: sampleBuyBoxData,
			previousData: {
				...sampleBuyBoxData,
				Offers: sampleBuyBoxData.Offers.map((offer, index) => ({
					...offer,
					IsBuyBoxWinner: index === 0 ? false : offer.IsBuyBoxWinner
				}))
			},
			recommendations: [
				'Consider lowering price to £22.49 to compete with lowest offer',
				'Review shipping strategy - competitors offering free shipping',
				'Monitor competitor A3RXQV425EXSM2 who is undercutting by £2.49'
			]
		},
		{
			id: 'alert-002',
			asin: 'B0CLNZR3VV',
			productName: 'Premium Kitchen Organizer Set',
			sku: 'KIT-ORG-001',
			timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
			alertType: 'PRICE_CHANGE',
			severity: 'HIGH',
			data: sampleBuyBoxData,
			previousData: {
				...sampleBuyBoxData,
				Summary: {
					...sampleBuyBoxData.Summary,
					BuyBoxPrices: [
						{
							...sampleBuyBoxData.Summary.BuyBoxPrices[0],
							ListingPrice: { Amount: 26.99, CurrencyCode: 'GBP' }
						}
					]
				}
			},
			recommendations: [
				'Price reduced by £2.00 (7.4%) - monitor impact on margins',
				'Watch for competitor responses to price change'
			]
		},
		{
			id: 'alert-003',
			asin: 'B0CLNZR3VV',
			productName: 'Premium Kitchen Organizer Set',
			sku: 'KIT-ORG-001',
			timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
			alertType: 'NEW_COMPETITOR',
			severity: 'MEDIUM',
			data: sampleBuyBoxData,
			recommendations: [
				'New seller A1RKKUPIHCS9HS entered market with FBA fulfillment',
				'Monitor their pricing strategy and customer response'
			]
		}
	];

	// Event handlers
	function handleAlertDismiss(event: CustomEvent<{ alertId: string }>) {
		console.log('Dismissing alert:', event.detail.alertId);
		// Here you would typically make an API call to dismiss the alert
	}

	function handleAlertView(event: CustomEvent<{ alert: BuyBoxAlertType }>) {
		console.log('Viewing alert details:', event.detail.alert);
		// Here you would typically navigate to a detailed view or open a modal
	}

	function handleAlertAnalyze(event: CustomEvent<{ alert: BuyBoxAlertType }>) {
		console.log('Analyzing alert:', event.detail.alert);
		// Here you would typically open the competitor analysis view
	}

	function handleCompetitorSelect(event: CustomEvent<{ competitor: any }>) {
		console.log('Selected competitor:', event.detail.competitor);
		// Here you would typically open detailed competitor analysis
	}

	function handleCompetitorDetails(event: CustomEvent<{ competitor: any }>) {
		console.log('Viewing competitor details:', event.detail.competitor);
		// Here you would typically show competitor detail modal
	}
</script>

<svelte:head>
	<title>Buy Box Components Demo</title>
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-7xl">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-2">Buy Box Alert Components Demo</h1>
		<p class="text-gray-600">
			Interactive demonstration of the BuyBoxAlert and CompetitorAnalysisTable components with
			sample Amazon data.
		</p>
	</div>

	<!-- Alert Components Section -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold text-gray-900 mb-6">Buy Box Alerts</h2>
		<div class="space-y-4">
			{#each sampleAlerts as alert}
				<BuyBoxAlert
					{alert}
					on:dismiss={handleAlertDismiss}
					on:view={handleAlertView}
					on:analyze={handleAlertAnalyze}
				/>
			{/each}
		</div>
	</section>

	<!-- Competitor Analysis Section -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold text-gray-900 mb-6">Competitor Analysis</h2>
		<CompetitorAnalysisTable
			buyBoxData={sampleBuyBoxData}
			on:selectCompetitor={handleCompetitorSelect}
			on:viewDetails={handleCompetitorDetails}
		/>
	</section>

	<!-- Component Information -->
	<section class="bg-gray-50 rounded-lg p-6">
		<h2 class="text-xl font-semibold text-gray-900 mb-4">Component Features</h2>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<div>
				<h3 class="font-medium text-gray-900 mb-2">BuyBoxAlert Component</h3>
				<ul class="text-sm text-gray-600 space-y-1">
					<li>• Severity-based color coding (Critical, High, Medium, Low)</li>
					<li>• Price change tracking with percentage calculations</li>
					<li>• Buy box status indicators and winner information</li>
					<li>• Actionable recommendations</li>
					<li>• Interactive dismiss, view, and analyze buttons</li>
					<li>• Responsive design with mobile optimization</li>
				</ul>
			</div>
			<div>
				<h3 class="font-medium text-gray-900 mb-2">CompetitorAnalysisTable Component</h3>
				<ul class="text-sm text-gray-600 space-y-1">
					<li>• Sortable columns (price, rating, fulfillment)</li>
					<li>• Threat level assessment (High, Medium, Low)</li>
					<li>• Competitive advantage identification</li>
					<li>• Buy box winner highlighting</li>
					<li>• Prime and FBA status indicators</li>
					<li>• Interactive competitor selection and analysis</li>
				</ul>
			</div>
		</div>

		<div class="mt-6 p-4 bg-blue-50 rounded-lg">
			<h4 class="font-medium text-blue-900 mb-2">Integration Instructions</h4>
			<p class="text-sm text-blue-800">
				These components can be easily integrated into your existing buy-box monitoring pages.
				Import them from <code class="bg-blue-100 px-1 rounded">$lib/components/</code> and use the
				TypeScript interfaces from
				<code class="bg-blue-100 px-1 rounded">$lib/types/buyBoxTypes</code>
				for type safety.
			</p>
		</div>
	</section>
</div>
