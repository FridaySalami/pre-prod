const axios = require('axios');
require('dotenv').config();

async function attemptAuth(id, secret, method = 'body') {
  console.log(`\nTesting Auth Method: ${method}`);
  console.log(`Client ID: ${id.substring(0, 4)}...`);
  console.log(`Client Secret: ${secret.substring(0, 4)}...`);

  const apiUrl = process.env.MYHRTOOLKIT_API_URL;
  if (!apiUrl) throw new Error("Missing MYHRTOOLKIT_API_URL");

  const authUrl = `${apiUrl}/oauth/access_token`;

  try {
    let response;

    if (method === 'body') {
      const authBody = `grant_type=client_credentials&client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}`;

      response = await axios.post(authUrl, authBody, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'cache-control': 'no-cache'
        }
      });
    } else if (method === 'basic') {
      const credentials = Buffer.from(`${id}:${secret}`).toString('base64');
      const authBody = 'grant_type=client_credentials';

      response = await axios.post(authUrl, authBody, {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'cache-control': 'no-cache'
        }
      });
    }

    console.log("SUCCESS!");
    console.log(response.data);
    return response.data.access_token;

  } catch (error) {
    if (error.response) {
      console.log(`FAILED: ${error.response.status} - ${error.response.data.error ? JSON.stringify(error.response.data.error) : JSON.stringify(error.response.data)}`);
    } else {
      console.log(`ERROR: ${error.message}`);
    }
    return null;
  }
}

async function runTests() {
  const cId = process.env.MYHRTOOLKIT_CLIENT_ID ? process.env.MYHRTOOLKIT_CLIENT_ID.trim() : '';
  const cSecret = process.env.MYHRTOOLKIT_CLIENT_SECRET ? process.env.MYHRTOOLKIT_CLIENT_SECRET.trim() : '';

  if (!cId || !cSecret) {
    console.error("Missing MYHRTOOLKIT credentials in .env");
    return;
  }

  // Test 1: Standard (Body) - Order: ID, Secret
  await attemptAuth(cId, cSecret, 'body');

  // Test 2: Standard (Body) - Swapped: Secret, ID
  // In case user mixed them up
  await attemptAuth(cSecret, cId, 'body');

  // Test 3: Basic Auth - Order: ID, Secret
  await attemptAuth(cId, cSecret, 'basic');
}

runTests();
