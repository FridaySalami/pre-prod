/**
 * Inventory import service for handling CSV uploads and data processing
 */

import { supabaseAdmin } from '../supabaseAdmin';

export interface InventoryItem {
  sku: string;
  stockLevel?: number;
  depth?: number;
  height?: number;
  width?: number;
  purchasePrice?: number;
  retailPrice?: number;
  title: string;
  tracked?: boolean;
  weight?: number;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  updated: number;
  errors: string[];
  duplicates: number;
  total: number;
}

export interface ImportStats {
  totalItems: number;
  trackedItems: number;
  untrackedItems: number;
  averagePurchasePrice: number;
  averageRetailPrice: number;
  averageWeight: number;
  totalValue: number;
}

export class InventoryImportService {

  /**
   * Update progress in Supabase import_records table
   */
  private async updateProgress(sessionId: string, processedRecords: number, importedRecords: number, updatedRecords: number, errorCount: number, status: string = 'processing') {
    try {
      await supabaseAdmin
        .from('import_records')
        .update({
          processed_records: processedRecords,
          imported_records: importedRecords,
          updated_records: updatedRecords,
          error_count: errorCount,
          status,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId);
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  }

  /**
   * Import inventory data from parsed CSV/JSON with progress tracking
   */
  async importInventoryData(data: any[], sessionId?: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: 0,
      updated: 0,
      errors: [],
      duplicates: 0,
      total: data.length
    };

    if (!Array.isArray(data) || data.length === 0) {
      result.success = false;
      result.errors.push('No data provided or invalid format');
      if (sessionId) {
        await this.updateProgress(sessionId, 0, 0, 0, 1, 'error');
      }
      return result;
    }

    try {
      // Process items in batches for better performance
      const batchSize = 1000; // Increased batch size for Supabase
      const batches = this.createBatches(data, batchSize);
      let processedItems = 0;

      if (sessionId) {
        await this.updateProgress(sessionId, 0, 0, 0, 0, 'processing');
      }

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        if (sessionId) {
          await this.updateProgress(
            sessionId,
            processedItems,
            result.imported,
            result.updated,
            result.errors.length,
            'processing'
          );
        }

        try {
          const batchResult = await this.processBatch(batch);
          result.imported += batchResult.imported;
          result.updated += batchResult.updated;
          result.duplicates += batchResult.duplicates;
          result.errors.push(...batchResult.errors);

          processedItems += batch.length;

          if (sessionId) {
            await this.updateProgress(
              sessionId,
              processedItems,
              result.imported,
              result.updated,
              result.errors.length,
              'processing'
            );
          }
        } catch (error) {
          console.error('Batch processing error:', error);
          result.errors.push(`Batch processing failed: ${error}`);

          if (sessionId) {
            await this.updateProgress(sessionId, processedItems, result.imported, result.updated, result.errors.length, 'error');
          }
        }
      }

      // Consider import successful if we imported at least some items
      // even if there were validation errors for some rows
      result.success = result.imported > 0 && result.errors.length < result.total;

      console.log(`📊 Import Summary:
        Total: ${result.total}
        Imported: ${result.imported}
        Updated: ${result.updated}
        Errors: ${result.errors.length}
        Success: ${result.success}
        Sample errors: ${result.errors.slice(0, 3).join('; ')}`);

      if (sessionId) {
        const status = result.success ? 'completed' : 'error';
        await this.updateProgress(
          sessionId,
          result.total,
          result.imported,
          result.updated,
          result.errors.length,
          status
        );
      }

      return result;
    } catch (error) {
      console.error('Import error:', error);
      result.success = false;
      result.errors.push(`Import failed: ${error}`);

      if (sessionId) {
        await this.updateProgress(sessionId, 0, 0, 0, 1, 'error');
      }

      return result;
    }
  }

