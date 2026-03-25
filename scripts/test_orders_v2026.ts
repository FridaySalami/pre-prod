
import { SPAPIClient } from './src/lib/amazon/sp-api-client.ts';
import { env } from './src/lib/server/test-env.ts'; // We might need to mock env or load it
import * as dotenv from 'dotenv';
dotenv.config();

// Mock env if needed, or rely on dotenv loading .env file
const config = {
  clientId: process.env.AMAZON_CLIENT_ID,
  clientSecret: process.env.AMAZON_CLIENT_SECRET,
  refreshToken: process.env.AMAZON_REFRESH_TOKEN,
  awsAccessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY,
  awsRegion: 'eu-west-1',
  marketplaceId: 'A1F83G8C2ARO7P',
  sellerId: process.env.AMAZON_SELLER_ID,
  roleArn: process.env.AMAZON_ROLE_ARN
};

async function testOrdersV2026(orderId) {
  if (!config.clientId) {
    console.error("Missing env vars. Please ensure .env is set up or environment variables are passed.");
    return;
  }

  const client = new SPAPIClient(config);

  console.log(`Testing v2026-01-01 GetOrder for ${orderId}...`);

  try {
    // Test 1: Get Order (v2026-01-01)
    // According to migration guide: GetOrder -> getOrder (items always included)
    // Path: /orders/v2026-01-01/orders/{orderId}
    const getOrderRes = await client.request(
      'GET',
      `/orders/v2026-01-01/orders/${orderId}`
    );

    console.log("GetOrder Response Status:", getOrderRes.status);
    console.log("GetOrder Response Payload Keys:", Object.keys(getOrderRes.data || {}));
    if (getOrderRes.data) {
      console.log("GetOrder Data Sample:", JSON.stringify(getOrderRes.data, null, 2));
    }

  } catch (e) {
    console.error("Error calling GetOrder v2026-01-01:", e.message);
    if (e.response) {
      console.error("Response data:", JSON.stringify(e.response.data, null, 2));
    }
  }
}

const orderId = process.argv[2] || '204-9582027-8440369';
testOrdersV2026(orderId);
