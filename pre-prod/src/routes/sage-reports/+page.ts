import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url, fetch }) => {
	// Get URL parameters for initial page load
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '50');
	const search = url.searchParams.get('search') || '';
	const company = url.searchParams.get('company') || '';
	const supplier = url.searchParams.get('supplier') || '';
	const minPrice = url.searchParams.get('minPrice') || '';
	const maxPrice = url.searchParams.get('maxPrice') || '';
	const sortBy = url.searchParams.get('sortBy') || 'created_at';
	const sortOrder = url.searchParams.get('sortOrder') || 'desc';

	// Build query parameters
	const params = new URLSearchParams({
		page: page.toString(),
		limit: limit.toString(),
		...(search && { search }),
		...(company && { company }),
		...(supplier && { supplier }),
		...(minPrice && { minPrice }),
		...(maxPrice && { maxPrice }),
		...(sortBy && { sortBy }),
		...(sortOrder && { sortOrder })
	});

	try {
		// Load Sage report data
		const sageDataResponse = await fetch(`/api/sage-reports?${params}`);
		const sageData = sageDataResponse.ok ? await sageDataResponse.json() : null;

		// Load stats
		const statsResponse = await fetch('/api/sage-reports?action=stats');
		const statsData = statsResponse.ok ? await statsResponse.json() : null;

		return {
			sageData: sageData?.items || [],
			totalPages: sageData?.pagination?.pages || 1,
			totalItems: sageData?.pagination?.total || 0,
			stats: statsData || null,
			// Pass URL params to component
			searchParams: {
				page,
				limit,
				search,
				company,
				supplier,
				minPrice,
				maxPrice,
				sortBy,
				sortOrder
			},
			error: sageData === null ? 'Failed to load Sage report data' : null
		};
	} catch (error) {
		console.error('Error loading Sage report data:', error);
		return {
			sageData: [],
			totalPages: 1,
			totalItems: 0,
			stats: null,
			searchParams: {
				page,
				limit,
				search,
				company,
				supplier,
				minPrice,
				maxPrice,
				sortBy,
				sortOrder
			},
			error: 'Failed to load Sage report data'
		};
	}
};
