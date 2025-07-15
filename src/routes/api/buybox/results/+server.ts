import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';

/**
 * Get Buy Box job results 
 */
export async function GET({ url }) {
  try {
    const jobId = url.searchParams.get('job_id');
    const asin = url.searchParams.get('asin');
    const sku = url.searchParams.get('sku');

    // Require either job_id or asin/sku
    if (!jobId && !asin && !sku) {
      return json({
        success: false,
        error: 'Either job_id, asin, or sku parameter is required'
      }, { status: 400 });
    }

    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '25', 10);
    const offset = (page - 1) * limit;

    // Parse filter parameters
    const showOpportunities = url.searchParams.get('show_opportunities') === 'true';
    const showWinners = url.searchParams.get('show_winners') === 'true';
    const includeAllJobs = url.searchParams.get('include_all_jobs') === 'true';

    // Build query
    let query = supabaseAdmin
      .from('buybox_data')
      .select('*');

    // Apply filters
    if (jobId) {
      query = query.eq('run_id', jobId);
    }

    if (asin) {
      query = query.eq('asin', asin);
    }

    if (sku) {
      query = query.eq('sku', sku);
    }

    if (showOpportunities) {
      query = query.eq('opportunity_flag', true);
    }

    if (showWinners) {
      query = query.eq('is_winner', true);
    }

    // Fetch paginated results
    const { data: results, error: resultsError } = await query
      .order('captured_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Build total count query with the same filters
    let countQuery = supabaseAdmin
      .from('buybox_data')
      .select('id', { count: 'exact' });

    if (jobId) {
      countQuery = countQuery.eq('run_id', jobId);
    }

    if (asin) {
      countQuery = countQuery.eq('asin', asin);
    }

    if (sku) {
      countQuery = countQuery.eq('sku', sku);
    }

    if (showOpportunities) {
      countQuery = countQuery.eq('opportunity_flag', true);
    }

    if (showWinners) {
      countQuery = countQuery.eq('is_winner', true);
    }

    // Get total count separately
    const { count: totalCount } = await countQuery;

    if (resultsError) {
      console.error('Error fetching job results:', resultsError);
      return json({
        success: false,
        error: resultsError.message || 'Failed to fetch job results'
      }, { status: 500 });
    }

    // Get counts for winners and opportunities
    let winnersCountQuery = supabaseAdmin
      .from('buybox_data')
      .select('*', { count: 'exact', head: true });

    if (jobId && !includeAllJobs) {
      winnersCountQuery = winnersCountQuery.eq('run_id', jobId);
    }

    if (asin) {
      winnersCountQuery = winnersCountQuery.eq('asin', asin);
    }

    if (sku) {
      winnersCountQuery = winnersCountQuery.eq('sku', sku);
    }

    winnersCountQuery = winnersCountQuery.eq('is_winner', true);
    const { count: winnersCount } = await winnersCountQuery;

    let opportunitiesCountQuery = supabaseAdmin
      .from('buybox_data')
      .select('*', { count: 'exact', head: true });

    if (jobId && !includeAllJobs) {
      opportunitiesCountQuery = opportunitiesCountQuery.eq('run_id', jobId);
    }

    if (asin) {
      opportunitiesCountQuery = opportunitiesCountQuery.eq('asin', asin);
    }

    if (sku) {
      opportunitiesCountQuery = opportunitiesCountQuery.eq('sku', sku);
    }

    opportunitiesCountQuery = opportunitiesCountQuery.eq('opportunity_flag', true);
    const { count: opportunitiesCount } = await opportunitiesCountQuery;

    return json({
      success: true,
      results,
      total: totalCount,
      winners_count: winnersCount,
      opportunities_count: opportunitiesCount,
      page,
      limit
    });

  } catch (error) {
    console.error('Buy Box results error:', error);
    return json({
      success: false,
      error: (error as Error).message || 'Failed to fetch Buy Box results'
    }, { status: 500 });
  }
}
