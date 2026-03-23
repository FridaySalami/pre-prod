import { fail, type Actions } from '@sveltejs/kit';
import { writeFile, unlink, access, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { exec } from 'child_process';
import util from 'util';
import { analyzeSales, analyzeSalesData } from '$lib/server/sales-analyzer';
import { SPAPIClient } from '$lib/amazon/sp-api-client';
import { supabaseAdmin } from '$lib/supabase/supabaseAdmin';
import zlib from 'zlib';
import {
    AMAZON_CLIENT_ID,
    AMAZON_CLIENT_SECRET,
    AMAZON_REFRESH_TOKEN,
    AMAZON_AWS_ACCESS_KEY_ID,
    AMAZON_AWS_SECRET_ACCESS_KEY,
    AMAZON_AWS_REGION,
    AMAZON_MARKETPLACE_ID,
    AMAZON_ROLE_ARN,
    AMAZON_SELLER_ID
} from '$env/static/private';

const execPromise = util.promisify(exec);
const gunzip = util.promisify(zlib.gunzip);

// Helper to fetch report from SP-API
async function fetchSalesTrafficReport(client: SPAPIClient, startDate: string, endDate: string) {
    console.log(`Requesting report for ${startDate} to ${endDate}...`);
    
    // 1. Request Report
    const requestRes = await client.post('/reports/2021-06-30/reports', {
        reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
        dataStartTime: startDate,
        dataEndTime: endDate,
        marketplaceIds: ['A1F83G8C2ARO7P'], // UK Marketplace
        reportOptions: {
            dateGranularity: 'DAY',
            asinGranularity: 'SKU'
        }
    });

    if (!requestRes.success) {
        throw new Error(`Failed to request report: ${JSON.stringify(requestRes.errors)}`);
    }

    const reportId = requestRes.data.reportId;
    console.log(`Report requested. ID: ${reportId}`);

    // 2. Poll for status
    let processingStatus = 'IN_QUEUE';
    let documentId = '';

    while (processingStatus !== 'DONE' && processingStatus !== 'CANCELLED' && processingStatus !== 'FATAL') {
        await new Promise(r => setTimeout(r, 5000)); // Wait 5s
        const statusRes = await client.get(`/reports/2021-06-30/reports/${reportId}`);
        if (!statusRes.success) throw new Error(`Failed to check report status: ${JSON.stringify(statusRes.errors)}`);
        
        processingStatus = statusRes.data.processingStatus;
        if (processingStatus === 'DONE') {
            documentId = statusRes.data.reportDocumentId;
        }
        console.log(`Report status: ${processingStatus}`);
    }

    if (processingStatus !== 'DONE' || !documentId) {
        throw new Error(`Report processing failed with status: ${processingStatus}`);
    }

    // 3. Get Document URL
    const docRes = await client.get(`/reports/2021-06-30/documents/${documentId}`);
    if (!docRes.success) throw new Error(`Failed to get document info: ${JSON.stringify(docRes.errors)}`);

    const downloadUrl = docRes.data.url;
    const compression = docRes.data.compressionAlgorithm;

    // 4. Download and decompress
    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) throw new Error(`Failed to download report document: ${fileRes.statusText}`);

    const buffer = Buffer.from(await fileRes.arrayBuffer());
    let jsonContent;

    if (compression === 'GZIP') {
        const decompressed = await gunzip(buffer);
        jsonContent = JSON.parse(decompressed.toString('utf-8'));
    } else {
        jsonContent = JSON.parse(buffer.toString('utf-8'));
    }

    return jsonContent;
}

// Convert JSON Report to normalized row structure expected by analyzer
// Helper function to fetch product titles for a list of SKUs from Supabase
async function fetchProductTitlesFromSupabase(skus: string[]): Promise<Map<string, string>> {
    const titleMap = new Map<string, string>();
    const uniqueSkus = [...new Set(skus.map(s => s?.trim()))].filter(a => a);
    
    // Batch size for Supabase queries
    // Reduced to 50 to avoid HeadersOverflowError (url too long)
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
                console.log(`Supabase batch result: Found ${data.length} titles out of ${batch.length} requested.`);
                for (const item of data) {
                    if (item.sku && item.title) {
                        titleMap.set(item.sku, item.title);
                    }
                }
            } else {
                console.log('Supabase returned no data for batch.');
            }
        } catch (e) {
            console.warn('Error fetching title batch:', e);
        }
    }

    return titleMap;
}

