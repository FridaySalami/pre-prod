/**
 * Test Catalog API with explicit fresh token - no caching
 */

import { config } from 'dotenv';
config();

async function testCatalogWithFreshToken() {
  console.log('🔍 Testing Catalog API with fresh LWA token...\n');

  // Step 1: Get fresh LWA access token
  console.log('Step 1: Getting fresh LWA access token...');
  const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.AMAZON_REFRESH_TOKEN!,
      client_id: process.env.AMAZON_CLIENT_ID!,
      client_secret: process.env.AMAZON_CLIENT_SECRET!
    })
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error('❌ Failed to get LWA token:', error);
    process.exit(1);
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;
  console.log(`✅ Got access token: ${accessToken.substring(0, 50)}...`);
  console.log(`   Token expires in: ${tokenData.expires_in} seconds\n`);

  // Step 2: Make direct Catalog API call
  console.log('Step 2: Calling Catalog Items API v2022-04-01...');

  const asin = 'B08BPCC8WD';
  const marketplaceId = 'A1F83G8C2ARO7P';
  const url = `https://sellingpartnerapi-eu.amazon.com/catalog/2022-04-01/items/${asin}?marketplaceIds=${marketplaceId}&includedData=summaries,attributes`;

  const apiResponse = await fetch(url, {
    headers: {
      'x-amz-access-token': accessToken,
      'Content-Type': 'application/json'
    }
  });

  console.log(`   Status: ${apiResponse.status} ${apiResponse.statusText}`);

  const responseData = await apiResponse.json();
  console.log('\n📄 Response:');
  console.log(JSON.stringify(responseData, null, 2));

  if (apiResponse.status === 403) {
    console.log('\n❌ STILL 403! This means:');
    console.log('   1. The refresh token authorization did NOT include Catalog Items API scope');
    console.log('   2. Or "Product Listing" role is not enabled in Seller Central');
    console.log('   3. Or there\'s a mismatch between app and seller account\n');
    console.log('💡 SOLUTION:');
    console.log('   Go back to Seller Central → Developer Central');
    console.log('   Check "Data Access" section - is "Product Listing" checked?');
    console.log('   If not, check it and re-authorize the app');
  } else if (apiResponse.status === 200) {
    console.log('\n✅ SUCCESS! Catalog API is working!');
    console.log('   The new token has the correct permissions.');
  }
}

testCatalogWithFreshToken().catch(console.error);
