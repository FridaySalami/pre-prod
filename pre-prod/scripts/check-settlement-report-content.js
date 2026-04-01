import crypto from 'crypto';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream';
import { promisify } from 'util';

const streamPipeline = promisify(pipeline);
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

async function checkSettlementReportContent() {
  try {
    const accessToken = await getLwaAccessToken();
    console.log('Got access token');

    const reportDocumentId = 'amzn1.spdoc.1.4.eu.73c9d221-d170-419e-97af-bcf61b6bda37.TCMXK0MEWB8E8.1118'; // From previous run
    const endpoint = `https://sellingpartnerapi-eu.amazon.com/reports/2021-06-30/documents/${reportDocumentId}`;

    console.log(`Fetching document info from: ${endpoint}`);

    const response = await fetch(endpoint, {
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

    const docInfo = await response.json();
    console.log('Document Info:', JSON.stringify(docInfo, null, 2));

    const downloadUrl = docInfo.url;
    console.log('Downloading report...');

    const downloadResponse = await fetch(downloadUrl);
    if (!downloadResponse.ok) {
      throw new Error(`Download Failed: ${downloadResponse.status}`);
    }

    // Read the first chunk of text
    // Settlement reports are usually flat files (TSV/CSV)
    // Sometimes compressed? The docInfo usually says 'compressionAlgorithm'.
    
    let text = '';
    if (docInfo.compressionAlgorithm === 'GZIP') {
        console.log('Report is GZIP compressed. Decompressing...');
        const gunzip = createGunzip();
        downloadResponse.body.pipe(gunzip);
        
        for await (const chunk of gunzip) {
            text += chunk.toString();
            if (text.length > 10000) break; // Just read first 10KB
        }
    } else {
        text = await downloadResponse.text();
        text = text.substring(0, 10000);
    }

    console.log('--- REPORT PREVIEW ---');
    console.log(text.substring(0, 2000)); // Print first 2000 chars
    console.log('----------------------');

    // Check for "Shipping" or "Label"
    if (text.includes('Shipping') || text.includes('Label')) {
        console.log('FOUND "Shipping" or "Label" in the report!');
    } else {
        console.log('Did NOT find "Shipping" or "Label" in the first 10KB.');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkSettlementReportContent();
