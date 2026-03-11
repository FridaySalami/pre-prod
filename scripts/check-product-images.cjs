/**
 * Fetch and display raw image data from Amazon Catalog API
 */

const dotenv = require('dotenv');
const axios = require('axios');
const crypto = require('crypto');

dotenv.config();

const asin = process.argv[2] || 'B076B1NF1Q';

// Simplified SP-API client for this diagnostic
async function getAccessToken() {
  const response = await axios.post('https://api.amazon.com/auth/o2/token', null, {
    params: {
      grant_type: 'refresh_token',
      refresh_token: process.env.AMAZON_REFRESH_TOKEN,
      client_id: process.env.AMAZON_CLIENT_ID,
      client_secret: process.env.AMAZON_CLIENT_SECRET
    }
  });
  return response.data.access_token;
}

async function checkImages() {
  console.log('🔍 Amazon Catalog API - Image Analysis');
  console.log('═'.repeat(70));
  console.log(`📦 ASIN: ${asin}\n`);

  try {
    console.log('⏳ Getting access token...');
    const accessToken = await getAccessToken();

    console.log('⏳ Fetching from Amazon Catalog Items API v2022-04-01...\n');

    const response = await axios.get(
      `https://sellingpartnerapi-eu.amazon.com/catalog/2022-04-01/items/${asin}`,
      {
        headers: {
          'x-amz-access-token': accessToken
        },
        params: {
          marketplaceIds: 'A1F83G8C2ARO7P',
          includedData: 'summaries,images'
        }
      }
    );

    const data = response.data;
    console.log('✅ API Response Received\n');
    console.log('─'.repeat(70));
    console.log('PRODUCT INFO');
    console.log('─'.repeat(70));

    const summary = data.summaries?.[0] || {};
    console.log(`Title: ${summary.itemName || 'N/A'}`);
    console.log(`Brand: ${summary.brand || 'N/A'}`);

    console.log('\n' + '─'.repeat(70));
    console.log('RAW IMAGE DATA FROM API');
    console.log('─'.repeat(70));

    const imagesArray = data.images?.[0]?.images || [];
    console.log(`Total image entries: ${imagesArray.length}\n`);

    if (imagesArray.length === 0) {
      console.log('❌ No images returned by API');
      return;
    }

    // Show all raw entries
    console.log('All image entries from API:');
    imagesArray.forEach((img, i) => {
      console.log(`\n${i + 1}. Variant: ${img.variant}`);
      console.log(`   Size: ${img.width}x${img.height}px`);
      console.log(`   URL: ${img.link}`);

      // Extract image ID - FIXED REGEX
      const match = img.link.match(/\/I\/([A-Z0-9+]+)(?:\.|_)/i);
      const imageId = match ? match[1] : 'unknown';
      console.log(`   Image ID: ${imageId}`);
    });

    // Analyze duplicates
    console.log('\n' + '─'.repeat(70));
    console.log('DUPLICATE ANALYSIS');
    console.log('─'.repeat(70));

    const imageIds = new Map();
    imagesArray.forEach((img, i) => {
      const match = img.link.match(/\/I\/([A-Z0-9+]+)(?:\.|_)/i);
      const imageId = match ? match[1] : img.link;

      if (!imageIds.has(imageId)) {
        imageIds.set(imageId, []);
      }
      imageIds.get(imageId).push({ index: i, width: img.width, variant: img.variant, url: img.link });
    });

    console.log(`Unique image IDs: ${imageIds.size}`);
    console.log(`Total entries: ${imagesArray.length}`);
    console.log(`Duplicates: ${imagesArray.length - imageIds.size}\n`);

    if (imageIds.size < imagesArray.length) {
      console.log('Duplicate groups:');
      imageIds.forEach((versions, imageId) => {
        if (versions.length > 1) {
          console.log(`\n  Image ID: ${imageId} (${versions.length} versions)`);
          versions.forEach(v => {
            console.log(`    - ${v.width}px - ${v.variant} - ${v.url.substring(v.url.lastIndexOf('/') + 1)}`);
          });
        }
      });
    }

    // Show what we SHOULD display (after deduplication)
    console.log('\n' + '─'.repeat(70));
    console.log('AFTER DEDUPLICATION (what page should show)');
    console.log('─'.repeat(70));

    const uniqueImages = [];
    imageIds.forEach((versions, imageId) => {
      // Pick largest version
      const largest = versions.reduce((max, curr) => curr.width > max.width ? curr : max);
      uniqueImages.push(largest);
    });

    console.log(`Unique images to display: ${uniqueImages.length}\n`);
    uniqueImages.forEach((img, i) => {
      console.log(`${i + 1}. ${img.variant.padEnd(10)} ${img.width}x${img.width}px`);
      console.log(`   ${img.url}`);
    });

    console.log('\n' + '═'.repeat(70));
    console.log('💡 SUMMARY');
    console.log('═'.repeat(70));
    console.log(`Amazon API returns: ${imagesArray.length} image entries`);
    console.log(`Unique images: ${imageIds.size}`);
    console.log(`Your page should show: ${imageIds.size} image(s)`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkImages();
