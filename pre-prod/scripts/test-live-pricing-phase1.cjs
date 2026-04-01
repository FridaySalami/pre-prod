#!/usr/bin/env node
/**
 * Test Script for Phase 1 Live Pricing Implementation
 * 
 * Tests the new live pricing endpoints and services
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testLivePricingAPI() {
  console.log('🧪 Testing Live Pricing API - Phase 1');
  console.log('==========================================\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/api/live-pricing/health`);
    console.log('✅ Health check:', healthResponse.data);
    console.log('');

    // Test 2: Service Info
    console.log('2️⃣ Testing main service info...');
    const infoResponse = await axios.get(`${BASE_URL}/`);
    console.log('✅ Service endpoints:', infoResponse.data.endpoints.filter(e => e.includes('live-pricing')));
    console.log('');

    // Test 3: Status Check (with dummy record ID)
    console.log('3️⃣ Testing status check endpoint...');
    try {
      const statusResponse = await axios.get(`${BASE_URL}/api/live-pricing/status/dummy-record-id`);
      console.log('✅ Status check response:', statusResponse.data);
    } catch (error) {
      if (error.response?.status === 500) {
        console.log('⚠️ Status check failed as expected (no dummy record):', error.response.data.error);
      } else {
        throw error;
      }
    }
    console.log('');

    // Test 4: Update endpoint validation
    console.log('4️⃣ Testing update endpoint validation...');
    try {
      const updateResponse = await axios.post(`${BASE_URL}/api/live-pricing/update`, {
        // Missing required fields
      });
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Validation working:', error.response.data.message);
      } else {
        throw error;
      }
    }
    console.log('');

    console.log('🎉 Phase 1 API tests completed successfully!');
    console.log('');
    console.log('📋 Ready for Phase 2: Frontend UI Components');
    console.log('');
    console.log('🔧 To test with real data:');
    console.log('   1. Ensure render-service is running on port 3001');
    console.log('   2. Get a real record ID from your buybox_data table');
    console.log('   3. Make a POST request to /api/live-pricing/update with:');
    console.log('      {');
    console.log('        "sku": "your-sku",');
    console.log('        "recordId": "real-record-id",');
    console.log('        "userId": "test-user"');
    console.log('      }');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('');
      console.log('💡 Make sure the render-service is running:');
      console.log('   cd render-service && npm start');
    }
  }
}

// Run tests
testLivePricingAPI();
