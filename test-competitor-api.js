#!/usr/bin/env node
/**
 * Test Competitor API functionality
 * Test both title fetching and merchant mapping
 */

import axios from 'axios';

async function testCompetitorAPI() {
  const baseUrl = 'http://localhost:3000'; // Adjust if your dev server runs on different port
  const testAsin = 'B00WUBNJLE';

  console.log('🧪 Testing Competitor API functionality\n');

  try {
    // Test 1: Check buy box for the specific ASIN
    console.log(`1️⃣ Testing buy box check for ASIN: ${testAsin}`);
    const buyBoxResponse = await axios.get(`${baseUrl}/api/buy-box-monitor/check?asin=${testAsin}`);

    console.log('✅ Buy Box Response:');
    console.log('- Buy Box Owner:', buyBoxResponse.data.buyBoxOwner);
    console.log('- Buy Box Seller Name:', buyBoxResponse.data.buyBoxSellerName);
    console.log('- Has Buy Box:', buyBoxResponse.data.hasBuyBox);
    console.log('- Buy Box Price:', buyBoxResponse.data.buyBoxPrice);

    if (buyBoxResponse.data.competitorInfo && buyBoxResponse.data.competitorInfo.length > 0) {
      console.log('- Competitors:');
      buyBoxResponse.data.competitorInfo.forEach((comp, idx) => {
        console.log(`  ${idx + 1}. ${comp.sellerName} (${comp.sellerId}) - £${comp.price}`);
      });
    }

  } catch (error) {
    console.error('❌ Error testing buy box API:', error.response?.data || error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  try {
    // Test 2: Add as competitor and see if title is fetched
    console.log(`2️⃣ Testing competitor addition with title fetching`);

    // You'll need to provide a primary ASIN that exists in your sku_asin_mapping
    // Replace this with an actual ASIN from your data
    const primaryAsin = 'B07Y9VF8L1'; // Replace with a real ASIN from your system

    const addResponse = await axios.post(`${baseUrl}/api/buy-box-monitor/competitors`, {
      primaryAsin: primaryAsin,
      competitiveAsin: testAsin,
      relationshipType: 'direct_competitor',
      notes: 'Test competitor for title fetching'
    });

    console.log('✅ Add Competitor Response:');
    console.log('- Success:', addResponse.data.success);
    console.log('- Competitive Title:', addResponse.data.competitor?.competitive_product_title);
    console.log('- Primary Title:', addResponse.data.competitor?.primary_product_title);

  } catch (error) {
    console.error('❌ Error testing competitor addition:', error.response?.data || error.message);
  }
}

// Only run if called directly
testCompetitorAPI().catch(console.error);
