/**
 * Detailed 403 error inspection - capture ALL error information
 */

import 'dotenv/config';
import { SPAPIClient, RateLimiters } from './src/lib/amazon/index';

async function testDetailedError() {
  const client = SPAPIClient.fromEnv();
  const asin = 'B08BPCC8WD';

  console.log('🔍 Detailed 403 Error Analysis\n');
  console.log('Testing Catalog API v2022-04-01...\n');

  try {
    const response = await client.get(
      `/catalog/2022-04-01/items/${asin}`,
      {
        queryParams: {
          marketplaceIds: 'A1F83G8C2ARO7P',
          includedData: 'attributes,images,productTypes,salesRanks'
        },
        rateLimiter: RateLimiters.catalog
      }
    );

    if (!response.success) {
      console.log('❌ Request Failed\n');
      console.log('═══════════════════════════════════════');
      console.log('STATUS CODE:', response.statusCode);
      console.log('═══════════════════════════════════════\n');

      console.log('📋 ERRORS ARRAY:');
      if (response.errors && Array.isArray(response.errors)) {
        response.errors.forEach((error, index) => {
          console.log(`\nError #${index + 1}:`);
          console.log('  code:', error.code);
          console.log('  message:', error.message);
          console.log('  details:', error.details || '(no details)');

          // Check if there are any other fields
          const otherFields = Object.keys(error).filter(
            key => !['code', 'message', 'details'].includes(key)
          );
          if (otherFields.length > 0) {
            console.log('  Other fields:', otherFields);
            otherFields.forEach(field => {
              console.log(`    ${field}:`, (error as any)[field]);
            });
          }
        });
      } else {
        console.log('  (errors is not an array or is undefined)');
        console.log('  Raw errors:', JSON.stringify(response.errors, null, 2));
      }

      console.log('\n═══════════════════════════════════════');
      console.log('📨 RESPONSE HEADERS:');
      console.log('═══════════════════════════════════════');
      if (response.headers) {
        Object.entries(response.headers).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      } else {
        console.log('  (no headers captured)');
      }

      console.log('\n═══════════════════════════════════════');
      console.log('🔍 FULL RESPONSE OBJECT:');
      console.log('═══════════════════════════════════════');
      console.log(JSON.stringify(response, null, 2));
    } else {
      console.log('✅ Unexpected success!');
      console.log(JSON.stringify(response.data, null, 2));
    }
  } catch (error: any) {
    console.error('💥 EXCEPTION THROWN:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);

    if (error.response) {
      console.error('\nHTTP Response:');
      console.error('  Status:', error.response.status);
      console.error('  Headers:', error.response.headers);
      console.error('  Data:', error.response.data);
    }
  }
}

testDetailedError();
