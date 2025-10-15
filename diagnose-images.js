/**
 * Diagnostic script to check image data for a specific ASIN
 * This will show us exactly what the Catalog API is returning
 */

import { SPAPIClient } from './src/lib/amazon/sp-api-client.js';
import { CatalogService } from './src/lib/amazon/catalog-service.js';

const asin = process.argv[2] || 'B008K4HNOY'; // Callebaut as default

async function diagnoseImages() {
  console.log('🔍 Image Diagnostic Tool');
  console.log('═'.repeat(70));
  console.log(`📦 ASIN: ${asin}\n`);

  try {
    // Initialize client
    const client = SPAPIClient.fromEnv();
    const catalogService = new CatalogService(client);

    // Temporarily disable cache to get fresh data
    catalogService.cacheEnabled = false;

    // Fetch product
    console.log('⏳ Fetching catalog data from Amazon API...\n');
    const product = await catalogService.getProduct(asin);

    console.log('✅ Data Retrieved!\n');
    console.log('─'.repeat(70));
    console.log('📸 IMAGE ANALYSIS');
    console.log('─'.repeat(70));
    console.log(`Total Images: ${product.images.length}\n`);

    if (product.images.length === 0) {
      console.log('❌ No images found for this ASIN');
      return;
    }

    // Check for duplicates
    const imageLinks = product.images.map(img => img.link);
    const uniqueLinks = [...new Set(imageLinks)];

    console.log(`Unique Image URLs: ${uniqueLinks.length}`);
    console.log(`Duplicate Count: ${imageLinks.length - uniqueLinks.length}\n`);

    if (imageLinks.length !== uniqueLinks.length) {
      console.log('⚠️  DUPLICATES DETECTED!\n');
    }

    // Show all images with details
    console.log('Image List:');
    product.images.forEach((img, index) => {
      const isDuplicate = imageLinks.indexOf(img.link) !== index ? '❌ DUPLICATE' : '';
      console.log(`  ${(index + 1).toString().padStart(2)}. ${img.variant.padEnd(10)} ${img.width}x${img.height}px ${isDuplicate}`);
      console.log(`      ${img.link.substring(0, 80)}...`);
    });

    console.log('\n─'.repeat(70));
    console.log('🔗 UNIQUE IMAGES ONLY');
    console.log('─'.repeat(70));

    const uniqueImages = product.images.filter((img, index, self) =>
      index === self.findIndex(i => i.link === img.link)
    );

    console.log(`Total Unique Images: ${uniqueImages.length}\n`);
    uniqueImages.forEach((img, index) => {
      console.log(`  ${(index + 1).toString().padStart(2)}. ${img.variant.padEnd(10)} ${img.width}x${img.height}px`);
    });

    console.log('\n─'.repeat(70));
    console.log('💡 RAW API RESPONSE STRUCTURE');
    console.log('─'.repeat(70));

    // Make a direct API call to see raw response
    const rawResult = await client.get(`/catalog/2022-04-01/items/${asin}`, {
      queryParams: {
        marketplaceIds: 'A1F83G8C2ARO7P',
        includedData: 'images'
      }
    });

    if (rawResult.success && rawResult.data?.images) {
      console.log('\nRaw images array from API:');
      console.log(JSON.stringify(rawResult.data.images, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

diagnoseImages();
