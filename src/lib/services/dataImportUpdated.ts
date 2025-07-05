/**
 * Automated data import service for Sage/Linnworks
 * Updated for new Prisma schema
 */

import prisma from '../prisma';
import fs from 'fs';
import path from 'path';

export interface ImportConfig {
  source: 'sage' | 'linnworks';
  filePath: string;
  mapping: {
    [key: string]: string; // Maps JSON field to database field
  };
}

export class DataImportService {

  /**
   * Import products from JSON file
   */
  async importProducts(config: ImportConfig): Promise<{
    success: boolean;
    imported: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let imported = 0;

    try {
      // Read JSON file
      const jsonData = JSON.parse(fs.readFileSync(config.filePath, 'utf8'));

      console.log(`📦 Starting import of ${jsonData.length} products from ${config.source}`);

      // Create import record
      const importRecord = await prisma.importRecord.create({
        data: {
          filename: path.basename(config.filePath),
          fileType: config.source,
          status: 'processing',
          recordsTotal: jsonData.length
        }
      });

      // Process each product
      for (const item of jsonData) {
        try {
          // Map fields according to config
          const productData = this.mapProductData(item, config.mapping);

          // Validate required fields
          if (!productData.sku) {
            errors.push(`Missing SKU for product: ${JSON.stringify(item)}`);
            continue;
          }

          // Upsert product (insert or update)
          await prisma.product.upsert({
            where: { sku: productData.sku },
            update: {
              ...productData,
              updatedAt: new Date()
            },
            create: {
              ...productData,
              imports: {
                connect: { id: importRecord.id }
              }
            }
          });

          imported++;

          // Log progress every 100 items
          if (imported % 100 === 0) {
            console.log(`📊 Imported ${imported}/${jsonData.length} products`);
          }

        } catch (error) {
          const errorMsg = `Error importing product ${item.sku || 'unknown'}: ${error}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Update import record
      await prisma.importRecord.update({
        where: { id: importRecord.id },
        data: {
          status: errors.length > 0 ? 'completed' : 'completed',
          recordsProcessed: imported,
          recordsFailed: errors.length,
          errors: errors.length > 0 ? JSON.stringify(errors) : null
        }
      });

      console.log(`✅ Import completed: ${imported} products imported, ${errors.length} errors`);

      return {
        success: true,
        imported,
        errors
      };

    } catch (error) {
      console.error('❌ Import failed:', error);
      return {
        success: false,
        imported: 0,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Map raw data to product model
   */
  private mapProductData(item: any, mapping: { [key: string]: string }): any {
    const productData: any = {};

    // Apply field mappings
    for (const [jsonField, dbField] of Object.entries(mapping)) {
      if (item[jsonField] !== undefined) {
        productData[dbField] = item[jsonField];
      }
    }

    // Type conversions
    if (productData.cost) productData.cost = parseFloat(productData.cost);
    if (productData.listPrice) productData.listPrice = parseFloat(productData.listPrice);
    if (productData.weight) productData.weight = parseFloat(productData.weight);
    if (productData.stockLevel) productData.stockLevel = parseInt(productData.stockLevel);
    if (productData.reorderLevel) productData.reorderLevel = parseInt(productData.reorderLevel);
    if (productData.active !== undefined) productData.active = Boolean(productData.active);

    return productData;
  }

  /**
   * Get predefined mapping configurations
   */
  static getMapping(source: 'sage' | 'linnworks'): { [key: string]: string } {
    const mappings = {
      sage: {
        'Product_Code': 'sku',
        'Product_Name': 'name',
        'Category': 'category',
        'Supplier': 'supplier',
        'Cost_Price': 'cost',
        'Selling_Price': 'listPrice',
        'Weight': 'weight',
        'Description': 'description',
        'Stock_Level': 'stockLevel',
        'Reorder_Level': 'reorderLevel',
        'Active': 'active'
      },
      linnworks: {
        'ItemNumber': 'sku',
        'ItemTitle': 'name',
        'CategoryName': 'category',
        'PurchasePrice': 'cost',
        'RetailPrice': 'listPrice',
        'Weight': 'weight',
        'ItemDescription': 'description',
        'StockLevel': 'stockLevel',
        'MinimumLevel': 'reorderLevel',
        'IsActive': 'active'
      }
    };

    return mappings[source] || {};
  }

  /**
   * Get import history
   */
  async getImportHistory() {
    return prisma.importRecord.findMany({
      orderBy: { importedAt: 'desc' },
      take: 20,
      include: {
        products: {
          select: {
            sku: true,
            name: true
          },
          take: 5
        }
      }
    });
  }
}

/**
 * Convenience function to run imports
 */
export async function importFromFile(
  filePath: string,
  source: 'sage' | 'linnworks' = 'sage'
): Promise<{ success: boolean; imported: number; errors: string[] }> {
  const service = new DataImportService();
  const mapping = DataImportService.getMapping(source);

  return await service.importProducts({
    source,
    filePath,
    mapping
  });
}

/**
 * Bulk import multiple files
 */
export async function bulkImport(
  files: Array<{ path: string; source: 'sage' | 'linnworks' }>
): Promise<{ totalImported: number; totalErrors: number; results: any[] }> {
  const results = [];
  let totalImported = 0;
  let totalErrors = 0;

  console.log(`🚀 Starting bulk import of ${files.length} files`);

  for (const file of files) {
    console.log(`📄 Processing ${file.path}...`);
    const result = await importFromFile(file.path, file.source);

    results.push({
      file: file.path,
      source: file.source,
      ...result
    });

    totalImported += result.imported;
    totalErrors += result.errors.length;
  }

  console.log(`🎉 Bulk import complete: ${totalImported} products imported, ${totalErrors} errors`);

  return {
    totalImported,
    totalErrors,
    results
  };
}
