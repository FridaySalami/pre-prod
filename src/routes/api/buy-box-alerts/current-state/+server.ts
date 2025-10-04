// API endpoint to fetch current Buy Box competitive state
// Queries the Render PostgreSQL database (current_state table)

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import pg from 'pg';

const { Pool } = pg;

// Database connection (uses DATABASE_URL from environment)
let pool: pg.Pool | null = null;

function getPool() {
  if (!pool) {
    // Use the SvelteKit environment variable (runtime)
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

export const GET: RequestHandler = async ({ url }) => {
  try {
    const db = getPool();

    // Get query parameters for pagination and filtering
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100); // Max 100 items
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const severityFilter = url.searchParams.get('severity'); // Optional severity filter

    // Build WHERE clause if filtering by severity
    let whereClause = '';
    const queryParams: any[] = [limit, offset];

    if (severityFilter) {
      whereClause = 'WHERE severity = $3';
      queryParams.push(severityFilter);
    }

    // Query current_state table for all ASINs
    const result = await db.query(`
			SELECT 
				asin,
				severity,
				your_price,
				market_low,
				prime_low,
				your_position,
				total_offers,
				buy_box_winner,
				last_notification_data,
				last_updated,
				created_at
			FROM current_state
			${whereClause}
			ORDER BY 
				CASE severity
					WHEN 'critical' THEN 1
					WHEN 'high' THEN 2
					WHEN 'warning' THEN 3
					WHEN 'info' THEN 4
					WHEN 'success' THEN 5
					ELSE 6
				END,
				last_updated DESC
			LIMIT $1 OFFSET $2
		`, queryParams);

    // Get total count and stats (separate query for accuracy)
    const statsQuery = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical,
        COUNT(*) FILTER (WHERE severity = 'high') as high,
        COUNT(*) FILTER (WHERE severity = 'warning') as warning,
        COUNT(*) FILTER (WHERE severity = 'success') as success,
        COUNT(DISTINCT asin) as unique_asins
      FROM current_state
    `);

    const stats = {
      total: parseInt(statsQuery.rows[0].total) || 0,
      critical: parseInt(statsQuery.rows[0].critical) || 0,
      high: parseInt(statsQuery.rows[0].high) || 0,
      warning: parseInt(statsQuery.rows[0].warning) || 0,
      success: parseInt(statsQuery.rows[0].success) || 0,
      uniqueAsins: parseInt(statsQuery.rows[0].unique_asins) || 0,
      currentPage: Math.floor(offset / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil((parseInt(statsQuery.rows[0].total) || 0) / limit)
    };

    // Transform data for UI - use database fields + minimal JSONB data
    const alerts = result.rows.map((row) => {
      // Extract only essential fields from JSONB to keep response size manageable
      const notificationData = row.last_notification_data;
      const offerData = notificationData?.Payload?.AnyOfferChangedNotification;

      // Build a lightweight notification structure
      return {
        messageId: `db-${row.asin}`,
        eventTime: row.last_updated || row.created_at,
        receivedAt: row.last_updated,

        // Include the full payload for UI compatibility, but it's already optimized
        payload: {
          AnyOfferChangedNotification: {
            ASIN: row.asin,
            OfferChangeTrigger: offerData?.OfferChangeTrigger || { ASIN: row.asin },
            Offers: offerData?.Offers || [],
            Summary: offerData?.Summary || {
              NumberOfOffers: [{ OfferCount: row.total_offers || 0 }]
            }
          }
        },

        // Direct database fields for immediate UI display (avoid parsing JSONB)
        _dbMetadata: {
          asin: row.asin,
          severity: row.severity,
          yourPrice: row.your_price ? parseFloat(row.your_price) : null,
          marketLow: row.market_low ? parseFloat(row.market_low) : null,
          primeLow: row.prime_low ? parseFloat(row.prime_low) : null,
          yourPosition: row.your_position,
          totalOffers: row.total_offers,
          buyBoxWinner: row.buy_box_winner,
          lastUpdated: row.last_updated
        }
      };
    });

    return json({
      alerts,
      stats,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database query error:', error);
    return json(
      {
        error: 'Failed to fetch alerts from database',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
};
