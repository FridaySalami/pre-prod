import { json } from '@sveltejs/kit';
import { inventoryImportService } from '$lib/services/inventoryImportService';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
  try {
    const action = url.searchParams.get('action');

    if (action === 'stats') {
      const stats = await inventoryImportService.getInventoryStats();
      return json(stats);
    }

    if (action === 'clear') {
      const result = await inventoryImportService.clearAllInventory();
      return json({
        success: true,
        message: `Cleared ${result.deleted} inventory items`
      });
    }

    // Default: get filtered inventory with pagination
    const filters = {
      search: url.searchParams.get('search') || '',
      tracked: url.searchParams.get('tracked') || '',
      minPrice: url.searchParams.get('minPrice') || '',
      maxPrice: url.searchParams.get('maxPrice') || '',
      page: parseInt(url.searchParams.get('page') || '1'),
      limit: parseInt(url.searchParams.get('limit') || '50'),
      sortBy: url.searchParams.get('sortBy') || 'createdAt',
      sortOrder: url.searchParams.get('sortOrder') || 'desc'
    };

    const result = await inventoryImportService.getFilteredInventory(filters);
    return json(result);

  } catch (error) {
    console.error('Inventory API error:', error);
    return json({
      error: 'Failed to process request',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
  try {
    const { data } = await request.json();

    if (!data || !Array.isArray(data)) {
      return json({
        success: false,
        error: 'Invalid data format. Expected array of inventory items.'
      }, { status: 400 });
    }

    const result = await inventoryImportService.importInventoryData(data);

    return json(result);

  } catch (error) {
    console.error('Inventory import error:', error);
    return json({
      success: false,
      error: 'Import failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
