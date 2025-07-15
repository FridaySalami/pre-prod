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
    const includeAllJobs = url.searchParams.get('include_all_jobs') === 'true';

    // Require either job_id, asin, sku, or include_all_jobs flag
    if (!jobId && !asin && !sku && !includeAllJobs) {
      return json({
        success: false,
        error: 'Either job_id, asin, sku parameter, or include_all_jobs=true is required'
      }, { status: 400 });
    }

    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '25', 10);

    // For very large limits (>10000), remove pagination entirely
    const usePagination = limit <= 10000;
    const offset = usePagination ? (page - 1) * limit : 0;

    // Parse filter parameters
    const showOpportunities = url.searchParams.get('show_opportunities') === 'true';
    const showWinners = url.searchParams.get('show_winners') === 'true';

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

    // Fetch results (with or without pagination)
    let results: any[] = [];
    let resultsError: any = null;

    if (usePagination) {
      // Use normal pagination for smaller limits
      const resultsQuery = query.order('captured_at', { ascending: false })
        .range(offset, offset + limit - 1);
      const response = await resultsQuery;
      results = response.data || [];
      resultsError = response.error;
    } else {
      // For large limits, fetch in batches to avoid Supabase limits
      let allResults: any[] = [];
      let currentOffset = 0;
      const batchSize = 1000; // Supabase safe batch size
      let hasMore = true;

      while (hasMore && currentOffset < 100000) { // Safety limit to prevent infinite loops
        const batchQuery = query.order('captured_at', { ascending: false })
          .range(currentOffset, currentOffset + batchSize - 1);
        const response = await batchQuery;

        if (response.error) {
          resultsError = response.error;
          break;
        }

        const batchResults = response.data || [];
        allResults = allResults.concat(batchResults);

        // If we got less than batchSize, we've reached the end
        hasMore = batchResults.length === batchSize;
        currentOffset += batchSize;
      }

      results = allResults;
    }

    if (resultsError) {
      console.error('Error fetching job results:', resultsError);
      return json({
        success: false,
        error: (resultsError as any)?.message || 'Failed to fetch job results'
      }, { status: 500 });
    }

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
        error: (resultsError as any)?.message || 'Failed to fetch job results'
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
      results: results,
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
