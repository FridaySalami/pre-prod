import { json } from '@sveltejs/kit';
import { amazonImportService } from '$lib/services/amazonImportService';
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

    // Read file content
    const content = await file.text();

    // Save to temporary file
    const tempDir = './temp';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, `upload_${Date.now()}_${file.name}`);
    fs.writeFileSync(tempFilePath, content);

    try {
      // Import the file
      const result = await amazonImportService.importListings(tempFilePath, 'csv');

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      return json(result);
    } catch (error) {
      // Clean up temp file on error
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      throw error;
    }

  } catch (error) {
    console.error('File upload error:', error);
    return json({
      success: false,
      error: 'Failed to process file upload',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
