import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url, fetch }) => {
  // Get URL parameters for initial page load
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const search = url.searchParams.get('search') || '';
  const tracked = url.searchParams.get('tracked') || '';
  const minPrice = url.searchParams.get('minPrice') || '';
  const maxPrice = url.searchParams.get('maxPrice') || '';
  const sortBy = url.searchParams.get('sortBy') || 'createdAt';
  const sortOrder = url.searchParams.get('sortOrder') || 'desc';
  const priceRange = url.searchParams.get('priceRange') || '';

  // Build query parameters
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(search && { search }),
    ...(tracked && { tracked }),
    ...(minPrice && { minPrice }),
    ...(maxPrice && { maxPrice }),
    ...(sortBy && { sortBy }),
    ...(sortOrder && { sortOrder })
  });

  // Handle price range filter
  if (priceRange && !minPrice && !maxPrice) {
    if (priceRange === '250+') {
      params.set('minPrice', '250');
    } else {
      const [min, max] = priceRange.split('-');
      if (min) params.set('minPrice', min);
      if (max) params.set('maxPrice', max);
    }
  }

  try {
    // Load inventory data
    const inventoryResponse = await fetch(`/api/inventory?${params}`);
    const inventoryData = inventoryResponse.ok ? await inventoryResponse.json() : null;

    // Load stats
    const statsResponse = await fetch('/api/inventory?action=stats');
    const statsData = statsResponse.ok ? await statsResponse.json() : null;

    return {
      inventory: inventoryData?.items || [],
      totalPages: inventoryData?.pagination?.pages || 1,
      totalItems: inventoryData?.pagination?.total || 0,
      stats: statsData || null,
      // Pass URL params to component
      searchParams: {
        page,
        limit,
        search,
        tracked,
        minPrice,
        maxPrice,
        sortBy,
        sortOrder,
        priceRange
      },
      error: inventoryData === null ? 'Failed to load inventory' : null
    };
  } catch (error) {
    console.error('Error loading inventory data:', error);
    return {
      inventory: [],
      totalPages: 1,
      totalItems: 0,
      stats: null,
      searchParams: {
        page,
        limit,
        search,
        tracked,
        minPrice,
        maxPrice,
        sortBy,
        sortOrder,
        priceRange
      },
      error: 'Failed to load inventory data'
    };
  }
};