function transformReportToRows(reportData: any, titleMap?: Map<string, string>): any[] {
    const rows: any[] = [];
    
    // The report has salesAndTrafficByAsin which is aggregated by SKU (as requested)
    // However, the JSON structure splits child/sku/parent.
    
    const asinData = reportData.salesAndTrafficByAsin || [];

    for (const item of asinData) {
        const sales = item.salesByAsin || {};
        const traffic = item.trafficByAsin || {};
        const childAsin = item.childAsin;
        const sku = item.sku?.trim(); // Trim for lookup consistency
        
        // Map fields to what analyzer expects
        // Use the title from the map if available (keyed by SKU)
        let title = 'Unknown Product';
        
        if (sku) {
            if (titleMap?.has(sku)) {
                title = titleMap.get(sku)!;
            } else {
                title = sku; // Fallback to SKU so it's identifiable
            }
        } else if (childAsin) {
            title = childAsin;
        }

        // Just in case lookup missed by case or something, try direct ASIN lookup if implemented later
        // or prioritize title from map
        
        rows.push({
            'SKU': sku || 'N/A',
            'Title': title, 
            '(Child) ASIN': childAsin,
            
            // Metrics
            'Ordered Product Sales': sales.orderedProductSales?.amount || 0,
            'Units ordered': sales.unitsOrdered || 0,
            'Sessions – Total': traffic.sessions || 0,
            'Page views – Total': traffic.pageViews || 0,
            // API returns percentages as 0-100 (e.g. 12.5), but analyzer expects 0-1 (e.g. 0.125) for numbers
            // because it multiplies by 100 to handle Excel decimal formatting.
            'Unit Session Percentage': (traffic.unitSessionPercentage || 0) / 100,
            'Featured Offer (Buy Box) percentage': (traffic.buyBoxPercentage || 0) / 100
        });
    }

    return rows;
}


