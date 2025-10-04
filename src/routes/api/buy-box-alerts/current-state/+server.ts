// API endpoint to fetch current Buy Box competitive state
// Queries the Render PostgreSQL database (current_state table)

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pg from 'pg';

const { Pool } = pg;

// Database connection (uses DATABASE_URL from environment)
let pool: pg.Pool | null = null;

function getPool() {
  if (!pool) {
    // Try multiple environment variable names for flexibility
    const dbUrl = 
      process.env.RENDER_DATABASE_URL || 
      process.env.BUYBOX_DATABASE_URL ||
      process.env.WORKER_DATABASE_URL;

    if (!dbUrl) {
      throw new Error('Database URL not found. Set RENDER_DATABASE_URL, BUYBOX_DATABASE_URL, or WORKER_DATABASE_URL environment variable');
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

export const GET: RequestHandler = async () => {
  try {
    const db = getPool();

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
		`);

    // Calculate stats
    const stats = result.rows.reduce(
      (acc, row) => {
        acc.total++;
        if (row.severity === 'critical') acc.critical++;
        else if (row.severity === 'high') acc.high++;
        else if (row.severity === 'warning') acc.warning++;
        else if (row.severity === 'success') acc.success++;
        return acc;
      },
      { total: 0, critical: 0, high: 0, warning: 0, success: 0 }
    );

    // Transform data for UI
    const alerts = result.rows.map((row) => ({
      asin: row.asin,
      severity: row.severity,
      yourPrice: row.your_price ? parseFloat(row.your_price) : null,
      marketLow: row.market_low ? parseFloat(row.market_low) : null,
      primeLow: row.prime_low ? parseFloat(row.prime_low) : null,
      yourPosition: row.your_position,
      totalOffers: row.total_offers,
      buyBoxWinner: row.buy_box_winner,
      lastNotification: row.last_notification_data,
      lastUpdated: row.last_updated,
      createdAt: row.created_at
    }));

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
