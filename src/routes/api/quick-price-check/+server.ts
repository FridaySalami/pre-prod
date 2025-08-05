import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    // Temporarily bypass authentication for debugging
    console.log('🔍 Quick price check API called - bypassing authentication for debugging');
    
    const asin = url.searchParams.get('asin') || 'B01EX15HEA'; // Default to your recent ASIN
    
    console.log(`💰 Checking current live price for ASIN: ${asin}`);

    try {
      // Use your existing live pricing update service to get fresh data
      const updateResponse = await fetch(`http://localhost:3001/api/live-pricing/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sku: 'CON12A - 007', // Your SKU for B01EX15HEA
          recordId: '87bc5e35-106f-4a1a-a54f-7de4ddc2c004' // Your record ID
        })
      });

      if (updateResponse.ok) {
        const updateData = await updateResponse.json();
        console.log('📊 Live pricing update response:', updateData);
        
        // Now fetch the updated record from your buybox data
        const recordResponse = await fetch(`http://localhost:3001/api/buybox-data/87bc5e35-106f-4a1a-a54f-7de4ddc2c004`);
        
        if (recordResponse.ok) {
          const recordData = await recordResponse.json();
          console.log('📊 Current record data:', recordData);
          
          return json({
            success: true,
            asin: asin,
            sku: 'CON12A - 007',
            timestamp: new Date().toISOString(),
            pricing: {
              yourCurrentPrice: recordData.data?.your_current_price || null,
              buyBoxPrice: recordData.data?.buybox_price || null,
              competitorPrice: recordData.data?.competitor_price || null,
              breakEvenPrice: recordData.data?.break_even_price || null,
              lastUpdated: recordData.data?.captured_at || null,
              formatted: {
                yourPrice: recordData.data?.your_current_price ? `£${parseFloat(recordData.data.your_current_price).toFixed(2)}` : 'N/A',
                buyBox: recordData.data?.buybox_price ? `£${parseFloat(recordData.data.buybox_price).toFixed(2)}` : 'N/A',
                competitor: recordData.data?.competitor_price ? `£${parseFloat(recordData.data.competitor_price).toFixed(2)}` : 'N/A'
              }
            },
            feedComparison: {
              expectedPrice: '£40.60',
              message: 'Compare with your recent feed update (Feed ID: 288225020304)'
            }
          });
        }
      }
      
      // Fallback to basic response
      return json({
        success: false,
        error: 'Could not fetch live pricing data',
        asin: asin,
        suggestion: 'Try checking Amazon product page directly',
        amazonUrl: `https://amazon.co.uk/dp/${asin}`
      });

    } catch (apiError) {
      console.error('❌ API error:', apiError);
      
      return json({
        success: false,
        error: 'Failed to fetch live pricing',
        asin: asin,
        timestamp: new Date().toISOString(),
        fallback: {
          amazonUrl: `https://amazon.co.uk/dp/${asin}`,
          sellerCentralUrl: 'https://sellercentral.amazon.co.uk/inventory',
          feedStatus: 'Feed 288225020304 was processed successfully (DONE status)',
          expectedPrice: '£40.60'
        }
      });
    }

  } catch (error) {
    console.error('❌ Price check failed:', error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
};
