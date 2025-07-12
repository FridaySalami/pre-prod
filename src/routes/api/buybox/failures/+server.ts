import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';

/**
 * Get Buy Box job failures 
 */
export async function GET({ url }) {
  try {
    const jobId = url.searchParams.get('job_id');
    if (!jobId) {
      return json({
        success: false,
        error: 'job_id parameter is required'
      }, { status: 400 });
    }

    const { data: failures, error } = await supabaseAdmin
      .from('buybox_failures')
      .select('*')
      .eq('job_id', jobId)
      .order('captured_at', { ascending: false });

    if (error) {
      console.error('Error fetching job failures:', error);
      return json({
        success: false,
        error: error.message || 'Failed to fetch job failures'
      }, { status: 500 });
    }

    return json({
      success: true,
      failures,
    });

  } catch (error) {
    console.error('Buy Box failures error:', error);
    return json({
      success: false,
      error: (error as Error).message || 'Failed to fetch Buy Box failures'
    }, { status: 500 });
  }
}
