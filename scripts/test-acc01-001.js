const axios = require('axios');
// Using process.env.PORT or defaulting to 3000 if not specified
const PORT = process.env.PORT || 3000;
const API_URL = `http://localhost:${PORT}/api/buybox-batch`;

async function runTest() {
  const SKU = 'ACC01 - 001';
  console.log(`🔍 Testing single SKU: ${SKU}`);
  
  try {
    const response = await axios.post(API_URL, { skus: [SKU] });
    console.log('\n--- API RESPONSE ---');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.success && response.data.results && response.data.results[0]?.data) {
      const result = response.data.results[0];
      const data = result.data;
      console.log('\n--- SKU: ' + result.sku + ' ---');
      console.log(`ASIN:            ${data.asin}`);
      console.log(`Our Seller ID:   A2D8NG39VURSL3`);
      console.log(`Winning:         ${data.isWinner ? '✅ Yes' : '❌ No'}`);
      console.log(`Our Price:       ${data.ourPrice}`);
      console.log(`Buy Box Price:   ${data.buyBoxPrice}`);
      console.log(`Next Best Price: ${data.nextBestPrice}`);
      console.log(`Lowest Price:    ${data.lowestPrice}`);
      console.log(`Offer Count:     ${data.offerCount}`);
      
      // LOG RAW OFFERS SO WE CAN SEE THEM
      if (data.rawOffers) {
          console.log('\n--- ALL RAW OFFERS ---');
          data.rawOffers.forEach((off, i) => {
              const isUs = off.SellerId === 'A2D8NG39VURSL3';
              console.log(`Offer ${i+1}: Price=${off.ListingPrice?.Amount}, Seller=${off.SellerId} ${isUs ? '[US]' : '[OTHER]'}, BB Winner=${off.IsBuyBoxWinner}`);
          });
      }
    } else {
        console.log('No data returned for SKU or API returned error.');
        if (response.data.results && response.data.results[0]) {
            console.log('Result Error:', response.data.results[0].error);
        }
    }
  } catch (error) {
    if (error.response) {
        console.error('\n❌ API Error:', error.response.status, error.response.data);
    } else {
        console.error('\n❌ Error:', error.message);
    }
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Tip: SvelteKit server must be running on localhost:' + PORT);
    }
  }
}

runTest();
