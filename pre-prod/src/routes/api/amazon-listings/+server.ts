import { json } from '@sveltejs/kit';
import { amazonImportService } from '$lib/services/amazonImportService';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
  try {
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || '';
    const shippingGroup = url.searchParams.get('shippingGroup') || '';
    const minPrice = url.searchParams.get('minPrice') ? parseFloat(url.searchParams.get('minPrice')!) : undefined;
    const maxPrice = url.searchParams.get('maxPrice') ? parseFloat(url.searchParams.get('maxPrice')!) : undefined;
    const sortBy = url.searchParams.get('sortBy') || 'createdAt';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    const dateFilter = url.searchParams.get('dateFilter') || '';
    const priceRange = url.searchParams.get('priceRange') || '';

    const filters = {
      ...(search && { search }),
      ...(status && { status }),
      ...(shippingGroup && { shippingGroup }),
      ...(minPrice && { minPrice }),
      ...(maxPrice && { maxPrice }),
      ...(dateFilter && { dateFilter }),
      ...(priceRange && { priceRange })
    };

    const result = await amazonImportService.getListings(page, limit, filters, sortBy, sortOrder);

    return json(result);

  } catch (error) {
    console.error('Amazon listings API error:', error);
    return json({
      error: 'Failed to fetch Amazon listings',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
  try {
    const { action, filePath, fileType } = await request.json();

    if (action === 'import') {
      const result = await amazonImportService.importListings(
        filePath || './amazon-listings.csv',
        fileType || 'csv'
      );

      return json(result);
    }

    if (action === 'stats') {
      const stats = await amazonImportService.getStats();
      return json(stats);
    }

    if (action === 'clear') {
      const result = await amazonImportService.clearAllListings();
      return json(result);
    }

    return json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Amazon listings API error:', error);
    return json({
      error: 'Failed to process request',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
