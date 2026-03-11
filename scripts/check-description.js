const { SellingPartnerAPI } = require('./dist/lib/amazon/sp-api-client.js');

async function checkDescription() {
  const client = new SellingPartnerAPI({
    refreshToken: process.env.AMAZON_REFRESH_TOKEN,
    clientId: process.env.AMAZON_CLIENT_ID,
    clientSecret: process.env.AMAZON_CLIENT_SECRET,
    region: 'eu-west-1',
    marketplace: 'UK'
  });

  const asin = 'B07N88YRJT';
  
  const result = await client.get(`/catalog/2022-04-01/items/${asin}`, {
    queryParams: {
      marketplaceIds: 'A1F83G8C2ARO7P',
      includedData: 'summaries,attributes'
    }
  });

  console.log('\n=== Full Attributes ===');
  console.log(JSON.stringify(result.data.attributes, null, 2));
  
  console.log('\n=== Looking for description fields ===');
  const attrs = result.data.attributes || {};
  
  if (attrs.product_description) {
    console.log('✓ Found product_description:', attrs.product_description);
  }
  
  if (attrs.description) {
    console.log('✓ Found description:', attrs.description);
  }
  
  if (attrs.item_description) {
    console.log('✓ Found item_description:', attrs.item_description);
  }
  
  // Check all keys that contain "desc"
  console.log('\n=== All keys containing "desc" ===');
  Object.keys(attrs).filter(k => k.toLowerCase().includes('desc')).forEach(key => {
    console.log(`${key}:`, attrs[key]);
  });
}

checkDescription().catch(console.error);
