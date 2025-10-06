// API endpoint to fetch all historical alerts for a specific ASIN
// Queries worker_notifications table for complete alert history

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool() {
  if (!pool) {
    const dbUrl = env.RENDER_DATABASE_URL;
    if (!dbUrl) {
      throw new Error('RENDER_DATABASE_URL environment variable required');
    }

    pool = new Pool({
      connectionString: dbUrl,
      ssl: {
        rejectUnauthorized: false
      },
      max: 5,
      idleTimeoutMillis: 30000
    });
  }
  return pool;
}

export const GET: RequestHandler = async ({ params, url }) => {
  try {
    const { asin } = params;
    const db = getPool();

    // Get query parameters
    const days = parseInt(url.searchParams.get('days') || '30'); // Default 30 days
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '500'), 1000); // Max 1000

    // Query worker_notifications for historical data for this ASIN
    const historyResult = await db.query(
      `
			SELECT 
				id,
				received_at,
				raw_notification,
				asin
			FROM worker_notifications
			WHERE asin = $1
			ORDER BY received_at ASC
		`,
      [asin]
    );

    // Fetch current state for this ASIN
    const currentStateQuery = await db.query(
      `
			SELECT 
				asin,
				marketplace,
				your_price,
				market_low,
				prime_low,
				your_position,
				total_offers,
				buy_box_winner,
				severity,
				last_notification_data,
				last_updated,
				created_at
			FROM current_state
			WHERE asin = $1
		`,
      [asin]
    );

    // Transform historical data for analysis
    const history = historyResult.rows.map((row) => {
      const notifData = row.raw_notification;
      const offerData = notifData?.Payload?.AnyOfferChangedNotification;

      // Extract price points from offers
      const offers = offerData?.Offers || [];
      const yourOffer = offers.find((o: any) => o.SellerId === 'A2D8NG39VURSL3');

      const allPrices = offers.map((o: any) => ({
        seller: o.SellerId,
        listingPrice: o.ListingPrice?.Amount || 0,
        shippingPrice: o.Shipping?.Amount || 0,
        landedPrice:
          (o.ListingPrice?.Amount || 0) + (o.Shipping?.Amount || 0),
        isFBA: o.IsFulfilledByAmazon || false,
        isBuyBox: o.IsBuyBoxWinner || false,
        shipsFrom: o.ShipsFrom?.Country || 'UK',
        isPrime: o.PrimeInformation?.IsOfferPrime || false,
        shippingMinHours: o.ShippingTime?.MinimumHours,
        shippingMaxHours: o.ShippingTime?.MaximumHours
      }));

      return {
        timestamp: row.received_at,
        processedAt: row.processed_at,
        offerCount: offers.length,
        yourOffer: yourOffer
          ? {
            listingPrice: yourOffer.ListingPrice?.Amount || 0,
            shippingPrice: yourOffer.Shipping?.Amount || 0,
            landedPrice:
              (yourOffer.ListingPrice?.Amount || 0) +
              (yourOffer.Shipping?.Amount || 0),
            position:
              offers.findIndex(
                (o: any) => o.SellerId === 'A2D8NG39VURSL3'
              ) + 1,
            isBuyBoxWinner: yourOffer.IsBuyBoxWinner || false,
            isFBA: yourOffer.IsFulfilledByAmazon || false,
            shippingPrice: yourOffer.Shipping?.Amount || 0,
            shipsFrom: yourOffer.ShipsFrom?.Country || 'UK',
            isPrime: yourOffer.PrimeInformation?.IsOfferPrime || false,
            shippingMinHours: yourOffer.ShippingTime?.MinimumHours,
            shippingMaxHours: yourOffer.ShippingTime?.MaximumHours
          }
          : null,
        marketLow: Math.min(...allPrices.map((p) => p.landedPrice)),
        marketHigh: Math.max(...allPrices.map((p) => p.landedPrice)),
        competitorPrices: allPrices.filter((p) => p.seller !== 'A2D8NG39VURSL3'),
        buyBoxWinner: offers.find((o: any) => o.IsBuyBoxWinner)?.SellerId || null,
        buyBoxWinnerIsPrime: offers.find((o: any) => o.IsBuyBoxWinner)?.PrimeInformation?.IsOfferPrime || false
      };
    });

    // Calculate analytics
    const analytics = calculateAnalytics(history);

    // Extract competitor activity
    const competitors = extractCompetitorActivity(history);

    // Get current buy box winner from most recent notification
    const currentBuyBoxWinner = history[0]?.buyBoxWinner || null;

    return json({
      asin,
      currentState: currentStateQuery.rows[0] || null,
      history,
      analytics,
      competitors,
      currentBuyBoxWinner,
      meta: {
        totalRecords: historyResult.rows.length,
        daysRequested: days,
        oldestRecord: history.length > 0 ? history[history.length - 1].timestamp : null,
        newestRecord: history.length > 0 ? history[0].timestamp : null
      }
    });
  } catch (error) {
    console.error('Error fetching product alert history:', error);
    return json(
      {
        error: 'Failed to fetch product alert history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
};

// Calculate analytics from historical data
function calculateAnalytics(history: any[]) {
  if (history.length === 0) {
    return {
      avgPrice: 0,
      minPrice: 0,
      maxPrice: 0,
      priceVolatility: 0,
      avgPosition: 0,
      buyBoxWinRate: 0,
      avgCompetitors: 0,
      priceChanges: 0
    };
  }

  const yourPrices = history
    .map((h) => h.yourOffer?.landedPrice)
    .filter((p) => p !== null && p !== undefined);

  const positions = history
    .map((h) => h.yourOffer?.position)
    .filter((p) => p !== null && p !== undefined);

  const buyBoxWins = history.filter((h) => h.yourOffer?.isBuyBoxWinner).length;

  // Calculate price changes
  let priceChanges = 0;
  for (let i = 1; i < yourPrices.length; i++) {
    if (yourPrices[i] !== yourPrices[i - 1]) {
      priceChanges++;
    }
  }

  // Calculate price volatility (standard deviation)
  const avgPrice = yourPrices.reduce((a, b) => a + b, 0) / yourPrices.length;
  const variance =
    yourPrices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) /
    yourPrices.length;
  const volatility = Math.sqrt(variance);

  return {
    avgPrice: avgPrice || 0,
    minPrice: Math.min(...yourPrices) || 0,
    maxPrice: Math.max(...yourPrices) || 0,
    priceVolatility: volatility || 0,
    avgPosition: positions.reduce((a, b) => a + b, 0) / positions.length || 0,
    buyBoxWinRate: (buyBoxWins / history.length) * 100 || 0,
    avgCompetitors: history.reduce((a, b) => a + b.offerCount, 0) / history.length || 0,
    priceChanges,
    totalDataPoints: history.length
  };
}

// Extract competitor activity from historical data
function extractCompetitorActivity(history: any[]) {
  const competitorMap = new Map<string, any>();
  const OUR_SELLER_ID = 'A2D8NG39VURSL3';

  // Process each historical notification
  history.forEach((record, index) => {
    const timestamp = record.timestamp;

    // Add YOUR offer data
    if (record.yourOffer) {
      const yourData = {
        seller: OUR_SELLER_ID,
        landedPrice: record.yourOffer.landedPrice,
        isFBA: record.yourOffer.isFBA || false,
        isBuyBox: record.yourOffer.isBuyBoxWinner,
        shippingPrice: record.yourOffer.shippingPrice || 0,
        isPrime: record.yourOffer.isPrime || false,
        shippingMinHours: record.yourOffer.shippingMinHours,
        shippingMaxHours: record.yourOffer.shippingMaxHours
      };

      // Create composite key: sellerId + shipping type
      const shippingType = yourData.isPrime ? 'Prime' : 'Standard';
      const compositeKey = `${OUR_SELLER_ID}|${shippingType}`;

      if (!competitorMap.has(compositeKey)) {
        competitorMap.set(compositeKey, {
          sellerId: OUR_SELLER_ID,
          shippingType,
          firstSeen: timestamp,
          lastSeen: timestamp,
          prices: [],
          shippingPrices: [],
          shippingInfo: [],
          buyBoxWins: 0,
          appearances: 0,
          isFBA: record.yourOffer.isFBA || false,
          isPrime: yourData.isPrime,
          priceChanges: 0,
          isYou: true
        });
      }

      const yourCompetitor = competitorMap.get(compositeKey);
      yourCompetitor.lastSeen = timestamp;
      yourCompetitor.appearances++;
      yourCompetitor.prices.push(yourData.landedPrice);
      yourCompetitor.shippingPrices.push(yourData.shippingPrice);
      yourCompetitor.shippingInfo.push({
        isPrime: yourData.isPrime,
        minHours: yourData.shippingMinHours,
        maxHours: yourData.shippingMaxHours
      });

      if (yourData.isBuyBox) {
        yourCompetitor.buyBoxWins++;
      }

      // Count price changes
      if (yourCompetitor.prices.length > 1) {
        const prevPrice = yourCompetitor.prices[yourCompetitor.prices.length - 2];
        const currentPrice = yourData.landedPrice;
        if (Math.abs(prevPrice - currentPrice) > 0.01) {
          yourCompetitor.priceChanges++;
        }
      }
    }

    // Add competitor data
    record.competitorPrices?.forEach((comp: any) => {
      const sellerId = comp.seller;
      const isPrime = comp.isPrime || false;
      const shippingType = isPrime ? 'Prime' : 'Standard';
      const compositeKey = `${sellerId}|${shippingType}`;

      if (!competitorMap.has(compositeKey)) {
        competitorMap.set(compositeKey, {
          sellerId,
          shippingType,
          firstSeen: timestamp,
          lastSeen: timestamp,
          prices: [],
          shippingPrices: [],
          shippingInfo: [],
          buyBoxWins: 0,
          appearances: 0,
          isFBA: comp.isFBA,
          isPrime: isPrime,
          priceChanges: 0
        });
      }

      const competitor = competitorMap.get(compositeKey);
      competitor.lastSeen = timestamp;
      competitor.appearances++;
      competitor.prices.push(comp.landedPrice);
      competitor.shippingPrices.push(comp.shippingPrice || 0);
      competitor.shippingInfo.push({
        isPrime: comp.isPrime || false,
        minHours: comp.shippingMinHours,
        maxHours: comp.shippingMaxHours
      });
      competitor.isFBA = competitor.isFBA || comp.isFBA; // Update if they use FBA

      if (comp.isBuyBox) {
        competitor.buyBoxWins++;
      }

      // Count price changes
      if (competitor.prices.length > 1) {
        const prevPrice = competitor.prices[competitor.prices.length - 2];
        const currentPrice = comp.landedPrice;
        if (Math.abs(prevPrice - currentPrice) > 0.01) {
          competitor.priceChanges++;
        }
      }
    });
  });

  // Convert map to array and calculate summary stats
  const currentBuyBoxWinner = history[0]?.buyBoxWinner || null; // Most recent buy box winner
  const currentBuyBoxWinnerIsPrime = history[0]?.buyBoxWinnerIsPrime || false;
  const currentBuyBoxWinnerShippingType = currentBuyBoxWinnerIsPrime ? 'Prime' : 'Standard';

  const competitors = Array.from(competitorMap.values()).map((comp) => {
    const currentShippingInfo = comp.shippingInfo[comp.shippingInfo.length - 1] || {};

    return {
      sellerId: comp.sellerId,
      shippingType: comp.shippingType, // Add shipping type to response
      firstSeen: comp.firstSeen,
      lastSeen: comp.lastSeen,
      lowestPrice: Math.min(...comp.prices),
      highestPrice: Math.max(...comp.prices),
      avgPrice: comp.prices.reduce((a: number, b: number) => a + b, 0) / comp.prices.length,
      currentPrice: comp.prices[comp.prices.length - 1], // Most recent price
      currentShipping: comp.shippingPrices[comp.shippingPrices.length - 1] || 0, // Most recent shipping
      isPrime: currentShippingInfo.isPrime || false,
      shippingMinHours: currentShippingInfo.minHours,
      shippingMaxHours: currentShippingInfo.maxHours,
      appearances: comp.appearances,
      buyBoxWins: comp.buyBoxWins,
      buyBoxWinRate: (comp.buyBoxWins / comp.appearances) * 100,
      priceChanges: comp.priceChanges,
      isFBA: comp.isFBA,
      currentlyActive: comp.lastSeen === history[0]?.timestamp, // Active in most recent notification
      isCurrentBuyBoxWinner: comp.sellerId === currentBuyBoxWinner && comp.shippingType === currentBuyBoxWinnerShippingType, // Match both seller and shipping type
      isYou: comp.isYou || false
    };
  });

  // Sort by current price (ASC) - all sellers including YOU
  return competitors.sort((a, b) => a.currentPrice - b.currentPrice);
}
