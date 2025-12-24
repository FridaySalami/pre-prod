import crypto from 'crypto';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('No .env file found');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};

  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  });

  return env;
}

const env = loadEnvFile();

async function getLwaAccessToken() {
  try {
    const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: env.AMAZON_REFRESH_TOKEN,
        client_id: env.AMAZON_CLIENT_ID,
        client_secret: env.AMAZON_CLIENT_SECRET
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token Exchange Failed: ${tokenResponse.status} ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
}

async function checkSettlementReports() {
  try {
    const accessToken = await getLwaAccessToken();
    console.log('Got access token');

    const endpoint = 'https://sellingpartnerapi-eu.amazon.com/reports/2021-06-30/reports';
    const createdSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const url = new URL(endpoint);
    url.searchParams.append('reportTypes', 'GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2');
    url.searchParams.append('createdSince', createdSince);
    url.searchParams.append('pageSize', '10');

    console.log(`Fetching reports from: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Request Failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log(`Found ${data.reports ? data.reports.length : 0} reports.`);

    if (data.reports && data.reports.length > 0) {
      console.log('Most recent report:', JSON.stringify(data.reports[0], null, 2));
    } else {
      console.log('No settlement reports found in the last 30 days.');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkSettlementReports();
