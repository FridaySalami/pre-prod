/**
 * Test getCatalogItem with v2022-04-01 API
 * Using corrected canonical query string sorting
 */

import 'dotenv/config';
import { SPAPIClient, RateLimiters } from './src/lib/amazon/index';

async function testGetCatalogItemV2022() {
  const client = SPAPIClient.fromEnv();

  const asin = 'B08BPCC8WD';

  console.log('🧪 Testing getCatalogItem (v2022-04-01) with fixed canonical query string...\n');
  console.log('✅ Endpoint: sellingpartnerapi-eu.amazon.com');
  console.log('✅ API Version: v2022-04-01');
  console.log('✅ Query Params: marketplaceIds (not MarketplaceId)');
  console.log('✅ Signature: Using sorted RFC3986 encoded query string\n');

  try {
    const response = await client.get(
      `/catalog/2022-04-01/items/${asin}`,
      {
        // NOTE: v2022-04-01 uses marketplaceIds (can be array or comma-separated)
        queryParams: {
          marketplaceIds: 'A1F83G8C2ARO7P',
          includedData: 'attributes,identifiers,images,salesRanks,summaries'
        },
        rateLimiter: RateLimiters.catalog,
      }
    );

    if (response.success) {
      console.log('✅ SUCCESS - getCatalogItem (v2022-04-01) works!\n');
      console.log('📦 Product Data:');

      // Extract key information
      const item = response.data;
      console.log('  ASIN:', item.asin || 'N/A');

      if (item.summaries && item.summaries[0]) {
        const summary = item.summaries[0];
        console.log('  Title:', summary.itemName || 'N/A');
        console.log('  Brand:', summary.brand || 'N/A');
      }

      if (item.images && item.images[0] && item.images[0].images) {
        console.log('  Images:', item.images[0].images.length, 'available');
      }

      console.log('\n📄 Full Response:');
      console.log(JSON.stringify(response.data, null, 2));
    } else {
      console.log('❌ FAILED\n');
      console.log('Status:', response.statusCode);
      console.log('Errors:', JSON.stringify(response.errors, null, 2));

      if (response.headers) {
        console.log('\n📨 Response Headers:');
        console.log('  x-amzn-errortype:', response.headers['x-amzn-errortype']);
        console.log('  x-amzn-requestid:', response.headers['x-amzn-requestid']);
      }
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }
}

testGetCatalogItemV2022();
