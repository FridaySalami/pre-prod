import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sageImportService } from '$lib/services/sageImportService';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const action = url.searchParams.get('action');

		if (action === 'stats') {
			const stats = await sageImportService.getSageStats();
			return json(stats);
		}

		// Default: get filtered Sage reports
		const filters = {
			search: url.searchParams.get('search') || '',
			company: url.searchParams.get('company') || '',
			supplier: url.searchParams.get('supplier') || '',
			minPrice: url.searchParams.get('minPrice') || '',
			maxPrice: url.searchParams.get('maxPrice') || '',
			page: parseInt(url.searchParams.get('page') || '1'),
			limit: parseInt(url.searchParams.get('limit') || '50'),
			sortBy: url.searchParams.get('sortBy') || 'createdAt',
			sortOrder: url.searchParams.get('sortOrder') || 'desc'
		};

		const result = await sageImportService.getFilteredSageReports(filters);
		return json(result);

	} catch (error) {
		console.error('Error in Sage reports API:', error);
		return json(
			{ error: 'Failed to fetch Sage report data' },
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { data } = await request.json();

		if (!data || !Array.isArray(data)) {
			return json(
				{ error: 'Invalid data format. Expected array of Sage report items.' },
				{ status: 400 }
			);
		}

		const result = await sageImportService.importSageData(data);
		return json(result);

	} catch (error) {
		console.error('Error importing Sage data:', error);
		return json(
			{ error: 'Failed to import Sage data' },
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async ({ url }) => {
	try {
		const action = url.searchParams.get('action');

		if (action === 'clear') {
			const result = await sageImportService.clearAllSageData();
			return json(result);
		}

		return json(
			{ error: 'Invalid action' },
			{ status: 400 }
		);

	} catch (error) {
		console.error('Error in Sage reports DELETE:', error);
		return json(
			{ error: 'Failed to delete Sage data' },
			{ status: 500 }
		);
	}
};
