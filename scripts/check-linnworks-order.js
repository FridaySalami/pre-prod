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

async function authenticate() {
  try {
    console.log('Authenticating with Linnworks...');
    const authResponse = await fetch('https://api.linnworks.net/api/Auth/AuthorizeByApplication', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ApplicationId: env.LINNWORKS_APP_ID,
        ApplicationSecret: env.LINNWORKS_APP_SECRET,
        Token: env.LINNWORKS_ACCESS_TOKEN
      })
    });

    if (!authResponse.ok) {
      throw new Error(`Auth Failed: ${authResponse.statusText}`);
    }

    return await authResponse.json();
  } catch (error) {
    console.error('Auth Error:', error.message);
    return null;
  }
}

async function searchOrder(session) {
  try {
    console.log(`Searching for recent orders with shipping cost...`);

    const fromDate = '2025-12-15T00:00:00Z';
    const toDate = '2025-12-24T23:59:59Z';

    const searchRequest = {
      SearchTerm: "", // Empty search term to get all
      DateField: "processed",
      FromDate: fromDate,
      ToDate: toDate,
      PageNumber: 1,
      ResultsPerPage: 50,
      ExtraFields: [
        "PostalServiceCost",
        "PostageCostExTax",
        "ReferenceNum",
        "PostalServiceName"
      ]
    };

    const response = await fetch(`${session.Server}/api/ProcessedOrders/SearchProcessedOrders`, {
      method: 'POST',
      headers: {
        'Authorization': session.Token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ request: searchRequest })
    });

    if (!response.ok) {
      throw new Error(`Search Failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.ProcessedOrders && result.ProcessedOrders.Data && result.ProcessedOrders.Data.length > 0) {
      console.log(`Found ${result.ProcessedOrders.Data.length} orders.`);

      const ordersWithCost = result.ProcessedOrders.Data.filter(o => o.PostalServiceCost > 0 || o.PostageCostExTax > 0);

      if (ordersWithCost.length > 0) {
        console.log(`Found ${ordersWithCost.length} orders with shipping cost.`);
        const sample = ordersWithCost[0];
        console.log('Sample Order with Cost:');
        console.log(`Reference: ${sample.ReferenceNum}`);
        console.log(`Postal Service Cost: ${sample.PostalServiceCost}`);
        console.log(`Postage Cost Ex Tax: ${sample.PostageCostExTax}`);
        console.log(`Service: ${sample.PostalServiceName}`);
      } else {
        console.log('No orders found with shipping cost > 0.');
        // Print a sample anyway to see what fields are there
        console.log('Sample Order (No Cost):');
        console.log(JSON.stringify(result.ProcessedOrders.Data[0], null, 2));
      }

    } else {
      console.log('No recent orders found.');
    }

  } catch (error) {
    console.error('Search Error:', error.message);
  }
}

async function main() {
  const session = await authenticate();
  if (session) {
    await searchOrder(session);
  }
}

main();
