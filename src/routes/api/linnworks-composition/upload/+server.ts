import { json } from '@sveltejs/kit';
import { db } from '$lib/supabaseServer';

// Helper function to find column index with flexible naming
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const index = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
    if (index !== -1) return index;
  }
  return -1;
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return json({
        success: false,
        error: 'No file provided'
      }, { status: 400 });
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return json({
        success: false,
        error: 'Only CSV files are supported'
      }, { status: 400 });
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return json({
        success: false,
        error: 'File size must be less than 10MB'
      }, { status: 400 });
    }

    const text = await file.text();

    // Parse CSV
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return json({
        success: false,
        error: 'Empty file'
      }, { status: 400 });
    }

    // Get headers from first line and normalize them
    const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const headers = rawHeaders.map(h => h.trim());

    // Create a flexible column mapping to handle different naming conventions
    const columnMap = {
      parentSku: findColumnIndex(headers, ['ParentSKU', 'Parent SKU', 'parent_sku', 'parentSku', 'Parent_SKU']),
      parentTitle: findColumnIndex(headers, ['ParentTitle', 'Parent Title', 'parent_title', 'parentTitle', 'Parent_Title']),
      childSku: findColumnIndex(headers, ['ChildSKU', 'Child SKU', 'child_sku', 'childSku', 'Child_SKU']),
      childTitle: findColumnIndex(headers, ['ChildTitle', 'Child Title', 'child_title', 'childTitle', 'Child_Title']),
      quantity: findColumnIndex(headers, ['Quantity', 'quantity', 'qty', 'Qty', 'QTY'])
    };

    // Check if all required columns are found
    const missingColumns = Object.entries(columnMap).filter(([key, index]) => index === -1);
    if (missingColumns.length > 0) {
      return json({
        success: false,
        error: `Missing required columns. Expected columns (any case): ParentSKU, ParentTitle, ChildSKU, ChildTitle, Quantity. Found headers: ${headers.join(', ')}`
      }, { status: 400 });
    }

    // Convert CSV to JSON using the column mapping
    const data = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      // Split CSV line, handling quoted values
      const values = parseCsvLine(line);

      if (values.length !== headers.length) {
        errors.push(`Row ${i + 1}: Expected ${headers.length} columns, got ${values.length}`);
        continue;
      }

      // Map values to standardized field names
      const item = {
        ParentSKU: values[columnMap.parentSku]?.trim() || '',
        ParentTitle: values[columnMap.parentTitle]?.trim() || '',
        ChildSKU: values[columnMap.childSku]?.trim() || '',
        ChildTitle: values[columnMap.childTitle]?.trim() || '',
        Quantity: values[columnMap.quantity]?.trim() || ''
      };

      // Validate required fields
      const requiredFields = ['ParentSKU', 'ParentTitle', 'ChildSKU', 'ChildTitle', 'Quantity'];
      const missingRequiredFields = requiredFields.filter(field => !item[field as keyof typeof item]);
      if (missingRequiredFields.length > 0) {
        errors.push(`Row ${i + 1}: Missing values for required fields: ${missingRequiredFields.join(', ')}`);
        continue;
      }

      // Validate and convert quantity
      const quantity = parseFloat(item.Quantity);
      if (isNaN(quantity) || quantity < 0) {
        errors.push(`Row ${i + 1}: Invalid quantity value "${item.Quantity}". Must be a positive number.`);
        continue;
      }
      item.Quantity = quantity.toString();

      data.push(item);
    }

    // If there are too many errors, return them
    if (errors.length > 0 && errors.length >= lines.length / 2) {
      return json({
        success: false,
        error: 'Too many errors in CSV file',
        errorDetails: errors.slice(0, 20) // Return first 20 errors
      }, { status: 400 });
    }

    if (data.length === 0) {
      return json({
        success: false,
        error: 'No valid data to process'
      }, { status: 400 });
    }

    try {
      // Clear existing data
      await db.from('linnworks_composition').delete().gte('created_at', '1900-01-01');

      // Transform data for Supabase (snake_case columns)
      const supabaseData = data.map(item => ({
        parent_sku: item.ParentSKU,
        parent_title: item.ParentTitle,
        child_sku: item.ChildSKU,
        child_title: item.ChildTitle,
        quantity: item.Quantity
      }));

      // Insert in batches for better performance
      const batchSize = 1000;
      const batches = [];
      for (let i = 0; i < supabaseData.length; i += batchSize) {
        batches.push(supabaseData.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const { error } = await db
          .from('linnworks_composition')
          .insert(batch);

        if (error) {
          throw new Error(`Failed to insert batch: ${error.message}`);
        }
      }

      return json({
        success: true,
        message: `Successfully processed ${data.length} rows.`,
        errorCount: errors.length,
        errorDetails: errors.slice(0, 20)
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      return json({
        success: false,
        error: 'Failed to save data to the database.'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Linnworks Composition upload error:', error);
    return json({
      success: false,
      error: 'Failed to process file',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

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

  // Add the last field
  result.push(current.trim());

  return result;
}

// Helper function to calculate statistics
function calculateStats(data: any[]) {
  const parentSkus = new Set();
  const childSkus = new Set();
  let totalQuantity = 0;

  for (const item of data) {
    if (item.ParentSKU) {
      parentSkus.add(item.ParentSKU);
    }
    if (item.ChildSKU) {
      childSkus.add(item.ChildSKU);
    }
    if (typeof item.Quantity === 'number') {
      totalQuantity += item.Quantity;
    }
  }

  return {
    totalRecords: data.length,
    uniqueParentSkus: parentSkus.size,
    uniqueChildSkus: childSkus.size,
    totalQuantity: Math.round(totalQuantity * 100) / 100 // Round to 2 decimal places
  };
}
