const axios = require('axios');
const API_URL = 'http://localhost:3000/api/buybox-batch';

async function runTest() {
  const SKU = 'ACC02 - 010';
  console.log(`🔍 Testing single SKU: ${SKU}`);
  
  try {
    const response = await axios.post(API_URL, { skus: [SKU] });
    console.log('\n--- API RESPONSE ---');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.success && response.data.results[0]?.data) {
      const data = response.data.results[0].data;
      console.log('\n--- KEY DATA ---');
      console.log(`ASIN:          ${data.asin}`);
      console.log(`Winning:       ${data.isWinner ? 'Yes' : 'No'}`);
      console.log(`Buy Box:        ${data.currency} ${data.buyBoxPrice}`);
      console.log(`Lowest Price:   ${data.currency} ${data.lowestPrice}`);
      console.log(`Offer Count:    ${data.offerCount}`);
      
      // Checking if any next best price is listed in actual Amazon response
      if (data.rawOffers) {
          console.log('\n--- TOP OFFERS ---');
          data.rawOffers.slice(0, 3).forEach((off, i) => {
              console.log(`Offer ${i+1}: ${off.ListingPrice.Amount} (Seller: ${off.SellerId === 'A2D8NG39VURSL3' ? 'US' : 'OTHER'})`);
          });
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data?.error || error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Tip: SvelteKit server must be running on localhost:3000');
    }
  }
}

runTest();
