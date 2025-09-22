import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';

// Request tracking for debugging
let requestCounter = 0;

// Type definition for competitor offers from buybox_offers table
interface CompetitorOffer {
  run_id: string;
  asin: string;
  sku: string;
  seller_id: string;
  seller_name: string;
  listing_price: number;
  shipping: number;
  is_prime: boolean;
  is_fba: boolean;
  condition: string;
  raw_offer: any;
}

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
    const includeNoMarginData = url.searchParams.get('include_no_margin') === 'true';

    console.log(`🔵 [REQ-${requestId}] Filters - opportunities: ${showOpportunities}, winners: ${showWinners}, includeNoMargin: ${includeNoMarginData}`);

    // Build query
    console.log(`🔵 [REQ-${requestId}] Building Supabase query...`);
    const queryStartTime = Date.now();

    // OPTIMIZATION: Only select columns that are actually used in buy-box-manager interface
    // This significantly reduces response size by excluding unused columns
    const selectedColumns = [
      'id', 'asin', 'sku', 'captured_at', 'run_id',
      // Status flags
      'is_winner', 'opportunity_flag',
      // Stock and offer tracking
      'your_offers_count', 'total_offers_count',
      // Pricing fields
      'price', 'your_current_price', 'competitor_price', 'break_even_price', 'buybox_price',
      // Cost breakdown fields
      'your_cost', 'your_shipping_cost', 'your_material_total_cost', 'your_box_cost',
      'your_vat_amount', 'your_fragile_charge', 'total_operating_cost',
      // Profit and margin analysis
      'current_actual_profit', 'buybox_actual_profit',
      'your_margin_percent_at_current_price', 'margin_percent_at_buybox_price',
      'margin_difference', 'profit_opportunity',
      // ROI margin calculation breakdown (new fields)
      'current_margin_calculation', 'buybox_margin_calculation',
      'total_investment_current', 'total_investment_buybox',
      // Recommendations
      'recommended_action',
      // Shipping information
      'merchant_shipping_group',
      // Product information
      'item_name', // Re-added for better UX instead of lazy loading
      // Price update tracking
      'last_price_update', 'update_source'
      // Removed: product_title (replaced with item_name), material_cost_only, current_profit_breakdown, 
      // buybox_profit_breakdown, price_adjustment_needed, margin_calculation_version, 
      // cost_data_source, and other metadata fields not displayed in UI
    ];

    console.log(`🔵 [REQ-${requestId}] Selecting ${selectedColumns.length} columns (optimized from SELECT *, includes ROI calculation fields):`);
    console.log(`🔵 [REQ-${requestId}] ${selectedColumns.join(', ')}`);

    let query = supabaseAdmin
      .from('buybox_data')
      .select(selectedColumns.join(','));

    // OPTIMIZATION: Filter out records with no margin data by default (significantly reduces response size)
    if (!includeNoMarginData) {
      query = query.not('total_operating_cost', 'is', null);
      console.log(`🔵 [REQ-${requestId}] Applied filter: total_operating_cost IS NOT NULL (excludes records without margin data)`);
    }

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
      const batchSize = 300; // Further reduced batch size for response size limits
      let hasMore = true;
      const maxRecords = Math.min(limit, 4000); // Increased cap to 4k records for testing

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

    // Fetch competitor offers for each buybox record
    console.log(`🔵 [REQ-${requestId}] Starting competitor offers fetch...`);
    const competitorFetchStartTime = Date.now();

    if (results && results.length > 0) {
      try {
        // Get unique run_ids from results
        const runIds = [...new Set(results.map(r => r.run_id).filter(Boolean))];
        console.log(`🔵 [REQ-${requestId}] Fetching competitor offers for ${runIds.length} unique run_ids`);

        if (runIds.length > 0) {
          // Fetch ALL competitor data using pagination to overcome Supabase 1000 record limit
          let allCompetitorOffers: CompetitorOffer[] = [];
          let currentOffset = 0;
          const batchSize = 1000;
          let hasMore = true;

          console.log(`🔵 [REQ-${requestId}] Fetching ALL competitor offers for ${runIds.length} run_ids using pagination...`);

          while (hasMore) {
            const { data: batchOffers, error: competitorError } = await supabaseAdmin
              .from('buybox_offers')
              .select('run_id, asin, sku, seller_id, seller_name, listing_price, shipping, is_prime, is_fba, condition, raw_offer')
              .in('run_id', runIds)
              .order('listing_price', { ascending: true })
              .range(currentOffset, currentOffset + batchSize - 1);

            if (competitorError) {
              console.error(`🔴 [REQ-${requestId}] Competitor offers error:`, competitorError);
              break;
            }

            const batchCount = batchOffers?.length || 0;
            allCompetitorOffers = allCompetitorOffers.concat(batchOffers || []);

            console.log(`🔵 [REQ-${requestId}] Fetched batch: ${batchCount} offers (offset: ${currentOffset}), total so far: ${allCompetitorOffers.length}`);

            // If we got less than batchSize, we're done
            hasMore = batchCount === batchSize;
            currentOffset += batchSize;

            // Safety break to prevent infinite loops
            if (currentOffset > 10000) {
              console.log(`� [REQ-${requestId}] Safety limit reached at 10,000 competitive offers`);
              break;
            }
          }

          const competitorOffers = allCompetitorOffers;
          console.log(`🔵 [REQ-${requestId}] Fetched ${competitorOffers?.length || 0} competitor offers total`);

          // Debug: Check if we found the B01E4KDDV4 competitive offer
          if (competitorOffers && competitorOffers.length > 0) {
            const sampleOffer = competitorOffers.find(o => o.asin === 'B01E4KDDV4');
            if (sampleOffer) {
              console.log(`🔍 [REQ-${requestId}] DEBUG - Found offer for B01E4KDDV4:`, JSON.stringify(sampleOffer, null, 2));
            }
          }

          // Group competitor offers by run_id + asin (+ sku if available) and limit to top 3 per listing
          const offersByKey = new Map();
          competitorOffers?.forEach(offer => {
            // Create unique key for each ASIN within this run_id
            const key = `${offer.run_id}_${offer.asin}${offer.sku ? '_' + offer.sku : ''}`;

            // Debug for specific ASIN
            if (offer.asin === 'B01E4KDDV4') {
              console.log(`🔍 [REQ-${requestId}] DEBUG Offer B01E4KDDV4 - Generated key: ${key}`);
              console.log(`🔍 [REQ-${requestId}] DEBUG Offer B01E4KDDV4 - run_id: ${offer.run_id}, asin: ${offer.asin}, sku: ${offer.sku}`);
            }

            if (!offersByKey.has(key)) {
              offersByKey.set(key, []);
            }

            // Only keep top 3 competitors per ASIN to reduce data size
            const currentOffers = offersByKey.get(key);
            if (currentOffers.length < 3) {
              // Extract additional data from raw_offer if available
              let sellerRating = null;
              let feedbackCount = null;
              let shippingTime = null;
              let isPrime = offer.is_prime; // Default to database value
              let isFba = offer.is_fba; // Default to database value

              if (offer.raw_offer) {
                // Extract seller feedback rating
                if (offer.raw_offer.SellerFeedbackRating) {
                  sellerRating = offer.raw_offer.SellerFeedbackRating.SellerPositiveFeedbackRating;
                  feedbackCount = offer.raw_offer.SellerFeedbackRating.FeedbackCount;
                }

                // Extract shipping time information
                if (offer.raw_offer.ShippingTime) {
                  const shippingTimeData = offer.raw_offer.ShippingTime;
                  if (shippingTimeData.maximumHours && shippingTimeData.minimumHours) {
                    if (shippingTimeData.maximumHours === shippingTimeData.minimumHours) {
                      shippingTime = `${shippingTimeData.maximumHours}h`;
                    } else {
                      shippingTime = `${shippingTimeData.minimumHours}-${shippingTimeData.maximumHours}h`;
                    }
                  }
                }

                // Extract Prime information from raw data (more reliable than database field)
                if (offer.raw_offer.PrimeInformation) {
                  isPrime = offer.raw_offer.PrimeInformation.IsPrime || offer.raw_offer.PrimeInformation.IsNationalPrime;
                }

                // Extract FBA information from raw data
                if (offer.raw_offer.IsFulfilledByAmazon !== undefined) {
                  isFba = offer.raw_offer.IsFulfilledByAmazon;
                }
              }

              currentOffers.push({
                seller_id: offer.seller_id,
                seller_name: offer.seller_name,
                listing_price: offer.listing_price,
                shipping: offer.shipping,
                is_prime: isPrime,
                is_fba: isFba,
                condition: offer.condition,
                seller_rating: sellerRating,
                feedback_count: feedbackCount,
                shipping_time: shippingTime
              });
            }
          });

          // Add competitor offers to each result by matching run_id + asin + sku
          results = results.map(result => {
            const key = `${result.run_id}_${result.asin}${result.sku ? '_' + result.sku : ''}`;
            const offers = offersByKey.get(key) || [];

            // Debug for specific ASIN
            if (result.asin === 'B01E4KDDV4') {
              console.log(`🔍 [REQ-${requestId}] DEBUG B01E4KDDV4 - Key: ${key}, Offers found: ${offers.length}`);
              if (offers.length > 0) {
                console.log(`🔍 [REQ-${requestId}] DEBUG B01E4KDDV4 - Sample offer:`, JSON.stringify(offers[0], null, 2));
              }
            }

            return {
              ...result,
              competitor_offers: offers
            };
          });

          console.log(`🔵 [REQ-${requestId}] Added competitor offers to ${results.length} records (max 3 per ASIN/SKU combination)`);
        }
      } catch (competitorError) {
        console.error(`🔴 [REQ-${requestId}] Error fetching competitor offers:`, competitorError);
        // Don't fail the entire request if competitor data fails
      }
    }

    const competitorFetchTime = Date.now() - competitorFetchStartTime;
    console.log(`🔵 [REQ-${requestId}] Competitor offers fetch completed in ${competitorFetchTime}ms`);

    // Build total count query with the same filters
    console.log(`🔵 [REQ-${requestId}] Starting count queries...`);
    const countStartTime = Date.now();

    let countQuery = supabaseAdmin
      .from('buybox_data')
      .select('id', { count: 'exact' });

    // Apply the same margin filter to count query
    if (!includeNoMarginData) {
      countQuery = countQuery.not('total_operating_cost', 'is', null);
    }

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

    // Apply the same margin filter to winners count
    if (!includeNoMarginData) {
      winnersCountQuery = winnersCountQuery.not('total_operating_cost', 'is', null);
    }

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

    // Apply the same margin filter to opportunities count
    if (!includeNoMarginData) {
      opportunitiesCountQuery = opportunitiesCountQuery.not('total_operating_cost', 'is', null);
    }

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

    const responsePayload = {
      success: true,
      results: results, // Use unmodified results to avoid any field truncation issues
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
    };

    const responseSize = JSON.stringify(responsePayload).length;
    const responseSizeMB = (responseSize / 1024 / 1024).toFixed(2);

    console.log(`🟢 [REQ-${requestId}] Response size: ${responseSize} bytes (${responseSizeMB}MB)`);

    // Check if response is approaching the 6MB Netlify limit
    const maxSizeBytes = 6 * 1024 * 1024; // 6MB in bytes
    if (responseSize > maxSizeBytes * 0.9) { // 90% of limit
      console.log(`🟡 [REQ-${requestId}] WARNING: Response size (${responseSizeMB}MB) approaching 6MB limit`);
    }

    if (responseSize > maxSizeBytes) {
      console.error(`🔴 [REQ-${requestId}] ERROR: Response size (${responseSizeMB}MB) exceeds 6MB limit`);

      // Calculate a suggested limit based on the current response size
      const currentRecords = results?.length || 0;
      const bytesPerRecord = currentRecords > 0 ? responseSize / currentRecords : 2000; // fallback estimate
      const suggestedLimit = Math.floor((maxSizeBytes * 0.8) / bytesPerRecord); // 80% of limit for safety
      const recommendedLimit = Math.max(1000, Math.min(suggestedLimit, 3000)); // between 1k-3k

      console.log(`🔴 [REQ-${requestId}] Calculated ${bytesPerRecord.toFixed(0)} bytes per record, suggesting limit of ${recommendedLimit}`);

      return json({
        success: false,
        error: `Response too large (${responseSizeMB}MB). Dataset contains ${currentRecords} records but response exceeds 6MB limit.`,
        errorType: 'Function.ResponseSizeTooLarge',
        autoRetryWith: recommendedLimit,
        suggestions: [
          `Try reducing limit to ${recommendedLimit} records`,
          'Use "Latest data only" filter (enabled by default)',
          'Add search filters for specific SKUs or ASINs',
          'Use category filters (Winners, Opportunities, etc.)',
          'Apply minimum profit/margin filters'
        ],
        debug: {
          requestId,
          responseSize: responseSizeMB + 'MB',
          currentLimit: limit,
          actualResults: currentRecords,
          suggestedLimit: recommendedLimit,
          bytesPerRecord: Math.round(bytesPerRecord)
        }
      }, { status: 413 });
    }

    // Final memory check
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      console.log(`🟢 [REQ-${requestId}] Final Memory - RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    }

    return json(responsePayload);

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
