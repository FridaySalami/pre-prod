import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Simple test endpoint first to check if basic functionality works
 * POST /api/product-lookup
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { asin } = body;

    console.log('🔍 Product lookup called for ASIN:', asin);

    if (!asin) {
      return json({ success: false, error: 'ASIN is required' }, { status: 400 });
    }

    // For now, let's just return success to test the pipeline
    // You can see the ASIN in server logs and verify the integration works
    console.log(`✅ Product lookup request received for: ${asin}`);

    // Simple hardcoded response for testing
    const mockResponse = {
      success: true,
      product: {
        asin: asin,
        name: `Product for ${asin}`,
        sku: `SKU-${asin}`
      }
    };

    return json(mockResponse);

  } catch (error: any) {
    console.error('❌ Error in product lookup:', error);
    return json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
};