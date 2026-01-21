const axios = require('axios');
require('dotenv').config();

async function fetchHolidays() {
  const clientId = process.env.MYHRTOOLKIT_CLIENT_ID;
  const clientSecret = process.env.MYHRTOOLKIT_CLIENT_SECRET;
  const apiUrl = process.env.MYHRTOOLKIT_API_URL || 'https://api.myhrtoolkit.com';

  if (!clientId || !clientSecret) {
    console.error("Missing MYHRTOOLKIT credentials in .env");
    return;
  }

  console.log("Authenticating with myHRtoolkit...");

  try {
    // Step 1: Get Access Token
    const tokenUrl = `${apiUrl}/oauth/access_token`;
    const authBody = `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;

    const authResponse = await axios.post(tokenUrl, authBody, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'cache-control': 'no-cache'
      }
    });

    const { access_token } = authResponse.data;
    console.log("Authentication successful! Token received.");

    // Step 2: Fetch Holidays
    console.log("Fetching holidays for 2026...");
    const holidaysUrl = `${apiUrl}/public/holidays`;

    const holidaysResponse = await axios.get(holidaysUrl, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json'
      },
      params: {
        year: 2026
      }
    });

    console.log("\nHolidays Response:");
    console.dir(holidaysResponse.data, { depth: null, colors: true });

  } catch (error) {
    console.error("\nError:");
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error("Data:", error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

fetchHolidays();
