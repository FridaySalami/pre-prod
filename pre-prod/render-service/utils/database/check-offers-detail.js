// Quick script to check the actual offers data
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function checkOffers() {
  console.log('🔍 Checking actual offers data and raw API responses...\n');

  // Get latest offers with raw data
  const { data: offers, error } = await supabase
    .from('buybox_offers')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`📊 Total offers found: ${offers.length}\n`);

  // Group by ASIN to see how many offers per ASIN
  const offersByAsin = {};
  offers.forEach(offer => {
    if (!offersByAsin[offer.asin]) {
      offersByAsin[offer.asin] = [];
    }
    offersByAsin[offer.asin].push(offer);
  });

  console.log('📈 Offers per ASIN:');
  Object.keys(offersByAsin).forEach(asin => {
    console.log(`   ${asin}: ${offersByAsin[asin].length} offers`);
  });
  console.log('');

  // Check raw API data to see what Amazon returned
  offers.slice(0, 3).forEach((offer, index) => {
    console.log(`${index + 1}. 🏷️ ASIN: ${offer.asin}, Seller: ${offer.seller_id}`);
    console.log(`   💰 Price: £${offer.listing_price}, Shipping: £${offer.shipping}, Total: £${offer.total}`);
    console.log(`   📦 Prime: ${offer.is_prime}, FBA: ${offer.is_fba}, BuyBox: ${offer.is_buybox_winner}`);
    console.log(`   📅 Captured: ${offer.captured_at}`);

    // Check raw offer data from Amazon API
    if (offer.raw_offer) {
      console.log(`   🔍 Raw API Response Length: ${JSON.stringify(offer.raw_offer).length} chars`);
      console.log(`   🏪 Raw Seller Info:`, {
        SellerId: offer.raw_offer.SellerId,
        SellerName: offer.raw_offer.SellerName,
        IsBuyBoxWinner: offer.raw_offer.IsBuyBoxWinner,
        IsFulfilledByAmazon: offer.raw_offer.IsFulfilledByAmazon
      });
    }
    console.log('');
  });

  // Check for multiple sellers on same ASIN
  console.log('🔍 Multi-seller analysis:');
  Object.keys(offersByAsin).forEach(asin => {
    const uniqueSellers = [...new Set(offersByAsin[asin].map(o => o.seller_id))];
    console.log(`   ${asin}: ${uniqueSellers.length} unique sellers (${uniqueSellers.join(', ')})`);
  });
}

checkOffers().catch(console.error);
