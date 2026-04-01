import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sageImportService } from '$lib/services/sageImportService';
import { linnworksCompositionService } from '$lib/services/linnworksCompositionService';

// Helper function to find column index with flexible naming
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const index = headers.findIndex(h => h.trim().toLowerCase() === name.toLowerCase());
    if (index !== -1) return index;
  }
  return -1;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return json(
        { success: false, error: 'Only CSV files are supported' },
        { status: 400 }
      );
    }

    const csvText = await file.text();

    if (!csvText.trim()) {
      return json(
        { success: false, error: 'File is empty' },
        { status: 400 }
      );
    }

    // Parse CSV
    const lines = csvText.trim().split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return json({
        success: false,
        error: 'Empty file'
      }, { status: 400 });
    }

    // Get headers from first line and normalize them
    // Handle potential quotes in headers
    const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    const columnMap = {
      // User's file uses "Code"
      stockCode: findColumnIndex(rawHeaders, ['Code', 'Stock Code', 'StockItem']),
      // User's file uses "Standard Cost"
      standardCost: findColumnIndex(rawHeaders, ['Standard Cost', 'StandardCost', 'Cost']),
      // Optional: Tax Rate
      taxRate: findColumnIndex(rawHeaders, ['Tax Rate', 'TaxRate', 'Tax', 'Vat Rate', 'Vat'])
    };

    if (columnMap.stockCode === -1 || columnMap.standardCost === -1) {
      return json({
        success: false,
        error: 'Required columns not found. Expected: "Code" and "Standard Cost"'
      }, { status: 400 });
    }

    const batch = [];
    // Start from line 1 (skipping header)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const columns = parseCsvLine(line);

      if (columns.length <= Math.max(columnMap.stockCode, columnMap.standardCost)) continue;

      const stockCode = columns[columnMap.stockCode]?.trim();
      const standardCostStr = columns[columnMap.standardCost]?.replace(/[^\d.-]/g, '');

      // Parse tax rate if column exists
      let taxRate = undefined;
      if (columnMap.taxRate !== -1 && columns[columnMap.taxRate]) {
        const taxStr = columns[columnMap.taxRate].replace(/[^\d.-]/g, '');
        if (taxStr) {
          taxRate = parseFloat(taxStr);
        }
      }

      if (stockCode) {
        batch.push({
          stockCode,
          standardCost: standardCostStr ? parseFloat(standardCostStr) : 0,
          taxRate // Will be undefined if not found, preserving existing value
        });
      }
    }

    const result = await sageImportService.importSageData(batch);

    // After successful import, regenerate linnworks composition summaries
    if (result.success) {
      console.log('Sage data imported successfully, regenerating composition summaries...');
      try {
        const summaryResult = await linnworksCompositionService.generateSummary();
        console.log('Composition summary regeneration result:', summaryResult);
      } catch (e) {
        console.error('Failed to regenerate composition summaries after import:', e);
      }
    }

    return json(result);

  } catch (error) {
    console.error('Upload error:', error);
    return json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
};

// Start logic for parsing CSV line
function parseCsvLine(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Start or end of quoted field
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
