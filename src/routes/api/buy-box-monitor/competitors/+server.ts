import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';
import { loadEnvVariables } from '$lib/loadEnv';

// Load environment variables for development
loadEnvVariables();

/**
 * GET - Get all competitors for a specific ASIN
 */
export async function GET({ url }) {
  try {
    const primaryAsin = url.searchParams.get('asin');

    if (!primaryAsin) {
      return json({
        success: false,
        error: 'ASIN parameter is required'
      }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('competitive_asins')
      .select('*')
      .eq('primary_asin', primaryAsin)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching competitors:', error);
      return json({
        success: false,
        error: 'Failed to fetch competitors'
      }, { status: 500 });
    }

    return json({
      success: true,
      competitors: data || []
    });

  } catch (error) {
    console.error('Error in competitors GET:', error);
    return json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * POST - Add a new competitive relationship
 */
export async function POST({ request }) {
  try {
    const body = await request.json();
    const { primaryAsin, competitiveAsin, relationshipType, notes } = body;

    // Validation
    if (!primaryAsin || !competitiveAsin) {
      return json({
        success: false,
        error: 'Primary ASIN and competitive ASIN are required'
      }, { status: 400 });
    }

    if (primaryAsin === competitiveAsin) {
      return json({
        success: false,
        error: 'Cannot add an ASIN as a competitor to itself'
      }, { status: 400 });
    }

    // Check if relationship already exists
    const { data: existing } = await supabaseAdmin
      .from('competitive_asins')
      .select('id')
      .eq('primary_asin', primaryAsin)
      .eq('competitive_asin', competitiveAsin)
      .single();

    if (existing) {
      return json({
        success: false,
        error: 'This competitive relationship already exists'
      }, { status: 409 });
    }

    // Fetch product titles for both ASINs from sku_asin_mapping table
    const { data: primaryProduct } = await supabaseAdmin
      .from('sku_asin_mapping')
      .select('item_name')
      .eq('asin1', primaryAsin)
      .single();

    const { data: competitiveProduct } = await supabaseAdmin
      .from('sku_asin_mapping')
      .select('item_name')
      .eq('asin1', competitiveAsin)
      .single();

    // If we don't have titles in our database, try to fetch them from Amazon
    let primaryTitle = primaryProduct?.item_name || null;
    let competitiveTitle = competitiveProduct?.item_name || null;

    // For competitive ASIN, try to fetch from Amazon if we don't have it
    if (!competitiveTitle) {
      try {
        console.log(`Attempting to scrape product title from Amazon for ASIN: ${competitiveAsin}`);

        // Import the scraper
        const { scrapeAmazonTitle } = await import('$lib/amazonScraper');

        const scrapedTitle = await scrapeAmazonTitle(competitiveAsin);

        if (scrapedTitle) {
          competitiveTitle = scrapedTitle;
          console.log(`✅ Scraped title from Amazon: ${competitiveTitle}`);
        } else {
          console.log(`⚠️ No title found when scraping ${competitiveAsin}`);
        }

      } catch (scrapeError: unknown) {
        const errorMessage = scrapeError instanceof Error ? scrapeError.message : 'Unknown error';
        console.warn(`Failed to scrape title from Amazon for ${competitiveAsin}:`, errorMessage);

        // If scraping fails, set appropriate title
        if (errorMessage.includes('timeout')) {
          competitiveTitle = `[Timeout] Product ${competitiveAsin}`;
        } else if (errorMessage.includes('403') || errorMessage.includes('blocked')) {
          competitiveTitle = `[Blocked] Product ${competitiveAsin}`;
        } else {
          competitiveTitle = `Product ${competitiveAsin}`;
        }
      }
    }

    // For primary title, use placeholder if not found in our database
    if (!primaryTitle) {
      primaryTitle = `Product ${primaryAsin}`;
    }

    // Insert new competitive relationship with product titles
    const { data, error } = await supabaseAdmin
      .from('competitive_asins')
      .insert({
        primary_asin: primaryAsin,
        competitive_asin: competitiveAsin,
        relationship_type: relationshipType || 'direct_competitor',
        notes: notes || null,
        primary_product_title: primaryTitle,
        competitive_product_title: competitiveTitle,
        added_by: 'system' // You can enhance this with actual user info later
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding competitor:', error);
      return json({
        success: false,
        error: 'Failed to add competitor'
      }, { status: 500 });
    }

    return json({
      success: true,
      competitor: data
    });

  } catch (error) {
    console.error('Error in competitors POST:', error);
    return json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * DELETE - Remove a competitive relationship
 */
export async function DELETE({ url }) {
  try {
    const id = url.searchParams.get('id');

    if (!id) {
      return json({
        success: false,
        error: 'Competitor ID is required'
      }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('competitive_asins')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting competitor:', error);
      return json({
        success: false,
        error: 'Failed to delete competitor'
      }, { status: 500 });
    }

    return json({
      success: true,
      message: 'Competitor relationship deleted successfully'
    });

  } catch (error) {
    console.error('Error in competitors DELETE:', error);
    return json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
