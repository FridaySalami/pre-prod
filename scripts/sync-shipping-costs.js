// scripts/sync-shipping-costs.js
// Centralized script to run the Playwright automation for Amazon Shipping Sync
// This mimics the logic found in src/routes/dashboard/tools/upload-shipping/+page.server.ts

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

// 1. Initialize Supabase
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey);

async function processShippingFile(buffer) {
    const workbook = XLSX.read(buffer);
    if (!workbook.SheetNames.length) {
        throw new Error('File contains no sheets');
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (rows.length < 2) {
        throw new Error('File is empty or invalid');
    }

    const headers = rows[0].map((h) => String(h || '').trim());
    const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const headerMap = headers.map(norm);
    const findCol = (re) => headerMap.findIndex(h => re.test(h));

    const refIndex = findCol(/^reference\s*#$/i);
    const costIndex = findCol(/label\s*cost.*gbp/i);
    const statusIndex = findCol(/order\s*status/i);
    const trackingIndex = findCol(/tracking\s*id/i);
    const carrierIndex = findCol(/carrier/i);
    const speedIndex = findCol(/delivery\s*speed/i);
    const labelDateIndex = findCol(/label\s*creation\s*date/i);

    if (refIndex === -1 || costIndex === -1) {
        throw new Error('Missing required columns: "Reference #" or "Label Cost(GBP)"');
    }

    const orderUpdates = new Map();

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const getValue = (index) => {
            if (index === -1 || index >= row.length) return '';
            const val = row[index];
            return val === undefined || val === null ? '' : String(val).trim();
        };

        const orderId = getValue(refIndex);
        const costStr = getValue(costIndex);
        const status = getValue(statusIndex);
        const tracking = getValue(trackingIndex);
        const carrier = getValue(carrierIndex);
        const method = getValue(speedIndex);

        if (status && /cancel/i.test(status)) continue;

        if (orderId && costStr) {
            const cost = parseFloat(costStr);
            if (!isNaN(cost)) {
                const current = orderUpdates.get(orderId) || {
                    cost: 0,
                    tracking: null,
                    carrier: null,
                    method: null
                };
                current.cost += cost;
                if (!current.tracking && tracking) current.tracking = tracking;
                if (!current.carrier && carrier) current.carrier = carrier;
                if (!current.method && method) current.method = method;
                orderUpdates.set(orderId, current);
            }
        }
    }

    const allOrderIds = Array.from(orderUpdates.keys());
    const validOrderIds = new Set();

    console.log(`Verifying ${allOrderIds.length} orders against database...`);
    for (let i = 0; i < allOrderIds.length; i += 100) {
        const batch = allOrderIds.slice(i, i + 100);
        const { data: existing, error } = await db
            .from('amazon_orders')
            .select('amazon_order_id')
            .in('amazon_order_id', batch);

        if (error) {
            console.error('Error fetching orders:', error);
        } else if (existing) {
            existing.forEach(r => validOrderIds.add(r.amazon_order_id));
        }
    }

    const upsertPayloads = [];
    for (const [orderId, data] of orderUpdates.entries()) {
        if (!validOrderIds.has(orderId)) continue;

        const payload = {
            amazon_order_id: orderId,
            shipping_cost: data.cost,
            shipping_source: 'automated_sync',
            shipping_imported_at: new Date().toISOString()
        };

        if (data.tracking) payload.tracking_id = data.tracking;
        if (data.carrier) payload.automated_carrier = data.carrier;
        
        // Simplified method mapping
        let readableMethod = data.method;
        if (readableMethod === 'SWA-UK-2D') readableMethod = 'Amazon Standard Two Day';
        if (readableMethod === 'SWA-UK-PRIME-PREM') readableMethod = 'Amazon Shipping One-Day Tracked';
        if (data.method) payload.automated_ship_method = readableMethod;

        upsertPayloads.push(payload);
    }

    console.log(`Updating ${upsertPayloads.length} matched orders...`);
    let updatedCount = 0;
    for (let i = 0; i < upsertPayloads.length; i += 100) {
        const batch = upsertPayloads.slice(i, i + 100);
        const { error, data: result } = await db
            .from('amazon_orders')
            .upsert(batch, { onConflict: 'amazon_order_id' })
            .select();

        if (error) {
            console.error('Upsert error:', error.message);
        } else {
            updatedCount += result ? result.length : batch.length;
        }
    }

    return updatedCount;
}

async function runAutomation() {
    let browser;
    try {
        const authFile = path.join(process.cwd(), '.auth', 'amazon-shipping.json');
        
        browser = await chromium.launch({
            headless: true, // Run headless for automation
            channel: 'chrome' 
        });

        const options = {
            viewport: { width: 1280, height: 720 },
            acceptDownloads: true
        };

        if (fs.existsSync(authFile)) {
            options.storageState = authFile;
        }

        const context = await browser.newContext(options);
        const page = await context.newPage();

        const today = new Date();
        const pastDate = new Date();
        pastDate.setDate(today.getDate() - 2); 

        const toDateStr = (d) => d.toISOString().split('T')[0];
        const url = `https://ship.amazon.co.uk/tracking?duration=custom&durationStart=${toDateStr(pastDate)}&durationEnd=${toDateStr(today)}`;
        
        console.log(`Navigating to ${url}`);
        await page.goto(url, { waitUntil: 'networkidle' });

        if (page.url().includes('signin')) {
            throw new Error('AUTH_REQUIRED: Please log in via the web dashboard first to refresh cookies.');
        }

        // Wait for survey modal (common blocker)
        try {
            const survey = page.locator('text=satisfied are you with Amazon Shipping');
            if (await survey.isVisible({ timeout: 5000 })) {
                await page.locator('button[aria-label*="Close"]').first().click({ force: true }).catch(() => {});
            }
        } catch(e) {}

        // Select All and Export
        await page.waitForSelector('input[type="checkbox"]', { timeout: 10000 });
        await page.locator('input[type="checkbox"]').first().click({ force: true });
        
        await page.getByRole('button', { name: /actions/i }).click();
        
        const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
        await page.locator('text=/Export.*shipments.*Excel/i').first().click();
        
        const download = await downloadPromise;
        const tmpPath = path.join(os.tmpdir(), `ship-${Date.now()}.xlsx`);
        await download.saveAs(tmpPath);
        
        console.log('Download complete. Processing...');
        const count = await processShippingFile(fs.readFileSync(tmpPath));
        console.log(`Success: Updated ${count} orders.`);
        
        fs.unlinkSync(tmpPath); // Cleanup
        await browser.close();
    } catch (err) {
        if (browser) await browser.close();
        console.error('FATAL ERROR:', err.message);
        process.exit(1);
    }
}

runAutomation();
