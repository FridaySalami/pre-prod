
import { json } from '@sveltejs/kit';
import { db } from '$lib/supabaseServer';
import { fetchOrdersData } from '$lib/server/data-fetchers';
import { generateDailyReportHtml } from '$lib/server/email-templates';
import { sendEmail } from '$lib/server/email';
import { env } from '$env/dynamic/private';

export async function POST({ request }) {
  try {
    const { date, orderIds, sendEmail: shouldSendEmail } = await request.json();
    console.log('Starting Fulfillment Validation...', { date, orderIdsCount: orderIds?.length });

    // ... (rest of validation logic) ...

    let query = db.from('amazon_orders').select('*');

    let startDate: Date;
    let endDate: Date;

    if (orderIds && orderIds.length > 0) {
      query = query.in('amazon_order_id', orderIds);
    } else if (date) {
      startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      query = query.gte('purchase_date', startDate.toISOString())
        .lte('purchase_date', endDate.toISOString());
    } else {
      return json({ error: 'Please provide date or orderIds' }, { status: 400 });
    }

    const { data: orders, error } = await query;

    if (error) {
      // ...
      console.error('Validation DB Error', error);
      return json({ error: 'Database error' }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return json({ success: true, message: 'No orders found to validate', data: { complete: 0, incomplete: 0, total: 0 } });
    }

    const validationResults = orders.map(order => {
      const issues = [];

      // Skip Canceled and Pending orders from validation requirements
      // Pending orders are waiting on Amazon/Customer, not us
      if (order.order_status === 'Canceled' || order.order_status === 'Pending') {
        return {
          orderId: order.amazon_order_id,
          status: order.order_status,
          isComplete: true,
          issues: []
        };
      }

      // Check Shipping Cost
      if (order.shipping_cost === null || order.shipping_cost === undefined) {
        issues.push('Missing Shipping Cost');
      }

      // Check Carrier
      if (!order.automated_carrier && !order.carrier) { // Check both potential fields
        issues.push('Missing Carrier');
      }

      // Check Tracking
      // Relaxed: Tracking ID is not strictly required for report readiness if cost is present
      // if (!order.tracking_id) {
      //   issues.push('Missing Tracking ID');
      // }

      return {
        orderId: order.amazon_order_id,
        status: order.order_status,
        isComplete: issues.length === 0,
        issues
      };
    });

    const total = validationResults.length;
    const complete = validationResults.filter(r => r.isComplete).length;
    const incomplete = validationResults.filter(r => !r.isComplete).length;
    const incompleteDetails = validationResults.filter(r => !r.isComplete);

    // Report Ready Criteria: 90% completion
    const completionRate = total > 0 ? (complete / total) : 1;
    const reportReady = completionRate >= 0.90;

    let emailResult = null;
    if (reportReady && shouldSendEmail) {
      console.log('Report criteria met. Generating and sending email...');

      // 1. Fetch deep data for report
      const reportDate = startDate! || new Date();
      // Determine end date if not set (e.g. if orderIds provided)
      const reportEndDate = endDate! || new Date();

      const fullOrdersData = await fetchOrdersData(reportDate, reportEndDate, undefined);

      // 2. Generate HTML
      const html = generateDailyReportHtml(fullOrdersData, reportDate);

      // 3. Send Email
      const recipient = env.ALERT_EMAIL_TO || 'jack.w@parkersfoodservice.co.uk';
      const subject = `Amazon Orders Report - ${reportDate.toLocaleDateString()}`;

      emailResult = await sendEmail({ to: recipient, subject, html });
    }

    return json({
      success: true,
      message: reportReady
        ? `Report Criteria Met: ${(completionRate * 100).toFixed(1)}% complete`
        : `Report Not Ready: ${(completionRate * 100).toFixed(1)}% complete`,
      data: {
        total,
        complete,
        incomplete,
        details: incompleteDetails,
        reportReady,
        emailSent: emailResult?.success,
        emailMessageId: emailResult?.messageId
      }
    });

  } catch (err: any) {
    console.error('Validation Error', err);
    return json({ error: err.message }, { status: 500 });
  }
}
