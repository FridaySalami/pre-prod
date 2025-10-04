<script lang="ts">
	// Svelte 5 with runes - Real-time Amazon Buy Box Alerts from Database
	import { onMount } from 'svelte';
	import { slide, fade, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import type { PageData } from './$types';

	// Get server-loaded data from database
	let { data }: { data: PageData } = $props();

	// Types for Amazon SP-API notifications (comprehensive structure)
	interface AnyOfferChangedNotification {
		SellerId: string;
		MarketplaceId: string;
		ASIN: string;
		ItemCondition: string;
		TimeOfOfferChange: string;
		OfferChangeTrigger: {
			MarketplaceId: string;
			ASIN: string;
			ItemCondition: string;
			TimeOfOfferChange: string;
			OfferChangeType?: string;
		};
		Summary: {
			NumberOfOffers: Array<{
				Condition: string;
				FulfillmentChannel: string;
				OfferCount: number;
			}>;
			LowestPrices?: Array<{
				Condition: string;
				FulfillmentChannel: string;
				LandedPrice: {
					CurrencyCode: string;
					Amount: number;
				};
				ListingPrice: {
					CurrencyCode: string;
					Amount: number;
				};
				Shipping: {
					CurrencyCode: string;
					Amount: number;
				};
			}>;
			BuyBoxPrices?: Array<{
				Condition: string;
				FulfillmentChannel: string;
				LandedPrice: {
					CurrencyCode: string;
					Amount: number;
				};
				ListingPrice: {
					CurrencyCode: string;
					Amount: number;
				};
				Shipping: {
					CurrencyCode: string;
					Amount: number;
				};
			}>;
			ListPrice?: {
				CurrencyCode: string;
				Amount: number;
			};
			SalesRankings?: Array<{
				ProductCategoryId: string;
				Rank: number;
			}>;
			NumberOfBuyBoxEligibleOffers?: Array<{
				Condition: string;
				FulfillmentChannel: string;
				OfferCount: number;
			}>;
			CompetitivePriceThreshold?: {
				CurrencyCode: string;
				Amount: number;
			};
		};
		Offers?: Array<{
			SellerId: string;
			SubCondition: string;
			SellerFeedbackRating?: {
				SellerPositiveFeedbackRating?: number;
				FeedbackCount?: number;
			};
			ShippingTime: {
				MinimumHours?: number;
				MaximumHours?: number;
				AvailabilityType?: string;
				AvailableDate?: string;
			};
			ListingPrice: {
				CurrencyCode: string;
				Amount: number;
			};
			Shipping: {
				CurrencyCode: string;
				Amount: number;
			};
			ShipsFrom?: {
				Country?: string;
			};
			IsFulfilledByAmazon: boolean;
			IsBuyBoxWinner?: boolean;
			IsFeaturedMerchant?: boolean;
			PrimeInformation?: {
				IsOfferPrime?: boolean;
				IsOfferNationalPrime?: boolean;
			};
			ShipsDomestically?: boolean;
		}>;
	}

	interface SpApiNotification {
		notificationType: string;
		payloadVersion: string;
		eventTime: string;
		payload: {
			anyOfferChangedNotification?: AnyOfferChangedNotification;
			AnyOfferChangedNotification?: any; // Real Amazon format with PascalCase
		};
		messageId: string;
		receiptHandle: string;
		receivedAt?: string;
	}

	interface AlertLevel {
		level: string;
		color: string;
		bgColor: string;
		icon: string;
	}

	// Reactive state using Svelte 5 runes
	// Initialize with server-loaded data from database
	let alerts = $state(data.alerts || []);
	let notifications = $state<SpApiNotification[]>(data.alerts || []);
	let isPolling = $state(false);
	let lastPollTime = $state<Date | null>(data.lastUpdated ? new Date(data.lastUpdated) : null);
	let errorMessage = $state<string | null>(null);
	let connectionStatus = $state<'connected' | 'disconnected' | 'polling'>('connected');

	// Initialize stats from server data
	const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

	let stats = $state({
		totalNotifications: data.alerts?.length || 0,
		uniqueAsins: new Set(data.alerts?.map((a: any) => a.asin) || []),
		lastHour: data.alerts?.filter((a: any) => new Date(a.lastUpdated) > oneHourAgo).length || 0
	});

	// Product information cache
	let productCache = $state<Map<string, any>>(new Map());

	// Reactive product names cache (populated as buybox data is fetched)
	let productNames = $state<Map<string, string>>(new Map());

	// Historical tracking for trend analysis and stability detection
	interface HistoricalData {
		asin: string;
		timestamp: Date;
		offerCount: number;
		yourPosition: number;
		hasBuyBox: boolean;
		yourPrice: number;
		marketLow: number;
		competitorCount: number;
	}

	interface StabilityState {
		asin: string;
		buyBoxStreak: number; // Hours holding buy box
		topThreeStreak: number; // Hours in top 3
		lastStableCheck: Date;
		isStable: boolean;
	}

	// Tracking state
	let historicalData = $state<Map<string, HistoricalData[]>>(new Map());
	let stabilityStates = $state<Map<string, StabilityState>>(new Map());
	let trendAlerts = $state<Map<string, { type: string; message: string; timestamp: Date }>>(
		new Map()
	);

	// UI State for collapsed/expanded cards
	let expandedCards = $state<Set<string>>(new Set());
	let animatingCards = $state<Set<string>>(new Set());

	// Tab state for filtering
	let activeTab = $state<string>('all');

	// Sorting state
	let sortBy = $state<string>('severity');
	let showAllOffers = $state<boolean>(false);

	// Manual refresh mode
	let isManualMode = $state<boolean>(false);
	let pendingMessagesCount = $state<number>(0);
	let lastManualRefresh = $state<Date | null>(null);

	// Our seller ID for identification
	const OUR_SELLER_ID = 'A2D8NG39VURSL3';

	// Polling configuration
	const POLL_INTERVAL = 10000; // 10 seconds
	let pollInterval: NodeJS.Timeout | null = null;

	// Marketplace mapping
	const MARKETPLACES: Record<string, { name: string; currency: string }> = {
		A1F83G8C2ARO7P: { name: 'Amazon UK', currency: 'GBP' },
		ATVPDKIKX0DER: { name: 'Amazon US', currency: 'USD' },
		A1PA6795UKMFR9: { name: 'Amazon DE', currency: 'EUR' },
		A1RKKUPIHCS9HS: { name: 'Amazon ES', currency: 'EUR' },
		A13V1IB3VIYZZH: { name: 'Amazon FR', currency: 'EUR' },
		APJ6JRA9NG5V4: { name: 'Amazon IT', currency: 'EUR' }
	};

	// Category ID mapping (common ones)
	const CATEGORY_NAMES: Record<string, string> = {
		grocery_display_on_website: 'Grocery',
		'14096872031': 'Food & Beverages',
		'11052681': 'Health & Personal Care',
		'11052683': 'Beauty',
		'276009011': 'Baby Products'
	};

	// Calculate latency between event and receipt
	function calculateLatency(eventTime: string, receivedAt?: string): number {
		if (!receivedAt) return 0;
		const event = new Date(eventTime);
		const received = new Date(receivedAt);
		return Math.round((received.getTime() - event.getTime()) / 1000);
	}

	// Calculate landed price (listing + shipping)
	function calculateLandedPrice(listingPrice: number, shippingPrice: number = 0): number {
		return listingPrice + shippingPrice;
	}

	// Get marketplace info
	function getMarketplaceInfo(marketplaceId: string) {
		// Handle undefined or null marketplace IDs
		if (!marketplaceId) {
			console.warn('No marketplace ID provided, defaulting to UK');
			return { name: 'Amazon UK', currency: 'GBP' };
		}

		// Check if we have a direct mapping
		if (MARKETPLACES[marketplaceId]) {
			return MARKETPLACES[marketplaceId];
		}

		// Log unknown marketplace IDs for debugging
		console.warn('Unknown marketplace ID:', marketplaceId);

		// For UK-based systems, default to GBP instead of USD
		// This is more appropriate for UK businesses
		return { name: `Unknown Marketplace (${marketplaceId})`, currency: 'GBP' };
	}

	// Get category name from ID
	function getCategoryName(categoryId: string): string {
		return CATEGORY_NAMES[categoryId] || categoryId;
	}

	// Seller alias mapping for human-readable names
	const SELLER_ALIASES: Record<string, string> = {
		A31CZFODBOPWBZ: 'Competitor A',
		AS9F7LS8HNWMC: 'Prime Seller B',
		AMT37MGFL5AJI: 'Big FBA Seller',
		A2NY2SCZIPVB9V: 'High Price Co',
		A24VQX7LPBJ2BC: 'Slow Shipper'
	};

	// Get seller display name
	function getSellerDisplayName(sellerId: string): string {
		if (sellerId === OUR_SELLER_ID) return 'YOU';
		return SELLER_ALIASES[sellerId] || `${sellerId.substring(0, 8)}...`;
	}

	// Get ship time display with color coding
	function getShipTimeDisplay(offer: any) {
		const minHours = offer.ShippingTime?.MinimumHours;
		const maxHours = offer.ShippingTime?.MaximumHours;
		const availabilityType = offer.ShippingTime?.AvailabilityType;
		const availableDate = offer.ShippingTime?.AvailableDate;

		if (availabilityType === 'FUTURE_WITH_DATE' && availableDate) {
			return {
				text: `In stock ${new Date(availableDate).toLocaleDateString()}`,
				color: 'gray',
				icon: '📅'
			};
		}

		if (minHours !== undefined && maxHours !== undefined) {
			const minDays = Math.floor(minHours / 24);
			const maxDays = Math.floor(maxHours / 24);

			if (minDays === maxDays && minDays === 0) {
				return { text: 'Same day', color: 'green', icon: '⚡' };
			} else if (maxDays <= 1) {
				return { text: '1 day', color: 'green', icon: '🚀' };
			} else if (maxDays <= 2) {
				return { text: `${minDays}-${maxDays} days`, color: 'amber', icon: '🕐' };
			} else {
				return { text: `${minDays}-${maxDays} days`, color: 'amber', icon: '🕐' };
			}
		}

		return { text: 'Unknown', color: 'gray', icon: '❓' };
	}

	// Calculate competitive targets for decision-making
	function calculateCompetitiveTargets(offers: any[], yourOffer: any) {
		if (!offers || offers.length === 0) return null;

		const landedPrices = offers.map((offer) =>
			calculateLandedPrice(offer.ListingPrice.Amount, offer.Shipping?.Amount || 0)
		);
		const marketLow = Math.min(...landedPrices);

		// Find lowest Prime offer
		const primeOffers = offers.filter(
			(offer) => offer.PrimeInformation?.IsOfferPrime || offer.IsFulfilledByAmazon
		);
		const lowestPrime =
			primeOffers.length > 0
				? Math.min(
						...primeOffers.map((offer) =>
							calculateLandedPrice(offer.ListingPrice.Amount, offer.Shipping?.Amount || 0)
						)
					)
				: null;

		// Find second lowest for competitive buffer
		const sortedPrices = [...landedPrices].sort((a, b) => a - b);
		const secondLowest = sortedPrices.length > 1 ? sortedPrices[1] : marketLow;

		// Competitive floor (example: 20% below market low)
		const competitiveFloor = marketLow * 0.8;

		return {
			marketLow,
			lowestPrime,
			secondLowest,
			competitiveFloor,
			toBeatMarket: marketLow - 0.01,
			toBeatPrime: lowestPrime ? lowestPrime - 0.01 : null,
			safeCompetitive: secondLowest - 0.01
		};
	}

	// Enhanced competitive severity with multi-factor logic
	function getCompetitiveSeverity(
		yourOffer: any,
		targets: any,
		yourPosition: number,
		totalOffers: number,
		salesRankings?: Array<{ ProductCategoryId: string; Rank: number }>,
		notification?: any
	) {
		if (!yourOffer || !targets) return 'normal';

		const yourLanded = calculateLandedPrice(
			yourOffer.ListingPrice.Amount,
			yourOffer.Shipping?.Amount || 0
		);
		const gap = yourLanded - targets.marketLow;
		const gapPercentage = (gap / targets.marketLow) * 100;

		// Get sales rank priority (lower rank = higher priority)
		const bestRank = getBestSalesRank(salesRankings);
		const isLowPriorityProduct = bestRank && bestRank.rank > 200000;

		// Calculate position percentile for dynamic thresholds
		const positionPercentile = totalOffers > 0 ? yourPosition / totalOffers : 0;
		const isTopThree = yourPosition <= 3;
		const isTopTwentyPercent = positionPercentile <= 0.2;

		// Get margin analysis
		const currentMargin = targets.targetMargin || 0;
		const isUnsustainableMargin = currentMargin < 10; // Less than 10% margin

		// CRITICAL 🔥: Multi-factor logic - must meet multiple criteria
		// Only fire CRITICAL if it's a high-priority product AND multiple issues
		if (!isLowPriorityProduct) {
			// Critical: 50%+ gap AND Buy Box lost AND in bottom 20%
			if (gapPercentage > 50 && !yourOffer.IsBuyBoxWinner && !isTopTwentyPercent) {
				return 'critical';
			}

			// Critical: Massive pricing gap (75%+) regardless of buy box status for high-priority items
			if (gapPercentage > 75) {
				return 'critical';
			}
		}

		// HIGH ⚡: Buy Box winner but unsustainable margin
		if (yourOffer.IsBuyBoxWinner && isUnsustainableMargin) {
			return 'high';
		}

		// HIGH: Significant pricing disadvantage (20%+ gap) AND lost buy box
		if (gapPercentage > 20 && !yourOffer.IsBuyBoxWinner) {
			return 'high';
		}

		// HIGH: Lost Buy Box but still in top 20% position (room for quick recovery)
		if (!yourOffer.IsBuyBoxWinner && isTopTwentyPercent && totalOffers > 5) {
			return 'high';
		}

		// WARNING ⚠️: Minor competitive concerns or trending issues
		if (gapPercentage > 5 || (!isTopThree && totalOffers > 3)) {
			return 'warning';
		}

		// SUCCESS ✅: Strong position (within 5% of market low)
		return 'good';
	}

	// Track historical data for trend analysis
	function updateHistoricalData(
		asin: string,
		offerCount: number,
		yourPosition: number,
		hasBuyBox: boolean,
		yourPrice: number,
		marketLow: number
	) {
		const now = new Date();
		const dataPoint: HistoricalData = {
			asin,
			timestamp: now,
			offerCount,
			yourPosition,
			hasBuyBox,
			yourPrice,
			marketLow,
			competitorCount: offerCount - 1
		};

		// Get existing data or create new array
		const existing = historicalData.get(asin) || [];

		// Keep only last 24 hours of data
		const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		const filtered = existing.filter((d) => d.timestamp > dayAgo);

		// Add new data point
		filtered.push(dataPoint);
		historicalData.set(asin, filtered);

		// Update stability tracking
		updateStabilityState(asin, hasBuyBox, yourPosition, now);

		// Check for trend alerts
		checkTrendAlerts(asin, filtered);
	}

	// Update stability state for "locked-in" detection
	function updateStabilityState(
		asin: string,
		hasBuyBox: boolean,
		position: number,
		timestamp: Date
	) {
		const existing = stabilityStates.get(asin) || {
			asin,
			buyBoxStreak: 0,
			topThreeStreak: 0,
			lastStableCheck: timestamp,
			isStable: false
		};

		const hoursSinceLastCheck =
			(timestamp.getTime() - existing.lastStableCheck.getTime()) / (1000 * 60 * 60);

		// Update buy box streak
		if (hasBuyBox) {
			existing.buyBoxStreak += hoursSinceLastCheck;
		} else {
			existing.buyBoxStreak = 0;
		}

		// Update top 3 streak
		if (position <= 3) {
			existing.topThreeStreak += hoursSinceLastCheck;
		} else {
			existing.topThreeStreak = 0;
		}

		// Check if stable (Buy Box + top 3 for 24+ hours)
		existing.isStable = existing.buyBoxStreak >= 24 && existing.topThreeStreak >= 24;
		existing.lastStableCheck = timestamp;

		stabilityStates.set(asin, existing);
	}

	// Check for trend alerts (competitor increases, price movements)
	function checkTrendAlerts(asin: string, history: HistoricalData[]) {
		if (history.length < 2) return;

		const recent = history.slice(-6); // Last 6 data points (1 hour if polling every 10min)
		if (recent.length < 2) return;

		const oldest = recent[0];
		const newest = recent[recent.length - 1];

		// Alert: Competitor surge (offers jumped significantly)
		if (newest.competitorCount >= oldest.competitorCount + 3) {
			trendAlerts.set(asin, {
				type: 'competitor_surge',
				message: `⚠️ Competitors increased from ${oldest.competitorCount} to ${newest.competitorCount} in the last hour`,
				timestamp: newest.timestamp
			});
		}

		// Alert: Rapid position decline
		if (newest.yourPosition >= oldest.yourPosition + 5) {
			trendAlerts.set(asin, {
				type: 'position_decline',
				message: `📉 Position dropped from #${oldest.yourPosition} to #${newest.yourPosition}`,
				timestamp: newest.timestamp
			});
		}

		// Alert: Price war detection (market low dropping rapidly)
		const priceDropPercent = ((oldest.marketLow - newest.marketLow) / oldest.marketLow) * 100;
		if (priceDropPercent > 10) {
			trendAlerts.set(asin, {
				type: 'price_war',
				message: `💥 Market price dropped ${priceDropPercent.toFixed(1)}% in the last hour`,
				timestamp: newest.timestamp
			});
		}
	}

	// Enhanced severity that includes trend data
	function getEnhancedSeverity(
		yourOffer: any,
		targets: any,
		yourPosition: number,
		totalOffers: number,
		salesRankings?: Array<{ ProductCategoryId: string; Rank: number }>,
		asin?: string
	) {
		// Get base severity
		let severity = getCompetitiveSeverity(
			yourOffer,
			targets,
			yourPosition,
			totalOffers,
			salesRankings
		);

		// Check if stable (can downgrade severity)
		if (asin) {
			const stability = stabilityStates.get(asin);
			if (stability?.isStable && severity === 'good') {
				return 'stable'; // New "locked-in" state
			}

			// Check for trend alerts (can upgrade severity)
			const alert = trendAlerts.get(asin);
			if (alert && severity === 'warning') {
				const timeSinceAlert = new Date().getTime() - alert.timestamp.getTime();
				if (timeSinceAlert < 60 * 60 * 1000) {
					// Within last hour
					return 'high'; // Upgrade warning to high due to trend
				}
			}
		}

		return severity;
	}

	// Enhanced fulfillment categorization
	function getFulfillmentCategory(offer: any): string {
		if (!offer) return 'unknown';

		if (offer.IsFulfilledByAmazon) {
			// Check for Prime indicators
			const hasFlexibleShipping =
				offer.ShippingTime?.MaximumHours && offer.ShippingTime.MaximumHours <= 48;
			return hasFlexibleShipping ? 'FBA_Prime' : 'FBA_Standard';
		} else {
			// Merchant fulfilled - check shipping speed
			const shippingHours = offer.ShippingTime?.MaximumHours || 999;
			if (shippingHours <= 48) {
				return 'SFP'; // Seller Fulfilled Prime
			} else if (shippingHours <= 120) {
				// 5 days
				return 'FBM_Fast';
			} else {
				return 'FBM_Slow';
			}
		}
	}

	// Price leadership analysis
	function analyzePriceLeadership(asin: string, yourPrice: number, marketPrices: number[]): string {
		const history = historicalData.get(asin) || [];
		if (history.length < 3) return 'insufficient_data';

		const recent = history.slice(-3);
		const yourPriceHistory = recent.map((h) => h.yourPrice);
		const marketLowHistory = recent.map((h) => h.marketLow);

		// Check if you're consistently the price anchor (lowest or near-lowest)
		const isAnchor = yourPriceHistory.every((price) =>
			marketLowHistory.every((marketLow) => Math.abs(price - marketLow) < marketLow * 0.05)
		);

		if (isAnchor) {
			return 'price_anchor';
		}

		// Check if competitors are aggressively undercutting
		const priceDrops = marketLowHistory
			.map((current, index) => {
				if (index === 0) return 0;
				return ((marketLowHistory[index - 1] - current) / marketLowHistory[index - 1]) * 100;
			})
			.filter((drop) => drop > 0);

		const avgDrop =
			priceDrops.length > 0 ? priceDrops.reduce((a, b) => a + b, 0) / priceDrops.length : 0;

		if (avgDrop > 5) {
			return 'aggressive_undercut';
		}

		// Check if you're shadowing competitor moves
		const yourChanges = yourPriceHistory.map((current, index) => {
			if (index === 0) return 0;
			return Math.abs(current - yourPriceHistory[index - 1]);
		});

		const marketChanges = marketLowHistory.map((current, index) => {
			if (index === 0) return 0;
			return Math.abs(current - marketLowHistory[index - 1]);
		});

		const isShadowing = yourChanges.every(
			(change, index) => index === 0 || Math.abs(change - marketChanges[index]) < change * 0.1
		);

		if (isShadowing) {
			return 'price_follower';
		}

		return 'price_leader';
	}

	// Enhanced alert level with new categories
	function getEnhancedAlertLevel(notification: SpApiNotification): AlertLevel {
		const offerData = getOfferData(notification);
		const offerCount =
			offerData?.Summary?.NumberOfOffers?.[0]?.OfferCount ||
			offerData?.summary?.numberOfOffers?.[0]?.offerCount ||
			0;

		// Get enhanced severity
		const asin = offerData?.ASIN || offerData?.asin;
		const offers = offerData?.Offers || offerData?.offers || [];
		const yourOffer = offers.find((offer: any) => offer.SellerId === OUR_SELLER_ID);
		const targets = calculateCompetitiveTargets(offers, yourOffer);
		const yourPosition = offers.findIndex((offer: any) => offer.SellerId === OUR_SELLER_ID) + 1;
		const salesRankings = offerData?.Summary?.SalesRankings || offerData?.summary?.salesRankings;

		// Update historical tracking
		if (asin && yourOffer && targets) {
			updateHistoricalData(
				asin,
				offerCount,
				yourPosition,
				yourOffer.IsBuyBoxWinner || false,
				yourOffer.ListingPrice?.Amount || 0,
				targets.marketLow || 0
			);
		}

		const severity = getEnhancedSeverity(
			yourOffer,
			targets,
			yourPosition,
			offerCount,
			salesRankings,
			asin
		);

		// Map severity to alert levels
		switch (severity) {
			case 'critical':
				return {
					level: 'critical',
					color: 'text-red-600',
					bgColor: 'bg-red-50 border-red-200',
					icon: '🔥'
				};
			case 'high':
				return {
					level: 'high',
					color: 'text-orange-600',
					bgColor: 'bg-orange-50 border-orange-200',
					icon: '⚡'
				};
			case 'warning':
				return {
					level: 'warning',
					color: 'text-yellow-600',
					bgColor: 'bg-yellow-50 border-yellow-200',
					icon: '⚠️'
				};
			case 'stable':
				return {
					level: 'stable',
					color: 'text-blue-600',
					bgColor: 'bg-blue-50 border-blue-200',
					icon: '🔒'
				};
			default: // 'good'
				return {
					level: 'success',
					color: 'text-green-600',
					bgColor: 'bg-green-50 border-green-200',
					icon: '✅'
				};
		}
	}

	// Get best sales rank
	function getBestSalesRank(salesRankings?: Array<{ ProductCategoryId: string; Rank: number }>) {
		if (!salesRankings || salesRankings.length === 0) return null;
		const sorted = [...salesRankings].sort((a, b) => a.Rank - b.Rank);
		return {
			rank: sorted[0].Rank,
			category: getCategoryName(sorted[0].ProductCategoryId),
			categoryId: sorted[0].ProductCategoryId
		};
	}

	// Fetch product information from buybox_data table by ASIN
	async function fetchBuyBoxData(asin: string) {
		if (productCache.has(`buybox_${asin}`)) {
			return productCache.get(`buybox_${asin}`);
		}

		try {
			const response = await fetch('/api/buybox-lookup', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ asin }),
				credentials: 'include'
			});

			if (response.ok) {
				const result = await response.json();
				productCache.set(`buybox_${asin}`, result);

				// Also populate the productNames cache for use in collapsed view
				if (result.success && result.data?.item_name) {
					productNames.set(asin, result.data.item_name);
					// Trigger reactivity by reassigning the Map
					productNames = new Map(productNames);
				}

				return result;
			} else {
				console.error('BuyBox lookup failed:', response.status, await response.text());
				return { success: false, error: `HTTP ${response.status}` };
			}
		} catch (error: any) {
			console.error('Error fetching buybox data:', error);
			return { success: false, error: error.message };
		}
	}

	// Prefetch product names for all visible ASINs (for collapsed view display)
	async function prefetchProductNames() {
		const allAsins = new Set<string>();

		// Collect all unique ASINs from current notifications
		notifications.forEach((notification: SpApiNotification) => {
			const offerData = getOfferData(notification);
			const asin = extractAsin(offerData);
			if (asin && asin !== 'Unknown') {
				allAsins.add(asin);
			}
		});

		// Fetch product names for ASINs that aren't already cached
		const promises = Array.from(allAsins)
			.filter((asin) => !productNames.has(asin))
			.map(async (asin) => {
				try {
					const result = await fetchBuyBoxData(asin);
					// fetchBuyBoxData already populates productNames cache
				} catch (error) {
					console.log(`Failed to prefetch product name for ${asin}:`, error);
				}
			});

		await Promise.allSettled(promises);
	}

	// Fetch product information from Supabase by ASIN
	async function fetchProductInfo(asin: string) {
		if (productCache.has(asin)) {
			return productCache.get(asin);
		}

		try {
			const response = await fetch('/api/product-lookup', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ asin }),
				credentials: 'include' // Include session cookies
			});

			if (response.ok) {
				const result = await response.json();
				productCache.set(asin, result);
				return result;
			} else {
				console.error('Product lookup failed:', response.status, await response.text());
				return { success: false, error: `HTTP ${response.status}` };
			}
		} catch (error: any) {
			console.error('Error fetching product info:', error);
			return { success: false, error: error.message };
		}
	}

	// Extract offer data from notification (handle both test and real formats)
	function getOfferData(notification: SpApiNotification) {
		const payload = notification.payload;
		// Real Amazon notifications use "AnyOfferChangedNotification" (capital A)
		// Test notifications use "anyOfferChangedNotification" (lowercase a)
		return payload.AnyOfferChangedNotification || payload.anyOfferChangedNotification;
	}

	// Helper function to extract ASIN from offer data consistently
	function extractAsin(offerData: any): string {
		return (
			offerData?.OfferChangeTrigger?.ASIN ||
			offerData?.offerChangeTrigger?.ASIN ||
			offerData?.OfferChangeTrigger?.asin ||
			offerData?.offerChangeTrigger?.asin ||
			offerData?.ASIN ||
			offerData?.asin ||
			'Unknown'
		);
	}

	// Get alert level based on offer count and competitive position (legacy compatibility)
	function getAlertLevel(notification: SpApiNotification): AlertLevel {
		return getEnhancedAlertLevel(notification);
	}

	// Format price for display
	function formatPrice(amount: number, currency: string = 'GBP'): string {
		return new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency: currency
		}).format(amount);
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

	// Severity-based sorting and grouping
	function getSeverityPriority(severity: string): number {
		switch (severity) {
			case 'critical':
				return 4;
			case 'high':
				return 3;
			case 'warning':
				return 2;
			case 'stable':
				return 1;
			case 'success':
			default:
				return 0;
		}
	}

	function sortNotificationsBySeverity(notifications: SpApiNotification[]): SpApiNotification[] {
		return [...notifications].sort((a, b) => {
			const alertA = getEnhancedAlertLevel(a);
			const alertB = getEnhancedAlertLevel(b);

			const priorityA = getSeverityPriority(alertA.level);
			const priorityB = getSeverityPriority(alertB.level);

			// First sort by severity (highest priority first)
			if (priorityA !== priorityB) {
				return priorityB - priorityA;
			}

			// Then by time (newest first within same severity)
			const timeA = new Date(a.receivedAt || a.eventTime).getTime();
			const timeB = new Date(b.receivedAt || b.eventTime).getTime();
			return timeB - timeA;
		});
	}

	// Card state management
	function toggleCard(messageId: string) {
		if (expandedCards.has(messageId)) {
			expandedCards.delete(messageId);
		} else {
			expandedCards.add(messageId);
		}
		// Trigger reactivity
		expandedCards = new Set(expandedCards);
	}

	function isCardExpanded(messageId: string): boolean {
		return expandedCards.has(messageId);
	}

	// Get collapsed summary for notification
	function getCollapsedSummary(notification: SpApiNotification): {
		asin: string;
		summary: string;
		priceGap: string;
	} {
		const offerData = getOfferData(notification);
		const asin = extractAsin(offerData);
		const offers = offerData?.Offers || offerData?.offers || [];
		const yourOffer = offers.find((offer: any) => offer.SellerId === OUR_SELLER_ID);
		const targets = yourOffer ? calculateCompetitiveTargets(offers, yourOffer) : null;

		let priceGap = '';
		let summary = '';

		if (yourOffer && targets) {
			const yourLanded = calculateLandedPrice(
				yourOffer.ListingPrice?.Amount || 0,
				yourOffer.Shipping?.Amount || 0
			);
			const gap = yourLanded - targets.marketLow;
			const gapPercentage = (gap / targets.marketLow) * 100;

			priceGap =
				gapPercentage > 0 ? `+${gapPercentage.toFixed(1)}%` : `${gapPercentage.toFixed(1)}%`;

			if (yourOffer.IsBuyBoxWinner) {
				summary = `Buy Box Winner`;
			} else {
				const position = offers.findIndex((offer: any) => offer.SellerId === OUR_SELLER_ID) + 1;
				summary = `Position #${position}`;
			}
		} else {
			summary = `${offers.length} offers`;
		}

		return { asin, summary, priceGap };
	}

	// Group notifications by severity for better visual organization
	function groupNotificationsBySeverity(
		notifications: SpApiNotification[]
	): { severity: string; notifications: SpApiNotification[]; count: number }[] {
		const sorted = sortNotificationsBySeverity(notifications);
		const groups = new Map<string, SpApiNotification[]>();

		for (const notification of sorted) {
			const alertLevel = getEnhancedAlertLevel(notification);
			const severity = alertLevel.level;

			if (!groups.has(severity)) {
				groups.set(severity, []);
			}
			groups.get(severity)!.push(notification);
		}

		// Return in priority order
		const priorityOrder = ['critical', 'high', 'warning', 'stable', 'success'];
		const result = [];

		for (const severity of priorityOrder) {
			if (groups.has(severity)) {
				result.push({
					severity,
					notifications: groups.get(severity)!,
					count: groups.get(severity)!.length
				});
			}
		}

		return result;
	}

	// Get severity display info
	function getSeverityDisplayInfo(severity: string): { name: string; color: string; icon: string } {
		switch (severity) {
			case 'critical':
				return { name: 'Price Gap 50%+', color: 'text-red-600', icon: '🔥' };
			case 'high':
				return { name: 'Price Gap 20%+', color: 'text-orange-600', icon: '⚡' };
			case 'warning':
				return { name: 'Price Gap 5%+', color: 'text-yellow-600', icon: '⚠️' };
			case 'buybox':
				return { name: 'Buy Box Winner', color: 'text-green-600', icon: '👑' };
			case 'stable':
				return { name: 'Stable', color: 'text-blue-600', icon: '🔒' };
			case 'success':
			default:
				return { name: 'Within 5%', color: 'text-green-600', icon: '✅' };
		}
	} // Tab filtering and management
	function getTabCounts(notifications: SpApiNotification[]): Record<string, number> {
		const counts = {
			all: notifications.length,
			critical: 0,
			high: 0,
			warning: 0,
			stable: 0,
			success: 0,
			buybox: 0
		};

		for (const notification of notifications) {
			const alertLevel = getEnhancedAlertLevel(notification);
			counts[alertLevel.level as keyof typeof counts]++;

			// Count buy box winners separately
			const offerData = getOfferData(notification);
			const offers = offerData?.Offers || offerData?.offers || [];
			const yourOffer = offers.find((offer: any) => offer.SellerId === OUR_SELLER_ID);
			if (yourOffer?.IsBuyBoxWinner === true) {
				counts.buybox++;
			}
		}

		return counts;
	}

	function getTabConfig() {
		return [
			{ id: 'all', name: 'All', icon: '📊', description: 'All notifications' },
			{
				id: 'critical',
				name: 'Price Gap 50%+',
				icon: '🔥',
				description: 'Massive price disadvantage or margin crisis'
			},
			{
				id: 'high',
				name: 'Price Gap 20%+',
				icon: '⚡',
				description: 'Lost buy box or unsustainable margin'
			},
			{
				id: 'warning',
				name: 'Price Gap 5%+',
				icon: '⚠️',
				description: 'Price >5% above market or position concern'
			},
			{ id: 'stable', name: 'Stable', icon: '🔒', description: 'Locked-in positions' },
			{ id: 'success', name: 'Within 5%', icon: '✅', description: 'Within 5% of market low' },
			{ id: 'buybox', name: 'Buy Box Winner', icon: '👑', description: 'Currently winning buy box' }
		];
	}

	function filterNotificationsByTab(
		notifications: SpApiNotification[],
		tabId: string
	): SpApiNotification[] {
		if (tabId === 'all') return notifications;

		if (tabId === 'buybox') {
			// Special filter for Buy Box Winner
			return notifications.filter((notification) => {
				const offerData = getOfferData(notification);
				const offers = offerData?.Offers || offerData?.offers || [];
				const yourOffer = offers.find((offer: any) => offer.SellerId === OUR_SELLER_ID);
				return yourOffer?.IsBuyBoxWinner === true;
			});
		}

		return notifications.filter((notification) => {
			const alertLevel = getEnhancedAlertLevel(notification);
			return alertLevel.level === tabId;
		});
	}

	function getFilteredGroups(notifications: SpApiNotification[], tabId: string) {
		const filteredNotifications = filterNotificationsByTab(notifications, tabId);
		return groupNotificationsBySeverity(filteredNotifications);
	}

	// Poll SQS for new notifications
	async function pollNotifications() {
		if (isPolling) return;

		isPolling = true;
		connectionStatus = 'polling';
		errorMessage = null;

		try {
			const response = await fetch('/api/sqs-notifications/poll', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const result = await response.json();

			if (result.success && result.notifications && result.notifications.length > 0) {
				// Add new notifications to the beginning of the array
				const newNotifications = result.notifications.map((notif: any) => ({
					...notif,
					receivedAt: new Date().toISOString(),
					messageId: notif.messageId || `msg-${Date.now()}-${Math.random()}`
				}));

				notifications = [...newNotifications, ...notifications].slice(0, 100); // Limit to 100 notifications

				// Prefetch product names for collapsed view display
				prefetchProductNames();

				// Update stats
				stats.totalNotifications += newNotifications.length;
				newNotifications.forEach((notif: SpApiNotification) => {
					const offerData = getOfferData(notif);
					const asin = extractAsin(offerData);
					if (asin !== 'Unknown') {
						stats.uniqueAsins.add(asin);
					}
				});

				// Count notifications from last hour
				const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
				stats.lastHour = notifications.filter(
					(n) => new Date(n.receivedAt || n.eventTime) > oneHourAgo
				).length;
			}

			connectionStatus = 'connected';
			lastPollTime = new Date();
		} catch (error: any) {
			console.error('Error polling notifications:', error);
			errorMessage = error.message;
			connectionStatus = 'disconnected';
		} finally {
			isPolling = false;
		}
	}

	// Check for new messages without updating the UI (for manual mode)
	async function checkForNewMessages() {
		if (!isManualMode) return;

		try {
			const response = await fetch('/api/notifications');
			if (response.ok) {
				const data = await response.json();
				const newMessages = data.notifications || [];

				// Count messages newer than the last manual refresh
				const lastRefreshTime = lastManualRefresh || new Date(0);
				const newCount = newMessages.filter(
					(msg: SpApiNotification) => new Date(msg.eventTime) > lastRefreshTime
				).length;

				pendingMessagesCount = newCount;
			}
		} catch (error) {
			console.error('Error checking for new messages:', error);
		}
	}

	// Manual refresh function
	async function manualRefresh() {
		await pollNotifications();
		lastManualRefresh = new Date();
		pendingMessagesCount = 0;
	}

	// Toggle between auto and manual mode
	function toggleRefreshMode() {
		isManualMode = !isManualMode;

		if (isManualMode) {
			// Switch to manual mode
			stopPolling();
			lastManualRefresh = new Date();
			pendingMessagesCount = 0;
			// Check for new messages every 30 seconds in manual mode
			pollInterval = setInterval(checkForNewMessages, 30000);
		} else {
			// Switch back to auto mode
			if (pollInterval) {
				clearInterval(pollInterval);
			}
			startPolling();
		}
	}

	// Refresh data from database (replaces SQS polling)
	async function refreshFromDatabase() {
		try {
			connectionStatus = 'polling';

			const response = await fetch('/api/buy-box-alerts/current-state');
			const result = await response.json();

			if (result.alerts) {
				alerts = result.alerts;
				notifications = result.alerts; // Update notifications array for UI display
				
				// Recalculate stats from the fresh alerts data
				const uniqueAsins = new Set(result.alerts.map((a: any) => a.asin));
				const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
				const lastHourCount = result.alerts.filter((a: any) => 
					new Date(a.lastUpdated) > oneHourAgo
				).length;
				
				stats = {
					totalNotifications: result.alerts.length,
					uniqueAsins: uniqueAsins,
					lastHour: lastHourCount
				};
				
				lastPollTime = new Date();
				connectionStatus = 'connected';
				errorMessage = null;
			}
		} catch (error) {
			console.error('Error refreshing from database:', error);
			errorMessage = 'Failed to refresh alerts from database';
			connectionStatus = 'disconnected';
		}
	}

	// Start/stop polling
	function startPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
		}

		// Refresh immediately, then set interval (every 30 seconds for database polling)
		refreshFromDatabase();
		pollInterval = setInterval(refreshFromDatabase, 30000); // 30 seconds
		connectionStatus = 'connected';
	}

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
		connectionStatus = 'disconnected';
	}

	// Clear all notifications
	function clearNotifications() {
		notifications = [];
		stats = {
			totalNotifications: 0,
			uniqueAsins: new Set(),
			lastHour: 0
		};
	}

	// Test notifications (for development)
	async function sendTestNotification() {
		try {
			const response = await fetch('/api/sqs-notifications/test', {
				method: 'POST'
			});
			const result = await response.json();

			if (result.success) {
				console.log('Test notification sent');
			}
		} catch (error) {
			console.error('Error sending test notification:', error);
		}
	}

	// Lifecycle
	onMount(() => {
		// Start auto-refresh from database every 30 seconds
		startPolling();

		return () => {
			stopPolling();
		};
	});
