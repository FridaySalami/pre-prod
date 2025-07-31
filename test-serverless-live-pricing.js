#!/usr/bin/env node

/**
 * Test Serverless Live Pricing API
 * 
 * Quick test to validate the new serverless endpoint works without render-service
 */

const fetch = require('node-fetch');

async function testServerlessAPI() {
  console.log('🧪 Testing Serverless Live Pricing API');
  console.log('=====================================');

  const baseUrl = 'http://localhost:3000'; // SvelteKit dev server

  try {
    // Test 1: Health check
    console.log('\n📊 Test 1: Health Check');
    const healthResponse = await fetch(`${baseUrl}/api/live-pricing/update`);
    const healthData = await healthResponse.json();

    if (healthResponse.ok) {
      console.log('✅ Health check passed:', healthData.message);
    } else {
      console.log('❌ Health check failed:', healthData);
      return;
    }

    // Test 2: Invalid request (missing parameters)
    console.log('\n📊 Test 2: Invalid Request Handling');
    const invalidResponse = await fetch(`${baseUrl}/api/live-pricing/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: 'TEST-SKU' }) // Missing recordId
    });
    const invalidData = await invalidResponse.json();

    if (invalidResponse.status === 400) {
      console.log('✅ Invalid request handling works:', invalidData.message);
    } else {
      console.log('❌ Invalid request handling failed:', invalidData);
    }

    // Test 3: Configuration check (will fail without proper env vars, which is expected)
    console.log('\n📊 Test 3: Configuration Check');
    const configResponse = await fetch(`${baseUrl}/api/live-pricing/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: 'TEST-SKU-123',
        recordId: 'fake-uuid-for-testing',
        userId: 'test-user'
      })
    });
    const configData = await configResponse.json();

    if (configData.error === 'CONFIGURATION_ERROR') {
      console.log('✅ Configuration validation works - setup Amazon SP-API credentials to proceed');
    } else if (configData.error === 'RECORD_NOT_FOUND') {
      console.log('✅ Record validation works - API reached database layer');
    } else {
      console.log('🔍 Configuration test result:', configData);
    }

    console.log('\n🎉 Serverless API Tests Complete!');
    console.log('\n💡 Next Steps:');
    console.log('   1. Ensure Amazon SP-API environment variables are set');
    console.log('   2. Test with real SKU/recordId from Buy Box Manager');
    console.log('   3. Deploy to Netlify/Vercel for production use');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure SvelteKit dev server is running: npm run dev');
  }
}

// Run tests
testServerlessAPI();
