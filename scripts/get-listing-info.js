// Check the current product type for an ASIN
import dotenv from 'dotenv';

dotenv.config();

async function getAccessToken() {
  const response = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.AMAZON_REFRESH_TOKEN,
      client_id: process.env.AMAZON_CLIENT_ID,
      client_secret: process.env.AMAZON_CLIENT_SECRET
    })
  });

  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function getListingInfo(sku) {
  try {
    console.log(`🔍 Getting listing info for SKU: ${sku}`);

    const token = await getAccessToken();
    const endpoint = 'https://sellingpartnerapi-eu.amazon.com';
    const marketplaceId = process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P';

    // Get listing item info
    const response = await fetch(`${endpoint}/listings/2021-08-01/items/${process.env.AMAZON_CLIENT_ID}/${sku}?marketplaceIds=${marketplaceId}&includedData=summaries,attributes,offers,productTypes`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-amz-access-token': token,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to get listing info: ${response.status} ${response.statusText} - ${errorText}`);
      return;
    }

    const listingData = await response.json();
    console.log('📊 Listing Data:');
    console.log(JSON.stringify(listingData, null, 2));

    // Extract product type if available
    if (listingData.productTypes && listingData.productTypes.length > 0) {
      console.log('\n🎯 Product Types:');
      listingData.productTypes.forEach(pt => {
        console.log(`   - ${pt.productType}`);
      });
    }

    // Extract summaries if available
    if (listingData.summaries && listingData.summaries.length > 0) {
      console.log('\n📋 Summaries:');
      listingData.summaries.forEach((summary, index) => {
        console.log(`   Summary ${index + 1}:`, JSON.stringify(summary, null, 4));
      });
    }

  } catch (error) {
    console.error('❌ Error getting listing info:', error);
  }
}

// Get SKU from command line or use default
const sku = process.argv[2] || 'COL01A';
getListingInfo(sku);
