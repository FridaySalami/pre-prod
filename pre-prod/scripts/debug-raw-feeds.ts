
import { getStockItemsBySku, getExtendedProperties } from './src/lib/server/linnworksClient.server.ts';

async function debugRawFeeds() {
    const sku = "CAL01 - 015";
    console.log(`--- DEBUGGING RAW FEEDS FOR SKU: ${sku} ---`);
    
    try {
        const items = await getStockItemsBySku([sku]);
        console.log("1. RAW STOCK ITEMS FETCH:");
        console.log(JSON.stringify(items, null, 2));

        if (items.length > 0 && items[0].StockItemId) {
            console.log("\n2. RAW EXTENDED PROPERTIES FETCH:");
            const props = await getExtendedProperties([items[0].StockItemId]);
            console.log(JSON.stringify(props, null, 2));
        } else {
            console.log("\n2. SKIP EXTENDED PROPERTIES: No StockItemId found.");
        }
    } catch (e) {
        console.error("DEBUG SCRIPT ERROR:", e);
    }
}

debugRawFeeds();
