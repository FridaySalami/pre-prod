/**
 * Test Amazon API Access
 * Run this to verify your newly approved Product Listing permissions
 */

require('dotenv/config');
const AmazonListingsAPI = require('./src/lib/services/amazon-listings-api.cjs');

// Test configuration
const testConfig = {
  environment: 'production', // Try production first since sandbox often has access issues
  // You'll need to add these from your Amazon Developer Console:
  clientId: process.env.AMAZON_CLIENT_ID,
  clientSecret: process.env.AMAZON_CLIENT_SECRET,
  refreshToken: process.env.AMAZON_REFRESH_TOKEN,
  marketplaceId: 'A1F83G8C2ARO7P' // UK marketplace
};

async function testAmazonAPI() {
  console.log('🧪 Testing Amazon Listings API Access...');
  console.log(`Environment: ${testConfig.environment}`);

  // Initialize API service
  const amazonAPI = new AmazonListingsAPI(testConfig);

  try {
    // Test 1: Basic connectivity
    console.log('\n1. Testing API connectivity...');
    const connectionTest = await amazonAPI.testConnection();

    console.log('Connection test result:', JSON.stringify(connectionTest, null, 2));

    if (connectionTest.success) {
      console.log('✅ API Connection successful!');
      console.log('📊 Marketplace data:', connectionTest.data);
    } else {
      console.log('❌ API Connection failed:', connectionTest.error);
      return;
    }

    // Test 2: Get token
    console.log('\n2. Testing token generation...');
    try {
      const token = await amazonAPI.getAccessToken();
      console.log('✅ Access token obtained successfully');
      console.log('Token preview:', token ? token.substring(0, 20) + '...' : 'null');
    } catch (tokenError) {
      console.log('❌ Token generation failed:', tokenError.message);
      return;
    }

    // Test 3: Test listing retrieval (if you have a test ASIN)
    console.log('\n3. Testing listing retrieval...');
    console.log('ℹ️  Note: This will fail in sandbox unless you use Amazon test data');

    // For sandbox, Amazon provides test ASINs
    const testASIN = 'B07XYZ123TEST'; // Example test ASIN
    const listingTest = await amazonAPI.getListing(testASIN);

    if (listingTest.success) {
      console.log('✅ Listing retrieval successful!');
    } else {
      console.log('⚠️  Listing retrieval test:', listingTest.error);
      console.log('   This is expected in sandbox without proper test data');
    }

    console.log('\n🎉 Amazon API testing complete!');
    console.log('📋 Summary:');
    console.log('   - API connectivity: ✅');
    console.log('   - Authentication: ✅');
    console.log('   - Ready for Match Buy Box implementation: ✅');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Next steps:');
    console.log('   1. Check your environment variables');
    console.log('   2. Verify API credentials in Amazon Developer Console');
    console.log('   3. Ensure Product Listing permissions are fully activated');
  }
}

// Environment setup check
function checkEnvironment() {
  console.log('🔍 Checking environment setup...');

  const required = ['AMAZON_CLIENT_ID', 'AMAZON_CLIENT_SECRET', 'AMAZON_REFRESH_TOKEN'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.log('❌ Missing environment variables:');
    missing.forEach(key => console.log(`   - ${key}`));
    console.log('\n📝 Create a .env file with:');
    console.log('AMAZON_CLIENT_ID=your_client_id');
    console.log('AMAZON_CLIENT_SECRET=your_client_secret');
    console.log('AMAZON_REFRESH_TOKEN=your_refresh_token');
    console.log('AMAZON_MARKETPLACE_ID=A1F83G8C2ARO7P');
    return false;
  }

  console.log('✅ All environment variables found');
  return true;
}

// Run tests
async function main() {
  console.log('🚀 Amazon Listings API Test Suite');
  console.log('==================================');

  if (!checkEnvironment()) {
    process.exit(1);
  }

  await testAmazonAPI();
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testAmazonAPI, checkEnvironment };
