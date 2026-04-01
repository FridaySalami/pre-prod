import { json } from '@sveltejs/kit';
import { ReportsService } from '$lib/amazon/reports-service';

export async function POST({ request }) {
  try {
    const { reportPeriod, dataStartTime, dataEndTime, asins, nextToken } = await request.json();

    // Default to last completed week if not provided
    // Note: Use provided values or strict defaults to ensure successful report generation logic 
    // is consistent with Amazon's Sunday-Saturday requirement for WEEK reports.

    const reportsService = new ReportsService();
    console.log('Requesting Search Catalog Performance report...');

    const reportOptions: Record<string, string> = {
      reportPeriod: reportPeriod || 'WEEK'
    };

    if (asins) {
      reportOptions.asins = asins;
    }

    if (nextToken) {
      reportOptions.reportToken = nextToken;
    }

    const reportId = await reportsService.requestReport({
      reportType: 'GET_BRAND_ANALYTICS_SEARCH_CATALOG_PERFORMANCE_REPORT',
      marketplaceIds: ['A1F83G8C2ARO7P'], // UK Marketplace
      reportOptions,
      startDate: dataStartTime,
      endDate: dataEndTime
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
    const status = await reportsService.getReportStatus(reportId);

    if (status.status === 'DONE') {
      if (!status.reportDocumentId) {
        return json({ error: 'Report is DONE but has no document ID' }, { status: 500 });
      }

      const reportDoc = await reportsService.getReportDocument(status.reportDocumentId);
      const data = await reportsService.downloadReport(reportDoc.url, reportDoc.compressionAlgorithm);

      let parsedData = data;
      if (typeof data === 'string') {
        try {
          // This report type returns JSON
          parsedData = JSON.parse(data);
        } catch (e) {
          console.error('Failed to parse report JSON', e);
        }
      }

      return json({ status: 'DONE', data: parsedData });
    } else {
      return json({ status: status.status });
    }

  } catch (error) {
    console.error('Error checking report status:', error);
    return json({ error: 'Failed to check report status' }, { status: 500 });
  }
}
