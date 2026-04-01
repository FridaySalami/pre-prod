// Get seller information to find the correct seller ID
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

async function getSellerInfo() {
  try {
    console.log('🔍 Getting seller information...');

    const token = await getAccessToken();
    const endpoint = 'https://sellingpartnerapi-eu.amazon.com';

    // Get seller info
    const response = await fetch(`${endpoint}/sellers/v1/marketplaceParticipations`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-amz-access-token': token,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to get seller info: ${response.status} ${response.statusText}`);
      console.error('Error details:', errorText);
      return null;
    }

    const data = await response.json();
    console.log('📊 Seller Information:');
    console.log(JSON.stringify(data, null, 2));

    // Extract seller ID
    if (data.payload && data.payload.length > 0) {
      const sellerInfo = data.payload[0];
      const sellerId = sellerInfo.sellerId;
      console.log(`\n🎯 Seller ID: ${sellerId}`);
      console.log(`🎯 Marketplace ID: ${sellerInfo.marketplace?.id || 'Not found'}`);
      console.log(`🎯 Marketplace Name: ${sellerInfo.marketplace?.name || 'Not found'}`);
      console.log(`🎯 Marketplace Country: ${sellerInfo.marketplace?.countryCode || 'Not found'}`);

      return sellerId;
    }

    return null;

  } catch (error) {
    console.error('❌ Error getting seller info:', error);
    return null;
  }
}

getSellerInfo();
