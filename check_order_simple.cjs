require('dotenv').config();
const AmazonService = require('./src/lib/services/amazon-listings-api.cjs');

async function checkOrder() {
  const orderId = '203-4411232-5467562';
  console.log(`Checking order ${orderId}...`);

  const api = new AmazonService({
    environment: 'production' // IMPORTANT: Use production to get real data
  });

  try {
    const response = await api.makeRequest(`/orders/v0/orders/${orderId}`);
    const data = await response.json();

    if (!response.ok) {
      console.error('API Error:', data);
    } else {
      console.log('Order Details:');
      console.log(JSON.stringify(data, null, 2));

      // Highlight the Shipping Level
      if (data.payload) {
        console.log('\n--- Shipping Info ---');
        console.log('ShipmentServiceLevelCategory:', data.payload.ShipmentServiceLevelCategory);
        console.log('ShipServiceLevel:', data.payload.ShipServiceLevel);
      }
    }

  } catch (e) {
    console.error('Script Error:', e);
  }
}

checkOrder();
