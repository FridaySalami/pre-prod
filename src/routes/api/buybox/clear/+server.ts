import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';

/**
 * Clear Buy Box data tables
 * DELETE /api/buybox/clear - Clears buybox_data and buybox_offers tables
 */
export async function DELETE() {
  try {
    console.log('🗑️ Starting Buy Box data clear operation...');

    // Start with buybox_offers since it might reference buybox_data
    console.log('🗑️ Clearing buybox_offers table...');
    const { error: offersError } = await supabaseAdmin
      .from('buybox_offers')
      .delete()
      .neq('id', 0); // Delete all records (neq 0 is a workaround to delete all)

    if (offersError) {
      console.error('❌ Error clearing buybox_offers:', offersError);
      return json({
        success: false,
        error: `Failed to clear buybox_offers: ${offersError.message}`
      }, { status: 500 });
    }

    console.log('✅ buybox_offers table cleared');

    // Clear buybox_data table
    console.log('🗑️ Clearing buybox_data table...');
    const { error: dataError } = await supabaseAdmin
      .from('buybox_data')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (dataError) {
      console.error('❌ Error clearing buybox_data:', dataError);
      return json({
        success: false,
        error: `Failed to clear buybox_data: ${dataError.message}`
      }, { status: 500 });
    }

    console.log('✅ buybox_data table cleared');

    // Get final counts to confirm clearing
    const { count: remainingDataCount } = await supabaseAdmin
      .from('buybox_data')
      .select('*', { count: 'exact', head: true });

    const { count: remainingOffersCount } = await supabaseAdmin
      .from('buybox_offers')
      .select('*', { count: 'exact', head: true });

    console.log(`✅ Clear operation completed. Remaining records - buybox_data: ${remainingDataCount}, buybox_offers: ${remainingOffersCount}`);

    return json({
      success: true,
      message: 'Buy Box data tables cleared successfully',
      remainingRecords: {
        buybox_data: remainingDataCount || 0,
        buybox_offers: remainingOffersCount || 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error('❌ Buy Box clear operation failed:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred while clearing Buy Box data'
    }, { status: 500 });
  }
}

/**
 * Get current record counts
 * GET /api/buybox/clear - Returns current record counts without clearing
 */
export async function GET() {
  try {
    console.log('📊 Getting Buy Box data table counts...');

    const { count: dataCount, error: dataError } = await supabaseAdmin
      .from('buybox_data')
      .select('*', { count: 'exact', head: true });

    if (dataError) {
      console.error('❌ Error counting buybox_data:', dataError);
      return json({
        success: false,
        error: `Failed to count buybox_data: ${dataError.message}`
      }, { status: 500 });
    }

    const { count: offersCount, error: offersError } = await supabaseAdmin
      .from('buybox_offers')
      .select('*', { count: 'exact', head: true });

    if (offersError) {
      console.error('❌ Error counting buybox_offers:', offersError);
      return json({
        success: false,
        error: `Failed to count buybox_offers: ${offersError.message}`
      }, { status: 500 });
    }

    console.log(`📊 Current counts - buybox_data: ${dataCount}, buybox_offers: ${offersCount}`);

    return json({
      success: true,
      counts: {
        buybox_data: dataCount || 0,
        buybox_offers: offersCount || 0,
        total: (dataCount || 0) + (offersCount || 0)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error('❌ Failed to get Buy Box data counts:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred while getting data counts'
    }, { status: 500 });
  }
}