/**
 * API endpoint to clear catalog cache for a specific ASIN
 * DELETE /api/catalog-cache/[asin]
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_SERVICE_KEY } from '$env/static/private';

export const DELETE: RequestHandler = async ({ params }) => {
  const { asin } = params;

  if (!asin) {
    throw error(400, 'ASIN parameter is required');
  }

  try {
    const supabase = createClient(
      PUBLIC_SUPABASE_URL,
      PRIVATE_SUPABASE_SERVICE_KEY
    );

    // Delete the cached catalog data for this ASIN
    const { error: deleteError } = await supabase
      .from('amazon_catalog_cache')
      .delete()
      .eq('asin', asin);

    if (deleteError) {
      console.error(`Error clearing cache for ${asin}:`, deleteError);
      throw error(500, `Failed to clear cache: ${deleteError.message}`);
    }

    console.log(`✅ Cache cleared for ASIN: ${asin}`);

    return json({
      success: true,
      message: `Cache cleared for ${asin}. Page will reload with fresh data.`
    });

  } catch (err) {
    console.error('Cache clear error:', err);
    throw error(500, 'Failed to clear cache');
  }
};
