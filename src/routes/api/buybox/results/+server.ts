import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';

// Request tracking for debugging
let requestCounter = 0;

/**
 * Get Buy Box job results with comprehensive debugging
 */
export async function GET({ url }) {
  const requestId = ++requestCounter;
  const startTime = Date.now();

  // Initial request logging
  console.log(`� [REQ-${requestId}] BuyBox API Request Started`);
  console.log(`🔵 [REQ-${requestId}] URL: ${url.pathname}${url.search}`);
  console.log(`🔵 [REQ-${requestId}] Params: ${url.searchParams.toString()}`);
  console.log(`🔵 [REQ-${requestId}] Timestamp: ${new Date().toISOString()}`);

  // Memory tracking (if available)
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const memUsage = process.memoryUsage();
    console.log(`🔵 [REQ-${requestId}] Memory - RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
  }

  try {
    const jobId = url.searchParams.get('job_id');
    const asin = url.searchParams.get('asin');
    const sku = url.searchParams.get('sku');
    const includeAllJobs = url.searchParams.get('include_all_jobs') === 'true';

    console.log(`🔵 [REQ-${requestId}] Parsed params - jobId: ${jobId}, asin: ${asin}, sku: ${sku}, includeAllJobs: ${includeAllJobs}`);

    // Require either job_id, asin, sku, or include_all_jobs flag
    if (!jobId && !asin && !sku && !includeAllJobs) {
      console.log(`🟡 [REQ-${requestId}] Bad request - missing required params`);
      return json({
        success: false,
        error: 'Either job_id, asin, sku parameter, or include_all_jobs=true is required'
      }, { status: 400 });
    }

    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '25', 10);

    console.log(`🔵 [REQ-${requestId}] Pagination - page: ${page}, limit: ${limit}`);

    // For very large limits (>1000), use batch fetching
    const usePagination = limit <= 1000;
    const offset = usePagination ? (page - 1) * limit : 0;

    console.log(`🔵 [REQ-${requestId}] Strategy - usePagination: ${usePagination}, offset: ${offset}`);

    // Parse filter parameters
    const showOpportunities = url.searchParams.get('show_opportunities') === 'true';
    const showWinners = url.searchParams.get('show_winners') === 'true';

    console.log(`🔵 [REQ-${requestId}] Filters - opportunities: ${showOpportunities}, winners: ${showWinners}`);

    // Build query
    console.log(`🔵 [REQ-${requestId}] Building Supabase query...`);
    const queryStartTime = Date.now();

    let query = supabaseAdmin
      .from('buybox_data')
      .select('*');

    // Apply filters
    if (jobId) {
      query = query.eq('run_id', jobId);
      console.log(`🔵 [REQ-${requestId}] Applied filter: run_id = ${jobId}`);
    }

    if (asin) {
      query = query.eq('asin', asin);
      console.log(`🔵 [REQ-${requestId}] Applied filter: asin = ${asin}`);
    }

    if (sku) {
      query = query.eq('sku', sku);
      console.log(`🔵 [REQ-${requestId}] Applied filter: sku = ${sku}`);
    }

    if (showOpportunities) {
      query = query.eq('opportunity_flag', true);
      console.log(`🔵 [REQ-${requestId}] Applied filter: opportunity_flag = true`);
    }

    if (showWinners) {
      query = query.eq('is_winner', true);
      console.log(`🔵 [REQ-${requestId}] Applied filter: is_winner = true`);
    }

    const queryBuildTime = Date.now() - queryStartTime;
    console.log(`🔵 [REQ-${requestId}] Query built in ${queryBuildTime}ms`);

    // Fetch results (with or without pagination)
    let results: any[] = [];
    let resultsError: any = null;
    const dataFetchStartTime = Date.now();

    console.log(`🔵 [REQ-${requestId}] Starting data fetch - strategy: ${usePagination ? 'pagination' : 'batch'}`);

    if (usePagination) {
      // Use normal pagination for smaller limits
      console.log(`🔵 [REQ-${requestId}] Using pagination: offset=${offset}, limit=${limit}`);
      const paginationStartTime = Date.now();

      const resultsQuery = query.order('captured_at', { ascending: false })
        .range(offset, offset + limit - 1);

      console.log(`🔵 [REQ-${requestId}] Executing paginated query...`);
      const response = await resultsQuery;

      const paginationTime = Date.now() - paginationStartTime;
      console.log(`🔵 [REQ-${requestId}] Pagination completed in ${paginationTime}ms`);
      console.log(`🔵 [REQ-${requestId}] Pagination result: ${response.data?.length || 0} records, error: ${response.error ? 'YES' : 'NO'}`);

      results = response.data || [];
      resultsError = response.error;
    } else {
      // For large limits, fetch in batches to avoid Supabase limits
      console.log(`🔵 [REQ-${requestId}] Using batch fetching`);
      let allResults: any[] = [];
      let currentOffset = 0;
      const batchSize = 500; // Reduced batch size for production stability
      let hasMore = true;
      const maxRecords = Math.min(limit, 10000); // Reduced cap to 10k records for production

      console.log(`🔵 [REQ-${requestId}] Batch config: batchSize=${batchSize}, maxRecords=${maxRecords}`);

      let batchNumber = 0;
      while (hasMore && currentOffset < maxRecords) {
        batchNumber++;
        const batchStart = Date.now();

        console.log(`🔵 [REQ-${requestId}] Starting batch ${batchNumber}: offset=${currentOffset}, size=${batchSize}`);

        try {
          const batchQuery = query.order('captured_at', { ascending: false })
            .range(currentOffset, currentOffset + batchSize - 1);
          const response = await batchQuery;

          const batchTime = Date.now() - batchStart;
          console.log(`� [REQ-${requestId}] Batch ${batchNumber} completed: ${batchTime}ms, ${response.data?.length || 0} records`);

          if (response.error) {
            console.error(`� [REQ-${requestId}] Batch ${batchNumber} error:`, response.error);
            console.error(`🔴 [REQ-${requestId}] Error details:`, JSON.stringify(response.error, null, 2));
            resultsError = response.error;
            break;
          }

          const batchResults = response.data || [];
          allResults = allResults.concat(batchResults);

          console.log(`🔵 [REQ-${requestId}] Batch ${batchNumber} success: ${batchResults.length} records added, total so far: ${allResults.length}`);

          // If we got less than batchSize or reached our limit, we're done
          hasMore = batchResults.length === batchSize && (currentOffset + batchSize) < maxRecords;
          currentOffset += batchSize;

          console.log(`🔵 [REQ-${requestId}] Batch ${batchNumber} next: hasMore=${hasMore}, nextOffset=${currentOffset}`);

          // Add a small delay between batches to reduce server load
          if (hasMore) {
            console.log(`🔵 [REQ-${requestId}] Pausing 100ms before next batch...`);
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (batchError) {
          console.error(`🔴 [REQ-${requestId}] Batch ${batchNumber} exception:`, batchError);
          console.error(`🔴 [REQ-${requestId}] Exception stack:`, batchError instanceof Error ? batchError.stack : 'No stack trace');
          resultsError = batchError;
          break;
        }
      }

      console.log(`🔵 [REQ-${requestId}] Batch fetching completed: ${batchNumber} batches, ${allResults.length} total records`);
      results = allResults;
    }

    const dataFetchTime = Date.now() - dataFetchStartTime;
    console.log(`🔵 [REQ-${requestId}] Data fetch completed in ${dataFetchTime}ms`);

    if (resultsError) {
      console.error(`🔴 [REQ-${requestId}] Results error:`, resultsError);
      console.error(`🔴 [REQ-${requestId}] Error type:`, typeof resultsError);
      console.error(`🔴 [REQ-${requestId}] Error details:`, JSON.stringify(resultsError, null, 2));
      return json({
        success: false,
        error: (resultsError as any)?.message || 'Failed to fetch job results'
      }, { status: 500 });
    }

    // Build total count query with the same filters
    console.log(`🔵 [REQ-${requestId}] Starting count queries...`);
    const countStartTime = Date.now();

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
    console.log(`🔵 [REQ-${requestId}] Executing count query...`);
    const countQueryStart = Date.now();
    const { count: totalCount, error: countError } = await countQuery;
    const countQueryTime = Date.now() - countQueryStart;

    console.log(`🔵 [REQ-${requestId}] Count query completed: ${countQueryTime}ms, count=${totalCount}, error=${countError ? 'YES' : 'NO'}`);

    if (countError) {
      console.error(`🔴 [REQ-${requestId}] Count query error:`, countError);
      return json({
        success: false,
        error: (countError as any)?.message || 'Failed to fetch count'
      }, { status: 500 });
    }

    // Get counts for winners and opportunities
    console.log(`🔵 [REQ-${requestId}] Starting winners count query...`);
    const winnersCountStart = Date.now();

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
    const { count: winnersCount, error: winnersError } = await winnersCountQuery;
    const winnersCountTime = Date.now() - winnersCountStart;

    console.log(`🔵 [REQ-${requestId}] Winners count completed: ${winnersCountTime}ms, count=${winnersCount}, error=${winnersError ? 'YES' : 'NO'}`);

    if (winnersError) {
      console.error(`🔴 [REQ-${requestId}] Winners count error:`, winnersError);
    }

    console.log(`🔵 [REQ-${requestId}] Starting opportunities count query...`);
    const opportunitiesCountStart = Date.now();

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
    const { count: opportunitiesCount, error: opportunitiesError } = await opportunitiesCountQuery;
    const opportunitiesCountTime = Date.now() - opportunitiesCountStart;

    console.log(`🔵 [REQ-${requestId}] Opportunities count completed: ${opportunitiesCountTime}ms, count=${opportunitiesCount}, error=${opportunitiesError ? 'YES' : 'NO'}`);

    if (opportunitiesError) {
      console.error(`🔴 [REQ-${requestId}] Opportunities count error:`, opportunitiesError);
    }

    const totalCountTime = Date.now() - countStartTime;
    console.log(`� [REQ-${requestId}] All count queries completed in ${totalCountTime}ms`);

    const totalTime = Date.now() - startTime;
    console.log(`🟢 [REQ-${requestId}] Request completed successfully: ${totalTime}ms total, ${results?.length || 0} results`);
    console.log(`🟢 [REQ-${requestId}] Response size: ~${JSON.stringify({ results, total: totalCount }).length} characters`);

    // Final memory check
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      console.log(`🟢 [REQ-${requestId}] Final Memory - RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    }

    return json({
      success: true,
      results: results,
      total: totalCount,
      winners_count: winnersCount,
      opportunities_count: opportunitiesCount,
      page,
      limit,
      debug: {
        requestId,
        totalTime,
        resultCount: results?.length || 0,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`� [REQ-${requestId}] CRITICAL ERROR after ${totalTime}ms:`, error);
    console.error(`🔴 [REQ-${requestId}] Error type:`, typeof error);
    console.error(`🔴 [REQ-${requestId}] Error name:`, error instanceof Error ? error.name : 'Unknown');
    console.error(`🔴 [REQ-${requestId}] Error message:`, error instanceof Error ? error.message : String(error));
    console.error(`🔴 [REQ-${requestId}] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');

    // Additional context logging
    console.error(`🔴 [REQ-${requestId}] Request context:`);
    console.error(`🔴 [REQ-${requestId}]   - URL: ${url.pathname}${url.search}`);
    console.error(`🔴 [REQ-${requestId}]   - Timestamp: ${new Date().toISOString()}`);
    console.error(`🔴 [REQ-${requestId}]   - Duration: ${totalTime}ms`);

    // Memory check on error
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      console.error(`🔴 [REQ-${requestId}] Error Memory - RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    }

    return json({
      success: false,
      error: (error as Error).message || 'Failed to fetch Buy Box results',
      debug: {
        requestId,
        errorTime: totalTime,
        timestamp: new Date().toISOString(),
        errorType: error instanceof Error ? error.name : 'Unknown'
      }
    }, { status: 500 });
  }
}
