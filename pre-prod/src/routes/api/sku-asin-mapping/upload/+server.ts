import { json } from '@sveltejs/kit';
import { skuAsinImportService } from '$lib/services/skuAsinImportService';
import fs from 'fs';
import path from 'path';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      return json({ success: false, error: 'Only CSV files are allowed' }, { status: 400 });
    }

    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      return json({ success: false, error: 'File size must be less than 50MB' }, { status: 400 });
    }

    // Read file content
    const content = await file.text();

    // Save to temporary file
    const tempDir = './temp';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, `sku_asin_mapping_${Date.now()}_${file.name}`);
    fs.writeFileSync(tempFilePath, content);

    try {
      // Import mappings with the service - this will handle file storage and data import
      const result = await skuAsinImportService.importMappings(tempFilePath);

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      if (!result.success) {
        return json({
          success: false,
          error: result.errors?.[0] || 'Import failed'
        }, { status: 500 });
      }

      return json({
        success: true,
        message: `File uploaded successfully. Imported ${result.imported} records with ${result.errors.length} errors.`,
        filename: result.filename,
        imported: result.imported,
        errors: result.errors
      });

    } catch (serviceError) {
      // Clean up temp file on error
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      throw serviceError;
    }

  } catch (error) {
    console.error('Upload error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
