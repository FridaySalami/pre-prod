
import { json } from '@sveltejs/kit';
import { SPAPIClient } from '$lib/amazon/sp-api-client';
import { env } from '$env/dynamic/private';
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

export async function GET() {
  try {
    const client = new SPAPIClient({
      clientId: env.AMAZON_CLIENT_ID,
      clientSecret: env.AMAZON_CLIENT_SECRET,
      refreshToken: env.AMAZON_REFRESH_TOKEN,
      awsAccessKeyId: env.AMAZON_AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: env.AMAZON_AWS_SECRET_ACCESS_KEY,
      awsRegion: env.AMAZON_AWS_REGION || 'eu-west-1',
      roleArn: env.AMAZON_ROLE_ARN,
      sellerId: env.AMAZON_SELLER_ID
    });

    // 1. List Reports
    const reportsResponse = await client.get('/reports/2021-06-30/reports', {
      queryParams: {
        reportTypes: 'GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2',
        pageSize: '1',
        marketplaceIds: 'A1F83G8C2ARO7P' // UK Marketplace
      }
    });

    if (!reportsResponse.success) {
      return json({ error: 'Failed to list reports', details: reportsResponse.errors }, { status: 500 });
    }

    const reports = reportsResponse.data.reports;
    if (!reports || reports.length === 0) {
      return json({ message: 'No settlement reports found.' });
    }

    const report = reports[0];
    const reportDocumentId = report.reportDocumentId;

    // 2. Get Report Document
    const docResponse = await client.get(`/reports/2021-06-30/documents/${reportDocumentId}`);

    if (!docResponse.success) {
      return json({ error: 'Failed to get report document', details: docResponse.errors }, { status: 500 });
    }

    const docData = docResponse.data;
    const downloadUrl = docData.url;
    const compressionAlgorithm = docData.compressionAlgorithm;

    // 3. Download Report
    const fileResponse = await fetch(downloadUrl);
    if (!fileResponse.ok) {
      return json({ error: 'Failed to download report file' }, { status: 500 });
    }

    const arrayBuffer = await fileResponse.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    // 4. Decompress if needed
    if (compressionAlgorithm === 'GZIP') {
      buffer = await gunzip(buffer);
    }

    // 5. Parse and Filter
    const content = buffer.toString('utf-8');
    const lines = content.split('\n');
    const headers = lines[0].split('\t');

    const shippingCosts = lines.slice(1)
      .map(line => {
        const values = line.split('\t');
        const entry: Record<string, string> = {};
        headers.forEach((h, i) => entry[h] = values[i]);
        return entry;
      })
      .filter(entry => entry['amount-description'] === 'Shipping label purchase')
      .map(entry => ({
        orderId: entry['order-id'],
        amount: entry['amount'],
        date: entry['posted-date'],
        description: entry['amount-description']
      }))
      .slice(0, 10); // Just show first 10

    return json({
      reportId: report.reportId,
      processingStatus: report.processingStatus,
      foundShippingCosts: shippingCosts
    });

  } catch (error) {
    console.error('Error fetching settlement report:', error);
    return json({ error: 'Internal Server Error', details: (error as Error).message }, { status: 500 });
  }
}
