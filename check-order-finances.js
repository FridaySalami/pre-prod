import crypto from 'crypto';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORDER_ID = '205-5978339-5725904';

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
      console.error(`Token Exchange Failed: ${tokenResponse.status} ${tokenResponse.statusText}`);
      console.error(errorText);
      return null;
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (error) {
    console.error(`Token Exchange Error: ${error.message}`);
    return null;
  }
}

async function getFinancialEvents(accessToken, orderId) {
  try {
    const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const date = timestamp.substr(0, 8);
    const region = 'eu-west-1';
    const service = 'execute-api';
    const host = `sellingpartnerapi-eu.amazon.com`;
    const method = 'GET';
    const uri = `/finances/v0/orders/${orderId}/financialEvents`;
    const querystring = '';

    // Create AWS signature
    const canonical_request = `${method}\n${uri}\n${querystring}\nhost:${host}\nx-amz-access-token:${accessToken}\nx-amz-date:${timestamp}\n\nhost;x-amz-access-token;x-amz-date\n${crypto.createHash('sha256').update('').digest('hex')}`;

    const algorithm = 'AWS4-HMAC-SHA256';
    const credential_scope = `${date}/${region}/${service}/aws4_request`;
    const string_to_sign = `${algorithm}\n${timestamp}\n${credential_scope}\n${crypto.createHash('sha256').update(canonical_request).digest('hex')}`;

    const kDate = crypto.createHmac('sha256', 'AWS4' + env.AWS_SECRET_ACCESS_KEY).update(date).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();

    const signature = crypto.createHmac('sha256', kSigning).update(string_to_sign).digest('hex');

    const authorization = `${algorithm} Credential=${env.AWS_ACCESS_KEY_ID}/${credential_scope}, SignedHeaders=host;x-amz-access-token;x-amz-date, Signature=${signature}`;

    console.log(`Fetching financial events for order ${orderId}...`);

    const response = await fetch(`https://${host}${uri}`, {
      method: 'GET',
      headers: {
        'Host': host,
        'Authorization': authorization,
        'x-amz-access-token': accessToken,
        'x-amz-date': timestamp
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Request Failed: ${response.status} ${response.statusText}`);
      console.error(errorText);
      return;
    }

    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error(`API Request Error: ${error.message}`);
  }
}

async function main() {
  const accessToken = await getLwaAccessToken();
  if (accessToken) {
    await getFinancialEvents(accessToken, ORDER_ID);
  }
}

main();
