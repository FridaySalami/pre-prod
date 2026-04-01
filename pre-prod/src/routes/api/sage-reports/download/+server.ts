import type { RequestHandler } from './$types';
import { sageImportService } from '$lib/services/sageImportService';

export const GET: RequestHandler = async ({ url }) => {
	try {
		// Get filter parameters
		const filters = {
			search: url.searchParams.get('search') || '',
			company: url.searchParams.get('company') || '',
			supplier: url.searchParams.get('supplier') || '',
			minPrice: url.searchParams.get('minPrice') || '',
			maxPrice: url.searchParams.get('maxPrice') || '',
			sortBy: url.searchParams.get('sortBy') || 'createdAt',
			sortOrder: url.searchParams.get('sortOrder') || 'desc',
			// Get all records for download
			page: 1,
			limit: 999999
		};

		const { items } = await sageImportService.getFilteredSageReports(filters);

		// Create CSV content with proper column headers matching Sage format
		const csvHeaders = [
			'StockItems.Code',
			'BinItems.BinName',
			'StockItems.StandardCost',
			'StockItems.TaxRate',
			'StockItemPrices.Price',
			'ProductGroups.Code',
			'StockItems.BOMItemTypeID',
			'SYSCompanies.CompanyName',
			'PLSupplierAccounts.SupplierAccountNumber'
		];

		const csvRows = items.map(item => [
			item.stockCode || '',
			item.binName || '',
			item.standardCost?.toString() || '',
			item.taxRate?.toString() || '',
			item.price?.toString() || '',
			item.productGroupCode || '',
			item.bomItemTypeId || '',
			item.companyName || '',
			item.supplierAccountNumber || ''
		]);

		// Combine headers and rows
		const csvContent = [
			csvHeaders.join(','),
			...csvRows.map(row => row.map(field => `"${field}"`).join(','))
		].join('\n');

		// Return CSV file
		return new Response(csvContent, {
			headers: {
				'Content-Type': 'text/csv',
				'Content-Disposition': `attachment; filename="sage-reports-${new Date().toISOString().split('T')[0]}.csv"`
			}
		});

	} catch (error) {
		console.error('Error generating Sage reports CSV:', error);
		return new Response('Error generating CSV', { status: 500 });
	}
};
