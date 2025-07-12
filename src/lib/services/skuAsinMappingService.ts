/**
 * SKU to ASIN Mapping Import Service
 * Handles CSV uploads and bulk import of SKU-ASIN mapping data
 */

import { supabaseAdmin } from '../supabaseAdmin';
import fs from 'fs';
import path from 'path';

export interface SkuAsinMappingData {
  sellerSku: string;
  itemName?: string;
  itemDescription?: string;
  listingId?: string;
  price?: number;
  quantity?: number;
  openDate?: string;
  imageUrl?: string;
  itemIsMarketplace?: boolean;
  productIdType?: string;
  zshopShippingFee?: number;
  itemNote?: string;
  itemCondition?: string;
  zshopCategory1?: string;
  zshopBrowsePath?: string;
  zshopStorefrontFeature?: string;
  asin1?: string;
  asin2?: string;
  asin3?: string;
  willShipInternationally?: boolean;
  expeditedShipping?: boolean;
  zshopBoldface?: boolean;
  productId?: string;
  bidForFeaturedPlacement?: boolean;
  addDelete?: string;
  pendingQuantity?: number;
  fulfillmentChannel?: string;
  merchantShippingGroup?: string;
  status?: string;
  minimumOrderQuantity?: number;
  sellRemainder?: boolean;
}

