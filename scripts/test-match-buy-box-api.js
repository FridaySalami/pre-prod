#!/usr/bin/env node

/**
 * Test the Match Buy Box API endpoint
 * Tests the new /api/match-buy-box route with known working data
 */

import dotenv from 'dotenv';
dotenv.config();

async function testMatchBuyBoxAPI() {
  console.log('🧪 Testing Match Buy Box API endpoint...');

  // Test data from your known working example
  const testData = {
    asin: 'B08BPBWV1C',
    sku: 'COL01A',
    newPrice: 42.15,
    recordId: 'test-record-id' // You'll need to get a real record ID
  };

  try {
    // First, let's test if we can reach the endpoint
    const response = await fetch('http://localhost:5173/api/match-buy-box', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In production, you'd need proper authentication headers
      },
      body: JSON.stringify(testData)
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const result = await response.json();
      console.log('✅ API Response Success:', result);
    } else {
      const error = await response.text();
      console.log('❌ API Response Error:', error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('💡 Make sure your SvelteKit dev server is running: npm run dev');
  }
}

// Also test the product type fetching specifically
async function testProductTypeFetch() {
  console.log('\n🔍 Testing product type fetching...');

  try {
    // Import our Amazon Feeds API with correct path
    const { default: AmazonFeedsAPI } = await import('../src/lib/services/amazon-feeds-api.js');

    const api = new AmazonFeedsAPI();
    const token = await api.getAccessToken();

    console.log('✅ Got access token successfully');

    const productType = await api.getProductType(token, 'COL01A');
    console.log(`✅ Product type for COL01A: ${productType}`);

  } catch (error) {
    console.error('❌ Product type test failed:', error.message);
  }
}

// Run tests
console.log('🚀 Starting Match Buy Box API tests...\n');

await testProductTypeFetch();
await testMatchBuyBoxAPI();

console.log('\n✅ Tests completed!');