  /**
   * Process a batch of inventory items using bulk operations for better performance
   */
  private async processBatch(batch: any[]): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: 0,
      updated: 0,
      errors: [],
      duplicates: 0,
      total: batch.length
    };

    try {
      // Validate and transform all items in the batch
      const validItems = [];
      const skippedCount = batch.length;

      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        const inventoryData = this.validateAndTransformItem(item);
        if (inventoryData) {
          validItems.push(inventoryData);
        } else {
          // Don't treat validation failures as critical errors for small numbers
          const itemInfo = item.SKU || item.sku || `row ${i + 1}`;
          console.warn(`⚠️ Skipping invalid item: ${itemInfo}`);
        }
      }

      console.log(`📝 Batch validation: ${validItems.length}/${batch.length} items valid`);

      if (validItems.length === 0) {
        result.errors.push(`No valid items in batch of ${batch.length}`);
        return result;
      }

      // Transform data for Supabase (snake_case columns)
      const supabaseData = validItems.map(item => ({
        sku: item.sku,
        stock_level: item.stockLevel,
        depth: item.depth,
        height: item.height,
        width: item.width,
        purchase_price: item.purchasePrice,
        retail_price: item.retailPrice,
        title: item.title,
        tracked: item.tracked,
        weight: item.weight
      }));

      // Use bulk upsert for much better performance
      const { error, data } = await supabaseAdmin
        .from('inventory')
        .upsert(supabaseData, {
          onConflict: 'sku',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Bulk upsert error:', error);
        result.errors.push(`Bulk upsert failed: ${error.message}`);
        // Don't set success to false here - the process completed but with errors
      } else {
        // Since we can't easily distinguish between inserts and updates with upsert,
        // we'll count all as imported for now
        result.imported = validItems.length;
        console.log(`✅ Bulk upserted ${validItems.length} inventory items`);
      }

    } catch (error) {
      console.error('Batch processing error:', error);
      result.errors.push(`Batch processing failed: ${error}`);
      // Don't set success to false here - the process completed but with errors
    }

    return result;
  }

  /**
   * Validate and transform inventory item data
   */
  private validateAndTransformItem(item: any): InventoryItem | null {
    try {
      // Handle different possible column name variations
      const sku = this.getFieldValue(item, ['SKU', 'sku', 'Sku']);
      const title = this.getFieldValue(item, ['Title', 'title', 'TITLE', 'Product Name', 'Name']);

      if (!sku || !title) {
        return null;
      }

      return {
        sku: String(sku).trim(),
        stockLevel: this.parseNumber(this.getFieldValue(item, ['Stock Level', 'stockLevel', 'stock_level', 'Stock'])),
        depth: this.parseNumber(this.getFieldValue(item, ['Depth', 'depth', 'DEPTH'])),
        height: this.parseNumber(this.getFieldValue(item, ['Height', 'height', 'HEIGHT'])),
        width: this.parseNumber(this.getFieldValue(item, ['Width', 'width', 'WIDTH'])),
        purchasePrice: this.parseNumber(this.getFieldValue(item, ['Purchase Price', 'purchasePrice', 'purchase_price', 'Cost'])),
        retailPrice: this.parseNumber(this.getFieldValue(item, ['Retail Price', 'retailPrice', 'retail_price', 'Price'])),
        title: String(title).trim(),
        tracked: this.parseBoolean(this.getFieldValue(item, ['Tracked', 'tracked', 'TRACKED'])),
        weight: this.parseNumber(this.getFieldValue(item, ['Weight', 'weight', 'WEIGHT']))
      };
    } catch (error) {
      console.error('Transform error:', error);
      return null;
    }
  }

  /**
   * Get field value with fallback options
   */
  private getFieldValue(item: any, fieldNames: string[]): any {
    for (const fieldName of fieldNames) {
      if (item[fieldName] !== undefined && item[fieldName] !== null && item[fieldName] !== '') {
        return item[fieldName];
      }
    }
    return null;
  }

  /**
   * Parse number value safely
   */
  private parseNumber(value: any): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }

    // Handle string values with currency symbols or commas
    if (typeof value === 'string') {
      value = value.replace(/[£$,]/g, '').trim();
    }

    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Parse boolean value safely
   */
  private parseBoolean(value: any): boolean {
    if (value === null || value === undefined || value === '') {
      return true; // Default to tracked
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'y';
    }

    return Boolean(value);
  }

  /**
   * Create batches for processing
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Get inventory statistics
   */
  async getInventoryStats(): Promise<ImportStats> {
    const { data: items, error } = await supabaseAdmin
      .from('inventory')
      .select('tracked, purchase_price, retail_price, weight, stock_level');

    if (error) {
      throw new Error(`Failed to fetch inventory stats: ${error.message}`);
    }

    const inventoryItems = items || [];
    const trackedItems = inventoryItems.filter((item: any) => item.tracked).length;
    const untrackedItems = inventoryItems.length - trackedItems;

    const purchasePrices = inventoryItems.filter((item: any) => item.purchase_price !== null).map((item: any) => item.purchase_price!);
    const retailPrices = inventoryItems.filter((item: any) => item.retail_price !== null).map((item: any) => item.retail_price!);
    const weights = inventoryItems.filter((item: any) => item.weight !== null).map((item: any) => item.weight!);

    const averagePurchasePrice = purchasePrices.length > 0
      ? purchasePrices.reduce((sum: number, price: number) => sum + price, 0) / purchasePrices.length
      : 0;

    const averageRetailPrice = retailPrices.length > 0
      ? retailPrices.reduce((sum: number, price: number) => sum + price, 0) / retailPrices.length
      : 0;

    const averageWeight = weights.length > 0
      ? weights.reduce((sum: number, weight: number) => sum + weight, 0) / weights.length
      : 0;

    // Calculate total value based on stock level and retail price
    const totalValue = inventoryItems.reduce((sum: number, item: any) => {
      if (item.retail_price && item.stock_level) {
        return sum + (item.retail_price * item.stock_level);
      }
      return sum;
    }, 0);

    return {
      totalItems: inventoryItems.length,
      trackedItems,
      untrackedItems,
      averagePurchasePrice,
      averageRetailPrice,
      averageWeight,
      totalValue
    };
  }

  /**
   * Clear all inventory data
   */
  async clearAllInventory(): Promise<{ deleted: number }> {
    // Get count before deletion
    const { count: beforeCount } = await supabaseAdmin
      .from('inventory')
      .select('*', { count: 'exact', head: true });

    // Delete all inventory
    const { error } = await supabaseAdmin
      .from('inventory')
      .delete()
      .neq('sku', ''); // Delete all records (sku != '')

    if (error) {
      throw new Error(`Failed to clear inventory: ${error.message}`);
    }

    return { deleted: beforeCount || 0 };
  }

  /**
   * Get filtered inventory with pagination
   */
  async getFilteredInventory(filters: {
    search?: string;
    tracked?: string;
    minPrice?: string;
    maxPrice?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const {
      search = '',
      tracked = '',
      minPrice = '',
      maxPrice = '',
      page = 1,
      limit = 50,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = filters;

    const offset = (page - 1) * limit;

    // Build query
    let query = supabaseAdmin.from('inventory').select('*', { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`sku.ilike.%${search}%,title.ilike.%${search}%`);
    }

    if (tracked) {
      query = query.eq('tracked', tracked === 'true');
    }

    if (minPrice || maxPrice) {
      if (minPrice) query = query.gte('retail_price', parseFloat(minPrice));
      if (maxPrice) query = query.lte('retail_price', parseFloat(maxPrice));
    }

    // Apply sorting
    const orderColumn = sortBy === 'createdAt' ? 'created_at' :
      sortBy === 'updatedAt' ? 'updated_at' :
        sortBy === 'retailPrice' ? 'retail_price' :
          sortBy === 'purchasePrice' ? 'purchase_price' :
            sortBy === 'stockLevel' ? 'stock_level' :
              sortBy;

    query = query.order(orderColumn, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const { data: items, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch inventory: ${error.message}`);
    }

    // Transform snake_case database fields to camelCase for frontend
    const transformedItems = (items || []).map(item => ({
      id: item.id,
      sku: item.sku,
      stockLevel: item.stock_level,
      depth: item.depth,
      height: item.height,
      width: item.width,
      purchasePrice: item.purchase_price,
      retailPrice: item.retail_price,
      title: item.title,
      tracked: item.tracked,
      weight: item.weight,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));

    return {
      items: transformedItems,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    };
  }
}

export const inventoryImportService = new InventoryImportService();
