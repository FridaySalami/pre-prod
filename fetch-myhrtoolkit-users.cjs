const axios = require('axios');
require('dotenv').config();

async function fetchUsers() {
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

    // Step 2: Fetch Users
    console.log("\nFetching all users...");
    const usersUrl = `${apiUrl}/public/users`;

    const usersResponse = await axios.get(usersUrl, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json'
      }
    });

    const users = usersResponse.data.data;
    console.log(`Found ${users.length} users.`);

    // Display first 5 users as sample
    console.log("\nSample Users (first 5):");
    console.dir(users.slice(0, 5), { depth: null, colors: true });

    if (users.length > 0) {
      // Pick the first user to get more details
      const testUser = users[0];
      console.log(`\nFetching details for user: ${testUser.forename} ${testUser.surname} (ID: ${testUser.id})`);

      // Step 3: Fetch User Details
      const userDetailsUrl = `${apiUrl}/public/users/${testUser.id}`;
      const userDetailsResponse = await axios.get(userDetailsUrl, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Accept': 'application/json'
        }
      });
      console.log("User Details:");
      console.dir(userDetailsResponse.data, { depth: null, colors: true });

      // Step 4: Fetch User Holiday Dashboard
      console.log(`\nFetching holiday dashboard for user ID: ${testUser.id}`);
      const dashboardUrl = `${apiUrl}/public/users/${testUser.id}/holidaydashboard`;
      const dashboardResponse = await axios.get(dashboardUrl, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Accept': 'application/json'
        }
      });
      console.log("Holiday Dashboard:");
      console.dir(dashboardResponse.data, { depth: null, colors: true });
    }

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

fetchUsers();
