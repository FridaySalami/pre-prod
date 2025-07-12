/**
 * SKU-ASIN Mapping Import Service
 * Optimized for bulk imports of large CSV files using Supabase
 * Based on the successful AmazonImportService pattern
 */

import { supabaseAdmin } from '../supabaseAdmin';
import fs from 'fs';
import path from 'path';

export interface SkuAsinMappingData {
  sellerSku: string;
  itemName: string;
  asin1?: string;
  asin2?: string;
  asin3?: string;
  price?: number;
  quantity?: number;
  fulfillmentChannel?: string;
  merchantShippingGroup?: string;
  status?: string;
}

export class SkuAsinImportService {

  /**
   * Import SKU-ASIN mappings from CSV file
   */
  async importMappings(filePath: string): Promise<{
    success: boolean;
    imported: number;
    errors: string[];
    duration: number;
    filename?: string;
  }> {
    const startTime = Date.now();
    const errors: string[] = [];
    let imported = 0;
    const filename = path.basename(filePath);
    let importRecord: any = null;

    console.log(`📦 Starting SKU-ASIN mapping import from ${filePath}`);

    try {
      // Parse CSV file
      const mappings = await this.parseCSV(filePath);
      console.log(`📊 Found ${mappings.length} mappings to import`);

      // Record the import in the metadata table
      const { data: importRecord, error: importRecordError } = await supabaseAdmin
        .from('sku_asin_mapping_imports')
        .insert({
          filename: filename,
          records_count: 0,
          status: 'processing',
          notes: `Processing ${mappings.length} records`
        })
        .select()
        .single();

      if (importRecordError) {
        console.error('Failed to create import record:', importRecordError);
      }

      // Bulk import in batches for better performance
      const batchSize = 1000;
      const batches = [];

      for (let i = 0; i < mappings.length; i += batchSize) {
        batches.push(mappings.slice(i, i + batchSize));
      }

      console.log(`🔄 Processing ${batches.length} batches of ${batchSize} records each`);

      // Process batches
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        try {
          // Filter valid mappings
          const validMappings = batch.filter(mapping => {
            if (!mapping.sellerSku) {
              errors.push(`Invalid mapping: Missing seller-sku`);
              return false;
            }
            return true;
          });

          if (validMappings.length > 0) {
            // Transform data for Supabase
            const supabaseData = validMappings.map(mapping => ({
              seller_sku: mapping.sellerSku,
              item_name: mapping.itemName || null,
              asin1: mapping.asin1 || null,
              asin2: mapping.asin2 || null,
              asin3: mapping.asin3 || null,
              price: mapping.price || null,
              quantity: mapping.quantity || null,
              fulfillment_channel: mapping.fulfillmentChannel || null,
              merchant_shipping_group: mapping.merchantShippingGroup || null,
              status: mapping.status || 'active'
            }));

            // Insert or update batch
            const { error } = await supabaseAdmin
              .from('sku_asin_mapping')
              .upsert(supabaseData, {
                onConflict: 'seller_sku',
                ignoreDuplicates: false
              });

            if (error) {
              console.error(`❌ Error inserting batch ${i + 1}:`, error);
              errors.push(`Batch ${i + 1} error: ${error.message}`);
            } else {
              imported += validMappings.length;
            }
          }

          // Progress logging
          if ((i + 1) % 10 === 0 || i === batches.length - 1) {
            console.log(`✅ Processed ${i + 1}/${batches.length} batches (${imported} records)`);
          }

        } catch (error) {
          console.error(`❌ Error processing batch ${i + 1}:`, error);
          errors.push(`Batch ${i + 1} error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`🎉 Import completed in ${duration}ms: ${imported} mappings imported, ${errors.length} errors`);

      // Update the import record
      if (importRecord?.id) {
        await supabaseAdmin
          .from('sku_asin_mapping_imports')
          .update({
            status: errors.length > 0 ? 'completed_with_errors' : 'completed',
            records_count: imported,
            notes: `Imported ${imported} records, ${errors.length} errors`
          })
          .eq('id', importRecord.id);
      }

      return {
        success: true,
        imported,
        errors,
        duration,
        filename
      };

    } catch (error) {
      console.error('❌ Import failed:', error);

      // Update the import record if it was created
      if (importRecord?.id) {
        await supabaseAdmin
          .from('sku_asin_mapping_imports')
          .update({
            status: 'failed',
            notes: `Import failed: ${error instanceof Error ? error.message : String(error)}`
          })
          .eq('id', importRecord.id);
      }

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
   * Parse CSV file
   */
  private async parseCSV(filePath: string): Promise<SkuAsinMappingData[]> {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');

    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header and one data row');
    }

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log('📋 CSV headers:', headers);

    // Find column indices
    const columnMap = {
      sellerSku: this.findColumnIndex(headers, ['seller-sku', 'seller_sku', 'sku']),
      itemName: this.findColumnIndex(headers, ['item-name', 'item_name', 'name', 'title']),
      asin1: this.findColumnIndex(headers, ['asin1', 'asin-1', 'primary-asin', 'primary_asin', 'asin']),
      asin2: this.findColumnIndex(headers, ['asin2', 'asin-2', 'secondary-asin', 'secondary_asin']),
      asin3: this.findColumnIndex(headers, ['asin3', 'asin-3', 'tertiary-asin', 'tertiary_asin']),
      price: this.findColumnIndex(headers, ['price', 'cost', 'amount']),
      quantity: this.findColumnIndex(headers, ['quantity', 'qty', 'stock']),
      fulfillmentChannel: this.findColumnIndex(headers, ['fulfillment-channel', 'fulfillment_channel', 'channel']),
      merchantShippingGroup: this.findColumnIndex(headers, ['merchant-shipping-group', 'shipping-group', 'shipping_group']),
      status: this.findColumnIndex(headers, ['status', 'state', 'condition'])
    };

    console.log('🗂️  Column mapping:', columnMap);

    // Parse data rows
    const mappings: SkuAsinMappingData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseCSVLine(line);

      const mapping: SkuAsinMappingData = {
        sellerSku: values[columnMap.sellerSku]?.trim() || '',
        itemName: values[columnMap.itemName]?.trim() || '',
        asin1: columnMap.asin1 !== -1 ? values[columnMap.asin1]?.trim() : undefined,
        asin2: columnMap.asin2 !== -1 ? values[columnMap.asin2]?.trim() : undefined,
        asin3: columnMap.asin3 !== -1 ? values[columnMap.asin3]?.trim() : undefined,
        price: columnMap.price !== -1 ? parseFloat(values[columnMap.price]) : undefined,
        quantity: columnMap.quantity !== -1 ? parseInt(values[columnMap.quantity], 10) : undefined,
        fulfillmentChannel: columnMap.fulfillmentChannel !== -1 ? values[columnMap.fulfillmentChannel]?.trim() : undefined,
        merchantShippingGroup: columnMap.merchantShippingGroup !== -1 ? values[columnMap.merchantShippingGroup]?.trim() : undefined,
        status: columnMap.status !== -1 ? values[columnMap.status]?.trim() : 'active'
      };

      mappings.push(mapping);
    }

    return mappings;
  }

  /**
   * Find column index by multiple possible names
   */
  private findColumnIndex(headers: string[], possibleNames: string[]): number {
    for (const name of possibleNames) {
      const index = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
      if (index !== -1) return index;
    }
    return -1;
  }

  /**
   * Parse a single CSV line, handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  /**
   * Get SKU-ASIN mappings with pagination and filtering
   */
  async getMappings(
    page: number = 1,
    limit: number = 50,
    filters?: {
      search?: string;
      status?: string;
      fulfillmentChannel?: string;
      minPrice?: number;
      maxPrice?: number;
    },
    sortBy: string = 'created_at',
    sortOrder: string = 'desc'
  ) {
    const offset = (page - 1) * limit;

    // Build query
    let query = supabaseAdmin.from('sku_asin_mapping').select('*', { count: 'exact' });

    // Apply filters
    if (filters?.search) {
      query = query.or(`seller_sku.ilike.%${filters.search}%,item_name.ilike.%${filters.search}%,asin1.ilike.%${filters.search}%`);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.fulfillmentChannel) {
      query = query.eq('fulfillment_channel', filters.fulfillmentChannel);
    }

    if (filters?.minPrice) {
      query = query.gte('price', filters.minPrice);
    }

    if (filters?.maxPrice) {
      query = query.lte('price', filters.maxPrice);
    }

    // Apply sorting
    const dbSortBy = sortBy === 'createdAt' ? 'created_at' :
      sortBy === 'updatedAt' ? 'updated_at' :
        sortBy === 'sellerSku' ? 'seller_sku' :
          sortBy === 'itemName' ? 'item_name' : sortBy;

    query = query.order(dbSortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const { data, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching SKU-ASIN mappings:', error);
      throw error;
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return {
      success: true,
      mappings: data || [],
      totalMappings: count || 0,
      totalPages,
      currentPage: page,
      pageSize: limit
    };
  }

  /**
   * Get mapping stats
   */
  async getStats() {
    const { data, error } = await supabaseAdmin
      .from('sku_asin_mapping')
      .select('count', { count: 'exact' });

    if (error) {
      console.error('Error getting SKU-ASIN mapping stats:', error);
      throw error;
    }

    return {
      totalMappings: data?.[0]?.count || 0
    };
  }

  /**
   * Clear all mappings
   */
  async clearAllMappings() {
    // Delete all mappings
    const { error } = await supabaseAdmin
      .from('sku_asin_mapping')
      .delete()
      .neq('id', 0);

    if (error) {
      console.error('Error clearing SKU-ASIN mappings:', error);
      throw error;
    }

    return {
      success: true,
      message: 'All SKU-ASIN mappings cleared'
    };
  }
}

export const skuAsinImportService = new SkuAsinImportService();
