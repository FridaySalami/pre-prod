import { supabaseAdmin } from '$lib/supabaseAdmin';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params }) => {
  const { sessionId } = params;

  if (!sessionId) {
    return new Response('Session ID required', { status: 400 });
  }

  // Create Server-Sent Events stream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection message
      controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));

      // Poll for progress updates
      const pollInterval = setInterval(async () => {
        try {
          const { data: importRecord, error } = await supabaseAdmin
            .from('import_records')
            .select('*')
            .eq('session_id', sessionId)
            .single();

          if (error) {
            controller.enqueue(encoder.encode(`data: {"type":"error","message":"${error.message}"}\n\n`));
            return;
          }

          if (importRecord) {
            const progress = {
              type: 'progress',
              sessionId: importRecord.session_id,
              status: importRecord.status,
              totalRecords: importRecord.total_records,
              processedRecords: importRecord.processed_records,
              importedRecords: importRecord.imported_records,
              updatedRecords: importRecord.updated_records,
              errorCount: importRecord.error_count,
              percentage: importRecord.total_records > 0
                ? Math.round((importRecord.processed_records / importRecord.total_records) * 100)
                : 0,
              startedAt: importRecord.started_at,
              completedAt: importRecord.completed_at,
              errorMessage: importRecord.error_message
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`));

            // Close stream if upload is complete or failed
            if (importRecord.status === 'completed' || importRecord.status === 'error') {
              clearInterval(pollInterval);
              controller.close();
            }
          }
        } catch (error) {
          controller.enqueue(encoder.encode(`data: {"type":"error","message":"Internal server error"}\n\n`));
          clearInterval(pollInterval);
          controller.close();
        }
      }, 1000); // Poll every second

      // Clean up interval after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        controller.close();
      }, 300000);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
};
