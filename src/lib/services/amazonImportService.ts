/**
 * Amazon Listings Import Service
 * Optimized for bulk imports of large CSV files using Supabase
 */

import { supabaseAdmin } from '../supabaseAdmin.js';
import fs from 'fs';
import path from 'path';

export interface AmazonListingData {
  sellerSku: string;
  itemName: string;
  price?: number;
  merchantShippingGroup?: string;
  status: string;
}

export class AmazonImportService {

  /**
   * Import Amazon listings from CSV/JSON file
   */
  async importListings(filePath: string, fileType: 'csv' | 'json' = 'csv'): Promise<{
    success: boolean;
    imported: number;
    errors: string[];
    duration: number;
  }> {
    const startTime = Date.now();
    const errors: string[] = [];
    let imported = 0;

    console.log(`📦 Starting Amazon listings import from ${filePath}`);

    try {
      // Read and parse file
      const listings = fileType === 'csv'
        ? await this.parseCSV(filePath)
        : await this.parseJSON(filePath);

      console.log(`📊 Found ${listings.length} listings to import`);

      // Create import record
      const { data: importRecord } = await supabaseAdmin
        .from('import_records')
        .insert({
          filename: path.basename(filePath),
          file_type: 'amazon_listings',
          status: 'processing',
          records_total: listings.length
        })
        .select()
        .single();

      // Clear existing data first (delete all)
      await supabaseAdmin.from('amazon_listings').delete().neq('id', 0);
      console.log('🗑️  Cleared existing Amazon listings');

      // Bulk import in batches for better performance
      const batchSize = 1000;
      const batches = [];

      for (let i = 0; i < listings.length; i += batchSize) {
        batches.push(listings.slice(i, i + batchSize));
      }

      console.log(`🔄 Processing ${batches.length} batches of ${batchSize} records each`);

      // Process batches
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        try {
          // Filter valid listings
          const validListings = batch.filter(listing => {
            if (!listing.sellerSku || !listing.itemName) {
              errors.push(`Invalid listing: Missing seller-sku or item-name`);
              return false;
            }
            return true;
          });

          if (validListings.length > 0) {
            // Transform data for Supabase
            const supabaseData = validListings.map(listing => ({
              seller_sku: listing.sellerSku,
              item_name: listing.itemName,
              price: listing.price || null,
              merchant_shipping_group: listing.merchantShippingGroup || null,
              status: listing.status
            }));

            // Insert batch
            const { error } = await supabaseAdmin
              .from('amazon_listings')
              .insert(supabaseData);

            if (error) {
              console.error(`❌ Error inserting batch ${i + 1}:`, error);
              errors.push(`Batch ${i + 1} error: ${error.message}`);
            } else {
              imported += validListings.length;
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
      console.log(`🎉 Import completed in ${duration}ms: ${imported} listings imported, ${errors.length} errors`);

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
   * Parse CSV file
   */
  private async parseCSV(filePath: string): Promise<AmazonListingData[]> {
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
      price: this.findColumnIndex(headers, ['price', 'cost', 'amount']),
      merchantShippingGroup: this.findColumnIndex(headers, ['merchant-shipping-group', 'shipping-group', 'shipping_group']),
      status: this.findColumnIndex(headers, ['status', 'state', 'condition'])
    };

    console.log('🗂️  Column mapping:', columnMap);

    // Parse data rows
    const listings: AmazonListingData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseCSVLine(line);

      const listing: AmazonListingData = {
        sellerSku: values[columnMap.sellerSku]?.trim() || '',
        itemName: values[columnMap.itemName]?.trim() || '',
        price: columnMap.price !== -1 ? parseFloat(values[columnMap.price]) : undefined,
        merchantShippingGroup: columnMap.merchantShippingGroup !== -1 ? values[columnMap.merchantShippingGroup]?.trim() : undefined,
        status: values[columnMap.status]?.trim() || 'active'
      };

      listings.push(listing);
    }

    return listings;
  }

  /**
   * Parse JSON file
   */
  private async parseJSON(filePath: string): Promise<AmazonListingData[]> {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      throw new Error('JSON file must contain an array of listings');
    }

    return data.map(item => ({
      sellerSku: item['seller-sku'] || item.sellerSku || item.sku || '',
      itemName: item['item-name'] || item.itemName || item.name || '',
      price: item.price ? parseFloat(item.price) : undefined,
      merchantShippingGroup: item['merchant-shipping-group'] || item.merchantShippingGroup || undefined,
      status: item.status || 'active'
    }));
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
   * Get Amazon listings with pagination
   */
  async getListings(
    page: number = 1,
    limit: number = 50,
    filters?: {
      search?: string;
      status?: string;
      shippingGroup?: string;
      minPrice?: number;
      maxPrice?: number;
      dateFilter?: string;
      priceRange?: string;
    },
    sortBy: string = 'createdAt',
    sortOrder: string = 'desc'
  ) {
    const offset = (page - 1) * limit;

    // Build query
    let query = supabaseAdmin.from('amazon_listings').select('*', { count: 'exact' });

    // Apply filters
    if (filters?.search) {
      query = query.or(`seller_sku.ilike.%${filters.search}%,item_name.ilike.%${filters.search}%`);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.shippingGroup) {
      query = query.eq('merchant_shipping_group', filters.shippingGroup);
    }

    // Price filtering - use custom min/max if provided, otherwise use price range presets
    if (filters?.minPrice || filters?.maxPrice) {
      if (filters.minPrice) query = query.gte('price', filters.minPrice);
      if (filters.maxPrice) query = query.lte('price', filters.maxPrice);
    } else if (filters?.priceRange) {
      // Only apply price range presets if no custom min/max is set
      switch (filters.priceRange) {
        case 'free':
          query = query.is('price', null);
          break;
        case '0-10':
          query = query.gte('price', 0).lte('price', 10);
          break;
        case '10-25':
          query = query.gte('price', 10).lte('price', 25);
          break;
        case '25-50':
          query = query.gte('price', 25).lte('price', 50);
          break;
        case '50-100':
          query = query.gte('price', 50).lte('price', 100);
          break;
        case '100+':
          query = query.gte('price', 100);
          break;
      }
    }

    // Date filtering
    if (filters?.dateFilter) {
      const now = new Date();
      let startDate: Date;

      switch (filters.dateFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(0);
      }

      query = query.gte('created_at', startDate.toISOString());
    }

    // Apply sorting
    const orderColumn = sortBy === 'sellerSku' ? 'seller_sku' :
      sortBy === 'itemName' ? 'item_name' :
        sortBy === 'updatedAt' ? 'updated_at' :
          'created_at';

    query = query.order(orderColumn, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const { data: listings, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch listings: ${error.message}`);
    }

    // Transform snake_case database fields to camelCase for frontend
    const transformedListings = (listings || []).map(listing => ({
      id: listing.id,
      sellerSku: listing.seller_sku,
      itemName: listing.item_name,
      price: listing.price,
      merchantShippingGroup: listing.merchant_shipping_group,
      status: listing.status,
      createdAt: listing.created_at,
      updatedAt: listing.updated_at
    }));

    return {
      listings: transformedListings,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    };
  }

  /**
   * Get statistics
   */
  async getStats() {
    // Get total count
    const { count: totalListings, error: totalError } = await supabaseAdmin
      .from('amazon_listings')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      throw new Error(`Failed to get total count: ${totalError.message}`);
    }

    // Get active count
    const { count: activeListings, error: activeError } = await supabaseAdmin
      .from('amazon_listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    if (activeError) {
      throw new Error(`Failed to get active count: ${activeError.message}`);
    }

    // Get price statistics
    const { data: priceStats, error: priceError } = await supabaseAdmin
      .from('amazon_listings')
      .select('price')
      .not('price', 'is', null);

    if (priceError) {
      throw new Error(`Failed to get price stats: ${priceError.message}`);
    }

    // Calculate price statistics
    const prices = (priceStats || []).map(item => item.price).filter(p => p !== null);
    const avgPrice = prices.length > 0 ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0;
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    return {
      totalListings: totalListings || 0,
      activeListings: activeListings || 0,
      avgPrice,
      minPrice,
      maxPrice
    };
  }

  /**
   * Clear all Amazon listings from the database
   */
  async clearAllListings(): Promise<{
    success: boolean;
    deleted: number;
    message: string;
  }> {
    try {
      console.log('🗑️  Clearing all Amazon listings...');

      // Get count before deletion
      const { count: beforeCount } = await supabaseAdmin
        .from('amazon_listings')
        .select('*', { count: 'exact', head: true });

      // Delete all listings
      const { error } = await supabaseAdmin
        .from('amazon_listings')
        .delete()
        .gte('created_at', '1900-01-01'); // Delete all records

      if (error) {
        throw new Error(`Failed to delete listings: ${error.message}`);
      }

      const deletedCount = beforeCount || 0;
      console.log(`✅ Cleared ${deletedCount} Amazon listings`);

      return {
        success: true,
        deleted: deletedCount,
        message: `Successfully cleared ${deletedCount} Amazon listings`
      };

    } catch (error) {
      console.error('❌ Failed to clear listings:', error);
      return {
        success: false,
        deleted: 0,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const amazonImportService = new AmazonImportService();
