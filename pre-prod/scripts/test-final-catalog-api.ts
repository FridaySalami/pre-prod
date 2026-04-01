/**
 * Final Test: Catalog API with Updated SP-API Client
 * 
 * Tests the updated sp-api-client.ts with External ID support
 */

import 'dotenv/config';
import { SPAPIClient } from './src/lib/amazon/sp-api-client';

const ASIN = 'B08BPCC8WD';

async function testCatalogApiWithUpdatedClient() {
  console.log('🧪 Testing Catalog API with Updated SP-API Client\n');
  console.log('='.repeat(70));

  // Create client with Seller ID (for External ID in AssumeRole)
  const client = new SPAPIClient({
    clientId: process.env.AMAZON_CLIENT_ID!,
    clientSecret: process.env.AMAZON_CLIENT_SECRET!,
    refreshToken: process.env.AMAZON_REFRESH_TOKEN!,
    awsAccessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID!,
    awsSecretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY!,
    awsRegion: 'eu-west-1',
    marketplaceId: 'A1F83G8C2ARO7P', // UK
    sellerId: process.env.AMAZON_SELLER_ID // CRITICAL: For External ID
  });

  console.log('\n📝 Configuration:');
  console.log('   Region: eu-west-1');
  console.log('   Marketplace: A1F83G8C2ARO7P (UK)');
  console.log('   Seller ID:', process.env.AMAZON_SELLER_ID);
  console.log('   Role ARN:', process.env.AMAZON_ROLE_ARN);
  console.log('');

  console.log('📞 Test 1: Catalog Items API');
  console.log('   ASIN:', ASIN);
  console.log('');

  try {
    const result = await client.get(`/catalog/2022-04-01/items/${ASIN}`, {
      queryParams: { marketplaceIds: 'A1F83G8C2ARO7P' }
    });

    if (result.success && result.data) {
      console.log('✅ SUCCESS! Catalog API works!\n');
      console.log('📦 Product Information:');
      console.log('   ASIN:', result.data.asin);

      // Extract product details from summaries
      const summary = result.data.summaries?.[0];
      if (summary) {
        console.log('   Brand:', summary.brand || 'N/A');
        console.log('   Name:', summary.itemName || 'N/A');
        console.log('   Classification:', summary.itemClassification || 'N/A');
        console.log('   Package Qty:', summary.packageQuantity || 'N/A');
      }

      console.log('\n🎯 SOLUTION CONFIRMED:');
      console.log('   ✅ External ID (Seller Partner ID) is REQUIRED');
      console.log('   ✅ Must be passed to AssumeRoleCommand');
      console.log('   ✅ Enables access to Catalog Items API');

      console.log('\n📋 What was wrong:');
      console.log('   ❌ AssumeRole was called WITHOUT External ID');
      console.log('   ❌ Amazon requires Seller ID as External ID for security');
      console.log('   ❌ Without it, temporary credentials lack Catalog API permission');

      console.log('\n✅ What fixed it:');
      console.log('   ✓ Added ExternalId parameter to AssumeRoleCommand');
      console.log('   ✓ Used Seller Partner ID (A2D8NG39VURSL3) as External ID');
      console.log('   ✓ Now temporary credentials have full API access');

    } else {
      console.log('❌ FAILED:', result.errors);
    }
  } catch (error: any) {
    console.log('❌ ERROR:', error.message);
    console.log('\nStack:', error.stack);
  }

  console.log('\n' + '='.repeat(70));
  console.log('📚 Key Learnings:\n');
  console.log('1. Amazon SP-API requires External ID in STS AssumeRole');
  console.log('2. External ID must be the Seller Partner ID');
  console.log('3. This is a security measure for cross-account access');
  console.log('4. Without External ID, temporary credentials are restricted');
  console.log('5. The IAM role trust policy must allow this External ID');
  console.log('');
  console.log('Trust Policy should include:');
  console.log('```json');
  console.log(JSON.stringify({
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::881471314805:user/amazon-spapi-user"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "A2D8NG39VURSL3"
        }
      }
    }]
  }, null, 2));
  console.log('```');
  console.log('\n' + '='.repeat(70));
}

testCatalogApiWithUpdatedClient().catch(console.error);
