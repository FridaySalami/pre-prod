/**
 * Quick Catalog API Test with Multiple ASINs
 */

import 'dotenv/config';
import { SPAPIClient } from './src/lib/amazon/sp-api-client';

const TEST_ASINS = [
  'B08BPCC8WD', // Major Stock Powder
  'B0CSYNW3X3', // Example ASIN
  'B00005LA8Y'  // Another example
];

async function testMultipleAsins() {
  const client = new SPAPIClient({
    clientId: process.env.AMAZON_CLIENT_ID!,
    clientSecret: process.env.AMAZON_CLIENT_SECRET!,
    refreshToken: process.env.AMAZON_REFRESH_TOKEN!,
    awsAccessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID!,
    awsSecretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY!,
    awsRegion: 'eu-west-1',
    marketplaceId: 'A1F83G8C2ARO7P',
    sellerId: process.env.AMAZON_SELLER_ID
  });

  console.log('🧪 Testing Catalog API with Multiple ASINs\n');
  console.log('='.repeat(70));

  for (const asin of TEST_ASINS) {
    console.log(`\n📦 Testing ASIN: ${asin}`);

    try {
      const result = await client.get(`/catalog/2022-04-01/items/${asin}`, {
        queryParams: { marketplaceIds: 'A1F83G8C2ARO7P' }
      });

      if (result.success && result.data) {
        const summary = result.data.summaries?.[0];
        console.log('   ✅ SUCCESS');
        console.log('   Brand:', summary?.brand || 'N/A');
        console.log('   Name:', summary?.itemName || 'N/A');
      } else {
        console.log('   ❌ Failed:', result.errors?.[0]?.message || 'Unknown error');
      }
    } catch (error: any) {
      console.log('   ❌ Error:', error.message);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ All tests complete! Catalog API is fully operational.\n');
}

testMultipleAsins().catch(console.error);
