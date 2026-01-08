/**
 * Sage report import service for handling CSV uploads and data processing
 */

import { db } from '../supabaseServer.js';

export interface SageReportItem {
  stockCode: string;
  binName?: string;
  standardCost?: number;
  taxRate?: number;
  price?: number;
  productGroupCode?: string;
  bomItemTypeId?: string;
  companyName?: string;
  supplierAccountNumber?: string;
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
  totalCompanies: number;
  totalSuppliers: number;
  averagePrice: number;
  averageStandardCost: number;
  totalValue: number;
}

export class SageImportService {

  /**
   * Import Sage report data from parsed CSV/JSON
   */
  async importSageData(data: any[]): Promise<ImportResult> {
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
      return result;
    }

    // Process items in batches for better performance
    const batchSize = 100;
    const batches = this.createBatches(data, batchSize);

    for (const batch of batches) {
      try {
        const batchResult = await this.processBatch(batch);
        result.imported += batchResult.imported;
        result.updated += batchResult.updated;
        result.duplicates += batchResult.duplicates;
        result.errors.push(...batchResult.errors);
      } catch (error) {
        console.error('Batch processing error:', error);
        result.errors.push(`Batch processing failed: ${error}`);
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * Process a batch of Sage report items using bulk operations
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

    // Validate and transform all items first
    const validItems: Array<{ original: any; transformed: SageReportItem; supabaseData: any }> = [];

    for (const item of batch) {
      try {
        const sageData = this.validateAndTransformItem(item);

        if (!sageData) {
          result.errors.push(`Invalid item data: ${JSON.stringify(item)}`);
          continue;
        }

        // Transform data for Supabase (snake_case columns)
        const supabaseData = {
          stock_code: sageData.stockCode,
          bin_name: sageData.binName,
          standard_cost: sageData.standardCost,
          tax_rate: sageData.taxRate,
          price: sageData.price,
          product_group_code: sageData.productGroupCode,
          bom_item_type_id: sageData.bomItemTypeId,
          company_name: sageData.companyName,
          supplier_account_number: sageData.supplierAccountNumber
        };

        validItems.push({ original: item, transformed: sageData, supabaseData });
      } catch (error) {
        console.error('Item validation error:', error);
        result.errors.push(`Failed to validate item: ${error}`);
      }
    }

    if (validItems.length === 0) {
      return result;
    }

    // STEP 1: Deduplicate within the CSV itself (keep latest occurrence of each stock_code)
    console.log(`Before deduplication: ${validItems.length} items`);

    const deduplicatedMap = new Map();
    for (const item of validItems) {
      const stockCode = item.transformed.stockCode;
      // Always keep the latest occurrence (overwrites previous if duplicate)
      deduplicatedMap.set(stockCode, item);
    }

    const deduplicatedItems = Array.from(deduplicatedMap.values());
    console.log(`After deduplication: ${deduplicatedItems.length} items (removed ${validItems.length - deduplicatedItems.length} duplicates)`);

    // STEP 2: Get all existing records in bulk to check for database duplicates and fetch current values for merging
    const stockCodes = deduplicatedItems.map(item => item.transformed.stockCode);
    const { data: existingRecords } = await db
      .from('sage_reports')
      .select('id, stock_code, company_name, tax_rate') // Fetch tax_rate to preserve it
      .in('stock_code', stockCodes);

    // Create lookup map for existing records
    const existingMap = new Map();
    if (existingRecords) {
      existingRecords.forEach(record => {
        existingMap.set(record.stock_code, record); // Store full record
      });
    }

    // STEP 3: Separate items into new inserts and updates
    const newItems: any[] = [];
    const updateItems: Array<{ id: string; data: any }> = [];

    for (const item of deduplicatedItems) {
      const stockCode = item.transformed.stockCode;
      const existingRecord = existingMap.get(stockCode);

      if (existingRecord) {
        // MERGE LOGIC: If incoming tax_rate is undefined/null, preserve existing one
        const mergedData = { ...item.supabaseData };

        if (mergedData.tax_rate === undefined || mergedData.tax_rate === null) {
          mergedData.tax_rate = existingRecord.tax_rate;
        }

        updateItems.push({ id: existingRecord.id, data: mergedData });
      } else {
        newItems.push(item.supabaseData);
      }
    }

    console.log(`Processing: ${newItems.length} new items, ${updateItems.length} updates`);

    // Bulk insert new items
    if (newItems.length > 0) {
      // Insert in batches for better performance
      const batchSize = 1000;
      let insertedCount = 0;

      for (let i = 0; i < newItems.length; i += batchSize) {
        const batch = newItems.slice(i, i + batchSize);
        const { error: insertError } = await db
          .from('sage_reports')
          .insert(batch);

        if (insertError) {
          result.errors.push(`Batch insert failed (items ${i + 1}-${i + batch.length}): ${insertError.message}`);
        } else {
          insertedCount += batch.length;
        }
      }

      result.imported = insertedCount;
    }

    // For updates, we'll upsert since Supabase doesn't have efficient bulk updates
    if (updateItems.length > 0) {
      // Convert update items to upsert format
      const upsertItems = updateItems.map(item => ({
        ...item.data,
        id: item.id
      }));

      // Batch upsert for better performance
      const batchSize = 1000;
      let updatedCount = 0;

      for (let i = 0; i < upsertItems.length; i += batchSize) {
        const batch = upsertItems.slice(i, i + batchSize);

        try {
          const { error } = await db
            .from('sage_reports')
            .upsert(batch, {
              onConflict: 'id',
              ignoreDuplicates: false
            });

          if (error) {
            result.errors.push(`Batch upsert failed (items ${i + 1}-${i + batch.length}): ${error.message}`);
          } else {
            updatedCount += batch.length;
          }
        } catch (error) {
          result.errors.push(`Batch upsert failed (items ${i + 1}-${i + batch.length}): ${error}`);
        }
      }

      result.updated = updatedCount;
    }

    return result;
  }

  /**
   * Validate and transform Sage report item data
   */
  private validateAndTransformItem(item: any): SageReportItem | null {
    try {
      // Handle different possible column name variations
      const stockCode = this.getFieldValue(item, [
        'StockItems.Code',
        'stockCode',
        'Stock Code',
        'SKU',
        'sku'
      ]);

      if (!stockCode) {
        return null;
      }

      return {
        stockCode: String(stockCode).trim(),
        binName: this.getFieldValue(item, [
          'BinItems.BinName',
          'binName',
          'Bin Name',
          'bin_name'
        ]),
        standardCost: this.parseNumber(this.getFieldValue(item, [
          'StockItems.StandardCost',
          'standardCost',
          'Standard Cost',
          'standard_cost'
        ])),
        taxRate: this.parseNumber(this.getFieldValue(item, [
          'StockItems.TaxRate',
          'taxRate',
          'Tax Rate',
          'tax_rate'
        ])),
        price: this.parseNumber(this.getFieldValue(item, [
          'StockItemPrices.Price',
          'price',
          'Price',
          'selling_price'
        ])),
        productGroupCode: this.getFieldValue(item, [
          'ProductGroups.Code',
          'productGroupCode',
          'Product Group Code',
          'product_group'
        ]),
        bomItemTypeId: this.getFieldValue(item, [
          'StockItems.BOMItemTypeID',
          'bomItemTypeId',
          'BOM Item Type ID',
          'bom_type'
        ]),
        companyName: this.getFieldValue(item, [
          'SYSCompanies.CompanyName',
          'companyName',
          'Company Name',
          'company'
        ]),
        supplierAccountNumber: this.getFieldValue(item, [
          'PLSupplierAccounts.SupplierAccountNumber',
          'supplierAccountNumber',
          'Supplier Account Number',
          'supplier_account'
        ])
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
   * Get Sage report statistics
   */
  async getSageStats(): Promise<ImportStats> {
    const { data: items, error } = await db
      .from('sage_reports')
      .select('price, standard_cost, company_name, supplier_account_number');

    if (error) {
      throw new Error(`Failed to fetch Sage stats: ${error.message}`);
    }

    const sageItems = items || [];
    const totalItems = sageItems.length;

    // Get unique companies and suppliers
    const companies = new Set(sageItems.map((item: any) => item.company_name).filter(Boolean));
    const suppliers = new Set(sageItems.map((item: any) => item.supplier_account_number).filter(Boolean));

    // Calculate averages
    const prices = sageItems.filter((item: any) => item.price !== null).map((item: any) => item.price!);
    const standardCosts = sageItems.filter((item: any) => item.standard_cost !== null).map((item: any) => item.standard_cost!);

    const averagePrice = prices.length > 0
      ? prices.reduce((sum: number, price: number) => sum + price, 0) / prices.length
      : 0;

    const averageStandardCost = standardCosts.length > 0
      ? standardCosts.reduce((sum: number, cost: number) => sum + cost, 0) / standardCosts.length
      : 0;

    // Calculate total value based on prices
    const totalValue = prices.reduce((sum: number, price: number) => sum + price, 0);

    return {
      totalItems,
      totalCompanies: companies.size,
      totalSuppliers: suppliers.size,
      averagePrice,
      averageStandardCost,
      totalValue
    };
  }

  /**
   * Clear all Sage report data
   */
  async clearAllSageData(): Promise<{ deleted: number }> {
    // Get count before deletion
    const { count: beforeCount } = await db
      .from('sage_reports')
      .select('*', { count: 'exact', head: true });

    // Delete all Sage reports
    const { error } = await db
      .from('sage_reports')
      .delete()
      .gte('created_at', '1900-01-01'); // Delete all records

    if (error) {
      throw new Error(`Failed to clear Sage data: ${error.message}`);
    }

    return { deleted: beforeCount || 0 };
  }

  /**
   * Get filtered Sage reports with pagination
   */
  async getFilteredSageReports(filters: {
    search?: string;
    company?: string;
    supplier?: string;
    minPrice?: string;
    maxPrice?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const {
      search = '',
      company = '',
      supplier = '',
      minPrice = '',
      maxPrice = '',
      page = 1,
      limit = 50,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = filters;

    const offset = (page - 1) * limit;

    // Build query
    let query = db.from('sage_reports').select('*', { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`stock_code.ilike.%${search}%,bin_name.ilike.%${search}%,product_group_code.ilike.%${search}%`);
    }

    if (company) {
      query = query.ilike('company_name', `%${company}%`);
    }

    if (supplier) {
      query = query.ilike('supplier_account_number', `%${supplier}%`);
    }

    if (minPrice || maxPrice) {
      if (minPrice) query = query.gte('price', parseFloat(minPrice));
      if (maxPrice) query = query.lte('price', parseFloat(maxPrice));
    }

    // Apply sorting
    const orderColumn = sortBy === 'createdAt' ? 'created_at' :
      sortBy === 'updatedAt' ? 'updated_at' :
        sortBy === 'stockCode' ? 'stock_code' :
          sortBy === 'standardCost' ? 'standard_cost' :
            sortBy === 'companyName' ? 'company_name' :
              sortBy;

    query = query.order(orderColumn, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const { data: items, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch Sage reports: ${error.message}`);
    }

    return {
      items: items || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    };
  }
}

export const sageImportService = new SageImportService();
