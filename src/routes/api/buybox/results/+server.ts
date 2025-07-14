import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseServer';

interface BuyBoxResult {
  id: string;
  asin: string;
  sku: string;
  price: number | null;
  is_winner: boolean;
  opportunity_flag: boolean;
  margin_at_buybox: number | null;
  margin_percent_at_buybox: number | null;
  captured_at: string;
  your_cost: number | null;
  your_shipping_cost: number | null;
  your_material_total_cost: number | null;
  your_box_cost: number | null;
  your_vat_amount: number | null;
  your_fragile_charge: number | null;
  material_cost_only: number | null;
  total_operating_cost: number | null;
  your_margin_at_current_price: number | null;
  your_margin_percent_at_current_price: number | null;
  margin_at_buybox_price: number | null;
  margin_percent_at_buybox_price: number | null;
  margin_difference: number | null;
  profit_opportunity: number | null;
  current_actual_profit: number | null;
  buybox_actual_profit: number | null;
  current_profit_breakdown: string | null;
  buybox_profit_breakdown: string | null;
  recommended_action: string | null;
  price_adjustment_needed: number | null;
  break_even_price: number | null;
  margin_calculation_version: string | null;
  cost_data_source: string | null;
}

/**
 * Get Buy Box results directly from Supabase
 */
export async function GET({ url }) {
  try {
    const searchParams = url.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const includeAllJobs = searchParams.get('include_all_jobs') === 'true';
    const jobId = searchParams.get('job_id');
    const search = searchParams.get('search');

    // Build query
    let query = supabaseAdmin
      .from('buybox_data')
      .select('*')
      .order('captured_at', { ascending: false });

    // Apply filters
    if (jobId) {
      query = query.eq('job_id', jobId);
    }

    if (search) {
      query = query.or(`sku.ilike.%${search}%,asin.ilike.%${search}%`);
    }

    if (!includeAllJobs && !jobId) {
      // Get latest job ID if not including all jobs
      const { data: latestJob } = await supabaseAdmin
        .from('buybox_jobs')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (latestJob && latestJob.length > 0) {
        query = query.eq('job_id', latestJob[0].id);
      }
    }

    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Calculate summary statistics
    const results = data || [];
    const totalWinners = results.filter(item => item.is_winner).length;
    const totalOpportunities = results.filter(item => item.opportunity_flag).length;
    const totalProfitable = results.filter(item => 
      item.profit_opportunity && item.profit_opportunity > 0
    ).length;
    const totalMarginAnalyzed = results.filter(item => 
      item.your_margin_percent_at_current_price !== null
    ).length;

    const profitableItems = results.filter(item => item.current_actual_profit !== null);
    const avgProfit = profitableItems.length > 0
      ? profitableItems.reduce((sum, item) => sum + (item.current_actual_profit || 0), 0) / profitableItems.length
      : 0;

    const totalPotentialProfit = results
      .filter(item => item.profit_opportunity && item.profit_opportunity > 0)
      .reduce((sum, item) => sum + (item.profit_opportunity || 0), 0);

    return json({
      success: true,
      results,
      summary: {
        total_count: results.length,
        buybox_winners: totalWinners,
        opportunities: totalOpportunities,
        profitable_opportunities: totalProfitable,
        margin_analyzed_count: totalMarginAnalyzed,
        average_profit: avgProfit,
        total_profit_opportunity: totalPotentialProfit
      }
    });

  } catch (error) {
    console.error('Buy Box results error:', error);
    return json({
      success: false,
      error: (error as Error).message || 'Failed to fetch Buy Box results'
    }, { status: 500 });
  }
}
