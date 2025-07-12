import { json } from '@sveltejs/kit';
import { skuAsinImportService } from '$lib/services/skuAsinImportService';
import { supabaseAdmin } from '$lib/supabaseAdmin';

export async function GET({ url }: { url: URL }) {
  try {
    // Check if we're querying for mappings or files
    const queryType = url.searchParams.get('type') || 'files';

    if (queryType === 'mappings') {
      // Get SKU-ASIN mappings with pagination
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const search = url.searchParams.get('search') || '';
      const status = url.searchParams.get('status') || '';
      const fulfillmentChannel = url.searchParams.get('fulfillmentChannel') || '';
      const minPrice = url.searchParams.get('minPrice') ? parseFloat(url.searchParams.get('minPrice')!) : undefined;
      const maxPrice = url.searchParams.get('maxPrice') ? parseFloat(url.searchParams.get('maxPrice')!) : undefined;
      const sortBy = url.searchParams.get('sortBy') || 'created_at';
      const sortOrder = url.searchParams.get('sortOrder') || 'desc';

      const filters = {
        ...(search && { search }),
        ...(status && { status }),
        ...(fulfillmentChannel && { fulfillmentChannel }),
        ...(minPrice && { minPrice }),
        ...(maxPrice && { maxPrice })
      };

      const result = await skuAsinImportService.getMappings(page, limit, filters, sortBy, sortOrder);
      return json(result);
    } else {
      // Get import history
      try {
        const { data: imports, error } = await supabaseAdmin
          .from('sku_asin_mapping_imports')
          .select('*')
          .order('import_date', { ascending: false });

        if (error) throw error;

        // Also get stats
        const stats = await skuAsinImportService.getStats();

        return json({
          success: true,
          imports: imports || [],
          totalImports: imports?.length || 0,
          totalMappings: stats.totalMappings
        });
      } catch (error) {
        return json({
          success: false,
          error: 'Failed to fetch import history'
        }, { status: 500 });
      }
    }
  } catch (error) {
    console.error('Get files error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function POST({ request }: { request: Request }) {
  try {
    const { action } = await request.json();

    switch (action) {
      case 'stats':
        try {
          // Get mapping stats
          const stats = await skuAsinImportService.getStats();
          return json(stats);
        } catch (err) {
          return json({
            success: false,
            error: err instanceof Error ? err.message : 'Failed to get stats'
          }, { status: 500 });
        }

      case 'clear':
        try {
          // Clear mappings data
          const result = await skuAsinImportService.clearAllMappings();
          return json({
            success: true,
            message: result.message
          });
        } catch (err) {
          return json({
            success: false,
            error: err instanceof Error ? err.message : 'Failed to clear data'
          }, { status: 500 });
        }

      // No more file delete operation since we're not storing files

      default:
        return json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('API error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
