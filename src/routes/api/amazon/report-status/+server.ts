import { json } from '@sveltejs/kit';
import { ReportsService } from '$lib/amazon/reports-service';

export async function GET({ url }) {
    const reportId = url.searchParams.get('reportId');
    if (!reportId) {
        return json({ error: 'Missing reportId' }, { status: 400 });
    }

    try {
        const service = new ReportsService();
        const status = await service.getReportStatus(reportId);
        
        return json({ 
            status: status.status,
            reportId: status.reportId,
            reportDocumentId: status.reportDocumentId
        });
    } catch (error: any) {
        console.error('Error checking report status:', error);
        return json({ 
            error: error.message || 'Failed to check status' 
        }, { status: 500 });
    }
}