import { graphService } from './microsoftGraph';

/**
 * Helper utility to find SharePoint site, drive, and file IDs
 * Run this after authentication is set up to get the correct IDs
 */
export class SharePointIDFinder {
	private baseUrl = 'https://graph.microsoft.com/v1.0';

	private async makeGraphRequest(endpoint: string): Promise<any> {
		const token = await graphService.getAccessToken();

		const response = await fetch(`${this.baseUrl}${endpoint}`, {
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(`Graph API error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
		}

		return response.json();
	}

	/**
	 * Find the SharePoint site ID
	 */
	async findSiteId(hostname: string = 'parkersfood-my.sharepoint.com'): Promise<string> {
		console.log(`🔍 Finding site ID for: ${hostname}`);

		const response = await this.makeGraphRequest(`/sites/${hostname}`);

		console.log('✅ Site found:', {
			id: response.id,
			displayName: response.displayName,
			description: response.description
		});

		return response.id;
	}

	/**
	 * Find drives for a given site
	 */
	async findDrives(siteId: string): Promise<any[]> {
		console.log(`🔍 Finding drives for site: ${siteId}`);

		const response = await this.makeGraphRequest(`/sites/${siteId}/drives`);

		console.log('✅ Drives found:');
		response.value.forEach((drive: any, index: number) => {
			console.log(`  ${index + 1}. ${drive.name} (${drive.driveType})`);
			console.log(`     ID: ${drive.id}`);
		});

		return response.value;
	}

	/**
	 * Find files in a drive's root folder
	 */
	async findFilesInRoot(siteId: string, driveId: string): Promise<any[]> {
		console.log(`🔍 Finding files in root folder`);

		const response = await this.makeGraphRequest(`/sites/${siteId}/drives/${driveId}/root/children`);

		console.log('✅ Files found:');
		response.value.forEach((file: any, index: number) => {
			console.log(`  ${index + 1}. ${file.name}`);
			console.log(`     ID: ${file.id}`);
			console.log(`     Type: ${file.file ? 'File' : 'Folder'}`);
			if (file.file) {
				console.log(`     MIME Type: ${file.file.mimeType}`);
			}
		});

		return response.value;
	}

	/**
	 * Search for a specific file by name
	 */
	async findFileByName(siteId: string, driveId: string, fileName: string): Promise<any | null> {
		console.log(`🔍 Searching for file: ${fileName}`);

		const response = await this.makeGraphRequest(`/sites/${siteId}/drives/${driveId}/root/search(q='${encodeURIComponent(fileName)}')`);

		if (response.value.length === 0) {
			console.log('❌ File not found');
			return null;
		}

		const file = response.value[0];
		console.log('✅ File found:', {
			id: file.id,
			name: file.name,
			size: file.size,
			lastModified: file.lastModifiedDateTime
		});

		return file;
	}

	/**
	 * Complete discovery process - finds all IDs needed
	 */
	async discoverAll(
		hostname: string = 'parkersfood-my.sharepoint.com',
		fileName: string = 'Pricer - Work in progress 08.05.25.xlsx'
	): Promise<{
		siteId: string;
		driveId: string;
		fileId: string;
		fileName: string;
	}> {
		console.log('🚀 Starting SharePoint discovery process...');

		try {
			// Step 1: Find site ID
			const siteId = await this.findSiteId(hostname);

			// Step 2: Find drives
			const drives = await this.findDrives(siteId);
			const documentsDrive = drives.find(d => d.name === 'Documents' || d.driveType === 'business');

			if (!documentsDrive) {
				throw new Error('No Documents drive found');
			}

			console.log(`📁 Using drive: ${documentsDrive.name} (ID: ${documentsDrive.id})`);

			// Step 3: Find the specific file
			const file = await this.findFileByName(siteId, documentsDrive.id, fileName);

			if (!file) {
				throw new Error(`File "${fileName}" not found`);
			}

			const result = {
				siteId,
				driveId: documentsDrive.id,
				fileId: file.id,
				fileName: file.name
			};

			console.log('🎉 Discovery complete! Configuration:');
			console.log('Copy this to your excelAPI.ts file:');
			console.log(`
const EXCEL_CONFIG = {
	siteId: '${result.siteId}',
	driveId: '${result.driveId}',
	fileId: '${result.fileId}',
	fileName: '${result.fileName}'
};`);

			return result;

		} catch (error) {
			console.error('❌ Discovery failed:', error);
			throw error;
		}
	}
}

export const sharePointFinder = new SharePointIDFinder();
