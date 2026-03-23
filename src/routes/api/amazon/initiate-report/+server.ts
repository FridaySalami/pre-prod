import { json } from '@sveltejs/kit';
import { ReportsService } from '$lib/amazon/reports-service';

export async function POST({ request }) {
    try {
        const { startDate, endDate } = await request.json();
        
        if (!startDate || !endDate) {
            return json({ error: 'Missing start or end date' }, { status: 400 });
        }

        const service = new ReportsService();
        const reportId = await service.requestReport({
            reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
            startDate,
            endDate,
            reportOptions: {
                dateGranularity: 'DAY',
                asinGranularity: 'SKU'
            }
        });

        return json({ reportId });
    } catch (error: any) {
        console.error('Error initiating report:', error);
        return json({ 
            error: error.message || 'Failed to initiate report',
            details: error.response?.data || error.toString()
        }, { status: 500 });
    }
}