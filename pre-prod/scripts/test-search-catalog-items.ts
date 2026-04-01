/**
 * Test searchCatalogItems with v2022-04-01 API
 * Alternative endpoint that might have different permissions
 */

import 'dotenv/config';
import { SPAPIClient, RateLimiters } from './src/lib/amazon/index';

async function testSearchCatalogItems() {
  const client = SPAPIClient.fromEnv();

  const asin = 'B08BPCC8WD';

  console.log('🔍 Testing searchCatalogItems (v2022-04-01)...\n');
  console.log('This uses a different endpoint that might have different permissions\n');

  try {
    const response = await client.get(
      '/catalog/2022-04-01/items',
      {
        queryParams: {
          identifiers: asin,
          identifiersType: 'ASIN',
          marketplaceIds: 'A1F83G8C2ARO7P',
          includedData: 'attributes,identifiers,images,salesRanks,summaries'
        },
        rateLimiter: RateLimiters.catalog,
      }
    );

    if (response.success) {
      console.log('✅ SUCCESS - searchCatalogItems works!\n');
      console.log('📦 Search Results:');

      const items = response.data.items || [];
      console.log(`  Found ${items.length} item(s)\n`);

      items.forEach((item: any, index: number) => {
        console.log(`  Item ${index + 1}:`);
        console.log('    ASIN:', item.asin || 'N/A');

        if (item.summaries && item.summaries[0]) {
          const summary = item.summaries[0];
          console.log('    Title:', summary.itemName || 'N/A');
          console.log('    Brand:', summary.brand || 'N/A');
        }
      });

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

testSearchCatalogItems();
