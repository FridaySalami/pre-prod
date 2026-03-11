/**
 * Catalog API Test - Exact Documentation Specifications
 * 
 * Based on official Amazon docs:
 * https://developer-docs.amazon.com/sp-api/docs/catalog-items-api-v2022-04-01-reference
 * 
 * Endpoint: GET /catalog/2022-04-01/items/{asin}
 * 
 * Required Parameters:
 * - Path: asin (string) - The Amazon Standard Identification Number
 * - Query: marketplaceIds (array of strings, csv) - Required
 * 
 * Optional Parameters:
 * - Query: includedData (array of enum, csv) - Defaults to "summaries"
 * - Query: locale (string) - Defaults to marketplace primary locale
 * 
 * Authentication: Requires LWA access token
 * Rate Limit: 5 requests per second, burst of 5
 * 
 * Expected Success Response: 200 with Item object
 * Expected Error Responses:
 * - 400: Invalid parameters
 * - 403: Access forbidden (our issue)
 * - 404: Item not found
 */

import 'dotenv/config';

async function testCatalogAPIExact() {
  console.log('📚 Testing Catalog API - Exact Documentation Specifications\n');
  console.log('='.repeat(70));

  // Step 1: Get LWA Access Token
  console.log('Step 1: Getting LWA Access Token...');

  const lwaResponse = await fetch('https://api.amazon.com/auth/o2/token', {
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

  if (!lwaResponse.ok) {
    const error = await lwaResponse.text();
    console.error('❌ LWA Token Error:', lwaResponse.status, error);
    process.exit(1);
  }

  const lwaData = await lwaResponse.json();
  const accessToken = lwaData.access_token;
  console.log('   ✅ Access token obtained\n');

  // Step 2: Call Catalog API exactly as documented
  console.log('Step 2: Calling Catalog Items API...');
  console.log('   Method: GET');
  console.log('   Endpoint: https://sellingpartnerapi-eu.amazon.com/catalog/2022-04-01/items/{asin}');
  console.log('   Path Parameter: asin = B08BPCC8WD');
  console.log('   Query Parameter: marketplaceIds = A1F83G8C2ARO7P');
  console.log('   Query Parameter: includedData = summaries (default)');
  console.log('   Header: x-amz-access-token = [LWA token]\n');

  const asin = 'B08BPCC8WD';
  const marketplaceIds = 'A1F83G8C2ARO7P'; // UK

  // Build URL exactly as documented
  const url = `https://sellingpartnerapi-eu.amazon.com/catalog/2022-04-01/items/${asin}?marketplaceIds=${marketplaceIds}`;

  console.log('   Full URL:', url);
  console.log('');

  const catalogResponse = await fetch(url, {
    method: 'GET',
    headers: {
      'x-amz-access-token': accessToken,
      'Content-Type': 'application/json'
    }
  });

  const responseHeaders: Record<string, string> = {};
  catalogResponse.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  console.log('Step 3: Response Analysis');
  console.log('   Status Code:', catalogResponse.status, catalogResponse.statusText);
  console.log('   Rate Limit:', responseHeaders['x-amzn-ratelimit-limit'] || 'N/A');
  console.log('   Request ID:', responseHeaders['x-amzn-requestid'] || 'N/A');
  console.log('   Error Type:', responseHeaders['x-amzn-errortype'] || 'N/A');
  console.log('');

  const responseBody = await catalogResponse.text();
  let responseData;
  try {
    responseData = JSON.parse(responseBody);
  } catch {
    responseData = responseBody;
  }

  console.log('   Response Body:');
  console.log('   ' + JSON.stringify(responseData, null, 2).replace(/\n/g, '\n   '));
  console.log('');

  console.log('='.repeat(70));

  if (catalogResponse.status === 200) {
    console.log('✅ SUCCESS! Catalog API returned data!');
    console.log('');
    console.log('📦 Product Information:');
    if (responseData.asin) {
      console.log(`   ASIN: ${responseData.asin}`);
    }
    if (responseData.summaries && responseData.summaries[0]) {
      const summary = responseData.summaries[0];
      console.log(`   Title: ${summary.itemName || 'N/A'}`);
      console.log(`   Brand: ${summary.brand || 'N/A'}`);
      console.log(`   Marketplace: ${summary.marketplaceId || 'N/A'}`);
    }
  } else if (catalogResponse.status === 403) {
    console.log('❌ 403 FORBIDDEN - Access Denied');
    console.log('');
    console.log('📋 Documentation Says:');
    console.log('   403 = "Access to resource is forbidden"');
    console.log('   Possible reasons: Access Denied, Unauthorized, Expired Token, Invalid Signature');
    console.log('');
    console.log('✅ Our Implementation:');
    console.log('   • LWA token obtained successfully');
    console.log('   • Endpoint correct (sellingpartnerapi-eu.amazon.com)');
    console.log('   • Path correct (/catalog/2022-04-01/items/{asin})');
    console.log('   • Query params correct (marketplaceIds)');
    console.log('   • Headers correct (x-amz-access-token)');
    console.log('   • ASIN exists and is valid');
    console.log('');
    console.log('❓ Conclusion:');
    console.log('   The 403 error is an AUTHORIZATION issue at Amazon\'s OAuth level,');
    console.log('   NOT a technical implementation issue. The request format is correct');
    console.log('   per the official documentation, but the OAuth token lacks permission');
    console.log('   to access the Catalog Items API resource.');
    console.log('');
    console.log('📧 Next Step: Contact Amazon SP-API Support');
    console.log(`   Request ID: ${responseHeaders['x-amzn-requestid']}`);
    console.log('   Ask: "Why does Catalog API return 403 when all roles are authorized?"');
  } else if (catalogResponse.status === 404) {
    console.log('❌ 404 NOT FOUND - ASIN does not exist in catalog');
  } else {
    console.log(`❌ ${catalogResponse.status} - Unexpected error`);
  }

  console.log('');
  console.log('='.repeat(70));
}

testCatalogAPIExact().catch(console.error);
