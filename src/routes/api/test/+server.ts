import { json } from '@sveltejs/kit';
import { amazonImportService } from '$lib/services/amazonImportService';
import { inventoryImportService } from '$lib/services/inventoryImportService';
import { supabaseAdmin } from '$lib/supabaseAdmin';
import fs from 'fs';
import path from 'path';

/** @type {import('./$types').RequestHandler} */
export async function GET() {
  try {
    // Test database connection and get basic stats
    const [
      { count: productCount, error: productError },
      { count: importCount, error: importError },
      { count: calculationCount, error: calculationError },
      { count: amazonListingCount, error: amazonError }
    ] = await Promise.all([
      supabaseAdmin.from('products').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('import_records').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('price_calculations').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('amazon_listings').select('*', { count: 'exact', head: true })
    ]);

    if (productError || importError || calculationError || amazonError) {
      throw new Error('Database query failed');
    }

    const stats = {
      products: productCount || 0,
      imports: importCount || 0,
      calculations: calculationCount || 0,
      amazonListings: amazonListingCount || 0,
      status: 'connected'
    };

    return json(stats);

  } catch (error) {
    console.error('Database test failed:', error);
    return json({
      error: 'Database connection failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
  try {
    const { action, filePath, source, fileType } = await request.json();

    if (action === 'import') {
      // Test inventory import functionality using a test CSV file
      const testFilePath = filePath || './test-inventory-small.csv';

      // Check if file exists
      if (!fs.existsSync(testFilePath)) {
        return json({
          success: false,
          error: 'Test file not found',
          message: `File ${testFilePath} does not exist`
        }, { status: 400 });
      }

      // Read and parse CSV file
      const csvContent = fs.readFileSync(testFilePath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());

      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const item: any = {};
        headers.forEach((header, index) => {
          item[header] = values[index] || '';
        });
        return item;
      });

      // Import using inventory import service
      const result = await inventoryImportService.importInventoryData(data);

      return json({
        success: result.success,
        imported: result.imported,
        updated: result.updated,
        errors: result.errors,
        total: result.total,
        message: `Import completed: ${result.imported} items imported, ${result.updated} updated, ${result.errors.length} errors`
      });
    }

    if (action === 'import-amazon') {
      // Test Amazon import functionality
      const testFilePath = filePath || './amazon-sample.csv';

      // Check if file exists
      if (!fs.existsSync(testFilePath)) {
        return json({
          success: false,
          error: 'Test file not found',
          message: `File ${testFilePath} does not exist`
        }, { status: 400 });
      }

      const result = await amazonImportService.importListings(
        testFilePath,
        fileType || 'csv'
      );

      return json({
        success: result.success,
        imported: result.imported,
        errors: result.errors,
        duration: result.duration,
        message: `Amazon import completed: ${result.imported} listings imported in ${result.duration}ms`
      });
    }

    return json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Import test failed:', error);
    return json({
      error: 'Import failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
