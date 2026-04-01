import { json } from '@sveltejs/kit';
import { ReportsService } from '$lib/amazon/reports-service';

export async function POST() {
  try {
    const reportsService = new ReportsService();
    console.log('Requesting new B2B content report...');

    const reportId = await reportsService.requestReport({
      reportType: 'GET_B2B_PRODUCT_OPPORTUNITIES_RECOMMENDED_FOR_YOU',
      marketplaceIds: ['A1F83G8C2ARO7P'] // UK Marketplace
    });

    return json({ reportId, status: 'IN_QUEUE' });
  } catch (error) {
    console.error('Error requesting report:', error);
    return json({ error: 'Failed to request report' }, { status: 500 });
  }
}

export async function GET({ url }) {
  const reportId = url.searchParams.get('reportId');
  if (!reportId) {
    return json({ error: 'Report ID is required' }, { status: 400 });
  }

  try {
    const reportsService = new ReportsService();

    // Check report status directly
    const status = await reportsService.getReportStatus(reportId);

    if (status.status === 'DONE') {
      if (!status.reportDocumentId) {
        return json({ error: 'Report is DONE but has no document ID' }, { status: 500 });
      }

      // It's done, fetch the document info
      const reportDoc = await reportsService.getReportDocument(status.reportDocumentId);

      // Download and parse data
      const data = await reportsService.downloadReport(reportDoc.url, reportDoc.compressionAlgorithm);

      // Depending on the data format (gzip, plain text), we might need to parse it. 
      // ReportsService.downloadReport seems to handle decompression but maybe not JSON parsing if it's text.
      // B2B report is JSON based on the user's schema example.

      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch (e) {
          console.warn('Failed to parse report data as JSON, returning as string', e);
        }
      }

      return json({ status: 'DONE', data: parsedData });
    } else if (status.status === 'CANCELLED' || status.status === 'FATAL') {
      return json({ status: status.status, error: 'Report generation failed or was cancelled' });
    } else {
      // IN_QUEUE or IN_PROGRESS
      return json({ status: status.status });
    }

  } catch (error) {
    console.error('Error checking report status:', error);
    return json({ error: 'Failed to check report status: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
