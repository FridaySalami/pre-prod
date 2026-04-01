
import { getLinnworksAuth, callLinnworksApi } from './src/lib/server/linnworksClient.server.js';
import { getStockItemsBySku, getExtendedProperties } from './src/lib/server/linnworksClient.server.js';

async function testSymmetry() {
    try {
        const sku = 'CAL01 - 015';
        console.log(`--- Testing Specific SKU: ${sku} ---`);
        
        // 1. Get StockItem
        const items = await getStockItemsBySku([sku]);
        console.log('Stock Item Data:', JSON.stringify(items, null, 2));

        if (items && items.length > 0) {
            const stockItemId = items[0].StockItemId;
            
            // 2. Get Extended Properties
            const props = await getExtendedProperties([stockItemId]);
            console.log('Extended Properties:', JSON.stringify(props, null, 2));
        }

        console.log('\n--- Metadata Tests ---');
        // Inventory version
        const invNames = await callLinnworksApi('Inventory/GetExtendedPropertyNames', 'GET');
        console.log('Inventory Prop Names:', JSON.stringify(invNames, null, 2));

        // Orders version (as requested by user)
        const orderNames = await callLinnworksApi('Orders/GetExtendedPropertyNames', 'GET');
        console.log('Order Prop Names:', JSON.stringify(orderNames, null, 2));

    } catch (error) {
        console.error('Test Failed:', error);
    }
}

testSymmetry();
