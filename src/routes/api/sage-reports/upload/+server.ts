import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sageImportService } from '$lib/services/sageImportService';

// Helper function to find column index with flexible naming
function findColumnIndex(headers: string[], possibleNames: string[]): number {
	for (const name of possibleNames) {
		const index = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
		if (index !== -1) return index;
	}
	return -1;
}

// Helper function to parse CSV line, handling quoted values
function parseCsvLine(line: string): string[] {
	const result = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		const nextChar = line[i + 1];

		if (char === '"') {
			if (inQuotes && nextChar === '"') {
				// Escaped quote
				current += '"';
				i++; // Skip next quote
			} else {
				// Start or end of quoted field
				inQuotes = !inQuotes;
			}
		} else if (char === ',' && !inQuotes) {
			// Field separator
			result.push(current.trim());
			current = '';
		} else {
			current += char;
		}
	}

	// Add the last field
	result.push(current.trim());
	return result;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File;

		if (!file) {
			return json(
				{ success: false, error: 'No file provided' },
				{ status: 400 }
			);
		}

		if (!file.name.toLowerCase().endsWith('.csv')) {
			return json(
				{ success: false, error: 'Only CSV files are supported' },
				{ status: 400 }
			);
		}

		// Validate file size (10MB limit)
		if (file.size > 10 * 1024 * 1024) {
			return json({
				success: false,
				error: 'File size must be less than 10MB'
			}, { status: 400 });
		}

		const csvText = await file.text();

		if (!csvText.trim()) {
			return json(
				{ success: false, error: 'File is empty' },
				{ status: 400 }
			);
		}

		// Parse CSV
		const lines = csvText.trim().split('\n').filter(line => line.trim());
		if (lines.length === 0) {
			return json({
				success: false,
				error: 'Empty file'
			}, { status: 400 });
		}

		// Get headers from first line and normalize them
		const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
		const headers = rawHeaders.map(h => h.trim());

		// Create a flexible column mapping to handle different naming conventions
		const columnMap = {
			stockCode: findColumnIndex(headers, ['StockItems.Code', 'Stock Code', 'stock_code', 'stockCode', 'SKU', 'sku']),
			binName: findColumnIndex(headers, ['BinItems.BinName', 'Bin Name', 'bin_name', 'binName']),
			standardCost: findColumnIndex(headers, ['StockItems.StandardCost', 'Standard Cost', 'standard_cost', 'standardCost']),
			taxRate: findColumnIndex(headers, ['StockItems.TaxRate', 'Tax Rate', 'tax_rate', 'taxRate']),
			price: findColumnIndex(headers, ['StockItemPrices.Price', 'Price', 'price', 'selling_price']),
			productGroupCode: findColumnIndex(headers, ['ProductGroups.Code', 'Product Group Code', 'product_group_code', 'productGroupCode']),
			bomItemTypeId: findColumnIndex(headers, ['StockItems.BOMItemTypeID', 'BOM Item Type ID', 'bom_item_type_id', 'bomItemTypeId']),
			companyName: findColumnIndex(headers, ['SYSCompanies.CompanyName', 'Company Name', 'company_name', 'companyName']),
			supplierAccountNumber: findColumnIndex(headers, ['PLSupplierAccounts.SupplierAccountNumber', 'Supplier Account Number', 'supplier_account_number', 'supplierAccountNumber'])
		};

		// Check if required column is found
		if (columnMap.stockCode === -1) {
			return json({
				success: false,
				error: `Missing required column. Expected: StockItems.Code (or variations like 'Stock Code', 'stock_code', 'SKU'). Found headers: ${headers.join(', ')}`
			}, { status: 400 });
		}

		// Convert CSV to JSON using the column mapping
		const data = [];
		const errors = [];

		console.log(`Parsing CSV: ${lines.length - 1} data rows to process`);

		for (let i = 1; i < lines.length; i++) {
			const line = lines[i].trim();
			if (!line) continue; // Skip empty lines

			try {
				// Split CSV line, handling quoted values
				const values = parseCsvLine(line);

				if (values.length !== headers.length) {
					errors.push(`Row ${i + 1}: Expected ${headers.length} columns, got ${values.length}`);
					continue;
				}

				// Map values to object with original column names for compatibility
				const item: any = {};

				// Use the original header names to maintain compatibility with existing service
				if (columnMap.stockCode !== -1) item['StockItems.Code'] = values[columnMap.stockCode]?.trim() || '';
				if (columnMap.binName !== -1) item['BinItems.BinName'] = values[columnMap.binName]?.trim() || '';
				if (columnMap.standardCost !== -1) item['StockItems.StandardCost'] = values[columnMap.standardCost]?.trim() || '';
				if (columnMap.taxRate !== -1) item['StockItems.TaxRate'] = values[columnMap.taxRate]?.trim() || '';
				if (columnMap.price !== -1) item['StockItemPrices.Price'] = values[columnMap.price]?.trim() || '';
				if (columnMap.productGroupCode !== -1) item['ProductGroups.Code'] = values[columnMap.productGroupCode]?.trim() || '';
				if (columnMap.bomItemTypeId !== -1) item['StockItems.BOMItemTypeID'] = values[columnMap.bomItemTypeId]?.trim() || '';
				if (columnMap.companyName !== -1) item['SYSCompanies.CompanyName'] = values[columnMap.companyName]?.trim() || '';
				if (columnMap.supplierAccountNumber !== -1) item['PLSupplierAccounts.SupplierAccountNumber'] = values[columnMap.supplierAccountNumber]?.trim() || '';

				// Validate required field
				if (!item['StockItems.Code']) {
					errors.push(`Row ${i + 1}: Missing required field: Stock Code`);
					continue;
				}

				data.push(item);

				// Log progress for large files
				if (i % 1000 === 0) {
					console.log(`Processed ${i} rows...`);
				}
			} catch (parseError) {
				errors.push(`Row ${i + 1}: Failed to parse - ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
				continue;
			}
		}

		console.log(`CSV parsing completed: ${data.length} valid items, ${errors.length} errors`);

		// If there are too many errors, return them
		if (errors.length > 0 && errors.length >= lines.length / 2) {
			return json({
				success: false,
				error: 'Too many errors in CSV file',
				errorDetails: errors.slice(0, 20) // Return first 20 errors
			}, { status: 400 });
		}

		if (data.length === 0) {
			return json({
				success: false,
				error: 'No valid data to process'
			}, { status: 400 });
		}

		// Clear existing data and import new data
		try {
			console.log(`Starting Sage Reports import: ${data.length} records to process`);

			await sageImportService.clearAllSageData();
			console.log('Cleared existing Sage Reports data');

			const importResult = await sageImportService.importSageData(data);
			console.log(`Import completed: ${importResult.imported} imported, ${importResult.updated} updated, ${importResult.errors.length} errors`);

			return json({
				success: true,
				message: `Successfully processed ${data.length} rows.`,
				imported: importResult.imported,
				updated: importResult.updated,
				errors: importResult.errors,
				errorCount: errors.length + importResult.errors.length,
				errorDetails: [...errors.slice(0, 10), ...importResult.errors.slice(0, 10)],
				summary: {
					totalRows: lines.length - 1, // Exclude header
					validRows: data.length,
					importedRows: importResult.imported,
					updatedRows: importResult.updated,
					errorRows: errors.length + importResult.errors.length,
					duplicatesRemoved: data.length - (importResult.imported + importResult.updated) // Estimate
				}
			});
		} catch (dbError) {
			console.error('Database error:', dbError);
			return json({
				success: false,
				error: 'Failed to save data to the database.',
				details: dbError instanceof Error ? dbError.message : 'Unknown database error'
			}, { status: 500 });
		}

	} catch (error) {
		console.error('Error processing Sage CSV upload:', error);
		return json(
			{ success: false, error: 'Failed to process CSV file' },
			{ status: 500 }
		);
	}
};