export const actions: Actions = {
    analyzeNode: async ({ request }) => {
        const formData = await request.formData();
        const oldFile = formData.get('oldReport') as File;
        const newFile = formData.get('newReport') as File;

        if (!oldFile || !newFile) {
            return fail(400, { missing: true });
        }

        try {
            const oldBuffer = Buffer.from(await oldFile.arrayBuffer());
            const newBuffer = Buffer.from(await newFile.arrayBuffer());

            const { analysis, excelBuffer } = await analyzeSales(oldBuffer, newBuffer);

            return {
                success: true,
                analysis,
                excelReport: excelBuffer.toString('base64'),
                ver: 'node'
            };

        } catch (err) {
            console.error('Error in Node analysis:', err);
            return fail(500, { error: 'Internal server error processing files (Node)' });
        }
    },

    analyzePython: async ({ request }) => {
        const formData = await request.formData();
        const oldFile = formData.get('oldReport') as File;
        const newFile = formData.get('newReport') as File;

        if (!oldFile || !newFile) {
            return fail(400, { missing: true });
        }

        // Generate unique temp filenames
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(7);
        const oldFilePath = join(tmpdir(), `old_report_${timestamp}_${randomSuffix}.csv`);
        const newFilePath = join(tmpdir(), `new_report_${timestamp}_${randomSuffix}.csv`);
        const outputExcelPath = join(tmpdir(), `comparison_report_${timestamp}_${randomSuffix}.xlsx`);

        try {
            // Write files to temp dir
            const oldBuffer = Buffer.from(await oldFile.arrayBuffer());
            const newBuffer = Buffer.from(await newFile.arrayBuffer());

            await writeFile(oldFilePath, oldBuffer);
            await writeFile(newFilePath, newBuffer);

            // Execute Python script
            const scriptPath = join(process.cwd(), 'scripts', 'compare-sales-reports.py');

            // Determine python executable
            let pythonPath = 'python3';
            const venvPath = join(process.cwd(), '.venv', 'bin', 'python3');

            try {
                await access(venvPath);
                pythonPath = venvPath;
            } catch (e) {
                // venv python not found, fallback to system python3
            }

            // Increase max buffer for large outputs (default is 1MB, let's bump to 10MB)
            const { stdout, stderr } = await execPromise(
                `"${pythonPath}" "${scriptPath}" "${oldFilePath}" "${newFilePath}" --output-excel "${outputExcelPath}"`,
                { maxBuffer: 10 * 1024 * 1024 }
            );

            if (stderr) {
                console.error('Python script stderr:', stderr);
            }

            // Clean up temp output files immediately
            await unlink(oldFilePath).catch(() => { });
            await unlink(newFilePath).catch(() => { });

            // Read the generated Excel file if it exists
            let excelBase64 = null;
            try {
                const excelBuffer = await readFile(outputExcelPath);
                excelBase64 = excelBuffer.toString('base64');
                await unlink(outputExcelPath).catch(() => { });
            } catch (e) {
                console.warn('Failed to read excel output:', e);
            }

            try {
                const data = JSON.parse(stdout);
                if (data.error) {
                    return fail(400, { error: data.error });
                }
                return { success: true, analysis: data, excelReport: excelBase64 };
            } catch (e) {
                console.error('Failed to parse JSON output:', stdout);
                return fail(500, { error: 'Failed to process analysis results. The script did not return valid JSON.' });
            }

        } catch (err) {
            console.error('Error processing files:', err);
            // Cleanup if error
            try { await unlink(oldFilePath).catch(() => { }); } catch { }
            try { await unlink(newFilePath).catch(() => { }); } catch { }
            try { await unlink(outputExcelPath).catch(() => { }); } catch { }

            return fail(500, { error: 'Internal server error processing files' });
        }
    },

    analyzeApi: async ({ request }) => {
        const formData = await request.formData();
        const oldStartDate = formData.get('oldStartDate') as string;
        const oldEndDate = formData.get('oldEndDate') as string;
        const newStartDate = formData.get('newStartDate') as string;
        const newEndDate = formData.get('newEndDate') as string;

        if (!oldStartDate || !oldEndDate || !newStartDate || !newEndDate) {
            return fail(400, { missing: true, error: 'All dates must be selected.' });
        }

        try {
            // Using SvelteKit environment variables directly
            let client;
            try {
                // @ts-ignore - Ignore type error about implicit any or undefined env vars for now
                // as SvelteKit guarantees string type for static/private env vars
                if (!AMAZON_REFRESH_TOKEN) throw new Error("Missing SP-API credentials");

                client = new SPAPIClient({
                    clientId: AMAZON_CLIENT_ID,
                    clientSecret: AMAZON_CLIENT_SECRET,
                    refreshToken: AMAZON_REFRESH_TOKEN,
                    awsAccessKeyId: AMAZON_AWS_ACCESS_KEY_ID,
                    awsSecretAccessKey: AMAZON_AWS_SECRET_ACCESS_KEY,
                    awsRegion: AMAZON_AWS_REGION || 'eu-west-1',
                    marketplaceId: AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
                    roleArn: AMAZON_ROLE_ARN,
                    sellerId: AMAZON_SELLER_ID
                });
            } catch (e) {
                // Return detailed error if env setup is clearly broken
                return fail(500, { error: 'Server SP-API configuration is missing or incomplete.' });
            }

            console.log(`Starting API comparison: ${oldStartDate}-${oldEndDate} vs ${newStartDate}-${newEndDate}`);

            // Fetch reports in parallel
            // We need to fetch the data
            const fetchOld = fetchSalesTrafficReport(client, oldStartDate, oldEndDate);
            const fetchNew = fetchSalesTrafficReport(client, newStartDate, newEndDate);

            const [oldReportJson, newReportJson] = await Promise.all([fetchOld, fetchNew]);

            // Enhancment: Fetch Product Titles from Supabase
            const skus = new Set<string>();
            const oldItems = oldReportJson.salesAndTrafficByAsin || [];
            const newItems = newReportJson.salesAndTrafficByAsin || [];
            
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

            const oldRows = transformReportToRows(oldReportJson, titleMap);
            const newRows = transformReportToRows(newReportJson, titleMap);

            console.log(`Fetched ${oldRows.length} baseline rows and ${newRows.length} current rows.`);

            const { analysis, excelBuffer } = await analyzeSalesData(oldRows, newRows);

            return {
                success: true,
                analysis,
                excelReport: excelBuffer.toString('base64'),
                ver: 'api'
            };

        } catch (err: any) {
            console.error('Error in API analysis:', err);
            return fail(500, { error: `API Error: ${err.message || 'Unknown error during Amazon data fetch'}` });
        }
    }
};