</script>

<div class="min-h-screen bg-gray-50 p-6">
	<div class="max-w-7xl mx-auto">
		<!-- Header -->
		<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-bold text-gray-900 mb-2">🔔 Real-time Buy Box Alerts</h1>
					<p class="text-gray-600">
						Live Amazon SP-API notifications for pricing and buy box changes
					</p>
				</div>
				<div class="flex items-center space-x-4">
					<!-- Connection Status -->
					<div class="flex items-center space-x-2">
						<div class="flex items-center space-x-2">
							{#if connectionStatus === 'connected'}
								<div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
								<span class="text-sm text-green-600 font-medium">Connected</span>
							{:else if connectionStatus === 'polling'}
								<div class="w-3 h-3 bg-yellow-500 rounded-full animate-spin"></div>
								<span class="text-sm text-yellow-600 font-medium">Polling...</span>
							{:else}
								<div class="w-3 h-3 bg-red-500 rounded-full"></div>
								<span class="text-sm text-red-600 font-medium">Disconnected</span>
							{/if}
						</div>
					</div>

					<!-- Controls -->
					<div class="flex space-x-2">
						<!-- Manual/Auto Mode Toggle -->
						<button
							onclick={toggleRefreshMode}
							class="px-4 py-2 {isManualMode
								? 'bg-orange-600 hover:bg-orange-700'
								: 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg transition-colors flex items-center space-x-2"
							title={isManualMode ? 'Switch to Auto Refresh' : 'Switch to Manual Refresh'}
						>
							<span>{isManualMode ? '⏸️' : '🔄'}</span>
							<span>{isManualMode ? 'Manual' : 'Auto'}</span>
						</button>

						{#if isManualMode}
							<!-- Manual Refresh Button -->
							<button
								onclick={manualRefresh}
								class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
								disabled={isPolling}
							>
								<span>🔄</span>
								<span>Refresh</span>
								{#if pendingMessagesCount > 0}
									<span class="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
										{pendingMessagesCount}
									</span>
								{/if}
							</button>
						{:else}
							<!-- Auto Mode Controls -->
							{#if connectionStatus === 'connected'}
								<button
									onclick={stopPolling}
									class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
								>
									Stop
								</button>
							{:else}
								<button
									onclick={startPolling}
									class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
								>
									Start
								</button>
							{/if}
						{/if}

						<button
							onclick={clearNotifications}
							class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
						>
							Clear
						</button>

						<button
							onclick={sendTestNotification}
							class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
						>
							Test
						</button>
					</div>
				</div>
			</div>

			<!-- Stats -->
			<div class="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6">
				<div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
					<div class="text-2xl font-bold text-blue-600">{stats.totalNotifications}</div>
					<div class="text-sm text-blue-700">Total Notifications</div>
				</div>
				<div class="bg-green-50 border border-green-200 rounded-lg p-4">
					<div class="text-2xl font-bold text-green-600">{stats?.uniqueAsins?.size ?? 0}</div>
					<div class="text-sm text-green-700">Unique ASINs</div>
				</div>
				<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
					<div class="text-2xl font-bold text-yellow-600">{stats.lastHour}</div>
					<div class="text-sm text-yellow-700">Last Hour</div>
				</div>
				{#if isManualMode}
					<div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
						<div class="text-2xl font-bold text-orange-600">{pendingMessagesCount}</div>
						<div class="text-sm text-orange-700">Pending Messages</div>
					</div>
				{/if}
				<div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
					<div class="text-sm font-medium text-gray-600">
						{isManualMode ? 'Last Manual Refresh' : 'Last Poll'}
					</div>
					<div class="text-sm text-gray-700">
						{isManualMode && lastManualRefresh
							? formatRelativeTime(lastManualRefresh.toISOString())
							: lastPollTime
								? formatRelativeTime(lastPollTime.toISOString())
								: 'Never'}
					</div>
				</div>
			</div>

			<!-- Error Message -->
			{#if errorMessage}
				<div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
					<div class="flex items-center space-x-2">
						<span class="text-red-600">❌</span>
						<span class="text-red-700 font-medium">Error:</span>
						<span class="text-red-600">{errorMessage}</span>
					</div>
				</div>
			{/if}

			<!-- Manual Mode Notification -->
			{#if isManualMode}
				<div class="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
					<div class="flex items-center justify-between">
						<div class="flex items-center space-x-2">
							<span class="text-orange-600">⏸️</span>
							<span class="text-orange-700 font-medium">Manual Refresh Mode Active</span>
							<span class="text-orange-600"
								>- Page updates are paused to prevent content shifting</span
							>
						</div>
						{#if pendingMessagesCount > 0}
							<button
								onclick={manualRefresh}
								class="px-3 py-1 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors text-sm flex items-center space-x-1"
							>
								<span>🔄</span>
								<span
									>Load {pendingMessagesCount} new message{pendingMessagesCount === 1
										? ''
										: 's'}</span
								>
							</button>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- Notification Tabs -->
		{#if notifications.length > 0}
			{@const tabCounts = getTabCounts(notifications)}
			{@const tabConfig = getTabConfig()}

			<div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
				<!-- Tab Headers -->
				<div class="border-b border-gray-200">
					<nav class="flex space-x-0" aria-label="Notification tabs">
						{#each tabConfig as tab}
							{@const count = tabCounts[tab.id as keyof typeof tabCounts]}
							{@const isActive = activeTab === tab.id}

							{#if count > 0 || tab.id === 'all'}
								<button
									onclick={() => (activeTab = tab.id)}
									class="relative px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-200
										{isActive
										? 'border-blue-500 text-blue-600 bg-blue-50'
										: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
								>
									<div class="flex items-center space-x-2">
										<span>{tab.icon}</span>
										<span>{tab.name}</span>
										{#if count > 0}
											<span
												class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
												{isActive ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}"
											>
												{count}
											</span>
										{/if}
									</div>

									<!-- Active tab indicator -->
									{#if isActive}
										<div class="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 rounded-t"></div>
									{/if}
								</button>
							{/if}
						{/each}
					</nav>
				</div>

				<!-- Tab Description -->
				{#if notifications.length > 0}
					{@const activeTabConfig = tabConfig.find((t) => t.id === activeTab)}
					{#if activeTabConfig}
						<div class="px-4 py-2 bg-gray-50 border-b border-gray-200">
							<div class="flex items-center justify-between">
								<span class="text-sm text-gray-600">{activeTabConfig.description}</span>
								<span class="text-xs text-gray-500"
									>💡 Cards are collapsed by default - click to expand</span
								>
							</div>
						</div>
					{/if}
				{/if}
			</div>
		{/if}

		<!-- Notifications List -->
		<div class="space-y-4">
			{#if notifications.length === 0}
				<!-- Empty state when no notifications -->
				<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
					<div class="text-gray-400 text-6xl mb-4">📭</div>
					<h3 class="text-xl font-medium text-gray-900 mb-2">No notifications yet</h3>
					<p class="text-gray-600 mb-6">Waiting for Amazon SP-API notifications to arrive...</p>
					<div class="flex justify-center space-x-4">
						<button
							onclick={pollNotifications}
							disabled={isPolling}
							class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
						>
							{isPolling ? 'Polling...' : 'Poll Now'}
						</button>
						<button
							onclick={sendTestNotification}
							class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
						>
							Send Test
						</button>
					</div>
				</div>
			{:else}
				<!-- Notifications exist -->
				{@const filteredGroups = getFilteredGroups(notifications, activeTab)}
				{#if filteredGroups.length === 0}
					<!-- Empty state for filtered tab -->
					<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
						{#if activeTab === 'critical'}
							<div class="text-gray-400 text-4xl mb-4">🔥</div>
							<h3 class="text-lg font-medium text-gray-900 mb-2">No critical notifications</h3>
						{:else if activeTab === 'high'}
							<div class="text-gray-400 text-4xl mb-4">⚡</div>
							<h3 class="text-lg font-medium text-gray-900 mb-2">No high priority notifications</h3>
						{:else if activeTab === 'warning'}
							<div class="text-gray-400 text-4xl mb-4">⚠️</div>
							<h3 class="text-lg font-medium text-gray-900 mb-2">No watching notifications</h3>
						{:else if activeTab === 'stable'}
							<div class="text-gray-400 text-4xl mb-4">🔒</div>
							<h3 class="text-lg font-medium text-gray-900 mb-2">No stable notifications</h3>
						{:else if activeTab === 'success'}
							<div class="text-gray-400 text-4xl mb-4">✅</div>
							<h3 class="text-lg font-medium text-gray-900 mb-2">No success notifications</h3>
						{:else}
							<div class="text-gray-400 text-4xl mb-4">📭</div>
							<h3 class="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
						{/if}
						<p class="text-gray-600">
							All notifications in this category have been resolved or no new ones have arrived.
						</p>
					</div>
				{:else}
					<!-- Display filtered notifications grouped by severity -->
					{#each filteredGroups as group (group.severity)}
						{@const displayInfo = getSeverityDisplayInfo(group.severity)}
						<!-- Severity Group Header -->
						<div class="mb-4" in:fade={{ duration: 200 }}>
							<div class="flex items-center space-x-2 mb-3">
								<span class="text-xl">{displayInfo.icon}</span>
								<h3 class="text-lg font-semibold {displayInfo.color}">{displayInfo.name}</h3>
								<span
									class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
								>
									{group.count}
								</span>
							</div>

							<!-- Notifications in this severity group -->
							<div class="space-y-3">
								{#each group.notifications as notification (notification.messageId)}
									{@const alertLevel = getEnhancedAlertLevel(notification)}
									{@const offerData = getOfferData(notification)}
									{@const asin = extractAsin(offerData)}
									{@const isExpanded = isCardExpanded(notification.messageId)}
									{@const summary = getCollapsedSummary(notification)}
									{@const offers = offerData?.Offers || offerData?.offers || []}
									{@const yourOffer = offers.find((offer: any) => offer.SellerId === OUR_SELLER_ID)}
									{@const sortedOffers = [...offers].sort(
										(a: any, b: any) =>
											calculateLandedPrice(a.ListingPrice?.Amount || 0, a.Shipping?.Amount || 0) -
											calculateLandedPrice(b.ListingPrice?.Amount || 0, b.Shipping?.Amount || 0)
									)}
									{@const marketLow = sortedOffers[0]
										? calculateLandedPrice(
												sortedOffers[0].ListingPrice?.Amount || 0,
												sortedOffers[0].Shipping?.Amount || 0
											)
										: 0}
									{@const yourPrice = yourOffer
										? calculateLandedPrice(
												yourOffer.ListingPrice?.Amount || 0,
												yourOffer.Shipping?.Amount || 0
											)
										: 0}
									{@const currency =
										yourOffer?.ListingPrice?.CurrencyCode ||
										sortedOffers[0]?.ListingPrice?.CurrencyCode ||
										'GBP'}
									{@const salesRank = offerData?.Summary?.SalesRankings?.[0]?.Rank || 0}

									<!-- Notification Card -->
									<div
										class="bg-white rounded-lg shadow-sm border-2 {alertLevel.bgColor} transition-all duration-300 hover:shadow-md"
										in:fly={{
											y: -20,
											duration: 400,
											easing: quintOut,
											delay: group.notifications.indexOf(notification) * 50
										}}
									>
										<!-- Collapsed View (Default) -->
										<div
											class="p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
											role="button"
											tabindex="0"
											onclick={() => toggleCard(notification.messageId)}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													toggleCard(notification.messageId);
												}
											}}
										>
											<div class="flex items-center justify-between">
												<div class="flex items-center space-x-3 flex-1">
													<span class="text-lg">{alertLevel.icon}</span>
													<div class="flex-1 min-w-0">
														<!-- Product name and details on first line -->
														<div class="flex items-center justify-between flex-wrap">
															<div class="flex items-center space-x-2 flex-wrap">
																<span class="font-mono text-sm font-medium text-gray-900">
																	{#if productNames.get(summary.asin)}
																		{productNames.get(summary.asin)}
																	{:else}
																		{summary.asin}
																	{/if}
																</span>

																<!-- Product info inline with ASIN -->
																{#if productNames.get(summary.asin)}
																	<span class="text-xs text-gray-500">
																		ASIN: {summary.asin}
																	</span>
																	<!-- Get SKU from cache if available -->
																	{#if productCache.has(`buybox_${summary.asin}`)}
																		{@const buyboxData = productCache.get(`buybox_${summary.asin}`)}
																		{#if buyboxData?.success && buyboxData.data?.sku}
																			<span class="text-xs text-gray-500">
																				SKU: {buyboxData.data.sku}
																			</span>
																		{/if}
																	{/if}
																{/if}
															</div>

															<!-- Individual product market data inline on the right side -->
															<div class="flex items-center gap-4 text-xs text-gray-600">
																<span>Offers: {offers.length}</span>
																{#if yourPrice > 0}
																	<span
																		>Your Price: <span class="text-blue-600 font-medium"
																			>{formatPrice(yourPrice, currency)}</span
																		></span
																	>
																{/if}
																{#if marketLow > 0}
																	<span
																		>Lowest Price: <span class="text-red-600 font-medium"
																			>{formatPrice(marketLow, currency)}</span
																		></span
																	>
																{/if}
																{#if salesRank > 0}
																	<span
																		>Rank: <span class="text-purple-600 font-medium"
																			>#{salesRank.toLocaleString()}</span
																		></span
																	>
																{/if}
															</div>
														</div>

														<!-- Position and price gap on second line -->
														<div class="flex items-center space-x-2 mt-1">
															<span class="text-sm text-gray-600">
																{summary.summary}
															</span>
															{#if summary.priceGap}
																<span
																	class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
																	{summary.priceGap.startsWith('+') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}"
																>
																	{summary.priceGap}
																</span>
															{/if}
														</div>
														<div class="text-xs text-gray-500">
															{formatRelativeTime(notification.eventTime)}
														</div>
													</div>
												</div>
												<div class="flex items-center space-x-2">
													{#if true}
														{@const isBuyBoxWinner = (() => {
															const offerData = getOfferData(notification);
															const offers = offerData?.Offers || offerData?.offers || [];
															const yourOffer = offers.find(
																(offer: any) => offer.SellerId === OUR_SELLER_ID
															);
															return yourOffer?.IsBuyBoxWinner === true;
														})()}

														<span
															class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium {activeTab ===
																'buybox' && isBuyBoxWinner
																? 'text-green-600'
																: alertLevel.color} bg-white border"
														>
															{activeTab === 'buybox' && isBuyBoxWinner
																? 'BUY BOX'
																: alertLevel.level.toUpperCase()}
														</span>
													{/if}
													<button
														class="text-gray-400 hover:text-gray-600 transition-colors"
														aria-label={isExpanded
															? 'Collapse notification'
															: 'Expand notification'}
													>
														<svg
															class="w-5 h-5 transform transition-transform duration-200 {isExpanded
																? 'rotate-180'
																: ''}"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M19 9l-7 7-7-7"
															></path>
														</svg>
													</button>
												</div>
											</div>
										</div>

										<!-- Simplified Notification Content (Always Visible) -->
										<div class="border-t border-gray-200 p-6 space-y-6">
											<!-- Product Details moved to top bar to avoid duplication -->
											<!-- Market Overview moved to top bar to avoid duplication -->

											<!-- Competitive Analysis -->
											{#if offerData?.Offers}
												{@const yourOffer = offerData.Offers.find(
													(offer: any) => offer.SellerId === OUR_SELLER_ID
												)}
												{@const targets = yourOffer
													? calculateCompetitiveTargets(offerData.Offers, yourOffer)
													: null}
												{@const marketLow = Math.min(
													...offerData.Offers.map((o: any) =>
														calculateLandedPrice(o.ListingPrice.Amount, o.Shipping?.Amount || 0)
													)
												)}
												{@const yourPrice = yourOffer
													? calculateLandedPrice(
															yourOffer.ListingPrice.Amount,
															yourOffer.Shipping?.Amount || 0
														)
													: 0}
												{@const priceGap = yourOffer ? yourPrice - marketLow : 0}
												{@const gapPercentage = marketLow > 0 ? (priceGap / marketLow) * 100 : 0}

												<div
													class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200"
												>
													<h3 class="text-lg font-semibold text-green-800 mb-3">
														📊 Competitive Analysis
													</h3>

													{#if yourOffer && targets}
														<div class="space-y-3 mb-4">
															<!-- Line 1: Your Price - Lowest Price -->
															<div class="flex justify-between items-center">
																<div class="flex items-center gap-4">
																	<span class="text-sm font-medium text-gray-700">Your Price:</span>
																	<span class="text-sm font-bold text-blue-600">
																		{formatPrice(yourPrice, yourOffer.ListingPrice.CurrencyCode)}
																	</span>
																</div>
																<div class="flex items-center gap-4">
																	<span class="text-sm font-medium text-gray-700"
																		>Lowest Price:</span
																	>
																	<span class="text-sm font-bold text-green-600">
																		{formatPrice(marketLow, yourOffer.ListingPrice.CurrencyCode)}
																	</span>
																</div>
															</div>

															<!-- Line 2: Lowest Prime - Price Gap -->
															<div class="flex justify-between items-center">
																<div class="flex items-center gap-4">
																	{#if targets.lowestPrime}
																		<span class="text-sm font-medium text-gray-700"
																			>Lowest Prime:</span
																		>
																		<span class="text-sm font-bold text-orange-600">
																			{formatPrice(
																				targets.lowestPrime,
																				yourOffer.ListingPrice.CurrencyCode
																			)}
																		</span>
																	{:else}
																		<span class="text-sm font-medium text-gray-500"
																			>Lowest Prime:</span
																		>
																		<span class="text-sm text-gray-500">N/A</span>
																	{/if}
																</div>
																<div class="flex items-center gap-4">
																	<span class="text-sm font-medium text-gray-700">Price Gap:</span>
																	<span
																		class="text-sm font-bold {gapPercentage > 0
																			? 'text-red-600'
																			: 'text-green-600'}"
																	>
																		{gapPercentage > 0 ? '+' : ''}{gapPercentage.toFixed(1)}% ({formatPrice(
																			Math.abs(priceGap),
																			yourOffer.ListingPrice.CurrencyCode
																		)})
																	</span>
																</div>
															</div>
														</div>
													{:else}
														<div class="p-3 bg-gray-50 border border-gray-200 rounded-lg">
															<span class="text-gray-700"
																>💡 Analysis available when you have an active offer</span
															>
														</div>
													{/if}
												</div>
											{/if}

											<!-- Your Position & Competition -->
											{#if offerData?.Offers}
												{@const yourOffer = offerData.Offers.find(
													(offer: any) => offer.SellerId === OUR_SELLER_ID
												)}
												{@const sortedOffers = [...offerData.Offers].sort(
													(a: any, b: any) =>
														calculateLandedPrice(a.ListingPrice.Amount, a.Shipping?.Amount || 0) -
														calculateLandedPrice(b.ListingPrice.Amount, b.Shipping?.Amount || 0)
												)}
												{@const yourPosition =
													sortedOffers.findIndex((offer: any) => offer.SellerId === OUR_SELLER_ID) +
													1}
												{@const topCompetitors = sortedOffers.slice(0, 5)}

												<div
													class="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200"
												>
													<h3 class="text-lg font-semibold text-blue-800 mb-3">🎯 Your Position</h3>

													{#if yourOffer}
														<div class="mb-4 p-3 bg-white rounded-lg border border-blue-200">
															<div class="flex items-center justify-between mb-2">
																<div class="flex items-center space-x-2">
																	<span class="text-lg font-bold text-blue-600">YOU</span>
																	<span class="px-2 py-1 rounded text-sm bg-blue-100 text-blue-800">
																		Position #{yourPosition}
																	</span>
																	{#if yourOffer.IsBuyBoxWinner}
																		<span
																			class="px-2 py-1 rounded text-sm bg-green-100 text-green-800"
																		>
																			🏆 Buy Box Winner
																		</span>
																	{/if}
																</div>
																<div class="text-right">
																	<div class="text-lg font-bold text-green-600">
																		{formatPrice(
																			calculateLandedPrice(
																				yourOffer.ListingPrice.Amount,
																				yourOffer.Shipping?.Amount || 0
																			),
																			yourOffer.ListingPrice.CurrencyCode
																		)}
																	</div>
																	{#if yourOffer.Shipping?.Amount > 0}
																		<div class="text-xs text-gray-500">
																			+{formatPrice(
																				yourOffer.Shipping.Amount,
																				yourOffer.Shipping.CurrencyCode
																			)} shipping
																		</div>
																	{/if}
																</div>
															</div>
															<div class="flex items-center justify-between text-sm text-gray-600">
																<div class="flex items-center space-x-4">
																	<span
																		>⭐ {yourOffer.SellerFeedbackRating
																			?.SellerPositiveFeedbackRating || 'N/A'}%</span
																	>
																	<span>📦 {getFulfillmentCategory(yourOffer)}</span>
																	{#if yourOffer.PrimeInformation?.IsOfferPrime}
																		<span class="text-orange-600">✓ Prime</span>
																	{/if}
																</div>
																{#if yourOffer.ShippingTime}
																	{@const shipTime = getShipTimeDisplay(yourOffer)}
																	<span class="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
																		{shipTime.text}
																	</span>
																{/if}
															</div>
														</div>
													{:else}
														<div class="p-3 bg-red-50 border border-red-200 rounded-lg">
															<span class="text-red-700"
																>⚠️ You are not currently offering this product</span
															>
														</div>
													{/if}

													<!-- Top Competitors -->
													<div class="space-y-2">
														<h4 class="font-medium text-gray-700 mb-2">🏁 Top 5 Competitors</h4>
														{#each topCompetitors as offer, index}
															{@const landedPrice = calculateLandedPrice(
																offer.ListingPrice.Amount,
																offer.Shipping?.Amount || 0
															)}
															{@const isYou = offer.SellerId === OUR_SELLER_ID}

															<div
																class="flex items-center justify-between p-2 bg-white rounded border {isYou
																	? 'border-blue-200 bg-blue-50'
																	: 'border-gray-200'}"
															>
																<div class="flex items-center space-x-3">
																	<span class="text-sm font-medium text-gray-600 w-6"
																		>#{index + 1}</span
																	>
																	<span
																		class="text-sm font-medium {isYou
																			? 'text-blue-600'
																			: 'text-gray-800'}"
																	>
																		{getSellerDisplayName(offer.SellerId)}
																	</span>
																	{#if offer.IsBuyBoxWinner}
																		<span
																			class="text-xs px-1 py-0.5 bg-green-100 text-green-700 rounded"
																			>Buy Box</span
																		>
																	{/if}
																	{#if offer.PrimeInformation?.IsOfferPrime}
																		<span
																			class="text-xs px-1 py-0.5 bg-orange-100 text-orange-700 rounded"
																			>Prime</span
																		>
																	{/if}
																</div>
																<div class="text-right">
																	<div class="text-sm font-semibold text-gray-800">
																		{formatPrice(landedPrice, offer.ListingPrice.CurrencyCode)}
																	</div>
																	<div class="text-xs text-gray-500">
																		⭐ {offer.SellerFeedbackRating?.SellerPositiveFeedbackRating ||
																			'N/A'}%
																	</div>
																</div>
															</div>
														{/each}
													</div>
												</div>
											{/if}

											<!-- Smart Actions -->
											<div
												class="bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg p-4 border border-gray-200"
											>
												<h3 class="text-lg font-semibold text-gray-800 mb-3">⚡ Smart Actions</h3>

												{#if offerData?.Offers}
													{@const yourOffer = offerData.Offers.find(
														(offer: any) => offer.SellerId === OUR_SELLER_ID
													)}
													{@const targets = yourOffer
														? calculateCompetitiveTargets(offerData.Offers, yourOffer)
														: null}
													{@const alertLevel = getEnhancedAlertLevel(notification)}

													<div class="space-y-4">
														<!-- Management Actions -->
														<div class="space-y-2">
															<h4 class="font-medium text-gray-700 mb-2">� Management</h4>
															{#if asin}
																<div class="grid grid-cols-2 gap-2">
																	<a
																		href="https://sellercentral.amazon.co.uk/myinventory/inventory?fulfilledBy=all&page=1&pageSize=50&searchField=all&searchTerm={asin}&sort=date_created_desc&status=all&ref_=xx_invmgr_favb_xx"
																		target="_blank"
																		class="block w-full px-3 py-2 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 text-center"
																	>
																		Manage Inventory ↗
																	</a>
																	<a
																		href="https://amazon.co.uk/dp/{asin}"
																		target="_blank"
																		class="block w-full px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 text-center"
																	>
																		🔍 View Product Page ↗
																	</a>
																</div>
															{/if}
														</div>
													</div>

													<!-- Notification Management -->
													<div class="mt-4 pt-3 border-t border-gray-200">
														<div class="flex flex-wrap gap-2">
															<button
																type="button"
																class="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
																onclick={() =>
																	console.log('Mark as handled:', notification.messageId)}
															>
																✅ Mark as Handled
															</button>
															<button
																type="button"
																class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
																onclick={() =>
																	console.log('Snooze notification:', notification.messageId)}
															>
																� Snooze 1hr
															</button>
															<button
																type="button"
																class="px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
																onclick={() => console.log('Create task:', notification.messageId)}
															>
																📝 Create Task
															</button>
														</div>
													</div>
												{:else}
													<!-- Fallback actions when no offer data -->
													<div class="flex flex-wrap gap-2">
														{#if asin}
															<a
																href="https://sellercentral.amazon.com/inventory"
																target="_blank"
																class="px-3 py-2 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
															>
																Manage Inventory ↗
															</a>
															<a
																href="https://sellercentral.amazon.com/pricing"
																target="_blank"
																class="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
															>
																Update Pricing ↗
															</a>
														{/if}
														<button
															type="button"
															class="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
															onclick={() =>
																console.log('Mark as handled:', notification.messageId)}
														>
															�🗑️ Mark as Handled
														</button>
													</div>
												{/if}
											</div>

											<!-- Raw Data (Collapsible) -->
											<details class="mt-4">
												<summary class="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
													View Raw Notification Data
												</summary>
												<pre
													class="mt-2 p-4 bg-gray-100 rounded-lg text-xs overflow-x-auto">{JSON.stringify(
														notification,
														null,
														2
													)}</pre>
											</details>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				{/if}
			{/if}
		</div>
	</div>
</div>

<svelte:head>
	<title>Real-time Buy Box Alerts - Amazon SP-API Notifications</title>
</svelte:head>
