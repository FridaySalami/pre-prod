/**
 * Database client for notification worker
 * Connects to Render PostgreSQL database (Buybox_notifications)
 */

const { Pool } = require('pg');
const logger = require('../shared/logger');

class Database {
  constructor() {
    this.pool = null;
    this.connected = false;
  }

  /**
   * Connect to PostgreSQL database
   * Uses DATABASE_URL environment variable (automatically set by Render)
   */
  async connect() {
    if (this.connected) {
      logger.warn('Database already connected');
      return;
    }

    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Create connection pool
    this.pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false // Render requires SSL
      },
      max: 10, // Maximum connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });

    // Test connection
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.connected = true;
      logger.info('✅ Database connected successfully');
    } catch (error) {
      logger.error('Failed to connect to database', { error: error.message });
      throw error;
    }
  }

  /**
   * Store raw notification with idempotency check
   * @param {Object} params - Notification parameters
   * @returns {Object} - Inserted or existing notification record
   */
  async storeNotification({ messageId, dedupeHash, rawNotification, traceId, workerId }) {
    const query = `
      INSERT INTO worker_notifications (
        message_id, 
        dedupe_hash, 
        raw_notification,
        notification_type,
        event_time,
        asin,
        trace_id,
        worker_id,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'processing')
      RETURNING *
    `;

    const values = [
      messageId,
      dedupeHash,
      rawNotification,
      rawNotification.notificationType || rawNotification.NotificationType,
      rawNotification.eventTime || rawNotification.EventTime,
      this.extractAsin(rawNotification),
      traceId,
      workerId
    ];

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      // Check if it's a duplicate (unique constraint violation)
      if (error.code === '23505') {
        logger.warn('⚠️ Duplicate message detected (idempotency working!)', {
          messageId,
          dedupeHash
        });

        // Fetch existing record
        const existingQuery = 'SELECT * FROM worker_notifications WHERE message_id = $1';
        const existing = await this.pool.query(existingQuery, [messageId]);
        return existing.rows[0];
      }

      throw error;
    }
  }

  /**
   * Update current_state table with latest competitive data
   * @param {Object} params - State update parameters
   */
  async updateCurrentState({ asin, marketplace, notificationId, ...analysis }) {
    const query = `
      INSERT INTO current_state (
        asin,
        marketplace,
        your_price,
        market_low,
        prime_low,
        your_position,
        total_offers,
        buy_box_winner,
        severity,
        last_notification_id,
        last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (asin, marketplace) 
      DO UPDATE SET
        your_price = EXCLUDED.your_price,
        market_low = EXCLUDED.market_low,
        prime_low = EXCLUDED.prime_low,
        your_position = EXCLUDED.your_position,
        total_offers = EXCLUDED.total_offers,
        buy_box_winner = EXCLUDED.buy_box_winner,
        severity = EXCLUDED.severity,
        last_notification_id = EXCLUDED.last_notification_id,
        last_updated = NOW()
      RETURNING *
    `;

    const values = [
      asin,
      marketplace || 'A1F83G8C2ARO7P', // UK marketplace default
      analysis.yourPrice,
      analysis.marketLow,
      analysis.primeLow,
      analysis.yourPosition,
      analysis.totalOffers,
      analysis.buyBoxWinner,
      analysis.severity,
      notificationId
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Mark notification as processed
   * @param {string} notificationId - UUID of notification
   */
  async markProcessed(notificationId) {
    const query = `
      UPDATE worker_notifications 
      SET status = 'completed', processed_at = NOW()
      WHERE id = $1
    `;

    await this.pool.query(query, [notificationId]);
  }

  /**
   * Store failed message in DLQ table
   * @param {Object} params - Failure parameters
   */
  async storeFailed({ messageId, rawMessage, errorType, errorMessage, stackTrace }) {
    const query = `
      INSERT INTO worker_failures (
        message_id,
        raw_message,
        error_type,
        error_message,
        stack_trace
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      messageId,
      rawMessage,
      errorType,
      errorMessage,
      stackTrace
    ];

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('❌ Failed to store DLQ record', { error: error.message });
      // Don't throw - we don't want to fail the whole process if DLQ insert fails
    }
  }

  /**
   * Extract ASIN from various notification formats
   * @param {Object} notification - Raw notification object
   * @returns {string|null} - Extracted ASIN or null
   */
  extractAsin(notification) {
    const payload = notification.payload || notification.Payload;

    if (!payload) return null;

    // Handle different notification types
    const offerChange = payload.anyOfferChangedNotification || payload.AnyOfferChangedNotification;
    if (offerChange) {
      return offerChange.asin || offerChange.ASIN;
    }

    const summary = payload.offerChangeSummary || payload.OfferChangeSummary;
    if (summary) {
      return summary.asin || summary.ASIN;
    }

    // Direct ASIN field
    return payload.asin || payload.ASIN || null;
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.connected = false;
      logger.info('👋 Database disconnected');
    }
  }

  /**
   * Check if database is connected
   * @returns {boolean}
   */
  isConnected() {
    return this.connected;
  }
}

module.exports = Database;
