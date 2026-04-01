import { SPAPIClient } from './sp-api-client';
import { env } from '$env/dynamic/private';

export interface DataKioskQuery {
  query: string;
  paginationToken?: string;
}

export interface DataKioskQueryStatus {
  queryId: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' | 'FATAL';
  documentId?: string;
  createdTime: string;
  processingStartTime?: string;
  processingEndTime?: string;
}

export interface DataKioskDocument {
  documentId: string;
  documentUrl: string;
}

export class DataKioskService {
  private client: SPAPIClient;

  constructor() {
    this.client = new SPAPIClient({
      clientId: env.AMAZON_CLIENT_ID || '',
      clientSecret: env.AMAZON_CLIENT_SECRET || '',
      refreshToken: env.AMAZON_REFRESH_TOKEN || '',
      awsAccessKeyId: env.AMAZON_AWS_ACCESS_KEY_ID || '',
      awsSecretAccessKey: env.AMAZON_AWS_SECRET_ACCESS_KEY || '',
      awsRegion: env.AMAZON_AWS_REGION || 'eu-west-1',
      marketplaceId: env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
      roleArn: env.AMAZON_ROLE_ARN,
      sellerId: env.AMAZON_SELLER_ID
    });
  }

  /**
   * Submit a GraphQL query to the Data Kiosk
   */
  async createQuery(query: string, nextToken?: string): Promise<string> {
    console.log('📊 Creating Data Kiosk query...');

    // Correctly structured request body
    const body: DataKioskQuery = {
      query,
      ...(nextToken && { paginationToken: nextToken })
    };

    const response = await this.client.request(
      'POST',
      '/dataKiosk/2023-11-15/queries',
      { body }
    );

    if (!response.success) {
      const errorMsg = response.errors?.map(e => e.message).join(', ') || 'Unknown error';
      throw new Error(`Data Kiosk query creation failed: ${errorMsg}`);
    }

    if (!response.data?.queryId) {
      throw new Error('Failed to create query - no queryId returned');
    }

    return response.data.queryId;
  }

  /**
   * Check the status of a query
   */
  async getQueryStatus(queryId: string): Promise<DataKioskQueryStatus> {
    const response = await this.client.request(
      'GET',
      `/dataKiosk/2023-11-15/queries/${queryId}`
    );

    if (!response.success) {
      const errorMsg = response.errors?.map(e => e.message).join(', ') || 'Unknown error';
      throw new Error(`Failed to get query status: ${errorMsg}`);
    }

    return response.data;
  }

  /**
   * Get the document URL for a completed query
   */
  async getDocument(documentId: string): Promise<DataKioskDocument> {
    const response = await this.client.request(
      'GET',
      `/dataKiosk/2023-11-15/documents/${documentId}`
    );

    if (!response.success) {
      const errorMsg = response.errors?.map(e => e.message).join(', ') || 'Unknown error';
      throw new Error(`Failed to get document info: ${errorMsg}`);
    }

    return response.data;
  }

  /**
   * Download and parse the document content (JSONL)
   */
  async downloadDocument(url: string): Promise<any> {
    console.log('📥 Downloading Data Kiosk document...');

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download document: ${response.statusText}`);
    }

    const text = await response.text();

    // Try parsing as standard JSON first
    try {
      const json = JSON.parse(text);
      // If it's a GraphQL response wrapper, return the inner list if possible, or just the whole object
      // The caller knows the structure.
      return json;
    } catch (e) {
      // If failed, it might be JSONL (JSON Lines)
      const results: any[] = [];
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.trim()) {
          try {
            results.push(JSON.parse(line));
          } catch (lineError) {
            console.error('Error parsing JSONL line:', lineError);
          }
        }
      }
      return results;
    }
  }
}
