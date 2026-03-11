/**
 * Test Catalog Items API Access
 * ASIN: B08BPCC8WD
 * 
 * This will verify we can access the Catalog Items API v2022-04-01
 * using our existing Product Listing role.
 */

// Load environment variables from .env file
import { config } from 'dotenv';
config();

import { SPAPIClient, RateLimiters } from './src/lib/amazon/index.js';

async function testCatalogAPI() {
  console.log('🔍 Testing Amazon Catalog Items API v2022-04-01...\n');

  const client = SPAPIClient.fromEnv();
  const testAsin = 'B08BPCC8WD';

  try {
    console.log(`📦 Fetching catalog data for ASIN: ${testAsin}`);
    console.log(`🌍 Marketplace: A1F83G8C2ARO7P (UK)\n`);

    const response = await client.get(
      `/catalog/2022-04-01/items/${testAsin}`,
      {
        queryParams: {
          marketplaceIds: 'A1F83G8C2ARO7P',
          includedData: 'attributes,images,productTypes,salesRanks,dimensions'
        },
        rateLimiter: RateLimiters.catalog
      }
    );

    console.log('✅ SUCCESS! Catalog API is accessible!\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Log full response for debugging
    console.log('📄 Full API Response:');
    console.log(JSON.stringify(response, null, 2));
    console.log('\n═══════════════════════════════════════════════════════════\n');

    // Extract key data from the response
    const item = response.data || response;
    const attributes = item.attributes || {};
    const summaries = item.summaries || [];
    const summary = summaries[0] || {};

    // Product Title
    const title = attributes.item_name?.[0]?.value || summary.itemName || 'N/A';
    console.log('📝 PRODUCT TITLE:');
    console.log(`   ${title}\n`);

    // Brand
    const brand = attributes.brand?.[0]?.value || summary.brand || 'N/A';
    console.log('🏷️  BRAND:');
    console.log(`   ${brand}\n`);

    // Model Number
    const modelNumber = attributes.model_number?.[0]?.value || summary.modelNumber || 'N/A';
    console.log('🔢 MODEL NUMBER:');
    console.log(`   ${modelNumber}\n`);

    // Images - Handle nested marketplace structure
    const imageGroups = item.images || [];
    const images = imageGroups[0]?.images || [];
    console.log(`🖼️  IMAGES: ${images.length} available`);
    images.slice(0, 3).forEach((img: any, i: number) => {
      console.log(`   ${i + 1}. ${img.variant} (${img.width}x${img.height})`);
      console.log(`      ${img.link}`);
    });
    if (images.length > 3) {
      console.log(`   ... and ${images.length - 3} more`);
    }
    console.log('');

    // Features/Bullets
    const features = attributes.bullet_point || [];
    console.log(`📋 FEATURE BULLETS: ${features.length} available`);
    features.slice(0, 3).forEach((feature: any, i: number) => {
      const text = feature.value.length > 80 ? feature.value.substring(0, 80) + '...' : feature.value;
      console.log(`   ${i + 1}. ${text}`);
    });
    if (features.length > 3) {
      console.log(`   ... and ${features.length - 3} more`);
    }
    console.log('');

    // Sales Rank - Handle nested marketplace structure
    const salesRankGroups = item.salesRanks || [];
    const salesRanks = salesRankGroups[0]?.displayGroupRanks || [];
    if (salesRanks.length > 0) {
      console.log('📊 SALES RANKS (BSR):');
      salesRanks.forEach((rank: any) => {
        console.log(`   ${rank.title}: #${rank.rank.toLocaleString()}`);
      });

      // Also show classification ranks
      const classRanks = salesRankGroups[0]?.classificationRanks || [];
      classRanks.forEach((rank: any) => {
        console.log(`   ${rank.title}: #${rank.rank.toLocaleString()}`);
      });
      console.log('');
    }

    // Dimensions - Handle nested marketplace structure
    const dimensionGroups = item.dimensions || [];
    const dimensions = dimensionGroups[0]?.item || {};
    if (dimensions.height || dimensions.width || dimensions.length) {
      console.log('📏 PRODUCT DIMENSIONS:');
      console.log(`   ${dimensions.length?.value} × ${dimensions.width?.value} × ${dimensions.height?.value} ${dimensions.height?.unit || ''}`);
      if (dimensions.weight) {
        console.log(`   Weight: ${dimensions.weight.value} ${dimensions.weight.unit}`);
      }
      console.log('');
    }

    // Product Type - Handle nested marketplace structure
    const productTypeGroups = item.productTypes || [];
    if (productTypeGroups.length > 0) {
      console.log('🏷️  PRODUCT TYPE:');
      console.log(`   ${productTypeGroups[0].productType}\n`);
    }

    // List Price
    const listPrice = attributes.list_price?.[0];
    if (listPrice) {
      console.log('💰 LIST PRICE:');
      console.log(`   ${listPrice.currency} ${listPrice.value}\n`);
    }

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('✅ VERIFICATION COMPLETE!\n');
    console.log('📌 KEY FINDINGS:');
    console.log('   • Catalog Items API v2022-04-01 is ACCESSIBLE');
    console.log('   • Product Listing role grants full access');
    console.log('   • No additional scopes needed');
    console.log('   • Ready to implement Phase 2!\n');

    console.log('🚀 NEXT STEPS:');
    console.log('   1. Build /api/amazon/catalog/[asin]/+server.ts endpoint');
    console.log('   2. Create amazon_catalog_cache database table');
    console.log('   3. Display product details on buy-box page');
    console.log('   4. Extract keywords from title + bullets');
    console.log('   5. Calculate listing health score\n');

    // Also log full response for debugging
    console.log('📄 Full API Response (for debugging):');
    console.log(JSON.stringify(response, null, 2));

  } catch (error: any) {
    console.error('❌ ERROR: Catalog API test failed!\n');
    console.error('Error details:', error.message);

    if (error.response) {
      console.error('\nAPI Response:');
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }

    if (error.response?.status === 403) {
      console.error('\n⚠️  403 Forbidden - This could mean:');
      console.error('   • Product Listing role is not properly enabled');
      console.error('   • Refresh token needs to be regenerated');
      console.error('   • App authorization needs to be renewed');
    }

    process.exit(1);
  }
}

// Run the test
testCatalogAPI();
