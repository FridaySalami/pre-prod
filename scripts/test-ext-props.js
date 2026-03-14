
import { callLinnworksApi } from './src/lib/server/linnworksClient.server.js';

async function test() {
    try {
        console.log('Fetching Extended Property Types...');
        const result = await callLinnworksApi('Inventory/GetExtendedPropertyTypes', 'GET');
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

test();
