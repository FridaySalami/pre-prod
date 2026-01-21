const axios = require('axios');
require('dotenv').config();

async function testApi() {
  const clientId = process.env.MYHRTOOLKIT_CLIENT_ID;
  const clientSecret = process.env.MYHRTOOLKIT_CLIENT_SECRET;
  const apiUrl = process.env.MYHRTOOLKIT_API_URL;

  if (!clientId || !clientSecret || !apiUrl) {
    console.error("Missing env vars");
    return;
  }

  try {
    console.log("Authenticating...");
    const tokenUrl = `${apiUrl}/oauth/access_token`;
    const authBody = `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;

    const authResponse = await axios.post(tokenUrl, authBody, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' }
    });

    const { access_token } = authResponse.data;
    console.log("Auth success.");

    const holidaysUrl = `${apiUrl}/public/holidays`;
    // Fetch 2025 AND 2026 to see if we get ANY future dates
    for (const year of [2025, 2026]) {
      console.log(`\nFetching ${year} holidays...`);
      const res = await axios.get(holidaysUrl, {
        headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' },
        params: { year, limit: 1000 } // Try adding limit
      });

      console.log('Response keys:', Object.keys(res.data));
      if (res.data.meta) console.log('Meta:', res.data.meta);
      if (res.data.links) console.log('Links:', res.data.links);

      // Handle if data is directly the array or inside .data
      const holidays = Array.isArray(res.data) ? res.data : (res.data.data || []);
      console.log(`Total count: ${holidays.length}`);

      if (holidays.length > 0) {
        const dates = [...new Set(holidays.map(h => h.from.split(' ')[0]))].sort();
        console.log('Distinct Dates:', dates);

        const statuses = [...new Set(holidays.map(h => h.status))];
        console.log('Distinct Statuses:', statuses);
      }
    }

  } catch (e) {
    console.error("Error:", e.message);
  }
}

testApi();
