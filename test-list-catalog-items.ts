/**
 * Test listCatalogItems endpoint - alternative to getCatalogItem
 * This uses query parameters instead of path parameters
 */

import 'dotenv/config';
import { SPAPIClient, RateLimiters } from './src/lib/amazon/index';

async function testListCatalogItems() {
  const client = SPAPIClient.fromEnv();
  const asin = 'B08BPCC8WD';

  console.log('🧪 Testing listCatalogItems (query-based) endpoint...\n');

  try {
    // Test listCatalogItems with ASIN query parameter
    const response = await client.get(
      '/catalog/v0/items',
      {
        queryParams: {
          MarketplaceId: 'A1F83G8C2ARO7P',
          ASIN: asin
        },
        rateLimiter: RateLimiters.catalog
      }
    );

    if (response.success) {
      console.log('✅ SUCCESS - listCatalogItems works!\n');
      console.log('Response:', JSON.stringify(response.data, null, 2));
    } else {
      console.log('❌ FAILED\n');
      console.log('Status:', response.statusCode);
      console.log('Errors:', JSON.stringify(response.errors, null, 2));
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }
}

testListCatalogItems();
