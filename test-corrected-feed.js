// Test the corrected POST_PRODUCT_PRICING_DATA feed with proper min/max values
import AmazonFeedsAPI from './src/lib/services/amazon-feeds-api.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Override environment variables for the test
process.env.AMAZON_CLIENT_ID = process.env.AMAZON_CLIENT_ID;
process.env.AMAZON_CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET;
process.env.AMAZON_REFRESH_TOKEN = process.env.AMAZON_REFRESH_TOKEN;
process.env.AMAZON_MARKETPLACE_ID = process.env.AMAZON_MARKETPLACE_ID;

async function testCorrectedFeed() {
  try {
    console.log('🧪 Testing corrected POST_PRODUCT_PRICING_DATA feed...\n');
    console.log('🔧 Using tab-delimited format with proper min/max values');
    console.log('📋 Format: sku\\tprice\\tcurrency\\tmin-price\\tmax-price\n');

    const api = new AmazonFeedsAPI();

    // Test with your specific ASIN and SKU
    console.log('🎯 Target: ASIN B08BPBWV1C (SKU: COL01A)');
    console.log('💰 Price: £42.16 → £42.15');
    console.log('📏 Min/Max: £40.15 - £52.15\n');

    const result = await api.updatePrice(
      'B08BPBWV1C',  // ASIN
      42.15,         // New price
      42.16,         // Current price
      'COL01A'       // SKU
    );

    console.log('\n🎉 Final Result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log(`\n✅ SUCCESS! Feed ID: ${result.feedId}`);
      console.log('⏰ Check feed status in 2-3 minutes');
      console.log('📊 This should avoid the FATAL error with proper min/max values');

      // Also update our database
      const supabase = createClient(
        process.env.PUBLIC_SUPABASE_URL,
        process.env.PRIVATE_SUPABASE_SERVICE_KEY
      );

      try {
        const { data, error } = await supabase
          .from('buybox_data')
          .update({
            your_current_price: 42.15,
            last_price_update: new Date().toISOString(),
            update_source: 'corrected_feeds_api',
            update_attempts: 1
          })
          .eq('asin', 'B08BPBWV1C');

        if (!error) {
          console.log('✅ Database updated successfully');
        }
      } catch (dbError) {
        console.warn('⚠️ Database update failed:', dbError.message);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCorrectedFeed();