export class SkuAsinMappingService {
  /**
   * Import SKU-ASIN mapping data from CSV file
   */
  async importMappingData(filePath: string): Promise<{
    success: boolean;
    imported: number;
    errors: string[];
    duration: number;
  }> {
    const startTime = Date.now();
    const errors: string[] = [];
    let imported = 0;

    console.log(`📦 Starting SKU-ASIN mapping import from ${filePath}`);

    try {
      // Read and parse CSV file
      const mappingData = await this.parseCSV(filePath);

      console.log(`📊 Found ${mappingData.length} mapping records to import`);

      // Create import record for tracking
      const { data: importRecord } = await supabaseAdmin
        .from('import_records')
        .insert({
          filename: path.basename(filePath),
          file_type: 'sku_asin_mapping',
          status: 'processing',
          records_total: mappingData.length
        })
        .select()
        .single();

      // Clear existing data first (full replace)
      await supabaseAdmin
        .from('sku_asin_mapping')
        .delete()
        .gte('created_at', '1900-01-01');

      console.log('🗑️  Cleared existing SKU-ASIN mapping data');

      // Bulk import in batches for better performance
      const batchSize = 1000;
      const batches = [];

      for (let i = 0; i < mappingData.length; i += batchSize) {
        batches.push(mappingData.slice(i, i + batchSize));
      }

      console.log(`🔄 Processing ${batches.length} batches of ${batchSize} records each`);

      // Process batches
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        try {
          // Filter valid records
          const validRecords = batch.filter(record => {
            if (!record.sellerSku) {
              errors.push(`Invalid record: Missing seller-sku`);
              return false;
            }
            return true;
          });

          if (validRecords.length > 0) {
            // Transform data for Supabase (snake_case columns)
            const supabaseData = validRecords.map(record => ({
              seller_sku: record.sellerSku,
              item_name: record.itemName || null,
              item_description: record.itemDescription || null,
              listing_id: record.listingId || null,
              price: record.price || null,
              quantity: record.quantity || null,
              open_date: record.openDate ? new Date(record.openDate).toISOString() : null,
              image_url: record.imageUrl || null,
              item_is_marketplace: record.itemIsMarketplace || false,
              product_id_type: record.productIdType || null,
              zshop_shipping_fee: record.zshopShippingFee || null,
              item_note: record.itemNote || null,
              item_condition: record.itemCondition || null,
              zshop_category1: record.zshopCategory1 || null,
              zshop_browse_path: record.zshopBrowsePath || null,
              zshop_storefront_feature: record.zshopStorefrontFeature || null,
              asin1: record.asin1 || null,
              asin2: record.asin2 || null,
              asin3: record.asin3 || null,
              will_ship_internationally: record.willShipInternationally || false,
              expedited_shipping: record.expeditedShipping || false,
              zshop_boldface: record.zshopBoldface || false,
              product_id: record.productId || null,
              bid_for_featured_placement: record.bidForFeaturedPlacement || false,
              add_delete: record.addDelete || null,
              pending_quantity: record.pendingQuantity || null,
              fulfillment_channel: record.fulfillmentChannel || null,
              merchant_shipping_group: record.merchantShippingGroup || null,
              status: record.status || 'active',
              minimum_order_quantity: record.minimumOrderQuantity || null,
              sell_remainder: record.sellRemainder || false
            }));

            // Insert batch
            const { error } = await supabaseAdmin
              .from('sku_asin_mapping')
              .insert(supabaseData);

            if (error) {
              console.error(`❌ Error inserting batch ${i + 1}:`, error);
              errors.push(`Batch ${i + 1} error: ${error.message}`);
            } else {
              imported += validRecords.length;
            }
          }

          // Progress logging
          if ((i + 1) % 10 === 0) {
            console.log(`✅ Processed ${i + 1}/${batches.length} batches (${imported} records)`);
          }

        } catch (error) {
          console.error(`❌ Error processing batch ${i + 1}:`, error);
          errors.push(`Batch ${i + 1} error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Update import record
      if (importRecord?.id) {
        await supabaseAdmin
          .from('import_records')
          .update({
            status: errors.length > 0 ? 'completed_with_errors' : 'completed',
            records_processed: imported,
            records_failed: errors.length,
            errors: errors.length > 0 ? JSON.stringify(errors) : null
          })
          .eq('id', importRecord.id);
      }

      const duration = Date.now() - startTime;
      console.log(`🎉 Import completed in ${duration}ms: ${imported} records imported, ${errors.length} errors`);

      return {
        success: true,
        imported,
        errors,
        duration
      };

    } catch (error) {
      console.error('❌ Import failed:', error);
      const duration = Date.now() - startTime;
      return {
        success: false,
        imported: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        duration
      };
    }
  }

  /**
   * Parse CSV file and convert to mapping data
   */
  private async parseCSV(filePath: string): Promise<SkuAsinMappingData[]> {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');

    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header and one data row');
    }

    // Parse header
    const headers = lines[0].split('\t').map(h => h.trim().replace(/"/g, ''));
    console.log('📋 CSV headers found:', headers);
    console.log('📋 Total headers:', headers.length);

    // Find column indices for mapping
    const columnMap = {
      sellerSku: this.findColumnIndex(headers, ['seller-sku', 'seller_sku', 'sku']),
      itemName: this.findColumnIndex(headers, ['item-name', 'item_name', 'title']),
      itemDescription: this.findColumnIndex(headers, ['item-description', 'item_description', 'description']),
      listingId: this.findColumnIndex(headers, ['listing-id', 'listing_id']),
      price: this.findColumnIndex(headers, ['price']),
      quantity: this.findColumnIndex(headers, ['quantity', 'qty']),
      openDate: this.findColumnIndex(headers, ['open-date', 'open_date']),
      imageUrl: this.findColumnIndex(headers, ['image-url', 'image_url']),
      itemIsMarketplace: this.findColumnIndex(headers, ['item-is-marketplace', 'item_is_marketplace']),
      productIdType: this.findColumnIndex(headers, ['product-id-type', 'product_id_type']),
      zshopShippingFee: this.findColumnIndex(headers, ['zshop-shipping-fee', 'zshop_shipping_fee']),
      itemNote: this.findColumnIndex(headers, ['item-note', 'item_note']),
      itemCondition: this.findColumnIndex(headers, ['item-condition', 'item_condition']),
      zshopCategory1: this.findColumnIndex(headers, ['zshop-category1', 'zshop_category1']),
      zshopBrowsePath: this.findColumnIndex(headers, ['zshop-browse-path', 'zshop_browse_path']),
      zshopStorefrontFeature: this.findColumnIndex(headers, ['zshop-storefront-feature', 'zshop_storefront_feature']),
      asin1: this.findColumnIndex(headers, ['asin1', 'asin_1', 'asin']),
      asin2: this.findColumnIndex(headers, ['asin2', 'asin_2']),
      asin3: this.findColumnIndex(headers, ['asin3', 'asin_3']),
      willShipInternationally: this.findColumnIndex(headers, ['will-ship-internationally', 'will_ship_internationally']),
      expeditedShipping: this.findColumnIndex(headers, ['expedited-shipping', 'expedited_shipping']),
      zshopBoldface: this.findColumnIndex(headers, ['zshop-boldface', 'zshop_boldface']),
      productId: this.findColumnIndex(headers, ['product-id', 'product_id']),
      bidForFeaturedPlacement: this.findColumnIndex(headers, ['bid-for-featured-placement', 'bid_for_featured_placement']),
      addDelete: this.findColumnIndex(headers, ['add-delete', 'add_delete']),
      pendingQuantity: this.findColumnIndex(headers, ['pending-quantity', 'pending_quantity']),
      fulfillmentChannel: this.findColumnIndex(headers, ['fulfillment-channel', 'fulfillment_channel']),
      merchantShippingGroup: this.findColumnIndex(headers, ['merchant-shipping-group', 'merchant_shipping_group']),
      status: this.findColumnIndex(headers, ['status']),
      minimumOrderQuantity: this.findColumnIndex(headers, ['minimum-order-quantity', 'minimum_order_quantity', 'Minimum order quantity']),
      sellRemainder: this.findColumnIndex(headers, ['sell-remainder', 'sell_remainder', 'Sell remainder'])
    };

    console.log('🗂️  Column mapping:', columnMap);

    // Check if required column is found
    if (columnMap.sellerSku === -1) {
      const availableColumns = headers.join(',');
      throw new Error(`Required column 'seller-sku' not found. Available columns: ${availableColumns}`);
    }

    // Check if seller-sku column was found
    if (columnMap.sellerSku === -1) {
      console.error('❌ seller-sku column not found! Available headers:', headers);
      throw new Error(`Required column 'seller-sku' not found. Available columns: ${headers.join(', ')}`);
    }

    console.log(`✅ seller-sku found at column index: ${columnMap.sellerSku} (${headers[columnMap.sellerSku]})`);

    // Parse data rows
    const mappingData: SkuAsinMappingData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseTabDelimitedLine(line);

      // Debug for first few rows
      if (i <= 3) {
        console.log(`Row ${i} values count: ${values.length}, seller-sku value: "${values[columnMap.sellerSku]}"`);
      }

      // Convert boolean strings to boolean values
      const toBool = (value: string): boolean => {
        if (!value) return false;
        const lower = value.toLowerCase();
        return lower === 'true' || lower === 'yes' || lower === '1';
      };

      // Convert date strings to ISO format
      const toDate = (value: string): string | undefined => {
        if (!value) return undefined;
        try {
          return new Date(value).toISOString();
        } catch {
          return undefined;
        }
      };

      // Get seller SKU value with better validation
      const sellerSkuValue = values[columnMap.sellerSku]?.trim();

      if (!sellerSkuValue) {
        console.log(`Row ${i}: Missing seller-sku value, skipping row`);
        continue; // Skip this row instead of adding to errors
      }

      const record: SkuAsinMappingData = {
        sellerSku: sellerSkuValue,
        itemName: values[columnMap.itemName]?.trim() || undefined,
        itemDescription: values[columnMap.itemDescription]?.trim() || undefined,
        listingId: values[columnMap.listingId]?.trim() || undefined,
        price: columnMap.price !== -1 ? parseFloat(values[columnMap.price]) : undefined,
        quantity: columnMap.quantity !== -1 ? parseInt(values[columnMap.quantity]) : undefined,
        openDate: columnMap.openDate !== -1 ? toDate(values[columnMap.openDate]) : undefined,
        imageUrl: values[columnMap.imageUrl]?.trim() || undefined,
        itemIsMarketplace: columnMap.itemIsMarketplace !== -1 ? toBool(values[columnMap.itemIsMarketplace]) : false,
        productIdType: values[columnMap.productIdType]?.trim() || undefined,
        zshopShippingFee: columnMap.zshopShippingFee !== -1 ? parseFloat(values[columnMap.zshopShippingFee]) : undefined,
        itemNote: values[columnMap.itemNote]?.trim() || undefined,
        itemCondition: values[columnMap.itemCondition]?.trim() || undefined,
        zshopCategory1: values[columnMap.zshopCategory1]?.trim() || undefined,
        zshopBrowsePath: values[columnMap.zshopBrowsePath]?.trim() || undefined,
        zshopStorefrontFeature: values[columnMap.zshopStorefrontFeature]?.trim() || undefined,
        asin1: values[columnMap.asin1]?.trim() || undefined,
        asin2: values[columnMap.asin2]?.trim() || undefined,
        asin3: values[columnMap.asin3]?.trim() || undefined,
        willShipInternationally: columnMap.willShipInternationally !== -1 ? toBool(values[columnMap.willShipInternationally]) : false,
        expeditedShipping: columnMap.expeditedShipping !== -1 ? toBool(values[columnMap.expeditedShipping]) : false,
        zshopBoldface: columnMap.zshopBoldface !== -1 ? toBool(values[columnMap.zshopBoldface]) : false,
        productId: values[columnMap.productId]?.trim() || undefined,
        bidForFeaturedPlacement: columnMap.bidForFeaturedPlacement !== -1 ? toBool(values[columnMap.bidForFeaturedPlacement]) : false,
        addDelete: values[columnMap.addDelete]?.trim() || undefined,
        pendingQuantity: columnMap.pendingQuantity !== -1 ? parseInt(values[columnMap.pendingQuantity]) : undefined,
        fulfillmentChannel: values[columnMap.fulfillmentChannel]?.trim() || undefined,
        merchantShippingGroup: values[columnMap.merchantShippingGroup]?.trim() || undefined,
        status: values[columnMap.status]?.trim() || 'active',
        minimumOrderQuantity: columnMap.minimumOrderQuantity !== -1 ? parseInt(values[columnMap.minimumOrderQuantity]) : undefined,
        sellRemainder: columnMap.sellRemainder !== -1 ? toBool(values[columnMap.sellRemainder]) : false
      };

      mappingData.push(record);
    }

    return mappingData;
  }

  /**
   * Find column index by multiple possible names
   */
  private findColumnIndex(headers: string[], possibleNames: string[]): number {
    for (const name of possibleNames) {
      const index = headers.findIndex(h => {
        const cleanHeader = h.trim().toLowerCase().replace(/['"]/g, '');
        const cleanName = name.trim().toLowerCase().replace(/['"]/g, '');
        return cleanHeader === cleanName;
      });
      if (index !== -1) return index;
    }
    return -1;
  }

  /**
   * Parse a tab-delimited line (handles quoted values)
   */
  private parseTabDelimitedLine(line: string): string[] {
    const values = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === '\t' && !inQuotes) {
        // Tab delimiter outside quotes
        values.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    values.push(current);
    return values;
  }

  /**
   * Get mapping data with pagination and filtering
   */
  async getMappingData(
    page: number = 1,
    limit: number = 50,
    filters?: {
      search?: string;
      fulfillmentChannel?: string;
      merchantShippingGroup?: string;
      status?: string;
      hasAsin?: boolean;
    }
  ) {
    const offset = (page - 1) * limit;

    // Build query
    let query = supabaseAdmin.from('sku_asin_mapping').select('*', { count: 'exact' });

    // Apply filters
    if (filters?.search) {
      query = query.or(`seller_sku.ilike.%${filters.search}%,item_name.ilike.%${filters.search}%,asin1.ilike.%${filters.search}%`);
    }

    if (filters?.fulfillmentChannel) {
      query = query.eq('fulfillment_channel', filters.fulfillmentChannel);
    }

    if (filters?.merchantShippingGroup) {
      query = query.eq('merchant_shipping_group', filters.merchantShippingGroup);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.hasAsin !== undefined) {
      if (filters.hasAsin) {
        query = query.not('asin1', 'is', null);
      } else {
        query = query.is('asin1', null);
      }
    }

    // Apply pagination and sorting
    const { data: mappingData, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch mapping data: ${error.message}`);
    }

    return {
      data: mappingData || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  }

  /**
   * Get statistics for mapping data
   */
  async getStats() {
    const { data: totalData, error: totalError } = await supabaseAdmin
      .from('sku_asin_mapping')
      .select('id', { count: 'exact' });

    const { data: withAsinData, error: withAsinError } = await supabaseAdmin
      .from('sku_asin_mapping')
      .select('id', { count: 'exact' })
      .not('asin1', 'is', null);

    const { data: activeData, error: activeError } = await supabaseAdmin
      .from('sku_asin_mapping')
      .select('id', { count: 'exact' })
      .eq('status', 'active');

    const { data: fbaData, error: fbaError } = await supabaseAdmin
      .from('sku_asin_mapping')
      .select('id', { count: 'exact' })
      .eq('fulfillment_channel', 'FBA');

    if (totalError || withAsinError || activeError || fbaError) {
      throw new Error('Failed to fetch statistics');
    }

    return {
      totalMappings: totalData?.length || 0,
      withAsin: withAsinData?.length || 0,
      active: activeData?.length || 0,
      fba: fbaData?.length || 0,
      withoutAsin: (totalData?.length || 0) - (withAsinData?.length || 0),
      asinCoverage: totalData?.length ? ((withAsinData?.length || 0) / totalData.length * 100) : 0
    };
  }

  /**
   * Clear all mapping data
   */
  async clearAllMappingData(): Promise<{
    success: boolean;
    deleted: number;
    message: string;
  }> {
    try {
      console.log('🗑️  Clearing all SKU-ASIN mapping data...');

      // Get count before deletion
      const { count: beforeCount } = await supabaseAdmin
        .from('sku_asin_mapping')
        .select('*', { count: 'exact', head: true });

      // Delete all records
      const { error } = await supabaseAdmin
        .from('sku_asin_mapping')
        .delete()
        .gte('created_at', '1900-01-01');

      if (error) {
        throw new Error(`Failed to delete mapping data: ${error.message}`);
      }

      const deletedCount = beforeCount || 0;
      console.log(`✅ Cleared ${deletedCount} mapping records`);

      return {
        success: true,
        deleted: deletedCount,
        message: `Successfully cleared ${deletedCount} mapping records`
      };
    } catch (error) {
      console.error('❌ Error clearing mapping data:', error);
      return {
        success: false,
        deleted: 0,
        message: error instanceof Error ? error.message : 'Failed to clear mapping data'
      };
    }
  }
}

// Export singleton instance
export const skuAsinMappingService = new SkuAsinMappingService();
