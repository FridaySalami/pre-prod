import { fail } from '@sveltejs/kit';
import { db } from '$lib/supabaseServer';
import * as XLSX from 'xlsx';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';

async function processShippingFile(buffer: ArrayBuffer | Buffer) {
  const workbook = XLSX.read(buffer);
  if (!workbook.SheetNames.length) {
    throw new Error('File contains no sheets');
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

  if (rows.length < 2) {
    throw new Error('File is empty or invalid');
  }

  // Parse headers using fuzzy matching
  const headers = rows[0].map((h) => String(h || '').trim());

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const headerMap = headers.map(norm);
  const findCol = (re: RegExp) => headerMap.findIndex(h => re.test(h));

  const refIndex = findCol(/^reference\s*#$/i);
  const costIndex = findCol(/label\s*cost.*gbp/i);
  const statusIndex = findCol(/order\s*status/i);
  const trackingIndex = findCol(/tracking\s*id/i);
  const carrierIndex = findCol(/carrier/i);
  const speedIndex = findCol(/delivery\s*speed/i);
  const labelDateIndex = findCol(/label\s*creation\s*date/i);
  const sourceIndex = findCol(/order\s*source/i);

  if (refIndex === -1 || costIndex === -1) {
    throw new Error('Missing required columns: "Reference #" or "Label Cost(GBP)" (checked with fuzzy matching)');
  }

  let updatedCount = 0;
  let insertedCount = 0;
  const errors: string[] = [];
  const orderUpdates = new Map<
    string,
    {
      cost: number;
      tracking: string | null;
      carrier: string | null;
      method: string | null;
      status: string | null;
      labelDate: string | null;
      source: string | null;
    }
  >();

  // Process rows to aggregate costs
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const getValue = (index: number) => {
      if (index === -1 || index >= row.length) return undefined;
      const val = row[index];
      return val === undefined || val === null ? '' : String(val).trim();
    };

    const orderId = getValue(refIndex);
    const costStr = getValue(costIndex);
    const status = getValue(statusIndex);
    const tracking = getValue(trackingIndex);
    const carrier = getValue(carrierIndex);
    const method = getValue(speedIndex);
    const labelDate = getValue(labelDateIndex);
    const source = getValue(sourceIndex);

    // Skip cancelled orders
    if (status && /cancel/i.test(status)) {
      continue;
    }

    if (orderId && costStr) {
      const cost = parseFloat(costStr);
      if (!isNaN(cost)) {
        const current = orderUpdates.get(orderId) || {
          cost: 0,
          tracking: null,
          carrier: null,
          method: null,
          status: null,
          labelDate: null,
          source: null
        };

        // Accumulate cost
        current.cost += cost;

        // Take the first non-empty value found for metadata
        if (!current.tracking && tracking) current.tracking = tracking;
        if (!current.carrier && carrier) current.carrier = carrier;
        if (!current.method && method) current.method = method;
        if (!current.status && status) current.status = status;
        if (!current.labelDate && labelDate) current.labelDate = labelDate;
        if (!current.source && source) current.source = source;

        orderUpdates.set(orderId, current);
      }
    }
  }

  // Optimize updates by checking existence first, then batch upserting
  const allOrderIds = Array.from(orderUpdates.keys());
  let validOrderIds = new Set<string>();

  // Check existence in batches of 100
  // Reduced from 1000 to avoid HeadersOverflowError/URI Too Long errors with Supabase
  for (let i = 0; i < allOrderIds.length; i += 100) {
    const batch = allOrderIds.slice(i, i + 100);
    const { data: existing, error } = await db
      .from('amazon_orders')
      .select('amazon_order_id')
      .in('amazon_order_id', batch);

    if (error) {
      console.error('Error fetching existing orders:', error);
      errors.push('Failed to verify existing orders');
    } else if (existing) {
      existing.forEach(r => validOrderIds.add(r.amazon_order_id));
    }
  }

  // Prepare batch upsert payload
  const upsertPayloads = [];
  for (const [orderId, data] of orderUpdates.entries()) {
    // Only verify against DB if we want to STRICTLY avoid inserts.
    // If the user wants to skip unknown orders, we must filter by validOrderIds.
    if (!validOrderIds.has(orderId)) {
      continue;
    }

    const payload: any = {
      amazon_order_id: orderId,
      shipping_cost: data.cost,
      shipping_source: 'amazon_shipping_export',
      shipping_imported_at: new Date().toISOString()
    };

    // Format method
    let readableMethod = data.method;
    if (data.method) {
      if (readableMethod === 'SWA-UK-2D') readableMethod = 'Amazon Standard Two Day';
      if (readableMethod === 'SWA-UK-PRIME-PREM') readableMethod = 'Amazon Shipping One-Day Tracked';
      if (readableMethod === 'SWA-UK-RTO') readableMethod = 'Amazon Return to Origin';
      payload.automated_ship_method = readableMethod;
    }

    if (data.tracking) payload.tracking_id = data.tracking;
    if (data.carrier) payload.automated_carrier = data.carrier;

    upsertPayloads.push(payload);
  }

  // Perform Batch Upsert
  // Limit batch size to avoid payload limits (e.g. 100 at a time)
  const BATCH_SIZE = 100;
  for (let i = 0; i < upsertPayloads.length; i += BATCH_SIZE) {
    const batch = upsertPayloads.slice(i, i + BATCH_SIZE);
    const { error, data: result } = await db
      .from('amazon_orders')
      .upsert(batch, { onConflict: 'amazon_order_id', ignoreDuplicates: false })
      .select();

    if (error) {
      console.error('Batch update failed:', error);
      errors.push(`Batch ${i / BATCH_SIZE + 1} failed: ${error.message}`);
    } else {
      updatedCount += result ? result.length : batch.length;
    }
  }

  const matchRate = allOrderIds.length > 0 ? (validOrderIds.size / allOrderIds.length) : 0;
  const matchRatePercent = (matchRate * 100).toFixed(1);
  console.log(`Sync Complete: Found ${allOrderIds.length} orders in CSV. Verified ${validOrderIds.size} exist in DB. Match Rate: ${matchRatePercent}%. Updated ${updatedCount} records.`);

  return {
    success: true, // Always return success so the user sees the report
    message: updatedCount > 0
      ? `Processed: ${updatedCount} orders updated.`
      : `Sync completed. No existing orders needed updates.`,
    stats: {
      totalFound: allOrderIds.length,
      verifiedInDb: validOrderIds.size,
      matchRate: `${matchRatePercent}%`,
      updated: updatedCount
    },
    updatedCount, // Legacy support
    details: errors.length > 0 ? { errors } : undefined
  };
}

export const actions = {
  upload: async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('csv') as File;

    if (!file) {
      return fail(400, { error: 'No file uploaded' });
    }

    if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
      return fail(400, { error: 'File must be a CSV or Excel file' });
    }

    try {
      const buffer = await file.arrayBuffer();
      return await processShippingFile(buffer);
    } catch (err: any) {
      console.error('Error processing file:', err);
      return fail(500, { error: err.message || 'Internal server error processing file' });
    }
  },

  download_sync: async () => {
    let browser;
    try {
      const authFile = path.join(process.cwd(), '.auth', 'amazon-shipping.json');

      // Launch headed so user can intervene if needed
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome' // Attempts to use installed Chrome
      });

      // Load storage state if it exists
      const options: any = {
        viewport: { width: 1280, height: 720 },
        acceptDownloads: true
      };

      if (fs.existsSync(authFile)) {
        console.log('Using saved auth state');
        options.storageState = authFile;
      }

      const context = await browser.newContext(options);
      const page = await context.newPage();

      // Calculate dates for "Last 3 Days" logic (Today - 2 days, to Today)
      // This reduces download size compared to default last 7 days
      const today = new Date();
      const pastDate = new Date();
      pastDate.setDate(today.getDate() - 2); // 2 days ago

      // Helper to format YYYY-MM-DD
      const toDateStr = (d: Date) => d.toISOString().split('T')[0];

      const durationStart = toDateStr(pastDate);
      const durationEnd = toDateStr(today);

      console.log(`Navigating to Amazon Shipping for range: ${durationStart} to ${durationEnd}`);

      // 1. Navigate directly with custom query param
      const url = `https://ship.amazon.co.uk/tracking?duration=custom&durationStart=${durationStart}&durationEnd=${durationEnd}`;
      await page.goto(url, { waitUntil: 'networkidle' });

      // 2. Handle Login if necessary
      // If we are redirected to a signin page, wait for the user to complete it
      if (page.url().includes('signin') || page.url().includes('ap/signin')) {
        console.log('Login required. Waiting for user...');
        // Wait for user to reach tracking dashboard
        await page.waitForURL('**/tracking**', { timeout: 120000 });

        // Save the fresh auth state for next time
        await context.storageState({ path: authFile });
      }

      // 3. Select All Shipments
      // Try to leverage the table structure if possible, otherwise fallback to first input checkbox
      await page.waitForLoadState('domcontentloaded');

      const checkboxSelector = 'input[type="checkbox"]';
      console.log('Attempting to select all shipments...');

      // Wait for at least one checkbox to be present
      try {
        await page.waitForSelector(checkboxSelector, { timeout: 10000, state: 'attached' });
      } catch (e) {
        throw new Error('No checkboxes found on page. Page might not have loaded correctly.');
      }

      // Try checking the first checkbox
      const firstCheckbox = page.locator(checkboxSelector).first();

      // Helper to check if checked
      const isChecked = async () => await firstCheckbox.isChecked();

      if (!(await isChecked())) {
        console.log('Checkbox not checked. attempting click...');
        try {
          // Use click instead of check() as it triggers UI events better for Angular/React
          // Use force: true to bypass visibility checks, but catch errors if it fails completely
          await firstCheckbox.click({ force: true, timeout: 5000 });
        } catch (e) {
          console.log('Standard click failed (element might be hidden), trying fallbacks...');
        }
        await page.waitForTimeout(500);
      }

      // Double check and retry with JS if needed
      if (!(await isChecked())) {
        console.log('Playwright click failed/skipped. Trying JS click on parent element...');
        try {
          // Try clicking the parent (often the label or custom styled div)
          await firstCheckbox.locator('..').click({ force: true, timeout: 2000 });
        } catch (e) {
          console.log('Parent click failed, moving to JS evaluation');
        }
        await page.waitForTimeout(500);
      }

      // Last resort: JS Direct Click
      if (!(await isChecked())) {
        console.log('Parent click failed. Forcing JS click...');
        await page.evaluate(() => {
          const el = document.querySelector('input[type="checkbox"]');
          if (el) {
            // Try standard click
            (el as HTMLElement).click();
            // Consistently set checked just in case
            if (!(el as HTMLInputElement).checked) {
              (el as HTMLInputElement).checked = true;
              // Dispatch change event manually
              el.dispatchEvent(new Event('change', { bubbles: true }));
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        });
        await page.waitForTimeout(1000);
      }

      if (!(await isChecked())) {
        console.warn('WARNING: Could not verify "Select All" checkbox is checked. Proceeding anyway but export might be empty.');
      } else {
        console.log('"Select All" checkbox verified checked.');
      }

      // Robust button selector with text fallback
      let actionsBtn = page.getByRole('button', { name: /actions/i });

      try {
        await actionsBtn.waitFor({ state: 'visible', timeout: 3000 });
      } catch {
        // Fallback to text if no button role
        console.log('Button role not found, trying text locator...');
        actionsBtn = page.locator('text=/^actions$/i').first();
        await actionsBtn.waitFor({ state: 'visible', timeout: 5000 });
      }

      await actionsBtn.click();

      console.log('Waiting for export option...');
      // 5. Click Export
      // Setup download listener before clicking
      console.log('Setting up download listener (timeout: 180s)...');
      // preventing crash by catching error and returning null
      const downloadPromise = page.waitForEvent('download', { timeout: 180000 })
        .catch(e => null);

      // Click the export menu item (matches "Export [number] shipments to Excel")
      const exportBtn = page.locator('text=/Export.*shipments.*Excel/i').first();

      try {
        await exportBtn.waitFor({ state: 'visible', timeout: 5000 });
      } catch (e) {
        console.log('Export button not visible, retrying Actions click...');
        // Retry clicking actions if the menu didn't open
        await actionsBtn.click({ force: true });
        await exportBtn.waitFor({ state: 'visible', timeout: 5000 });
      }

      const exportTextRaw = await exportBtn.textContent();
      const exportText = (exportTextRaw || '').trim().replace(/\s+/g, ' ');
      console.log(`Found Export button: "${exportText}"`);

      // Double check we aren't exporting 0 shipments
      // Usually it says "Export 1234 shipments to Excel"
      // If it says "Export 0 shipments", we stop.
      if (exportText.includes('Export 0 shipments')) {
        throw new Error('No shipments selected to export (0 shipments). Checkbox selection failed.');
      }

      await exportBtn.click();
      console.log('Export button clicked. Waiting for download to start...');

      const download = await downloadPromise;
      if (!download) throw new Error('Download failed, timed out, or browser closed before start.');

      console.log('Download started. Waiting for file to save...');

      // Use a consistent temp path instead of relying on default download path
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'amz-ship-'));
      const downloadPath = path.join(tmpDir, download.suggestedFilename() || 'download.xlsx');
      await download.saveAs(downloadPath);
      console.log(`File saved to ${downloadPath}`);

      // Save state again just in case cookies refreshed
      await context.storageState({ path: authFile });


      // 6. Read and Process
      const fileBuffer = fs.readFileSync(downloadPath);
      const result = await processShippingFile(fileBuffer);

      await browser.close();

      return result;

    } catch (err: any) {
      if (browser) await browser.close();
      console.error('Automation error:', err);
      // Clean up error message for UI
      const msg = err.message || '';
      if (msg.includes('Timeout')) {
        return fail(504, { error: 'Automation timed out. Did you log in?' });
      }
      return fail(500, { error: `Automation failed: ${msg}` });
    }
  }
};
