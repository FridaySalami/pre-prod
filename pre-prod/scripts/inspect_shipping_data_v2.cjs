const axios = require('axios');
const aws4 = require('aws4');
const { URL } = require('url');
require('dotenv').config();

// Configuration
const config = {
  clientId: process.env.AMAZON_CLIENT_ID,
  clientSecret: process.env.AMAZON_CLIENT_SECRET,
  refreshToken: process.env.AMAZON_REFRESH_TOKEN,
  awsAccessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY,
  region: 'eu-west-1', // or appropriate region
  marketplaceId: 'A1F83G8C2ARO7P', // UK
  endpoint: 'sellingpartnerapi-eu.amazon.com'
};

async function getAccessToken() {
  try {
    const response = await axios.post('https://api.amazon.com/auth/o2/token', {
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function inspectShippingData() {
  try {
    const accessToken = await getAccessToken();
    console.log('Got access token');

    // Calculate dates for "yesterday" to find recent orders
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 3); // wider window to ensure hits
    const createdAfter = yesterday.toISOString();

    const path = '/orders/2026-01-01/orders';
    const queryParams = new URLSearchParams({
      marketplaceIds: config.marketplaceId,
      createdAfter: createdAfter,
      maxResultsPerPage: '10',
      includedData: 'FULFILLMENT,PROCEEDS,PACKAGES,BUYER,RECIPIENT'
    });

    const requestOptions = {
      host: config.endpoint,
      path: `${path}?${queryParams.toString()}`,
      method: 'GET',
      headers: {
        'x-amz-access-token': accessToken,
        'content-type': 'application/json'
      },
      region: config.region,
      service: 'execute-api'
    };

    // Sign the request
    aws4.sign(requestOptions, {
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey
    });

    console.log(`Requesting ${path}?${queryParams.toString()}...`);

    const response = await axios({
      method: requestOptions.method,
      url: `https://${config.endpoint}${requestOptions.path}`,
      headers: requestOptions.headers
    });

    console.log('Response Status:', response.status);

    const orders = response.data.orders;
    if (!orders || orders.length === 0) {
      console.log("No orders found in window.");
      return;
    }

    console.log(`Found ${orders.length} orders. Scanning for non-zero shipping revenue...`);

    let foundShipping = false;

    // Dump full JSON to file or console
    if (orders.length > 0) {
      // Just print the first few orders fully to avoid massive console spam, or print all if user wants "whole raw data"
      // User asked for "whole raw data", so let's pick the first order with items and print it ENTIRELY.
      const exampleOrder = orders.find(o => o.orderItems && o.orderItems.length > 0) || orders[0];
      console.log("FULL RAW ORDER JSON:");
      console.log(JSON.stringify(exampleOrder, null, 2));
    }

    /* 
    // OLD FILTER LOGIC COMMENTED OUT - USER WANTS FULL RAW DUMP
    for(const order of orders) {
    ...
    */

  } catch (error) {
    console.error('Error fetching data:', error.message);
    if (error.response) {
      console.error('API Error Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

inspectShippingData();
