import { supabaseAdmin } from '$lib/supabaseAdmin';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ params }) => {
  const { sessionId } = params;

  if (!sessionId) {
    return json({ error: 'Session ID required' }, { status: 400 });
  }

  try {
    // Update the import record to cancelled status
    const { data, error } = await supabaseAdmin
      .from('import_records')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        error_message: 'Upload cancelled by user',
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)
      .eq('status', 'processing') // Only cancel if still processing
      .select()
      .single();

    if (error) {
      console.error('Error cancelling upload:', error);
      return json({ error: 'Failed to cancel upload' }, { status: 500 });
    }

    if (!data) {
      return json({ error: 'Upload session not found or already completed' }, { status: 404 });
    }

    return json({
      success: true,
      message: 'Upload cancelled successfully',
      sessionId: data.session_id,
      status: data.status
    });

  } catch (error) {
    console.error('Error in cancel upload:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
