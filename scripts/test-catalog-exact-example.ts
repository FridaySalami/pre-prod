/**
 * Test Catalog API v2022-04-01 using exact call example
 */

import 'dotenv/config';
import { SPAPIClient, RateLimiters } from './src/lib/amazon/index';

async function testCatalogAPI() {
  const client = SPAPIClient.fromEnv();
  const asin = 'B08BPCC8WD';

  console.log('🧪 Testing Catalog API v2022-04-01 with exact call example\n');
  console.log('ASIN:', asin);
  console.log('Marketplace:', 'A1F83G8C2ARO7P (UK)\n');

  const res = await client.get(
    `/catalog/2022-04-01/items/${asin}`,
    {
      queryParams: {
        marketplaceIds: 'A1F83G8C2ARO7P',
        // includedData: 'attributes,identifiers,images,salesRanks,summaries,variations'
      },
      rateLimiter: RateLimiters.catalog
    }
  );

  console.log('═══════════════════════════════════════════════════════════\n');

  if (res.success) {
    console.log('✅ SUCCESS!\n');
    console.log('Response Data:');
    console.log(JSON.stringify(res.data, null, 2));
  } else {
    console.log('❌ FAILED\n');
    console.log('Status Code:', res.statusCode);
    console.log('\nErrors:');
    console.log(JSON.stringify(res.errors, null, 2));

    console.log('\nResponse Headers:');
    if (res.headers) {
      console.log('  x-amzn-requestid:', res.headers['x-amzn-requestid']);
      console.log('  x-amzn-errortype:', res.headers['x-amzn-errortype']);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

testCatalogAPI().catch(console.error);
