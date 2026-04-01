/**
 * Database Update Service
 * 
 * Handles database operations for live pricing updates
 * Uses proven patterns from existing buybox data management
 */

const { SupabaseService } = require('./supabase-client');

class DatabaseUpdater {
  constructor() {
    this.db = SupabaseService.client;
  }

  /**
   * Update existing buybox_data record with new pricing information
   * Uses same data structure as existing buy box checks
   */
  async updateBuyboxRecord(id, newData) {
    try {
      console.log(`📝 Updating buybox record ${id} with fresh data`);

      // Prepare update with timestamp
      const updateData = {
        ...newData,
        captured_at: new Date().toISOString(),
        source: 'live_manual_update'
      };

      const { data, error } = await this.db
        .from('buybox_data')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Database update error:', error);
        throw new Error(`Failed to update record: ${error.message}`);
      }

      console.log(`✅ Successfully updated buybox record ${id}`);
      return data;

    } catch (error) {
      console.error('updateBuyboxRecord failed:', error);
      throw error;
    }
  }

  /**
   * Log price update for audit trail
   * Creates a record of what changed and when
   */
  async logPriceUpdate(sku, oldData, newData, userId) {
    try {
      const changes = this.calculateChanges(oldData, newData);

      const logEntry = {
        sku: sku,
        record_id: newData.id,
        changes: changes,
        updated_by: userId || 'system',
        updated_at: new Date().toISOString(),
        update_type: 'live_manual_update',
        old_data_snapshot: {
          your_current_price: oldData.your_current_price,
          buybox_price: oldData.buybox_price,
          captured_at: oldData.captured_at
        },
        new_data_snapshot: {
          your_current_price: newData.your_current_price,
          buybox_price: newData.buybox_price,
          captured_at: newData.captured_at
        }
      };

      // For now, log to console - can be extended to dedicated audit table
      console.log('📝 Price update audit log:', JSON.stringify(logEntry, null, 2));

      // TODO: Uncomment when audit table is created
      // const { error } = await this.db
      //   .from('price_update_audit')
      //   .insert(logEntry);
      // 
      // if (error) {
      //   console.warn('Failed to log to audit table:', error.message);
      // }

      return logEntry;

    } catch (error) {
      console.warn('Failed to log price update:', error.message);
      // Don't throw - audit logging failure shouldn't break the update
      return null;
    }
  }

  /**
   * Calculate what changed between old and new data
   */
  calculateChanges(oldData, newData) {
    const changes = {};

    // Price changes
    if (oldData.your_current_price !== newData.your_current_price) {
      changes.your_price = {
        from: oldData.your_current_price,
        to: newData.your_current_price,
        difference: newData.your_current_price - oldData.your_current_price
      };
    }

    if (oldData.buybox_price !== newData.buybox_price) {
      changes.buybox_price = {
        from: oldData.buybox_price,
        to: newData.buybox_price,
        difference: newData.buybox_price - oldData.buybox_price
      };
    }

    // Buy box status changes
    if (oldData.is_buybox_winner !== newData.is_buybox_winner) {
      changes.buybox_status = {
        from: oldData.is_buybox_winner ? 'winner' : 'not_winner',
        to: newData.is_buybox_winner ? 'winner' : 'not_winner'
      };
    }

    // Competitive position changes
    if (oldData.total_offers !== newData.total_offers) {
      changes.competition = {
        from: oldData.total_offers,
        to: newData.total_offers,
        difference: newData.total_offers - oldData.total_offers
      };
    }

    return changes;
  }

  /**
   * Validate user permissions for updating specific SKU
   */
  async validateUpdatePermissions(userId, sku) {
    // For now, allow all updates - can be extended with role-based permissions
    // TODO: Implement proper permission checking when user management is added

    console.log(`🔐 Validating update permissions for user ${userId} on SKU ${sku}`);

    // Basic validation - ensure required parameters
    if (!userId || !sku) {
      throw new Error('User ID and SKU are required for validation');
    }

    // Future: Check user roles, SKU ownership, etc.
    // const { data: userPermissions } = await this.db
    //   .from('user_permissions')
    //   .select('can_update_pricing')
    //   .eq('user_id', userId)
    //   .single();

    return true; // Allow for now
  }

  /**
   * Get current buybox record for comparison
   */
  async getCurrentRecord(recordId) {
    try {
      const { data, error } = await this.db
        .from('buybox_data')
        .select('*')
        .eq('id', recordId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch current record: ${error.message}`);
      }

      return data;

    } catch (error) {
      console.error('getCurrentRecord failed:', error);
      throw error;
    }
  }

  /**
   * Check if record was recently updated to prevent spam
   */
  async checkRecentUpdate(recordId, minutesThreshold = 5) {
    try {
      const record = await this.getCurrentRecord(recordId);
      const lastUpdate = new Date(record.captured_at);
      const thresholdTime = new Date(Date.now() - minutesThreshold * 60 * 1000);

      return {
        wasRecentlyUpdated: lastUpdate > thresholdTime,
        lastUpdateTime: lastUpdate,
        minutesSinceUpdate: Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60)),
        canUpdate: lastUpdate <= thresholdTime
      };

    } catch (error) {
      console.error('checkRecentUpdate failed:', error);
      return { canUpdate: true, error: error.message };
    }
  }
}

module.exports = DatabaseUpdater;
