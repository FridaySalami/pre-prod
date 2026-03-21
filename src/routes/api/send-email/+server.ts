// src/routes/api/send-email/+server.ts
import { Resend } from 'resend';
import { RESEND_API_KEY } from '$env/static/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const resend = new Resend(RESEND_API_KEY);

export const POST: RequestHandler = async ({ request }) => {
  if (!RESEND_API_KEY) {
    return json({ error: 'RESEND_API_KEY is not set' }, { status: 500 });
  }

  try {
    const { to, subject, html, text, data, attachments } = await request.json();

    // Basic validation
    if (!to || !subject || (!html && !text)) {
      return json(
        { error: 'Missing required fields: to, subject, and body (html or text)' },
        { status: 400 }
      );
    }

    // Example of using data to populate a simple template if html contains placeholders
    // This is a basic form of "populating emails"
    let finalHtml = html;
    if (html && data) {
      Object.entries(data).forEach(([key, value]) => {
        finalHtml = finalHtml.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      });
    }

    // Process attachments to Buffers if they are provided as base64 strings
    interface Attachment {
      filename: string;
      content: string | Buffer;
    }

    let processedAttachments: Attachment[] | undefined;
    if (attachments && Array.isArray(attachments)) {
      processedAttachments = attachments.map((att: any) => {
        if (att.content && typeof att.content === 'string') {
          return {
            filename: att.filename,
            content: Buffer.from(att.content, 'base64')
          };
        }
        return att;
      });
    }

    const { data: emailData, error } = await resend.emails.send({
      from: 'Acme <onboarding@resend.dev>', // Update this with your verified domain
      to,
      subject,
      html: finalHtml,
      text,
      attachments: processedAttachments
    });

    if (error) {
      return json({ error }, { status: 500 });
    }

    return json({ data: emailData });
  } catch (err) {
    return json({ error: 'Internal Server Error', details: err }, { status: 500 });
  }
};
