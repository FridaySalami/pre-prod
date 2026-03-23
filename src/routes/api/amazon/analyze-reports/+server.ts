import { json } from '@sveltejs/kit';
import { ReportsService } from '$lib/amazon/reports-service';
import { analyzeSalesData, transformReportToRows } from '$lib/server/sales-analyzer';
import { supabaseAdmin } from '$lib/supabase/supabaseAdmin';

// Fetch Product Titles from Supabase
async function fetchProductTitlesFromSupabase(skus: string[]): Promise<Map<string, string>> {
    const titleMap = new Map<string, string>();
    const uniqueSkus = [...new Set(skus.map(s => s?.trim()))].filter(a => a);
    
    // Reduced batch size to 50
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < uniqueSkus.length; i += batchSize) {
        batches.push(uniqueSkus.slice(i, i + batchSize));
    }

    console.log(`Fetching titles for ${uniqueSkus.length} SKUs from Supabase in ${batches.length} batches...`);

    // Process batches
    for (const batch of batches) {
        try {
            const { data, error } = await supabaseAdmin
                .from('inventory')
                .select('sku, title')
                .in('sku', batch);

            if (error) {
                console.error('Error fetching titles from Supabase:', error);
                continue;
            }

            if (data) {
                for (const item of data) {
                    if (item.sku && item.title) {
                        titleMap.set(item.sku, item.title);
                    }
                }
            }
        } catch (e) {
            console.warn('Error fetching title batch:', e);
        }
    }

    return titleMap;
}

export async function POST({ request }) {
    try {
        const { oldReportId, newReportId } = await request.json();

        if (!oldReportId || !newReportId) {
            return json({ error: 'Missing report IDs' }, { status: 400 });
        }

        const service = new ReportsService();

        // 1. Get status for both to confirm DONE and get document IDs
        const [oldStatus, newStatus] = await Promise.all([
            service.getReportStatus(oldReportId),
            service.getReportStatus(newReportId)
        ]);

        if (oldStatus.status !== 'DONE' || newStatus.status !== 'DONE') {
            return json({ error: 'One or more reports are not ready yet.' }, { status: 400 });
        }
        if (!oldStatus.reportDocumentId || !newStatus.reportDocumentId) {
            return json({ error: 'Reports completed but missing document IDs.' }, { status: 500 });
        }

        // 2. Get download info
        const [oldDoc, newDoc] = await Promise.all([
            service.getReportDocument(oldStatus.reportDocumentId),
            service.getReportDocument(newStatus.reportDocumentId)
        ]);

        // 3. Download data
        const [oldData, newData] = await Promise.all([
            service.downloadReport(oldDoc.url, oldDoc.compressionAlgorithm),
            service.downloadReport(newDoc.url, newDoc.compressionAlgorithm)
        ]);

        // 4. Fetch Titles
        const skus = new Set<string>();
        const oldItems = oldData.salesAndTrafficByAsin || [];
        const newItems = newData.salesAndTrafficByAsin || [];
        
        oldItems.forEach((i: any) => i.sku && skus.add(i.sku));
        newItems.forEach((i: any) => i.sku && skus.add(i.sku));
        
        let titleMap;
        if (skus.size > 0) {
            try {
                titleMap = await fetchProductTitlesFromSupabase(Array.from(skus));
            } catch (e) {
                console.error('Failed to fetch titles from Supabase, continuing with unknown titles', e);
            }
        }

        // 5. Transform & Analyze
        const oldRows = transformReportToRows(oldData, titleMap);
        const newRows = transformReportToRows(newData, titleMap);

        const { analysis, excelBuffer } = await analyzeSalesData(oldRows, newRows);

        return json({
            success: true,
            analysis,
            excelReport: excelBuffer.toString('base64'),
            ver: 'api-v2'
        });

    } catch (error: any) {
        console.error('Error in analyze-reports:', error);
        return json({ 
            error: error.message || 'Analysis failed',
            details: error.toString()
        }, { status: 500 });
    }
}