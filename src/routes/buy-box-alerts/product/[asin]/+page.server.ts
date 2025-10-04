// Server-side data loader for product analysis page
// Fetches historical alert data and product information

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch, url }) => {
  const { asin } = params;

  if (!asin || asin === 'undefined') {
    throw error(400, 'Invalid ASIN parameter');
  }

  try {
    // Get query parameters
    const days = url.searchParams.get('days') || '30';

    // Fetch historical alert data
    const alertResponse = await fetch(
      `/api/buy-box-alerts/product/${asin}?days=${days}`
    );

    if (!alertResponse.ok) {
      throw new Error(`Failed to fetch alert history: ${alertResponse.statusText}`);
    }

    const alertData = await alertResponse.json();

    // Fetch product information from buybox_data (optional - may not exist)
    let productInfo = null;
    try {
      const productResponse = await fetch('/api/buybox-lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ asin })
      });

      if (productResponse.ok) {
        const productResult = await productResponse.json();
        productInfo = productResult.success ? productResult.data : null;
      }
    } catch (productErr) {
      // Product info not found in Supabase - that's OK, we'll use ASIN only
      console.log(`Product info not found for ${asin}, using ASIN as fallback`);
    }

    return {
      asin,
      currentState: alertData.currentState,
      history: alertData.history || [],
      analytics: alertData.analytics || {},
      competitors: alertData.competitors || [],
      meta: alertData.meta || {},
      productInfo,
      daysRequested: parseInt(days)
    };
  } catch (err) {
    console.error(`Error loading product analysis for ${asin}:`, err);
    throw error(500, `Failed to load product analysis: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
};
