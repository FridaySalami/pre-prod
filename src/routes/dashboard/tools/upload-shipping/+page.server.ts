import { fail } from '@sveltejs/kit';
import { db } from '$lib/supabaseServer';

export const actions = {
  upload: async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('csv') as File;

    if (!file) {
      return fail(400, { error: 'No file uploaded' });
    }

    if (!file.name.endsWith('.csv')) {
      return fail(400, { error: 'File must be a CSV' });
    }

    try {
      const text = await file.text();
      const lines = text.split('\n');

      if (lines.length < 2) {
        return fail(400, { error: 'CSV file is empty or invalid' });
      }

      // Parse headers
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

      const refIndex = headers.indexOf('Reference #');
      const costIndex = headers.indexOf('Label Cost(GBP)');
      const statusIndex = headers.indexOf('Order status');
      const trackingIndex = headers.indexOf('TrackingId');

      if (refIndex === -1 || costIndex === -1) {
        return fail(400, {
          error: 'Missing required columns: "Reference #" or "Label Cost(GBP)"',
          details: { headers }
        });
      }

      let updatedCount = 0;
      const errors = [];
      const orderCosts = new Map<string, number>();

      // Process rows to aggregate costs
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV parser (handles commas inside quotes roughly)
        const values: string[] = [];
        let inQuote = false;
        let currentValue = '';

        for (let char of line) {
          if (char === '"') {
            inQuote = !inQuote;
          } else if (char === ',' && !inQuote) {
            values.push(currentValue);
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue);

        const orderId = values[refIndex]?.trim().replace(/^"|"$/g, '');
        const costStr = values[costIndex]?.trim().replace(/^"|"$/g, '');
        const status = statusIndex !== -1 ? values[statusIndex]?.trim().replace(/^"|"$/g, '') : '';

        // Skip cancelled orders
        if (status && (status.includes('CANCELLED') || status.includes('Cancelled'))) {
          continue;
        }

        if (orderId && costStr) {
          const cost = parseFloat(costStr);
          if (!isNaN(cost)) {
            const currentTotal = orderCosts.get(orderId) || 0;
            orderCosts.set(orderId, currentTotal + cost);
          }
        }
      }

      // Update Supabase with aggregated costs
      for (const [orderId, totalCost] of orderCosts.entries()) {
        const { error } = await db
          .from('amazon_orders')
          .update({ shipping_cost: totalCost })
          .eq('amazon_order_id', orderId);

        if (error) {
          console.error(`Failed to update order ${orderId}:`, error);
          errors.push(`Failed to update ${orderId}: ${error.message}`);
        } else {
          updatedCount++;
        }
      }

      return {
        success: true,
        message: 'CSV processed successfully',
        updatedCount,
        details: errors.length > 0 ? { errors } : undefined
      };

    } catch (err) {
      console.error('Error processing CSV:', err);
      return fail(500, { error: 'Internal server error processing CSV' });
    }
  }
};
