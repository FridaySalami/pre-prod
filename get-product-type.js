// Check current product type for an ASIN using Listings API
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

async function getListingItem(sku, marketplaceId = 'A1F83G8C2ARO7P') {
  try {
    console.log(`🔍 Getting listing item for SKU: ${sku}`);

    const token = await getAccessToken();
    const endpoint = 'https://sellingpartnerapi-eu.amazon.com';

    // Get listing item details
    const response = await fetch(`${endpoint}/listings/2021-08-01/items/${encodeURIComponent(process.env.AMAZON_SELLER_ID)}/${encodeURIComponent(sku)}?marketplaceIds=${marketplaceId}&includedData=summaries,attributes`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-amz-access-token': token,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to get listing: ${response.status} ${response.statusText}`);
      console.error('Error details:', errorText);
      return null;
    }

    const data = await response.json();
    console.log('📊 Listing Item Data:');
    console.log(JSON.stringify(data, null, 2));

    // Extract product type
    if (data.summaries && data.summaries.length > 0) {
      const summary = data.summaries[0];
      console.log(`\n🎯 Product Type: ${summary.productType || 'Not found'}`);
      console.log(`🎯 Item Name: ${summary.itemName || 'Not found'}`);
      console.log(`🎯 Status: ${summary.status || 'Not found'}`);

      if (summary.productType) {
        return summary.productType;
      }
    }

    return null;

  } catch (error) {
    console.error('❌ Error getting listing item:', error);
    return null;
  }
}

// Check for our specific SKU
const sku = process.argv[2] || 'COL01A';
getListingItem(sku);
