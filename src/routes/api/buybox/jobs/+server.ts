import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';

/**
 * Get Buy Box jobs 
 */
export async function GET({ url }) {
  try {
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Get jobs, sorted by most recent first
    const { data: jobs, error } = await supabaseAdmin
      .from('buybox_jobs')
      .select('*')
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching jobs:', error);
      return json({
        success: false,
        error: error.message || 'Failed to fetch jobs'
      }, { status: 500 });
    }

    return json({
      success: true,
      jobs,
    });

  } catch (error) {
    console.error('Buy Box jobs error:', error);
    return json({
      success: false,
      error: (error as Error).message || 'Failed to fetch Buy Box jobs'
    }, { status: 500 });
  }
}
