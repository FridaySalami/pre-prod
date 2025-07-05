import { graphService } from './microsoftGraph';

// Excel file configuration - Personal OneDrive Copy
const EXCEL_CONFIG = {
	fileId: '017KX46PNKGHSEZH5I2ZFL47QAS2NRGLV6', // Correct Graph API file ID
	fileName: 'Pricer - Updated 28.06.25.xlsx' // Actual filename from Graph API
};

export interface ExcelWorksheet {
	id: string;
	name: string;
	position: number;
}

export interface ExcelRange {
	address: string;
	values: any[][];
	formulas?: string[][];
	numberFormat?: string[][];
}

export interface ExcelTable {
	id: string;
	name: string;
	range: string;
	headers: string[];
	rows: any[][];
}

class ExcelAPIService {
	private baseUrl = 'https://graph.microsoft.com/v1.0';
	private fileEndpoint: string | null = null;

	// Helper to make authenticated Graph API calls with timeout
	private async makeGraphRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
		const token = await graphService.getAccessToken();

		// Add timeout to the request
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

		try {
			const response = await fetch(`${this.baseUrl}${endpoint}`, {
				...options,
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json',
					...options.headers
				},
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const error = await response.json().catch(() => ({ error: 'Unknown error' }));
				throw new Error(`Graph API error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
			}

			return response.json();
		} catch (error: any) {
			clearTimeout(timeoutId);
			if (error.name === 'AbortError') {
				throw new Error('Request timed out after 30 seconds');
			}
			throw error;
		}
	}

	// Find the file endpoint by searching for it
	private async findFileEndpoint(): Promise<string> {
		if (this.fileEndpoint) {
			return this.fileEndpoint;
		}

		console.log('🔍 Searching for Excel file...');
		console.log('📁 File name:', EXCEL_CONFIG.fileName);
		console.log('🔑 File ID from URL:', EXCEL_CONFIG.fileId);

		try {
			// Try 1: Direct access with file ID from URL
			console.log('🔍 Trying direct access with file ID...');
			try {
				const directResponse = await this.makeGraphRequest(`/me/drive/items/${EXCEL_CONFIG.fileId}`);
				this.fileEndpoint = `/me/drive/items/${EXCEL_CONFIG.fileId}`;
				console.log('✅ Found file with direct ID:', directResponse.name);
				return this.fileEndpoint;
			} catch (error) {
				console.log('❌ Direct ID access failed:', error instanceof Error ? error.message : 'Unknown error');
			}

			// Try 2: Search in user's drive
			console.log('🔍 Searching in user drive...');
			const searchResponse = await this.makeGraphRequest(`/me/drive/root/search(q='${encodeURIComponent(EXCEL_CONFIG.fileName)}')`);
			console.log('📊 Search results:', searchResponse.value?.length || 0, 'files found');

			if (searchResponse.value && searchResponse.value.length > 0) {
				const file = searchResponse.value[0];
				this.fileEndpoint = `/me/drive/items/${file.id}`;
				console.log('✅ Found file in drive search:', file.name, 'ID:', file.id);
				return this.fileEndpoint;
			}

			// Try 3: Search by partial name
			console.log('🔍 Searching by partial name "Pricer"...');
			const partialSearchResponse = await this.makeGraphRequest(`/me/drive/root/search(q='Pricer')`);
			console.log('📊 Partial search results:', partialSearchResponse.value?.length || 0, 'files found');

			if (partialSearchResponse.value && partialSearchResponse.value.length > 0) {
				// Log all found files for debugging
				partialSearchResponse.value.forEach((file: any, index: number) => {
					console.log(`📄 File ${index + 1}:`, file.name, 'ID:', file.id);
				});

				// Try to find exact match
				const exactMatch = partialSearchResponse.value.find((f: any) => f.name === EXCEL_CONFIG.fileName);
				if (exactMatch) {
					this.fileEndpoint = `/me/drive/items/${exactMatch.id}`;
					console.log('✅ Found exact match:', exactMatch.name, 'ID:', exactMatch.id);
					return this.fileEndpoint;
				}
			}

			// Try 4: Browse root directory
			console.log('🔍 Browsing root directory...');
			const rootResponse = await this.makeGraphRequest('/me/drive/root/children');
			console.log('📊 Root directory files:', rootResponse.value?.length || 0);

			const rootFile = rootResponse.value?.find((f: any) => f.name === EXCEL_CONFIG.fileName);
			if (rootFile) {
				this.fileEndpoint = `/me/drive/items/${rootFile.id}`;
				console.log('✅ Found file in root directory:', rootFile.name, 'ID:', rootFile.id);
				return this.fileEndpoint;
			}

			// Try 5: Check recent files
			console.log('🔍 Checking recent files...');
			const recentResponse = await this.makeGraphRequest('/me/drive/recent');
			console.log('📊 Recent files:', recentResponse.value?.length || 0);

			const recentFile = recentResponse.value?.find((f: any) => f.name === EXCEL_CONFIG.fileName);
			if (recentFile) {
				this.fileEndpoint = `/me/drive/items/${recentFile.id}`;
				console.log('✅ Found file in recent files:', recentFile.name, 'ID:', recentFile.id);
				return this.fileEndpoint;
			}

			throw new Error(`File "${EXCEL_CONFIG.fileName}" not found in any accessible location. Check Graph Explorer for the correct file ID.`);

		} catch (error) {
			console.error('❌ File search failed:', error);
			throw new Error(`Could not locate Excel file: ${error}`);
		}
	}

	// Get workbook information
	async getWorkbook(): Promise<any> {
		const fileEndpoint = await this.findFileEndpoint();
		return this.makeGraphRequest(`${fileEndpoint}/workbook`);
	}

	// Get all worksheets with timeout handling
	async getWorksheets(): Promise<ExcelWorksheet[]> {
		const fileEndpoint = await this.findFileEndpoint();

		try {
			console.log('📋 Attempting to load worksheet list...');
			const response = await this.makeGraphRequest(`${fileEndpoint}/workbook/worksheets`);
			console.log('✅ Worksheets loaded successfully:', response.value?.length || 0, 'worksheets found');
			return response.value || [];
		} catch (error: any) {
			console.error('❌ Failed to load worksheets:', error.message);

			// If even basic worksheet listing fails, the file might be corrupted or too complex
			if (error.message.includes('504') || error.message.includes('timeout') || error.message.includes('taking too long')) {
				console.log('⚠️ File appears to be too large or complex for Excel API');
				// Return empty array so the app doesn't crash, with a helpful error message
				throw new Error('This Excel file is too large or complex for the Excel API to process. Consider using a smaller file or breaking it into multiple files.');
			}

			throw error;
		}
	}

	// Get worksheet by name
	async getWorksheet(worksheetName: string): Promise<ExcelWorksheet> {
		const fileEndpoint = await this.findFileEndpoint();
		return this.makeGraphRequest(`${fileEndpoint}/workbook/worksheets('${worksheetName}')`);
	}

	// Get range data from worksheet
	async getRange(worksheetName: string, range: string): Promise<ExcelRange> {
		const fileEndpoint = await this.findFileEndpoint();
		return this.makeGraphRequest(`${fileEndpoint}/workbook/worksheets('${worksheetName}')/range(address='${range}')`);
	}

	// Get used range (all data) from worksheet with timeout handling
	async getUsedRange(worksheetName: string): Promise<ExcelRange> {
		const fileEndpoint = await this.findFileEndpoint();

		try {
			// Try to get the used range first
			console.log(`📊 Attempting to load used range for worksheet: ${worksheetName}`);
			return await this.makeGraphRequest(`${fileEndpoint}/workbook/worksheets('${worksheetName}')/usedRange`);
		} catch (error: any) {
			// If timeout or error, try smaller chunks
			if (error.message.includes('504') || error.message.includes('timeout') || error.message.includes('taking too long')) {
				console.log('⚠️ Timeout loading full range, trying smaller chunk (A1:Z100)');
				try {
					return await this.getRange(worksheetName, 'A1:Z100');
				} catch (smallerError) {
					console.log('⚠️ Still timing out, trying even smaller chunk (A1:J50)');
					return await this.getRange(worksheetName, 'A1:J50');
				}
			}
			throw error;
		}
	}

	// Update range data
	async updateRange(worksheetName: string, range: string, values: any[][]): Promise<ExcelRange> {
		const fileEndpoint = await this.findFileEndpoint();

		return this.makeGraphRequest(`${fileEndpoint}/workbook/worksheets('${worksheetName}')/range(address='${range}')`, {
			method: 'PATCH',
			body: JSON.stringify({ values })
		});
	}

	// Get tables from worksheet
	async getTables(worksheetName?: string): Promise<ExcelTable[]> {
		const fileEndpoint = await this.findFileEndpoint();
		let endpoint = `${fileEndpoint}/workbook/tables`;

		if (worksheetName) {
			endpoint = `${fileEndpoint}/workbook/worksheets('${worksheetName}')/tables`;
		}

		const response = await this.makeGraphRequest(endpoint);
		return response.value;
	}

	// Get table data
	async getTableData(tableName: string): Promise<ExcelTable> {
		const fileEndpoint = await this.findFileEndpoint();
		const table = await this.makeGraphRequest(`${fileEndpoint}/workbook/tables('${tableName}')`);

		// Get table rows
		const rowsResponse = await this.makeGraphRequest(`${fileEndpoint}/workbook/tables('${tableName}')/rows`);

		return {
			id: table.id,
			name: table.name,
			range: table.range,
			headers: table.columns?.map((col: any) => col.name) || [],
			rows: rowsResponse.value?.map((row: any) => row.values) || []
		};
	}

	// Add row to table
	async addTableRow(tableName: string, values: any[]): Promise<any> {
		const fileEndpoint = await this.findFileEndpoint();

		return this.makeGraphRequest(`${fileEndpoint}/workbook/tables('${tableName}')/rows/add`, {
			method: 'POST',
			body: JSON.stringify({ values: [values] })
		});
	}

	// Create a new worksheet
	async createWorksheet(name: string): Promise<ExcelWorksheet> {
		const fileEndpoint = await this.findFileEndpoint();

		return this.makeGraphRequest(`${fileEndpoint}/workbook/worksheets/add`, {
			method: 'POST',
			body: JSON.stringify({ name })
		});
	}

	// Calculate workbook (refresh formulas)
	async calculate(): Promise<void> {
		const fileEndpoint = await this.findFileEndpoint();

		await this.makeGraphRequest(`${fileEndpoint}/workbook/application/calculate('Full')`, {
			method: 'POST'
		});
	}

	// Create a session for batch operations
	async createSession(): Promise<string> {
		const fileEndpoint = await this.findFileEndpoint();

		const response = await this.makeGraphRequest(`${fileEndpoint}/workbook/createSession`, {
			method: 'POST',
			body: JSON.stringify({ persistChanges: true })
		});

		return response.id;
	}

	// Close session
	async closeSession(sessionId: string): Promise<void> {
		const fileEndpoint = await this.findFileEndpoint();

		await this.makeGraphRequest(`${fileEndpoint}/workbook/closeSession`, {
			method: 'POST',
			headers: {
				'workbook-session-id': sessionId
			}
		});
	}

	// Get basic worksheet information (name, visibility, etc.) without loading data
	async getWorksheetInfo(worksheetName: string): Promise<any> {
		const fileEndpoint = await this.findFileEndpoint();
		return this.makeGraphRequest(`${fileEndpoint}/workbook/worksheets('${worksheetName}')`);
	}

	// Get a sample of data (first few rows) to check structure
	async getSampleData(worksheetName: string, rows: number = 10): Promise<ExcelRange> {
		return this.getRange(worksheetName, `A1:Z${rows}`);
	}

	// Test if Excel API is working for this file (basic connectivity test)
	async testExcelAccess(): Promise<{ success: boolean; message: string; fileInfo?: any }> {
		try {
			const fileEndpoint = await this.findFileEndpoint();

			// Try to get basic file info first
			console.log('🧪 Testing Excel API access...');
			const fileInfo = await this.makeGraphRequest(fileEndpoint);

			// Try to access the workbook (without loading worksheets)
			try {
				await this.makeGraphRequest(`${fileEndpoint}/workbook`, {
					// Use a very short timeout for this test
					signal: AbortSignal.timeout(10000) // 10 second timeout
				});

				return {
					success: true,
					message: 'Excel API access confirmed',
					fileInfo: {
						name: fileInfo.name,
						size: fileInfo.size,
						lastModified: fileInfo.lastModifiedDateTime
					}
				};
			} catch (workbookError: any) {
				if (workbookError.message.includes('504') || workbookError.message.includes('timeout')) {
					return {
						success: false,
						message: 'File is too large or complex for Excel API processing',
						fileInfo: {
							name: fileInfo.name,
							size: fileInfo.size,
							lastModified: fileInfo.lastModifiedDateTime
						}
					};
				}
				throw workbookError;
			}

		} catch (error: any) {
			return {
				success: false,
				message: `Excel API test failed: ${error.message}`
			};
		}
	}

	// Get paginated data from a worksheet
	async getPaginatedData(worksheetName: string, page: number = 1, rowsPerPage: number = 50): Promise<{ data: ExcelRange; hasMore: boolean; totalEstimate?: number }> {
		const startRow = (page - 1) * rowsPerPage + 1;
		const endRow = startRow + rowsPerPage - 1;
		const range = `A${startRow}:Z${endRow}`;

		console.log(`📄 Loading page ${page}: rows ${startRow}-${endRow} from worksheet "${worksheetName}"`);

		try {
			const data = await this.getRange(worksheetName, range);

			// Try to estimate if there's more data by checking if we got a full page
			const hasMore = data.values && data.values.length === rowsPerPage;

			return {
				data,
				hasMore,
				totalEstimate: hasMore ? page * rowsPerPage + 50 : (page - 1) * rowsPerPage + (data.values?.length || 0)
			};
		} catch (error) {
			console.error(`Failed to load page ${page}:`, error);
			throw error;
		}
	}

	// Get specific columns from a worksheet (useful for wide sheets)
	async getColumns(worksheetName: string, columns: string[], maxRows: number = 100): Promise<ExcelRange> {
		const columnRange = `${columns[0]}1:${columns[columns.length - 1]}${maxRows}`;
		console.log(`📊 Loading columns ${columns.join(', ')} from worksheet "${worksheetName}" (range: ${columnRange})`);

		return this.getRange(worksheetName, columnRange);
	}

	// Get worksheet metadata (row/column count estimates)
	async getWorksheetMetadata(worksheetName: string): Promise<{ name: string; estimatedSize: string; sampleData: ExcelRange }> {
		try {
			const worksheetInfo = await this.getWorksheetInfo(worksheetName);
			const sampleData = await this.getRange(worksheetName, 'A1:J10'); // Small sample

			return {
				name: worksheetName,
				estimatedSize: `Sample shows ${sampleData.values?.length || 0} rows × ${sampleData.values?.[0]?.length || 0} columns`,
				sampleData
			};
		} catch (error) {
			console.error(`Failed to get metadata for worksheet "${worksheetName}":`, error);
			throw error;
		}
	}
}

export const excelService = new ExcelAPIService();
