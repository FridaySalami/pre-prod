// src/routes/api/webhooks/resend/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// For production, you should verify the signature using crypto
// and the RESEND_WEBHOOK_SECRET env variable.

export const POST: RequestHandler = async ({ request }) => {
  try {
    const payload = await request.json();
    const event = payload.type;
    const emailId = payload.data.email_id;

    console.log(`Received Resend webhook: ${event} for ${emailId}`, payload);

    // Handle different event types here
    switch (event) {
      case 'email.sent':
        // Handle sent event
        break;
      case 'email.delivered':
        // Handle delivered event
        break;
      case 'email.bounced':
        // Handle bounced event
        // e.g., Update status in your database
        break;
      case 'email.complained':
        // Handle spam complaints
        break;
    }

    return json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Error processing webhook:', err);
    return json({ error: 'Webhook processing failed' }, { status: 500 });
  }
};
