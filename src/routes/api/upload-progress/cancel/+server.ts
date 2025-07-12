import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return json({ success: false, error: 'Session ID required' }, { status: 400 });
    }

    // Update the import record to cancelled status using Supabase
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
      return json({ success: false, error: 'Failed to cancel upload' }, { status: 500 });
    }

    if (!data) {
      return json({ success: false, error: 'Upload session not found or already completed' }, { status: 404 });
    }

    return json({
      success: true,
      message: 'Upload cancelled successfully',
      sessionId: data.session_id
    });
  } catch (error) {
    console.error('Error cancelling upload:', error);
    return json({ success: false, error: 'Failed to cancel upload' }, { status: 500 });
  }
};
