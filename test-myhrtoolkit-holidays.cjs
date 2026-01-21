const axios = require('axios');
require('dotenv').config();

async function testApi() {
  const clientId = process.env.client_id ? process.env.client_id.trim() : '';
  const clientSecret = process.env.client_secret ? process.env.client_secret.trim() : '';

  if (!clientId || !clientSecret) {
    console.error("Missing client_id or client_secret in .env");
    return;
  }

  console.log(`Loaded Client ID: ${clientId.substring(0, 4)}...${clientId.substring(clientId.length - 4)} (Length: ${clientId.length})`);
  // console.log(`Loaded Client Secret: ${clientSecret.substring(0, 4)}...${clientSecret.substring(clientSecret.length - 4)} (Length: ${clientSecret.length})`);

  try {
    console.log("Authenticating with myHRtoolkit...");
    const authUrl = 'https://api.myhrtoolkit.com/oauth/access_token';

    // The API expects form-url-encoded data
    const authBody = `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;

    const authResponse = await axios.post(authUrl, authBody, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'cache-control': 'no-cache'
      }
    });

    const { access_token, token_type } = authResponse.data;
    console.log("Authentication successful!");
    console.log(`Token Type: ${token_type}`);

    // Fetch Holidays for 2026
    console.log("\nFetching Holidays for 2026...");
    const holidaysUrl = 'https://api.myhrtoolkit.com/public/holidays';
    const holidaysResponse = await axios.get(holidaysUrl, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      },
      params: {
        year: 2026
      }
    });

    console.log("Holidays Response:");
    console.log(JSON.stringify(holidaysResponse.data, null, 2));

  } catch (error) {
    console.error("Error occurred:");
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testApi();
