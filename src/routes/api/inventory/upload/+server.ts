import { json } from '@sveltejs/kit';
import { InventoryImportService } from '$lib/services/inventoryImportService.js';
import { supabaseAdmin } from '$lib/supabaseAdmin.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sessionId = formData.get('sessionId') as string;

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

    // Validate file size (50MB limit for large files)
    if (file.size > 50 * 1024 * 1024) {
      return json({
        success: false,
        error: 'File size must be less than 50MB'
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

    // Get headers from first line
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

    // Convert CSV to JSON
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      if (values.length === headers.length) {
        const item: any = {};
        headers.forEach((header, index) => {
          item[header] = values[index];
        });
        data.push(item);
      }
    }

    // Create upload session for progress tracking
    let actualSessionId = sessionId;
    if (!actualSessionId) {
      actualSessionId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Create import record for progress tracking
    const { error: recordError } = await supabaseAdmin
      .from('import_records')
      .insert({
        session_id: actualSessionId,
        import_type: 'inventory',
        file_name: file.name,
        file_size: file.size,
        total_records: data.length,
        processed_records: 0,
        imported_records: 0,
        updated_records: 0,
        error_count: 0,
        status: 'processing',
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (recordError) {
      console.error('Error creating import record:', recordError);
    }

    // Process the data with progress tracking
    const inventoryService = new InventoryImportService();
    const result = await inventoryService.importInventoryData(data, actualSessionId);

    // Determine success based on whether any items were imported, not just error count
    const overallSuccess = result.success && (result.imported > 0 || result.updated > 0);
    const finalStatus = overallSuccess ? 'completed' : 'error';

    // Update import record with final results
    const { error: updateError } = await supabaseAdmin
      .from('import_records')
      .update({
        processed_records: result.total,
        imported_records: result.imported,
        updated_records: result.updated,
        error_count: result.errors.length,
        status: finalStatus,
        completed_at: new Date().toISOString(),
        error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
        updated_at: new Date().toISOString()
      })
      .eq('session_id', actualSessionId);

    if (updateError) {
      console.error('Error updating import record:', updateError);
    }

    return json({
      success: overallSuccess,
      data: result,
      filename: file.name,
      recordCount: data.length,
      sessionId: actualSessionId,
      message: overallSuccess
        ? `Successfully imported ${result.imported} items${result.updated > 0 ? `, updated ${result.updated}` : ''}${result.errors.length > 0 ? ` with ${result.errors.length} errors` : ''}`
        : `Import failed: ${result.errors.length} errors occurred`
    });

  } catch (error) {
    console.error('File upload error:', error);

    // Try to extract sessionId for error logging
    let sessionId: string | null = null;
    try {
      const errorFormData = await request.formData();
      sessionId = errorFormData.get('sessionId') as string;
    } catch {
      // Ignore formData parsing errors in error handler
    }

    if (sessionId) {
      try {
        await supabaseAdmin
          .from('import_records')
          .update({
            status: 'error',
            completed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : 'Unknown error',
            updated_at: new Date().toISOString()
          })
          .eq('session_id', sessionId);
      } catch (historyError) {
        console.error('Error updating import record:', historyError);
      }
    }

    return json({
      success: false,
      error: 'Failed to process file',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
